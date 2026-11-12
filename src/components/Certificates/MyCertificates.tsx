import { useCallback, useEffect, useState } from 'react';
import { Award, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportCertificatePdf } from '../../lib/exportFile';

type Cert = { attendance_id: string; event_id: string; event_title: string; event_date: string; house_name: string | null; full_name: string; code: string };

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (v: string) => {
  const d = new Date(v);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** Gənc üçün: iştirak etdiyi tədbirlər üzrə sertifikatlar (PDF). */
export default function MyCertificates() {
  const [rows, setRows] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('my_certificates');
    if (err) setError(err.message);
    else setRows((data as Cert[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (c: Cert) => {
    setBusy(c.attendance_id);
    setError(null);
    try {
      await exportCertificatePdf({
        fullName: c.full_name,
        eventTitle: c.event_title,
        eventDate: fmt(c.event_date),
        houseName: c.house_name ?? '',
        code: c.code,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sertifikat yaradıla bilmədi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Sertifikatlarım</h2>
        <p className="text-sm text-gray-500">Qatıldığınız tədbirlər bitdikdən sonra sertifikat burada görünür.</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}
      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          Hələ sertifikat yoxdur. Tədbirə QR ilə qatılıb tədbir bitdikdən sonra burada görünəcək.
        </div>
      )}
      {rows.map(c => (
        <div key={c.attendance_id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Award size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900">{c.event_title}</p>
            <p className="text-xs text-gray-500">
              {fmt(c.event_date)}
              {c.house_name ? ` · ${c.house_name}` : ''} · {c.code}
            </p>
          </div>
          <button
            onClick={() => void download(c)}
            disabled={busy === c.attendance_id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Download size={14} /> {busy === c.attendance_id ? '...' : 'PDF'}
          </button>
        </div>
      ))}
    </div>
  );
}
