import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/profile';


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

const CONFIRM_WORD = 'SİL';

/**
 * Hesabın silinməsi.
 *
 * Google Play tətbiq daxilində silmə imkanını tələb edir. Silmə geri
 * qaytarılmadığı üçün istifadəçidən təsdiq sözü yazması istənilir.
 */
export function DeleteAccountCard() {
  const { signOut } = useProfile();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc('can_delete_my_account').then(({ data, error: err }) => {
      if (err) {
        setAllowed(false);
        setReason(err.message);
        return;
      }
      const result = data as { allowed: boolean; reason: string | null };
      setAllowed(result.allowed);
      setReason(result.reason);
    });
  }, []);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getUser();
      if (session.user?.id) await removeAccountPhotos(session.user.id);

      const { error: err } = await supabase.rpc('delete_my_account');
      if (err) throw new Error(err.message);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesab silinmədi');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-rose-100 p-2.5">
            <Trash2 className="text-rose-600" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-800">Hesabı sil</h3>
            <p className="mt-1 text-sm text-gray-600">
              Hesabınız və bütün şəxsi məlumatlarınız — profil, ziyarət tarixçəsi,
              tədbir qeydləri, xallar və rəylər — həmişəlik silinir. Bu əməliyyat
              geri qaytarılmır.
            </p>

            {allowed === false && reason && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {reason}
              </div>
            )}

            <button
              onClick={() => {
                setOpen(true);
                setWord('');
                setError(null);
              }}
              disabled={allowed !== true}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Trash2 size={15} />
              Hesabı sil
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-600" size={20} />
                <h3 className="font-semibold text-gray-800">Hesabı silmək istəyirsiniz?</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">
                Silindikdən sonra məlumatlarınızı bərpa etmək mümkün olmayacaq.
                Davam etmək üçün aşağıya <strong>{CONFIRM_WORD}</strong> yazın.
              </p>

              <input
                type="text"
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  İmtina
                </button>
                <button
                  onClick={() => void remove()}
                  disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-gray-300"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />}
                  Həmişəlik sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
