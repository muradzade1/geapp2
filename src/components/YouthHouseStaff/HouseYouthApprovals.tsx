import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { relativeTime } from '../../lib/api/content';

interface Props {
  houseId: string | null;
}

type YouthRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  city: string | null;
  status: 'pending' | 'rejected';
  created_at: string;
};

function ageOf(birthDate: string | null): string {
  if (!birthDate) return '';
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return `${age} yaş`;
}

/**
 * Mərkəzə qoşulmaq istəyən gənclərin qeydiyyatını Gənclər Evi özü təsdiqləyir.
 * Yalnız qeydiyyatda bu mərkəzi seçmiş gənclər görünür (yoxlama bazada aparılır).
 */
export function HouseYouthApprovals({ houseId }: Props) {
  const [rows, setRows] = useState<YouthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.rpc('house_pending_youth', { target_house: houseId });
    if (err) setError(err.message);
    else {
      setRows((data as YouthRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: YouthRow, status: 'approved' | 'rejected') => {
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.email || 'Bu gənc';
    if (status === 'rejected' && !window.confirm(`${name} rədd edilsin?`)) return;
    setBusyId(row.id);
    setError(null);
    const { error: err } = await supabase.rpc('house_set_youth_status', {
      target_id: row.id,
      new_status: status,
    });
    if (err) setError(err.message);
    else if (status === 'approved') setRows(current => current.filter(item => item.id !== row.id));
    else setRows(current => current.map(item => (item.id === row.id ? { ...item, status: 'rejected' } : item)));
    setBusyId(null);
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra gəncləri təsdiq edə biləcəksiniz.
      </div>
    );
  }

  const pending = rows.filter(row => row.status === 'pending');
  const rejected = rows.filter(row => row.status === 'rejected');

  const renderRow = (row: YouthRow) => {
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Adsız';
    const details = [ageOf(row.birth_date), row.city, row.phone].filter(Boolean).join(' · ');
    const busy = busyId === row.id;
    return (
      <div
        key={row.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{name}</p>
          {row.email && <p className="truncate text-sm text-gray-600">{row.email}</p>}
          {details && <p className="text-sm text-gray-500">{details}</p>}
          <p className="mt-0.5 text-xs text-gray-400">Qeydiyyat: {relativeTime(row.created_at)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => void decide(row, 'approved')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Təsdiq et
          </button>
          {row.status === 'pending' && (
            <button
              onClick={() => void decide(row, 'rejected')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              <X size={15} />
              Rədd et
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Gənc qeydiyyatları</h3>
          <p className="text-sm text-gray-500">Qeydiyyatda mərkəzinizi seçmiş gənclər</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yenilə
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <UserCheck className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Təsdiq gözləyən gənc yoxdur.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Təsdiq gözləyənlər ({pending.length})</p>
          {pending.map(renderRow)}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Rədd edilənlər ({rejected.length})</p>
          {rejected.map(renderRow)}
        </div>
      )}
    </div>
  );
}
