import { useMemo, useState } from 'react';
import {
  Sparkles,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  Trophy,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  useEvents,
  useMyRegistrations,
  registerForEvent,
  cancelRegistration,
  eventPhase,
  PHASE_LABEL,
  eventDate,
  eventTime,
  EVENT_CATEGORIES,
  type EventRow,
} from '../../lib/api/events';
import { imageUrl } from '../../lib/api/upload';

const CATEGORY_TONE: Record<string, string> = {
  'Təlim və İnkişaf': 'bg-blue-500',
  'İdman': 'bg-orange-500',
  'Sağlamlıq': 'bg-green-500',
  'Mədəniyyət və İncəsənət': 'bg-purple-500',
  'Startap və İnnovasiya': 'bg-pink-500',
  'Könüllülük': 'bg-teal-500',
  'Digər': 'bg-gray-500',
};

const PHASE_TONE: Record<ReturnType<typeof eventPhase>, string> = {
  upcoming: 'bg-emerald-100 text-emerald-700',
  running: 'bg-blue-100 text-blue-700',
  finished: 'bg-gray-100 text-gray-500',
};

export default function EventsPage() {
  const { events, loading, error, reload } = useEvents();
  const { registrations, reload: reloadRegistrations } = useMyRegistrations();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Hamısı');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleEvents = useMemo(
    () =>
      events.filter(event => {
        if (event.status !== 'published') return false;
        const matchesSearch = event.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesCategory =
          selectedCategory === 'Hamısı' || event.category === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [events, searchQuery, selectedCategory],
  );

  const toggle = async (event: EventRow) => {
    setBusyId(event.id);
    setActionError(null);
    try {
      if (registrations[event.id] === 'registered') {
        await cancelRegistration(event.id);
      } else {
        await registerForEvent(event.id);
      }
      await Promise.all([reload(), reloadRegistrations()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Əməliyyat alınmadı');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/40">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-yellow-300" />
            <h1 className="text-3xl font-bold text-white">Tədbirlər</h1>
          </div>
          <p className="text-lg text-emerald-50">
            Maraqlı tədbirləri kəşf edin və qeydiyyatdan keçin
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-7xl px-4 sm:px-6">
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tədbir axtar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {['Hamısı', ...EVENT_CATEGORIES].map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200'
                  : 'border border-gray-200 bg-white text-gray-600 hover:shadow-sm'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tədbirlər yüklənmədi: {error}
          </div>
        )}

        <p className="mb-4 text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{visibleEvents.length}</span> tədbir
        </p>

        {loading && (
          <p className="py-12 text-center text-sm text-gray-500">Yüklənir...</p>
        )}

        {!loading && visibleEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <Calendar className="mx-auto mb-3 text-gray-300" size={36} />
            <p className="text-sm text-gray-500">
              Hazırda planlaşdırılmış tədbir yoxdur. Yeni tədbirlər əlavə olunanda
              burada görünəcək.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map(event => {
            const phase = eventPhase(event);
            const isRegistered = registrations[event.id] === 'registered';
            const isFull =
              event.capacity > 0 && event.registered_count >= event.capacity;
            const canRegister = phase !== 'finished' && (!isFull || isRegistered);

            return (
              <div
                key={event.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
              >
                {imageUrl(event.cover_path) && (
                  <img
                    src={imageUrl(event.cover_path) as string}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                )}

                <div className="flex items-start justify-between gap-2 px-5 pt-5">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold text-white ${
                      CATEGORY_TONE[event.category] ?? 'bg-gray-500'
                    }`}
                  >
                    {event.category}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${PHASE_TONE[phase]}`}
                  >
                    {PHASE_LABEL[phase]}
                  </span>
                </div>

                <div className="px-5 pb-5 pt-3">
                  <h3 className="mb-1 text-lg font-bold text-gray-800">{event.title}</h3>
                  {event.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-500">
                      {event.description}
                    </p>
                  )}

                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <Calendar size={15} className="text-gray-400" />
                      {eventDate(event.starts_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock size={15} className="text-gray-400" />
                      {eventTime(event.starts_at)} — {eventTime(event.ends_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={15} className="text-gray-400" />
                      {event.house_name}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users size={15} className="text-gray-400" />
                      {event.registered_count}
                      {event.capacity > 0 ? ` / ${event.capacity}` : ''} iştirakçı
                    </p>
                    {event.points_reward > 0 && (
                      <p className="flex items-center gap-2 font-medium text-amber-600">
                        <Trophy size={15} />+{event.points_reward} xal
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => void toggle(event)}
                    disabled={busyId === event.id || !canRegister}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                      isRegistered
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {busyId === event.id && <Loader2 size={16} className="animate-spin" />}
                    {isRegistered && busyId !== event.id && <CheckCircle2 size={16} />}
                    {isRegistered
                      ? 'Qeydiyyatdan çıx'
                      : isFull
                        ? 'Yerlər dolub'
                        : phase === 'finished'
                          ? 'Tədbir bitib'
                          : phase === 'running'
                            ? 'İndi qoşul'
                            : 'Qeydiyyatdan keç'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
