import { useMemo, useState } from 'react';
import { Calendar, RefreshCw, Users, Trophy, Search } from 'lucide-react';
import { useAdminEvents } from '../../lib/api/adminLogs';
import { eventDate, eventTime } from '../../lib/api/events';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Qaralama',
  published: 'Dərc olunub',
  cancelled: 'Ləğv edilib',
  completed: 'Bitib',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
  completed: 'bg-blue-100 text-blue-700',
};

/** Platforma üzrə bütün tədbirlər. */
export function AdminEvents() {
  const { rows, loading, error, reload } = useAdminEvents(300);
  const [query, setQuery] = useState('');
  const [house, setHouse] = useState('Hamısı');

  const houses = useMemo(
    () => ['Hamısı', ...Array.from(new Set(rows.map(r => r.house_name ?? '—'))).sort()],
    [rows],
  );

  const visible = rows.filter(row => {
    const matchesQuery = row.title.toLowerCase().includes(query.toLowerCase());
    const matchesHouse = house === 'Hamısı' || (row.house_name ?? '—') === house;
    return matchesQuery && matchesHouse;
  });

  const totals = rows.reduce(
    (acc, row) => ({
      registered: acc.registered + Number(row.registered_count),
      attended: acc.attended + Number(row.attended_count),
    }),
    { registered: 0, attended: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Tədbirlər</h3>
          <p className="text-sm text-gray-500">
            {rows.length} tədbir · {totals.registered} qeydiyyat ·{' '}
            {totals.attended} iştirak
          </p>
        </div>
        <button
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Yenilə
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tədbir axtar..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          />
        </div>

        {houses.length > 2 && (
          <select
            value={house}
            onChange={e => setHouse(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
          >
            {houses.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <Calendar className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Hələ tədbir yaradılmayıb. Gənclər Evləri və təlimçilər tədbir əlavə
            etdikcə burada görünəcək.
          </p>
        </div>
      )}

      {visible.map(row => (
        <div
          key={row.id}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-gray-800">{row.title}</h4>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {row.category}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    STATUS_TONE[row.status] ?? STATUS_TONE.draft
                  }`}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-600">
                {row.house_name ?? '—'}
                {row.organiser_name && ` · ${row.organiser_name}`}
              </p>

              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  {eventDate(row.starts_at)} · {eventTime(row.starts_at)} —{' '}
                  {eventTime(row.ends_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-gray-400" />
                  {row.registered_count}
                  {row.capacity > 0 ? `/${row.capacity}` : ''} yazılıb ·{' '}
                  {row.attended_count} iştirak
                </span>
                {row.points_reward > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <Trophy size={14} />+{row.points_reward}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
