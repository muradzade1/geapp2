import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, Pencil, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProfile, type PlatformProfile } from '../../lib/profile';

interface AccountProfileCardProps {
  title: string;
  role: 'youth' | 'trainer' | 'youth_house';
  editableFields: Array<{ key: keyof PlatformProfile; label: string; type?: 'text' | 'email' | 'tel' | 'date' | 'textarea' }>;
  extras?: Array<{ label: string; value: string }>;
}

export function AccountProfileCard({ title, role, editableFields, extras }: AccountProfileCardProps) {
  const { profile, avatarUrl, refresh } = useProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    const next: Record<string, string> = {};
    editableFields.forEach((field) => {
      const raw = profile[field.key];
      next[String(field.key)] = raw == null ? '' : String(raw);
    });
    setValues(next);
  }, [profile, editableFields]);

  const displayName = useMemo(() => {
    if (!profile) return '—';
    if (role === 'youth_house') return profile.house_name || '—';
    const combined = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    return combined || profile.email || '—';
  }, [profile, role]);

  if (!profile) return null;

  const initial = displayName === '—' ? '?' : displayName.charAt(0).toUpperCase();

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Yalnız şəkil faylı yükləyə bilərsiniz.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Şəkil ölçüsü 3 MB-dan çox olmamalıdır.');
      return;
    }
    setError('');
    setUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('account-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (!uploadError) {
      await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
      await refresh();
    } else {
      setError('Şəkli yükləmək mümkün olmadı.');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const update: Record<string, string | null> = {};
    editableFields.forEach((field) => {
      const raw = (values[String(field.key)] ?? '').trim();
      update[String(field.key)] = raw.length === 0 ? null : raw;
    });
    const { error: updateError } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (updateError) {
      setError('Məlumatları saxlamaq mümkün olmadı.');
    } else {
      await refresh();
      setEditing(false);
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700 sm:h-24 sm:w-24">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
          </div>
          <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</p>
              <h2 className="mt-0.5 text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-sm text-gray-500">{profile.email || '—'}</p>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <Pencil className="h-3.5 w-3.5" />Redaktə et
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"><X className="h-3.5 w-3.5" />Ləğv et</button>
                <button disabled={saving} onClick={() => void handleSave()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Yadda saxla</button>
              </div>
            )}
          </div>

          {extras && extras.length > 0 && (
            <div className="mt-3 grid gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
              {extras.map((extra) => (
                <p key={extra.label}><span className="font-medium text-gray-500">{extra.label}:</span> {extra.value || '—'}</p>
              ))}
            </div>
          )}

          {editing && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {editableFields.map((field) => (
                <label key={String(field.key)} className={field.type === 'textarea' ? 'sm:col-span-2 block' : 'block'}>
                  <span className="mb-1 block text-xs font-semibold text-gray-500">{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} value={values[String(field.key)] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [String(field.key)]: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  ) : (
                    <input type={field.type ?? 'text'} value={values[String(field.key)] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [String(field.key)]: event.target.value }))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  )}
                </label>
              ))}
            </div>
          )}

          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
