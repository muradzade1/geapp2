import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ResetPasswordScreenProps {
  onDone: () => void;
  onCancel: () => void;
}

type LinkState = 'checking' | 'ready' | 'expired';

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50';

export function ResetPasswordScreen({ onDone, onCancel }: ResetPasswordScreenProps) {
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Bərpa linkindən sonra sessiyanın qurulmasını gözləyirik.
  useEffect(() => {
    let active = true;
    const markReady = () => { if (active) setLinkState('ready'); };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) markReady();
    });

    void supabase.auth.getSession().then(({ data: current }) => {
      if (current.session) markReady();
    });

    const timer = window.setTimeout(() => {
      if (active) setLinkState((state) => (state === 'checking' ? 'expired' : state));
    }, 8000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Şifrə ən azı 8 simvoldan ibarət olmalıdır.');
      return;
    }
    if (password !== confirmation) {
      setError('Şifrələr eyni deyil.');
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      if (/different from the old/i.test(updateError.message)) setError('Yeni şifrə köhnə şifrədən fərqli olmalıdır.');
      else if (/weak|pwned|compromised/i.test(updateError.message)) setError('Bu şifrə çox zəifdir. Daha güclü şifrə seçin.');
      else if (/session|jwt|expired/i.test(updateError.message)) { setLinkState('expired'); }
      else setError('Şifrəni yeniləmək mümkün olmadı. Bir az sonra yenidən cəhd edin.');
      return;
    }
    setDone(true);
  };

  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-emerald-100/40 sm:p-8">
          <img src="/Vertical-Main.png" alt="Gənclər Evləri" className="mx-auto mb-6 h-14 w-14 object-contain" />
          {children}
        </div>
      </div>
    </div>
  );

  if (linkState === 'checking') {
    return shell(
      <div className="flex flex-col items-center gap-3 py-6 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Link yoxlanılır...</p>
      </div>,
    );
  }

  if (linkState === 'expired') {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Linkin müddəti bitib</h1>
        <p className="mt-3 leading-relaxed text-gray-600">
          Şifrə yeniləmə linki köhnəlib və ya artıq istifadə olunub. Giriş səhifəsində "Şifrəni unutmusunuz?" seçərək yeni link sifariş edin.
        </p>
        <button onClick={onCancel} className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-700">
          Giriş səhifəsinə qayıt
        </button>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Şifrəniz yeniləndi</h1>
        <p className="mt-3 leading-relaxed text-gray-600">
          Yeni şifrənizlə daxil ola bilərsiniz. Mobil tətbiqdə də eyni e-poçt və yeni şifrə ilə giriş edin.
        </p>
        <button onClick={onDone} className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-700">
          Davam et
        </button>
      </div>,
    );
  }

  return shell(
    <>
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Yeni şifrə təyin edin</h1>
        <p className="mt-2 text-sm text-gray-500">Ən azı 8 simvol. Yalnız ingilis hərfləri və rəqəmlərdən istifadə etmək məsləhətdir.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">Yeni şifrə</span>
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">Şifrənin təkrarı</span>
          <input type="password" required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} />
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Şifrəni yenilə
        </button>
      </form>
    </>,
  );
}
