import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useMemo, useState } from 'react';
import { ArrowLeft, Building2, GraduationCap, KeyRound, Loader2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { YOUTH_HOUSES } from '../../data/youthHouseList';

type AccountRole = 'youth' | 'trainer' | 'youth_house' | 'admin';
type Screen = 'login' | 'register-choice' | 'register-form';

interface AuthFlowProps {
  initialRole: AccountRole;
  onBack: () => void;
}

const labels: Record<AccountRole, string> = {
  youth: 'Gənclər üçün giriş',
  trainer: 'Təlimçi girişi',
  youth_house: 'Gənclər Evi girişi',
  admin: 'Admin girişi',
};

const roleOptions = [
  { role: 'youth' as const, title: 'Gənc', description: 'Tədbirlərə qoşulun, xal toplayın və inkişaf edin.', icon: Users, tone: 'emerald' },
  { role: 'trainer' as const, title: 'Təlimçi', description: 'Təlimlərinizi və iştirakçıları idarə edin.', icon: GraduationCap, tone: 'amber' },
  { role: 'youth_house' as const, title: 'Gənclər Evi', description: 'Mərkəzinizin fəaliyyətini vahid paneldən idarə edin.', icon: Building2, tone: 'blue' },
];

function Field({ label, name, type = 'text', required = true, value, onChange, placeholder, children }: { label: string; name: string; type?: string; required?: boolean; value: string; onChange: (value: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      {children ?? <input name={name} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" />}
    </label>
  );
}

function setValue(setter: Dispatch<SetStateAction<Record<string, string>>>, name: string) {
  return (value: string) => setter((current) => ({ ...current, [name]: value }));
}

export function AuthFlow({ initialRole, onBack }: AuthFlowProps) {
  const [screen, setScreen] = useState<Screen>('login');
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = role === 'admin';

  const formTitle = useMemo(() => roleOptions.find((option) => option.role === role)?.title ?? '', [role]);

  const resetFeedback = () => {
    setMessage('');
    setError('');
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setBusy(true);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: (values.email ?? '').trim(),
      password: values.password ?? '',
    });
    if (signInError || !signInData.session) {
      setBusy(false);
      setError('E-poçt və ya şifrə düzgün deyil.');
      return;
    }
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', signInData.session.user.id)
      .maybeSingle();
    if (!profileRow) {
      await supabase.auth.signOut();
      setBusy(false);
      setError('Hesab məlumatları tapılmadı.');
      return;
    }
    if (profileRow.role !== 'admin' && profileRow.status !== 'approved') {
      await supabase.auth.signOut();
      setBusy(false);
      if (profileRow.status === 'pending') setError('Hesabınız hələ administrator tərəfindən təsdiqlənməyib.');
      else if (profileRow.status === 'rejected') setError('Qeydiyyatınız administrator tərəfindən təsdiqlənməyib.');
      else setError('Hesabınız müvəqqəti olaraq dayandırılıb.');
      return;
    }
    setBusy(false);
  };

  const resetPassword = async () => {
    if (!(values.email ?? '').trim()) {
      setError('Şifrəni yeniləmək üçün e-poçt ünvanınızı daxil edin.');
      return;
    }
    resetFeedback();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(values.email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    setMessage('Bu e-poçt qeydiyyatlıdırsa, şifrəni yeniləmə məlumatı göndərildi.');
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();
    if ((values.password ?? '').length < 8) {
      setError('Şifrə ən azı 8 simvoldan ibarət olmalıdır.');
      return;
    }
    if (values.password !== values.passwordConfirmation) {
      setError('Şifrələr eyni deyil.');
      return;
    }
    setBusy(true);
    const payload = {
      role,
      email: values.email ?? '',
      password: values.password ?? '',
      firstName: values.firstName ?? '',
      lastName: values.lastName ?? '',
      phone: values.phone,
      city: values.city,
      address: values.address,
      birthDate: values.birthDate,
      youthHouseName: values.youthHouseName,
      specialization: values.specialization,
      teachingDirection: values.teachingDirection,
      workplace: values.workplace,
      workExperience: values.workExperience,
      bio: values.bio,
      houseName: values.houseName,
      responsibleName: values.responsibleName,
      responsibleEmail: values.responsibleEmail,
    };
    const { error: registrationError } = await supabase.functions.invoke('register-platform-account', { body: payload });
    setBusy(false);
    if (registrationError) {
      setError('Qeydiyyatı tamamlamaq mümkün olmadı. Məlumatları yoxlayıb yenidən cəhd edin.');
      return;
    }
    setMessage('Qeydiyyatınız uğurla tamamlandı. Administrator tərəfindən təsdiq edildikdən sonra hesabınıza daxil ola biləcəksiniz.');
    setValues({ email: values.email ?? '' });
    setScreen('login');
    setRole(role);
  };

  const houseSelect = (label: string, name: string) => (
    <Field key={name} label={label} name={name} value={values[name] ?? ''} onChange={setValue(setValues, name)}>
      <select
        name={name}
        required
        value={values[name] ?? ''}
        onChange={(event) => setValue(setValues, name)(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
      >
        <option value="">Seçin...</option>
        {YOUTH_HOUSES.map((house) => (
          <option key={house.name} value={house.name}>
            {house.name} — {house.area}
          </option>
        ))}
      </select>
    </Field>
  );

  const input = (label: string, name: string, type = 'text', required = true, placeholder?: string) => <Field key={name} label={label} name={name} type={type} required={required} value={values[name] ?? ''} onChange={setValue(setValues, name)} placeholder={placeholder} />;

  const renderRegistrationFields = () => {
    const common = <>
      <div className="grid gap-4 sm:grid-cols-2">{input('Ad', 'firstName')}{input('Soyad', 'lastName')}</div>
      <div className="grid gap-4 sm:grid-cols-2">{input('E-poçt', 'email', 'email')}{input('Mobil telefon', 'phone', 'tel')}</div>
      <div className="grid gap-4 sm:grid-cols-2">{input('Şifrə', 'password', 'password')}{input('Şifrənin təkrarı', 'passwordConfirmation', 'password')}</div>
    </>;
    if (role === 'youth') return <>{common}<div className="grid gap-4 sm:grid-cols-2">{input('Doğum tarixi', 'birthDate', 'date')}{input('Şəhər/Rayon', 'city')}</div>{houseSelect('Gənclər Evi', 'youthHouseName')}</>;
    if (role === 'trainer') return <>{common}{input('İxtisas', 'specialization')}{input('Tədris istiqaməti', 'teachingDirection')}{input('İş yeri', 'workplace')}{input('İş təcrübəsi', 'workExperience')}<Field label="Qısa bio" name="bio" required={false} value={values.bio ?? ''} onChange={setValue(setValues, 'bio')}><textarea name="bio" value={values.bio ?? ''} onChange={(event) => setValue(setValues, 'bio')(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" /></Field></>;
    return <>{houseSelect('Gənclər Evinin adı', 'houseName')}{input('Şəhər/Rayon', 'city')}{input('Ünvan', 'address')}{input('Telefon', 'phone', 'tel')}{input('E-poçt', 'email', 'email')}{input('Məsul şəxsin adı və soyadı', 'responsibleName')}{input('Məsul şəxsin e-poçtu', 'responsibleEmail', 'email')}<div className="grid gap-4 sm:grid-cols-2">{input('Şifrə', 'password', 'password')}{input('Şifrənin təkrarı', 'passwordConfirmation', 'password')}</div><input type="hidden" value={values.houseName ?? ''} />{!values.firstName && <input type="hidden" />}</>;
  };

  if (screen === 'register-choice') {
    return <AuthShell onBack={onBack}>
      <div className="mb-8 text-center"><h1 className="text-2xl font-bold text-gray-900">Qeydiyyatdan keç</h1><p className="mt-2 text-gray-500">Hesab növünüzü seçin</p></div>
      <div className="space-y-3">{roleOptions.map((option) => { const Icon = option.icon; return <button key={option.role} onClick={() => { setRole(option.role); setValues({}); resetFeedback(); setScreen('register-form'); }} className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-md"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${option.tone === 'amber' ? 'bg-amber-50 text-amber-600' : option.tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}><Icon className="h-6 w-6" /></span><span><span className="block font-bold text-gray-900">{option.title}</span><span className="mt-0.5 block text-sm leading-5 text-gray-500">{option.description}</span></span></button>; })}</div>
    </AuthShell>;
  }

  if (screen === 'register-form') {
    return <AuthShell onBack={() => setScreen('register-choice')} wide>
      <div className="mb-7 text-center"><h1 className="text-2xl font-bold text-gray-900">{formTitle} qeydiyyatı</h1><p className="mt-2 text-gray-500">Məlumatlarınızı doldurun</p></div>
      <form onSubmit={register} className="space-y-4">{renderRegistrationFields()}<Feedback error={error} message={message} /><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Qeydiyyatdan keç</button></form>
    </AuthShell>;
  }

  return <AuthShell onBack={onBack}>
    <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{isAdmin ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}</div><h1 className="text-2xl font-bold text-gray-900">{labels[role]}</h1><p className="mt-2 text-sm text-gray-500">Hesab məlumatlarınızla daxil olun</p></div>
    <form onSubmit={signIn} className="space-y-4">{input(isAdmin ? 'E-poçt' : 'E-poçt və ya istifadəçi adı', 'email', 'email')}{input('Şifrə', 'password', 'password')}<Feedback error={error} message={message} /><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Daxil ol</button></form>
    {!isAdmin && <div className="mt-5 flex items-center justify-between text-sm"><button type="button" onClick={resetPassword} className="font-medium text-emerald-700 hover:text-emerald-800">Şifrəni unutmusunuz?</button><button type="button" onClick={() => { resetFeedback(); setValues({}); setScreen('register-choice'); }} className="font-medium text-emerald-700 hover:text-emerald-800">Qeydiyyatdan keç</button></div>}
  </AuthShell>;
}

function Feedback({ error, message }: { error: string; message: string }) {
  if (error) return <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>;
  if (message) return <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</p>;
  return null;
}

function AuthShell({ children, onBack, wide = false }: { children: ReactNode; onBack: () => void; wide?: boolean }) {
  return <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 px-4 py-8 sm:py-12"><div className={`mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}><button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Geri qayıt</button><div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-emerald-100/40 sm:p-8"><img src="/Vertical-Main.png" alt="Gənclər Evləri" className="mx-auto mb-6 h-14 w-14 object-contain" />{children}</div></div></div>;
}
