import { useEffect, useState } from 'react';
import { fullName, useProfile } from '../../lib/profile';
import { enqueueScan, pendingScans, type QueuedScan } from '../../lib/offline';
import { scanWithCamera } from '../../lib/api/qr';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('az-AZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

/** İnternet olmayanda gənc üçün sadələşdirilmiş ekran: yalnız QR skan. */
export function OfflineYouth() {
  const { profile, refresh } = useProfile();
  const userId = profile?.id ?? null;
  const [items, setItems] = useState<QueuedScan[]>(() => pendingScans(userId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const update = () => setItems(pendingScans(userId));
    update();
    window.addEventListener('offline-queue-change', update);
    return () => window.removeEventListener('offline-queue-change', update);
  }, [userId]);

  const scan = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const code = await scanWithCamera();
      if (code) {
        const pending = enqueueScan(code, userId);
        setMessage(
          'Qeyd olundu. İnternet qayıdanda avtomatik göndəriləcək. Gözləyən qeyd: ' + pending,
        );
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : '';
      setMessage('Skan alınmadı. ' + text);
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-white">
        İnternet yoxdur — oflayn rejim
      </div>
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Salam, {fullName(profile)}</h1>
          <p className="mt-2 text-gray-600 leading-relaxed">
            İnternet olmasa da Gənclər Evinin QR kodunu skan edə bilərsiniz. Giriş və çıxış qeydləriniz
            cihazda saxlanılır və internet qayıdanda avtomatik sistemə göndərilir.
          </p>

          <button
            onClick={() => void scan()}
            disabled={busy || !userId}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Kamera açılır...' : 'QR kodu skan et'}
          </button>

          {message && (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
          )}

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700">Göndərilməyi gözləyən qeydlər ({items.length})</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Gözləyən qeyd yoxdur.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {items.map((q) => (
                  <li key={q.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Skan vaxtı: {formatTime(q.scanned_at)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => void retry()}
            disabled={retrying}
            className="mt-6 w-full rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {retrying ? 'Yoxlanılır...' : 'Yenidən qoşul'}
          </button>
        </div>
      </div>
    </div>
  );
}
