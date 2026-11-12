import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Row = { event_id: string; title: string; starts_at: string; ends_at: string; status: string; certificate_enabled: boolean; attended: number };

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (v: string) => {
  const d = new Date(v);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** Rəhbər üçün: hansı tədbirlər üzrə iştirakçılara sertifikat verilsin. */
export default function HouseCertificates({ houseId }: { houseId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase.rpc('house_events_certificates', { p_house: houseId });
    if (err) setError(err.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: Row) => {
    const { error: err } = await supabase.rpc('set_event_certificate', { p_event: row.event_id, p_enabled: !row.certificate_enabled });
    if (err) setError(err.message);
    else await load();
  };

  if (!houseId) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">Mərkəz təsdiqləndikdən sonra sertifikatları idarə edə biləcəksiniz.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Sertifikatlar</h3>
        <p className="text-sm text-gray-500">Tədbir bitdikdən sonra QR ilə iştirakı təsdiqlənmiş gənclər "Sertifikatlarım" bölməsindən PDF yükləyə bilir. Yeni tədbirlərdə sertifikat avtomatik açıqdır.</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">Tədbir yoxdur.</p>}
      {rows.map(row => (
        <div key={row.event_id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{row.title}</p>
            <p className="text-xs text-gray-500">
              {fmt(row.starts_at)} · iştirak edən: {row.attended}
              {new Date(row.ends_at) > new Date() ? ' · hələ bitməyib' : ''}
            </p>
          </div>
          <button
            onClick={() => void toggle(row)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${row.certificate_enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {row.certificate_enabled ? 'Sertifikat var' : 'Sertifikat yoxdur'}
          </button>
        </div>
      ))}
    </div>
  );
}
