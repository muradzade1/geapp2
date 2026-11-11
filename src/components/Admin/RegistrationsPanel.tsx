import { useEffect, useMemo, useState } from 'react';
import { Download as ExportIcon } from 'lucide-react';
import { exportPdf, exportXlsx, type ExportTable } from '../../lib/exportFile';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCcw, Trash2, X, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PlatformProfile } from '../../lib/profile';


/** Hesabın profil şəkillərini Storage API ilə silir. */
async function removeAccountPhotos(userId: string) {
  try {
    const { data } = await supabase.storage.from('account-photos').list(userId);
    if (!data || data.length === 0) return;
    await supabase.storage
      .from('account-photos')
      .remove(data.map((file) => `${userId}/${file.name}`));
  } catch {
    // Şəkil silinməsə də hesabın silinməsi dayanmamalıdır.
  }
}

type RoleFilter = 'youth' | 'trainer' | 'youth_house';
type StatusFilter = 'pending' | 'approved' | 'rejected' | 'suspended' | 'all';

const roleLabels: Record<RoleFilter, string> = {
  youth: 'Gənclər',
  trainer: 'Təlimçilər',
  youth_house: 'Gənclər Evləri',
};

const statusLabels: Record<Exclude<StatusFilter, 'all'>, string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
  suspended: 'Dayandırılıb',
};

const statusTone: Record<Exclude<StatusFilter, 'all'>, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  suspended: 'bg-gray-200 text-gray-700',
};

export function RegistrationsPanel() {
  const [rows, setRows] = useState<PlatformProfile[]>([]);
  const [role, setRole] = useState<RoleFilter>('youth');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase.rpc('admin_list_profiles');
    if (fetchError) {
      setError('Qeydiyyatları yükləmək mümkün olmadı.');
      setRows([]);
    } else {
      setRows((data ?? []) as PlatformProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const field = (row: PlatformProfile, key: string): string => {
    const value = (row as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  };

  const houseOptions = useMemo(() => {
    const names = new Set<string>();
    rows.forEach((row) => {
      if (row.role === 'youth' && row.youth_house_name) names.add(row.youth_house_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'az'));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.role !== role) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (role === 'youth' && houseFilter && row.youth_house_name !== houseFilter) return false;
      if (role === 'youth' && genderFilter && field(row, 'gender') !== genderFilter) return false;
      const day = (row.created_at ?? '').slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (query) {
        const haystack = [row.first_name, row.last_name, row.email, row.phone, row.house_name, row.responsible_name, row.city]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, role, status, search, houseFilter, genderFilter, dateFrom, dateTo]);

  const hasFilters = Boolean(search || houseFilter || genderFilter || dateFrom || dateTo);

  const exportList = async (kind: 'xlsx' | 'pdf') => {
    if (filtered.length === 0) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtDate = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    };
    const ageOf = (iso: string): string | number => {
      if (!iso) return '';
      const born = new Date(iso);
      if (Number.isNaN(born.getTime())) return '';
      const now = new Date();
      let age = now.getFullYear() - born.getFullYear();
      const m = now.getMonth() - born.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
      return age;
    };
    const fullName = (row: PlatformProfile) => `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
    const statusText = (row: PlatformProfile) => statusLabels[row.status as Exclude<StatusFilter, 'all'>] ?? row.status;

    let columns: { header: string; width?: number }[];
    let body: (string | number)[][];
    if (role === 'youth') {
      columns = [
        { header: '№', width: 4 }, { header: 'Ad Soyad', width: 26 }, { header: 'Cins', width: 8 },
        { header: 'Doğum tarixi', width: 13 }, { header: 'Yaş', width: 5 }, { header: 'Telefon', width: 15 },
        { header: 'E-poçt', width: 30 }, { header: 'Şəhər', width: 14 }, { header: 'Gənclər Evi', width: 22 },
        { header: 'Təhsil', width: 24 }, { header: 'Məşğulluq', width: 14 }, { header: 'Status', width: 12 },
        { header: 'Qeydiyyat', width: 12 },
      ];
      body = filtered.map((row, i) => [
        i + 1, fullName(row), field(row, 'gender'), fmtDate(field(row, 'birth_date')), ageOf(field(row, 'birth_date')),
        row.phone ?? '', row.email ?? '', row.city ?? '', row.youth_house_name ?? '',
        row.education ?? '', row.employment_status ?? '', statusText(row), fmtDate(row.created_at),
      ]);
    } else if (role === 'trainer') {
      columns = [
        { header: '№', width: 4 }, { header: 'Ad Soyad', width: 26 }, { header: 'Telefon', width: 15 },
        { header: 'E-poçt', width: 30 }, { header: 'Şəhər', width: 14 }, { header: 'İxtisas', width: 24 },
        { header: 'İş yeri', width: 24 }, { header: 'Status', width: 12 }, { header: 'Qeydiyyat', width: 12 },
      ];
      body = filtered.map((row, i) => [
        i + 1, fullName(row), row.phone ?? '', row.email ?? '', row.city ?? '',
        row.specialization ?? '', field(row, 'workplace'), statusText(row), fmtDate(row.created_at),
      ]);
    } else {
      columns = [
        { header: '№', width: 4 }, { header: 'Mərkəz', width: 28 }, { header: 'Məsul şəxs', width: 24 },
        { header: 'Məsul e-poçt', width: 28 }, { header: 'Telefon', width: 15 }, { header: 'E-poçt', width: 28 },
        { header: 'Şəhər', width: 14 }, { header: 'Status', width: 12 }, { header: 'Qeydiyyat', width: 12 },
      ];
      body = filtered.map((row, i) => [
        i + 1, row.house_name ?? '', row.responsible_name ?? '', field(row, 'responsible_email'),
        row.phone ?? '', row.email ?? '', row.city ?? '', statusText(row), fmtDate(row.created_at),
      ]);
    }

    const info = [
      `Status: ${status === 'all' ? 'Hamısı' : statusLabels[status]}`,
      ...(role === 'youth' && houseFilter ? [`Gənclər Evi: ${houseFilter}`] : []),
      ...(role === 'youth' && genderFilter ? [`Cins: ${genderFilter}`] : []),
      ...(dateFrom || dateTo ? [`Qeydiyyat tarixi: ${dateFrom || '...'} — ${dateTo || '...'}`] : []),
      ...(search.trim() ? [`Axtarış: ${search.trim()}`] : []),
      `Say: ${filtered.length}`,
      `Hazırlanma tarixi: ${fmtDate(new Date().toISOString())}`,
    ];
    const table: ExportTable = { fileName: roleLabels[role], title: roleLabels[role], info, columns, rows: body };
    setExporting(kind);
    try {
      if (kind === 'xlsx') await exportXlsx(table);
      else await exportPdf(table);
    } catch (err) {
      setError(err instanceof Error ? `Fayl hazırlanmadı: ${err.message}` : 'Fayl hazırlanmadı');
    } finally {
      setExporting(null);
    }
  };

  const counts = useMemo(() => {
    const byRole = { youth: 0, trainer: 0, youth_house: 0 } as Record<RoleFilter, number>;
    rows.forEach((row) => {
      if (row.role !== 'admin' && row.status === 'pending') {
        byRole[row.role as RoleFilter] = (byRole[row.role as RoleFilter] ?? 0) + 1;
      }
    });
    return byRole;
  }, [rows]);

  const [deleteTarget, setDeleteTarget] = useState<PlatformProfile | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editTarget, setEditTarget] = useState<PlatformProfile | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = (row: PlatformProfile) => {
    setEditTarget(row);
    setEditFirstName(row.first_name ?? '');
    setEditLastName(row.last_name ?? '');
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const firstName = editFirstName.trim();
    const lastName = editLastName.trim();
    if (!firstName || !lastName) {
      setEditError('Ad və soyad boş ola bilməz.');
      return;
    }

    setSaving(true);
    setEditError(null);

    const { error: rpcError } = await supabase.rpc('admin_update_profile_name', {
      target_id: editTarget.id,
      new_first_name: firstName,
      new_last_name: lastName,
    });

    if (rpcError) {
      setEditError(rpcError.message);
      setSaving(false);
      return;
    }

    setRows((current) => current.map((row) => row.id === editTarget.id ? { ...row, first_name: firstName, last_name: lastName } : row));
    setEditTarget(null);
    setSaving(false);
  };

  const deleteAccount = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    await removeAccountPhotos(deleteTarget.id);

    const { error: rpcError } = await supabase.rpc('admin_delete_account', {
      target_id: deleteTarget.id,
    });

    if (rpcError) {
      setDeleteError(rpcError.message);
      setDeleting(false);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
    setDeleteTarget(null);
    setConfirmWord('');
    setDeleting(false);
  };

  const updateStatus = async (id: string, nextStatus: 'approved' | 'rejected') => {
    setPendingIds((current) => new Set(current).add(id));
    const { error: updateError } = await supabase.rpc('admin_set_profile_status', { target_id: id, new_status: nextStatus });
    if (!updateError) {
      setRows((current) => current.map((row) => row.id === id ? { ...row, status: nextStatus } : row));
    }
    setPendingIds((current) => {
      const copy = new Set(current);
      copy.delete(id);
      return copy;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Qeydiyyatlar</h2>
          <p className="text-sm text-gray-500">Yeni müraciətləri təsdiqləyin və ya rədd edin.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCcw className="h-4 w-4" />Yenilə
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(roleLabels) as RoleFilter[]).map((key) => (
          <button key={key} onClick={() => setRole(key)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${role === key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300'}`}>
            {roleLabels[key]}
            {counts[key] > 0 && <span className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${role === key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'suspended', 'all'] as StatusFilter[]).map((key) => (
          <button key={key} onClick={() => setStatus(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${status === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
            {key === 'all' ? 'Hamısı' : statusLabels[key]}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ad, e-poçt, telefon və ya şəhər üzrə axtar"
            className="min-w-[14rem] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {role === 'youth' && (
            <select
              value={houseFilter}
              onChange={(event) => setHouseFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Bütün Gənclər Evləri</option>
              {houseOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          {role === 'youth' && (
            <select
              value={genderFilter}
              onChange={(event) => setGenderFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Cins: hamısı</option>
              <option value="kişi">Kişi</option>
              <option value="qadın">Qadın</option>
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-gray-500">
            Qeydiyyat tarixi (başlanğıc)
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Qeydiyyat tarixi (son)
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800"
            />
          </label>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setHouseFilter(''); setGenderFilter(''); setDateFrom(''); setDateTo(''); }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
            >
              Filtrləri təmizlə
            </button>
          )}
          <span className="ml-auto text-sm text-gray-500">Tapıldı: <strong className="text-gray-800">{filtered.length}</strong></span>
          <button
            onClick={() => void exportList('xlsx')}
            disabled={exporting !== null || filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExportIcon className="h-4 w-4" />}
            Excel
          </button>
          <button
            onClick={() => void exportList('pdf')}
            disabled={exporting !== null || filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExportIcon className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Yüklənir...</div>
        ) : error ? (
          <div className="px-6 py-10 text-center"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Yenidən cəhd et</button></div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">Məlumat yoxdur.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((row) => {
              const displayName = row.role === 'youth_house' ? (row.house_name ?? '—') : `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—';
              const isBusy = pendingIds.has(row.id);
              return (
                <div key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{displayName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[row.status]}`}>{statusLabels[row.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{row.email || '—'}{row.phone ? ` · ${row.phone}` : ''}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {row.city ? `${row.city} · ` : ''}
                      {new Date(row.created_at).toLocaleDateString('az-AZ')}
                      {row.role === 'trainer' && row.specialization ? ` · ${row.specialization}` : ''}
                      {row.role === 'youth' && row.youth_house_name ? ` · ${row.youth_house_name}` : ''}
                      {row.role === 'youth_house' && row.responsible_name ? ` · ${row.responsible_name}` : ''}
                    </p>
                    {(row.role === 'youth' || row.role === 'trainer') && (row.education || row.employment_status) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {row.education ? `Təhsil: ${row.education}` : ''}
                        {row.education && row.employment_status ? ' · ' : ''}
                        {row.employment_status ? `Məşğulluq: ${row.employment_status}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button disabled={isBusy || row.status === 'approved'} onClick={() => void updateStatus(row.id, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" />Təsdiqlə
                    </button>
                    <button disabled={isBusy || row.status === 'rejected'} onClick={() => void updateStatus(row.id, 'rejected')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <XCircle className="h-4 w-4" />Rədd et
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => openEdit(row)}
                      title="Ad/soyadı redaktə et"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />Redaktə
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => { setDeleteTarget(row); setConfirmWord(''); setDeleteError(null); }}
                      title="Hesabı həmişəlik sil"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-500 hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="text-emerald-600" size={20} />
                <h3 className="font-semibold text-gray-800">Ad/soyadı redaktə et</h3>
              </div>
              <button onClick={() => setEditTarget(null)} disabled={saving} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">Ad</span>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(event) => setEditFirstName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">Soyad</span>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(event) => setEditLastName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              {editError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEditTarget(null)}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  İmtina
                </button>
                <button
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  Yadda saxla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-600" size={20} />
                <h3 className="font-semibold text-gray-800">Hesabı silmək</h3>
              </div>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">
                <strong>
                  {deleteTarget.role === 'youth_house'
                    ? (deleteTarget.house_name ?? 'Gənclər Evi')
                    : `${deleteTarget.first_name ?? ''} ${deleteTarget.last_name ?? ''}`.trim() || deleteTarget.email}
                </strong>{' '}
                hesabı və ona bağlı bütün məlumatlar həmişəlik silinir. Bu əməliyyat geri qaytarılmır.
              </p>

              {deleteTarget.role === 'youth_house' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Diqqət: bu hesabın Gənclər Evi qeydi, həmin mərkəzin bütün ziyarət
                  və tədbir tarixçəsi ilə birlikdə silinəcək.
                </div>
              )}

              <p className="text-sm text-gray-600">
                Davam etmək üçün aşağıya <strong>SİL</strong> yazın.
              </p>

              <input
                type="text"
                value={confirmWord}
                onChange={(event) => setConfirmWord(event.target.value)}
                placeholder="SİL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />

              {deleteError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  İmtina
                </button>
                <button
                  onClick={() => void deleteAccount()}
                  disabled={deleting || confirmWord.trim().toUpperCase() !== 'SİL'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-gray-300"
                >
                  {deleting && <Loader2 size={15} className="animate-spin" />}
                  Həmişəlik sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
