import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { fetchEventToken, secondsLeft } from '../../lib/api/checkin';

/**
 * Tədbir iştirakı üçün gəncin şəxsi kodu.
 *
 * Kod bir neçə dəqiqə yaşayır və vaxtı bitəndə özü yenilənir — ekran şəklinin
 * sonradan istifadə edilməsinin qarşısını alır.
 */
export function EventTokenCard() {
  const [image, setImage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Yenilənmə döngüsünün təkrarlanmaması üçün.
  const refreshing = useRef(false);

  const load = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);

    try {
      const result = await fetchEventToken(5);
      const url = await QRCode.toDataURL(result.token, {
        width: 560,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#065f46', light: '#ffffff' },
      });
      setImage(url);
      setExpiresAt(result.expires_at);
      setRemaining(secondsLeft(result.expires_at));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod alınmadı');
    } finally {
      setLoading(false);
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Geri sayım; vaxt bitəndə yeni kod istənilir.
  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const left = secondsLeft(expiresAt);
      setRemaining(left);
      if (left === 0) void load();
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, load]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <div className="mb-1 flex items-center justify-center gap-2 text-gray-800">
        <CalendarCheck size={20} />
        <h3 className="text-lg font-semibold">Tədbir iştirakı üçün kodunuz</h3>
      </div>
      <p className="mb-5 text-sm text-gray-500">
        Tədbirdə təlimçiyə və ya əməkdaşa göstərin — iştirakınız qeyd olunacaq.
      </p>

      {loading && !image && (
        <p className="py-12 text-sm text-gray-500">Yüklənir...</p>
      )}

      {image && (
        <>
          <img
            src={image}
            alt="Tədbir iştirakı kodu"
            className="mx-auto w-full max-w-[240px] rounded-xl border border-gray-100"
          />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <Clock size={13} />
            {remaining > 0
              ? `Kod ${minutes}:${String(seconds).padStart(2, '0')} sonra yenilənir`
              : 'Yenilənir...'}
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm text-rose-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={() => void load()}
        disabled={loading}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 disabled:opacity-60"
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        Yeni kod
      </button>
    </div>
  );
}
