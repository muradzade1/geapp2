import { useState } from 'react';
import { ScanLine, LogIn, LogOut, AlertCircle, Loader2 } from 'lucide-react';
import { scanQr, scanWithCamera, type ScanResult } from '../../lib/api/qr';

/**
 * Gənclər Evinə giriş-çıxış üçün skan kartı.
 *
 * Bir düymə həm girişi, həm çıxışı idarə edir — nəticəni server qaytarır.
 */
export function HouseScanCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const code = await scanWithCamera();
      if (!code) {
        setBusy(false);
        return;
      }
      setResult(await scanQr(code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skan alınmadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-center text-lg font-semibold text-gray-800">
        Gənclər Evinə giriş-çıxış
      </h3>
      <p className="mb-5 text-center text-sm text-gray-500">
        Girişdəki QR kodu skan edin. Birinci skan giriş, ikinci skan çıxışdır.
      </p>

      <button
        onClick={() => void run()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={20} className="animate-spin" /> : <ScanLine size={20} />}
        {busy ? 'Skan edilir...' : 'QR kodu skan et'}
      </button>

      {result && (
        <div
          className={`mt-5 rounded-xl border px-4 py-4 ${
            result.direction === 'in'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.direction === 'in' ? (
              <LogIn className="text-emerald-600" size={20} />
            ) : (
              <LogOut className="text-blue-600" size={20} />
            )}
            <p className="font-semibold text-gray-800">
              {result.direction === 'in' ? 'Giriş qeydə alındı' : 'Çıxış qeydə alındı'}
            </p>
          </div>
          <p className="mt-1 text-sm text-gray-700">{result.house_name}</p>
          <p className="text-sm text-gray-500">
            {new Date(result.at).toLocaleTimeString('az-AZ', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {result.direction === 'out' &&
              result.duration_minutes != null &&
              ` · ${result.duration_minutes} dəqiqə qaldınız`}
          </p>
          {result.direction === 'out' && (
            <p className="mt-2 text-sm font-medium text-emerald-700">
              Ziyarətə görə xal hesabınıza əlavə olundu.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
