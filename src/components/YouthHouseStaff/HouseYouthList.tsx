import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportPdf, exportXlsx, type ExportTable } from '../../lib/exportFile';

interface Props {
  houseId: string | null;
}

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  city: string | null;
  education: string | null;
  employment_status: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  points: number;
};

type StatusFilter = 'all' | Row['status'];

const STATUS_LABEL: Record<Row['status'], string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
  suspended: 'Dayandırılıb',
};

const STATUS_TONE: Record<Row['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
  suspended: 'bg-gray-200 text-gray-700',
};

const pad = (n: number) => String(n).padStart(2, '0');

function fmtDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ageOf(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

const fullName = (row: Row) => `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Adsız';

/** Gənclər Evinin öz gənclərinin siyahısı: axtarış, filtrlər, Excel/PDF ixracı. */
export function HouseYouthList({ houseId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [houseName, setHouseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [gender, setGender] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [list, house] = await Promise.all([
      supabase.rpc('house_youth_list', { target_house: houseId }),
      supabase.from('youth_houses').select('name').eq('id', houseId).maybeSingle(),
    ]);
    if (list.error) setError(list.error.message);
    else {
      setRows((list.data as Row[]) ?? []);
      setError(null);
    }
    setHouseName((house.data as { name?: string } | null)?.name ?? '');
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(row => {
      if (status !== 'all' && row.status !== status) return false;
      if (gender && (row.gender ?? '') !== gender) return false;
      const created = row.created_at.slice(0, 10);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo && created > dateTo) return false;
      if (!q) return true;
      return [fullName(row), row.email, row.phone, row.city].some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, status, gender, dateFrom, dateTo]);

  const hasFilters = Boolean(search || status !== 'all' || gender || dateFrom || dateTo);

  const buildTable = (): ExportTable => {
    const info = [
      houseName ? `Gənclər Evi: ${houseName}` : '',
      `Tarix: ${fmtDate(new Date().toISOString())}`,
      `Cəmi: ${filtered.length} gənc`,
      status !== 'all' ? `Status: ${STATUS_LABEL[status]}` : '',
      gender ? `Cins: ${gender}` : '',
      dateFrom || dateTo ? `Qeydiyyat tarixi: ${dateFrom ? fmtDate(dateFrom) : '...'} – ${dateTo ? fmtDate(dateTo) : '...'}` : '',
      search.trim() ? `Axtarış: ${search.trim()}` : '',
    ].filter(Boolean);
    return {
      fileName: `Gənclər${houseName ? ' ' + houseName : ''}`,
      title: 'Gənclərin siyahısı',
      info,
      columns: [
        { header: '№', width: 4 },
        { header: 'Ad Soyad', width: 22 },
        { header: 'Doğum tarixi', width: 11 },
        { header: 'Yaş', width: 5 },
        { header: 'Cins', width: 8 },
        { header: 'Telefon', width: 13 },
        { header: 'E-poçt', width: 24 },
        { header: 'Şəhər/Rayon', width: 13 },
        { header: 'Təhsil', width: 16 },
        { header: 'Məşğulluq', width: 12 },
        { header: 'Status', width: 11 },
        { header: 'Qeydiyyat', width: 11 },
        { header: 'Xal', width: 6 },
      ],
      rows: filtered.map((row, index) => [
        index + 1,
        fullName(row),
        fmtDate(row.birth_date),
        ageOf(row.birth_date),
        row.gender ?? '',
        row.phone ?? '',
        row.email ?? '',
        row.city ?? '',
        row.education ?? '',
        row.employment_status ?? '',
        STATUS_LABEL[row.status] ?? row.status,
        fmtDate(row.created_at),
        row.points,
      ]),
    };
  };

  const doExport = async (kind: 'xlsx' | 'pdf') => {
    if (filtered.length === 0) {
      setError('İxrac üçün siyahı boşdur');
      return;
    }
    setExporting(kind);
    setError(null);
    try {
      const table = buildTable();
      if (kind === 'xlsx') await exportXlsx(table);
      else await exportPdf(table);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fayl hazırlanmadı');
    }
    setExporting(null);
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra gənclərin siyahısını görə biləcəksiniz.
      </div>
    );
  }

  const input = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Gənclərin siyahısı</h3>
          <p className="text-sm text-gray-500">
            {hasFilters ? `${filtered.length} / ${rows.length}` : rows.length} gənc
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Yenilə
          </button>
          <button
            onClick={() => void doExport('xlsx')}
            disabled={exporting !== null || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {exporting === 'xlsx' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
          </button>
          <button
            onClick={() => void doExport('pdf')}
            disabled={exporting !== null || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${input} w-full pl-9`}
            placeholder="Ad, e-poçt, telefon, şəhər..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className={input} value={status} onChange={e => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Bütün statuslar</option>
          <option value="approved">Təsdiqlənib</option>
          <option value="pending">Gözləyir</option>
          <option value="rejected">Rədd edilib</option>
          <option value="suspended">Dayandırılıb</option>
        </select>
        <select className={input} value={gender} onChange={e => setGender(e.target.value)}>
          <option value="">Bütün cinslər</option>
          <option value="kişi">Kişi</option>
          <option value="qadın">Qadın</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className={`${input} w-full`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Qeydiyyat tarixi: başlanğıc" />
          <input type="date" className={`${input} w-full`} value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Qeydiyyat tarixi: son" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Users className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">{rows.length === 0 ? 'Mərkəzə bağlı gənc yoxdur.' : 'Filtrə uyğun gənc tapılmadı.'}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(row => {
          const age = ageOf(row.birth_date);
          const details = [age !== null ? `${age} yaş` : '', row.gender ?? '', row.city ?? '', row.phone ?? ''].filter(Boolean).join(' · ');
          return (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{fullName(row)}</p>
                {row.email && <p className="truncate text-sm text-gray-600">{row.email}</p>}
                {details && <p className="text-xs text-gray-500">{details}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{row.points} xal</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
