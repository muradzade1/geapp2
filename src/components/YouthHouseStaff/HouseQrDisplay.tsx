import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, QrCode, AlertCircle, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { rotateHouseQr } from '../../lib/api/house';

interface Props {
  houseId: string | null;
  houseName?: string;
}

type ActiveCode = {
  code: string;
  valid_until: string | null;
};

/**
 * Girişdə göstərilən QR kod.
 *
 * Kod bazada saxlanılır; bu ekran yalnız onu şəkilə çevirir. Yeniləmə
 * düyməsi köhnə kodu deaktiv edib yenisini yaradır — kodun şəkli
 * paylaşılarsa, bir kliklə etibarsız edilə bilər.
 */
export function HouseQrDisplay({ houseId, houseName }: Props) {
  const [code, setCode] = useState<ActiveCode | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(async (value: string) => {
    const url = await QRCode.toDataURL(value, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    setImage(url);
  }, []);

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: err } = await supabase
      .from('house_qr_codes')
      .select('code, valid_until')
      .eq('house_id', houseId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
    } else if (data) {
      setCode(data as ActiveCode);
      await draw((data as ActiveCode).code);
      setError(null);
    } else {
      setCode(null);
      setImage(null);
      setError(null);
    }
    setLoading(false);
  }, [houseId, draw]);

  useEffect(() => {
    void load();
  }, [load]);

  const rotate = async () => {
    if (!houseId) return;
    setBusy(true);
    try {
      const fresh = await rotateHouseQr(houseId);
      setCode({ code: fresh, valid_until: null });
      await draw(fresh);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod yaradıla bilmədi');
    } finally {
      setBusy(false);
    }
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra QR kod yaradıla biləcək.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mb-1 flex items-center justify-center gap-2 text-gray-800">
          <QrCode size={20} />
          <h3 className="text-lg font-semibold">Giriş-Çıxış QR kodu</h3>
        </div>
        {houseName && <p className="mb-5 text-sm text-gray-500">{houseName}</p>}

        {loading && <p className="py-12 text-sm text-gray-500">Yüklənir...</p>}

        {!loading && !image && (
          <div className="py-10">
            <p className="mb-4 text-sm text-gray-600">
              Hələ kod yaradılmayıb. Gənclərin skan edə bilməsi üçün kod yaradın.
            </p>
          </div>
        )}

        {!loading && image && (
          <>
            <img
              src={image}
              alt="Gənclər Evi QR kodu"
              className="mx-auto w-full max-w-[280px] rounded-xl border border-gray-100"
            />
            {code?.valid_until && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
                <Clock size={13} />
                Etibarlıdır: {new Date(code.valid_until).toLocaleString('az-AZ')}
              </p>
            )}
          </>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm text-rose-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={() => void rotate()}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          {image ? 'Yeni kod yarat' : 'Kod yarat'}
        </button>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Kodu girişdə ekranda və ya çap edilmiş şəkildə yerləşdirin. Gənc birinci
        skanda giriş, ikinci skanda çıxış edir — ayrıca düymə seçmir.
      </div>
    </div>
  );
}
