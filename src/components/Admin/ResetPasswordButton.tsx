import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  userId: string;
  /** Pəncərədə göstərilən ad (məs. "Ad Soyad"). */
  name: string;
  email?: string | null;
  /** Düymənin görünüşü: "full" mətnli, "compact" kiçik. */
  compact?: boolean;
}

/**
 * Hesaba müvəqqəti parol təyin edir (admin_reset_password).
 * Parol yalnız bir dəfə göstərilir; admin onu kopyalayıb gəncə çatdırır.
 */
export function ResetPasswordButton({ userId, name, email, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword(null);
    setError(null);
    setCopied(false);
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_reset_password', { p_user: userId });
    setBusy(false);
    if (rpcError || typeof data !== 'string') {
      setError(rpcError?.message || 'Parol sıfırlanmadı.');
      return;
    }
    setPassword(data);
  };

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* kopyalama alınmasa, parol ekranda görünür */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Müvəqqəti parol təyin et"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-600 hover:border-amber-300 hover:text-amber-700 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <KeyRound className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        Parolu sıfırla
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="text-amber-600" size={20} />
                <h3 className="font-semibold text-gray-800">Parolu sıfırla</h3>
              </div>
              <button onClick={close} disabled={busy} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">
                <strong>{name || email || 'İstifadəçi'}</strong>
                {email ? <span className="block text-xs text-gray-500">{email}</span> : null}
              </p>

              {!password ? (
                <>
                  <p className="text-sm text-gray-600">
                    Hesaba yeni müvəqqəti parol təyin ediləcək və köhnə parol keçərsiz olacaq. Cihazlardakı aktiv
                    sessiyalar bağlanacaq.
                  </p>
                  {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={close}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      İmtina
                    </button>
                    <button
                      onClick={() => void reset()}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:bg-gray-300"
                    >
                      {busy && <Loader2 size={15} className="animate-spin" />}
                      Sıfırla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
                    <p className="text-xs font-medium text-emerald-700">Yeni müvəqqəti parol</p>
                    <p className="mt-1 select-all font-mono text-xl font-bold tracking-wide text-emerald-900">{password}</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Bu parol yalnız indi göstərilir. Onu istifadəçiyə çatdırın və daxil olandan sonra Profil bölməsindən
                    dəyişməsini deyin.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void copy()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      {copied ? 'Kopyalandı' : 'Kopyala'}
                    </button>
                    <button
                      onClick={close}
                      className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Bağla
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
