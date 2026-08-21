import React, { useState } from 'react';
import { Building2, Clock, XCircle, AlertCircle } from 'lucide-react';
import type { HouseRegistrationInput, YouthHouse } from '../../lib/api/house';

interface Props {
  house: YouthHouse | null;
  onRegister: (input: HouseRegistrationInput) => Promise<void>;
}

/**
 * Mərkəz hələ qeydiyyatdan keçməyibsə — qeydiyyat formu.
 * Keçibsə, amma təsdiq gözləyirsə və ya rədd edilibsə — status lövhəsi.
 * Təsdiqlənibsə — heç nə göstərmir (panel açılır).
 */
export function HouseRegistration({ house, onRegister }: Props) {
  const [form, setForm] = useState<HouseRegistrationInput>({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (house?.status === 'approved') return null;

  if (house?.status === 'pending') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 shrink-0 text-amber-600" size={22} />
          <div>
            <h3 className="font-semibold text-amber-900">Təsdiq gözlənilir</h3>
            <p className="mt-1 text-sm text-amber-800">
              <strong>{house.name}</strong> ({house.city}) qeydiyyatı administratora
              göndərilib. Təsdiqləndikdən sonra mərkəziniz ümumi siyahıda görünəcək
              və panel məlumatları aktivləşəcək.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (house?.status === 'rejected') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 shrink-0 text-red-600" size={22} />
          <div>
            <h3 className="font-semibold text-red-900">Qeydiyyat rədd edildi</h3>
            {house.rejection_reason && (
              <p className="mt-1 text-sm text-red-800">
                Səbəb: {house.rejection_reason}
              </p>
            )}
            <p className="mt-2 text-sm text-red-800">
              Məlumatları dəqiqləşdirib administratorla əlaqə saxlayın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.city.trim()) {
      setError('Ad və şəhər mütləqdir');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onRegister(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Qeydiyyat alınmadı');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof HouseRegistrationInput,
    label: string,
    required = false,
    type = 'text',
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-blue-50 p-2">
          <Building2 className="text-blue-600" size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Gənclər Evini qeydiyyatdan keçirin</h3>
          <p className="text-sm text-gray-500">
            Məlumatlar administrator tərəfindən yoxlanıldıqdan sonra mərkəziniz
            platformada görünəcək.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Gənclər Evinin adı', true)}
        {field('city', 'Şəhər / Rayon', true)}
        {field('address', 'Ünvan')}
        {field('phone', 'Telefon', false, 'tel')}
        {field('email', 'E-poçt', false, 'email')}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-600">Haqqında</label>
        <textarea
          value={form.description ?? ''}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
      >
        {saving ? 'Göndərilir...' : 'Qeydiyyata göndər'}
      </button>
    </div>
  );
}
