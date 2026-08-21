import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Power, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type HouseRow = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  manager_name: string | null;
  members: number;
  current_visitors: number;
  today_check_ins: number;
  month_visits: number;
  events_count: number;
  created_at: string;
};

const STATUS_LABEL: Record<HouseRow['status'], string> = {
  pending: 'Gözləyir',
  approved: 'Təsdiqlənib',
  rejected: 'Rədd edilib',
};

const STATUS_TONE: Record<HouseRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

/** Admin panelində Gənclər Evləri siyahısı və təsdiq axını. */
export function HousesPanel() {
  const [rows, setRows] = useState<HouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_house_summary');
    if (err) setError(err.message);
    else {
      setRows((data as HouseRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, next: HouseRow['status']) => {
    setBusyId(id);
    const { error: err } = await supabase.rpc('admin_set_house_status', {
      house_id: id,
      new_status: next,
      reason: null,
    });
    if (err) setError(err.message);
    else setRows(current => current.map(r => (r.id === id ? { ...r, status: next } : r)));
    setBusyId(null);
  };

  const toggleActive = async (row: HouseRow) => {
    setBusyId(row.id);
    const { error: err } = await supabase.rpc('admin_set_house_active', {
      house_id: row.id,
      active: !row.is_active,
    });
    if (err) setError(err.message);
    else
      setRows(current =>
        current.map(r => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)),
      );
    setBusyId(null);
  };

  const pendingCount = rows.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Qeydiyyatdan keçmiş Gənclər Evləri</h3>
          <p className="text-sm text-gray-500">
            {rows.length} mərkəz
            {pendingCount > 0 && ` · ${pendingCount} təsdiq gözləyir`}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} />
          Yenilə
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Building2 className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Hələ heç bir Gənclər Evi qeydiyyatdan keçməyib.
          </p>
        </div>
      )}

      {rows.map(row => (
        <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-gray-800">{row.name}</h4>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
                {!row.is_active && (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    Deaktiv
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {row.city}
                {row.address && ` · ${row.address}`}
              </p>
              <p className="text-sm text-gray-500">
                {[row.email, row.phone, row.manager_name].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                disabled={busyId === row.id || row.status === 'approved'}
                onClick={() => void setStatus(row.id, 'approved')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                Təsdiqlə
              </button>
              <button
                disabled={busyId === row.id || row.status === 'rejected'}
                onClick={() => void setStatus(row.id, 'rejected')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <XCircle size={15} />
                Rədd et
              </button>
              <button
                disabled={busyId === row.id}
                onClick={() => void toggleActive(row)}
                title={row.is_active ? 'Deaktiv et' : 'Aktiv et'}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300 disabled:opacity-50"
              >
                <Power size={15} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Üzv', value: row.members },
              { label: 'Hazırda', value: row.current_visitors },
              { label: 'Bu gün giriş', value: row.today_check_ins },
              { label: 'Bu ay ziyarət', value: row.month_visits },
              { label: 'Tədbir', value: row.events_count },
            ].map(cell => (
              <div key={cell.label} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-lg font-bold text-gray-800">{cell.value}</p>
                <p className="text-xs text-gray-500">{cell.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
