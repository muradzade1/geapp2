import { useMemo, useState } from 'react';
import { Building2, Search, MapPin, Phone, Mail, Navigation } from 'lucide-react';
import { usePublicHouses } from '../../lib/api/catalog';

export default function YouthHousesPage() {
  const { houses, loading, error } = usePublicHouses();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Hamısı');

  const cities = useMemo(
    () => ['Hamısı', ...Array.from(new Set(houses.map(h => h.city))).sort()],
    [houses],
  );

  const visible = houses.filter(house => {
    const matchesQuery =
      house.name.toLowerCase().includes(query.toLowerCase()) ||
      house.city.toLowerCase().includes(query.toLowerCase());
    const matchesCity = city === 'Hamısı' || house.city === city;
    return matchesQuery && matchesCity;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-emerald-200" />
            <h1 className="text-3xl font-bold text-white">Gənclər Evləri</h1>
          </div>
          <p className="text-lg text-emerald-100">
            Platformada qeydiyyatdan keçmiş mərkəzlər
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-4xl space-y-5 px-4 sm:px-6">
        <div className="rounded-2xl bg-white p-4 shadow-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Mərkəz və ya şəhər axtar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {cities.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {cities.map(item => (
              <button
                key={item}
                onClick={() => setCity(item)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  city === item
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Siyahı yüklənmədi: {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && houses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <Building2 className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hələ təsdiqlənmiş Gənclər Evi yoxdur. Mərkəzlər qeydiyyatdan keçdikcə
              burada görünəcək.
            </p>
          </div>
        )}

        {!loading && houses.length > 0 && (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{visible.length}</span> mərkəz
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map(house => (
            <div
              key={house.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <Building2 className="text-emerald-600" size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-800">{house.name}</h3>
                  <p className="text-sm text-gray-500">{house.city}</p>
                </div>
              </div>

              {house.description && (
                <p className="mb-3 line-clamp-2 text-sm text-gray-500">
                  {house.description}
                </p>
              )}

              <div className="space-y-1.5 text-sm text-gray-600">
                {house.address && (
                  <p className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
                    {house.address}
                  </p>
                )}
                {house.phone && (
                  <a
                    href={`tel:${house.phone}`}
                    className="flex items-center gap-2 text-emerald-700 hover:underline"
                  >
                    <Phone size={15} className="shrink-0 text-gray-400" />
                    {house.phone}
                  </a>
                )}
                {house.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={15} className="shrink-0 text-gray-400" />
                    <span className="truncate">{house.email}</span>
                  </p>
                )}
              </div>

              {house.latitude != null && house.longitude != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${house.latitude},${house.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-300"
                >
                  <Navigation size={14} />
                  Xəritədə aç
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
