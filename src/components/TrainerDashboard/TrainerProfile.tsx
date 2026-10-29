import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  BookOpen,
  Camera,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  User,
  X,
} from 'lucide-react';
import { fullName, useProfile } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { DeleteAccountCard } from '../Profile/DeleteAccountCard';

const EDUCATION_OPTIONS = [
  'Orta təhsil',
  'Peşə təhsili',
  'Orta ixtisas təhsili',
  'Ali təhsil (bakalavriat)',
  'Ali təhsil (magistratura)',
  'Formal təhsil almamışam',
];
const EMPLOYMENT_OPTIONS = ['İşləyirəm', 'Sahibkaram', 'İşləmirəm'];

type FormState = {
  fullName: string;
  phone: string;
  city: string;
  education: string;
  employmentStatus: string;
  specialization: string;
  teachingDirection: string;
  workplace: string;
  workExperience: string;
  bio: string;
};

export function TrainerProfile() {
  const { profile, avatarUrl, refresh } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(profile));

  function toForm(p: typeof profile): FormState {
    return {
      fullName: fullName(p),
      phone: p?.phone ?? '',
      city: p?.city ?? '',
      education: p?.education ?? '',
      employmentStatus: p?.employment_status ?? '',
      specialization: p?.specialization ?? '',
      teachingDirection: p?.teaching_direction ?? '',
      workplace: p?.workplace ?? '',
      workExperience: p?.work_experience ?? '',
      bio: p?.bio ?? '',
    };
  }

  useEffect(() => {
    if (!editing) setForm(toForm(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, editing]);

  if (!profile) return null;

  const set = (key: keyof FormState) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const save = async () => {
    const parts = form.fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      setError('Ad və soyad boş ola bilməz.');
      return;
    }
    setSaving(true);
    setError(null);
    const [firstName, ...rest] = parts;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: rest.join(' '),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        education: form.education || null,
        employment_status: form.employmentStatus || null,
        specialization: form.specialization.trim() || null,
        teaching_direction: form.teachingDirection.trim() || null,
        workplace: form.workplace.trim() || null,
        work_experience: form.workExperience.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) {
      setError('Məlumatlar yadda saxlanmadı. Bir az sonra yenidən cəhd edin.');
      return;
    }
    await refresh();
    setEditing(false);
  };

  const cancel = () => {
    setForm(toForm(profile));
    setError(null);
    setEditing(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Yalnız şəkil faylı seçin.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Şəkil 5 MB-dan böyük olmamalıdır.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('account-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
      if (updateError) throw updateError;
      await refresh();
    } catch {
      setError('Şəkil yüklənmədi. Bir az sonra yenidən cəhd edin.');
    } finally {
      setUploading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
  const viewClass = 'rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-900';

  const textField = (label: string, key: keyof FormState, icon: React.ReactNode, type = 'text') => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </label>
      {editing ? (
        <input type={type} value={form[key]} onChange={e => set(key)(e.target.value)} className={inputClass} />
      ) : (
        <p className={viewClass}>{form[key] || '—'}</p>
      )}
    </div>
  );

  const selectField = (label: string, key: 'education' | 'employmentStatus', options: string[], icon: React.ReactNode) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </label>
      {editing ? (
        <select value={form[key]} onChange={e => set(key)(e.target.value)} className={inputClass}>
          <option value="">Seçin</option>
          {options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <p className={viewClass}>{form[key] || '—'}</p>
      )}
    </div>
  );

  const missing = !profile.education || !profile.employment_status;
  const initial = (fullName(profile).trim()[0] ?? '?').toUpperCase();

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-blue-100 text-2xl font-bold text-blue-700 shadow">
                    {initial}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-60"
                  aria-label="Profil şəklini dəyiş"
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadAvatar(file);
                  }}
                />
              </div>
              <div className="pt-12">
                <h2 className="text-xl font-bold text-gray-900">{fullName(profile)}</h2>
                <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                  Təlimçi
                </span>
              </div>
            </div>

            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                <Pencil size={15} />
                Redaktə et
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Yadda saxla
                </button>
                <button
                  onClick={cancel}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                >
                  <X size={15} />
                  Ləğv et
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {missing && !editing && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Təhsil və məşğulluq məlumatlarınız doldurulmayıb. Zəhmət olmasa, profilinizi tamamlayın.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Doldur
              </button>
            </div>
          )}

          <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-700">Şəxsi məlumatlar</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textField('Ad, soyad', 'fullName', <User size={14} />)}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Mail size={14} />
                E-poçt
              </label>
              <p className={viewClass}>{profile.email || '—'}</p>
            </div>
            {textField('Telefon', 'phone', <Phone size={14} />, 'tel')}
            {textField('Şəhər', 'city', <MapPin size={14} />)}
            {selectField('Təhsil', 'education', EDUCATION_OPTIONS, <GraduationCap size={14} />)}
            {selectField('Hazırkı məşğulluq vəziyyəti', 'employmentStatus', EMPLOYMENT_OPTIONS, <Briefcase size={14} />)}
          </div>

          <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-700">Peşəkar məlumatlar</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textField('İxtisas', 'specialization', <BookOpen size={14} />)}
            {textField('Tədris istiqaməti', 'teachingDirection', <BookOpen size={14} />)}
            {textField('İş yeri', 'workplace', <Briefcase size={14} />)}
            {textField('İş təcrübəsi', 'workExperience', <Briefcase size={14} />)}
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Qısa bio</label>
            {editing ? (
              <textarea
                value={form.bio}
                onChange={e => set('bio')(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            ) : (
              <p className={viewClass}>{form.bio || '—'}</p>
            )}
          </div>
        </div>
      </section>

      <DeleteAccountCard />
    </div>
  );
}

export default TrainerProfile;
