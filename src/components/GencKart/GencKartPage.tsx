import { useMemo, useState } from 'react';
import {
  CreditCard,
  Search,
  MapPin,
  Percent,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { usePartners, recordPartnerUsage } from '../../lib/api/catalog';
import { useProfile } from '../../lib/profile';
import { relativeTime } from '../../lib/api/content';

export default function GencKartPage() {
  const { partners, usages, loading, error, reload } = usePartners();
  const { profile } = useProfile();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Hamısı');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const categories = useMemo(
    () => ['Hamısı', ...Array.from(new Set(partners.map(p => p.category))).sort()],
    [partners],
  );

  const visible = partners.filter(partner => {
    const matchesQuery = partner.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'Hamısı' || partner.category === category;
    return matchesQuery && matchesCategory;
  });

  const use = async (partnerId: string, name: string) => {
    setBusyId(partnerId);
    setMessage(null);
    try {
      await recordPartnerUsage(partnerId);
      setMessage(`${name} — endirim istifadəsi qeyd olundu`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Qeyd edilmədi');
    } finally {
      setBusyId(null);
    }
  };

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Gənc';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-blue-200" />
            <h1 className="text-3xl font-bold text-white">GəncKart</h1>
          </div>
          <p className="text-lg text-blue-100">Partnyorlarda endirimlərdən yararlanın</p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl space-y-5 px-4 sm:px-6">
        {/* Kart */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">GəncKart</p>
              <p className="mt-3 text-xl font-bold">{fullName}</p>
              {profile?.city && <p className="text-sm text-slate-300">{profile.city}</p>}
            </div>
            <CreditCard size={32} className="text-slate-500" />
          </div>
          <p className="mt-6 text-xs text-slate-400">
            {usages.length} dəfə istifadə olunub
          </p>
        </div>

        {message && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Partnyorlar yüklənmədi: {error}
          </div>
        )}

        {/* Axtarış */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Partnyor axtar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(item => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  category === item
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && partners.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <CreditCard className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hələ partnyor əlavə olunmayıb. Endirim təklifləri burada görünəcək.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map(partner => (
            <div
              key={partner.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{partner.name}</h3>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    <Percent size={11} />
                    {partner.discount}%
                  </span>
                </div>
                {partner.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{partner.description}</p>
                )}
                {(partner.address || partner.city) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={12} />
                    {[partner.city, partner.address].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <button
                onClick={() => void use(partner.id, partner.name)}
                disabled={busyId === partner.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busyId === partner.id && <Loader2 size={14} className="animate-spin" />}
                İstifadə etdim
              </button>
            </div>
          ))}
        </div>

        {usages.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="font-semibold text-gray-800">İstifadə tarixçəsi</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {usages.slice(0, 10).map(usage => {
                const partner = partners.find(p => p.id === usage.partner_id);
                return (
                  <div key={usage.id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-gray-700">
                      {partner?.name ?? 'Partnyor'}
                    </p>
                    <p className="text-xs text-gray-400">{relativeTime(usage.used_at)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
