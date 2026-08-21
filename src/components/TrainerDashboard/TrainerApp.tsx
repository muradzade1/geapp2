import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  BookOpen,
  Users,
  MessageSquare,
  Plus,
  Calendar,
  Clock,
  Trophy,
  UserCheck,
  ScanLine,
  Star,
  Loader2,
  X,
  RefreshCw,
  Building2,
} from 'lucide-react';
import {
  useTrainerHouses,
  useTrainerStats,
  useTrainerFeedback,
} from '../../lib/api/trainer';
import {
  useEvents,
  createEvent,
  fetchParticipants,
  markAttendance,
  unmarkAttendance,
  eventDate,
  eventTime,
  toLocalInput,
  EVENT_CATEGORIES,
  type EventRow,
  type Participant,
} from '../../lib/api/events';
import { scanAndCheckin } from '../../lib/api/checkin';
import { relativeTime } from '../../lib/api/content';

interface TrainerAppProps {
  onBack: () => void;
}

type TabKey = 'main' | 'trainings' | 'participants' | 'feedback';

const TrainerApp: React.FC<TrainerAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('main');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { houses, loading: housesLoading } = useTrainerHouses();
  const { stats, reload: reloadStats } = useTrainerStats();
  const { items: feedback, loading: feedbackLoading } = useTrainerFeedback();
  const { events, loading: eventsLoading, reload: reloadEvents } = useEvents({
    includePast: true,
  });

  // Yalnız bu təlimçinin tədbirləri
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => {
    void import('../../lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null)),
    );
  }, []);

  const myEvents = events.filter(
    e => e.trainer_id === myId || (myId != null && e.trainer_id == null && houses.some(h => h.id === e.youth_house_id)),
  );

  /* ─── Tədbir yaratma ─────────────────────────────────── */

  const now = new Date();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    house_id: '',
    title: '',
    description: '',
    category: EVENT_CATEGORIES[0] as string,
    starts_at: toLocalInput(new Date(now.getTime() + 3600000)),
    ends_at: toLocalInput(new Date(now.getTime() + 7200000)),
    capacity: '20',
    points_reward: '10',
  });

  useEffect(() => {
    if (!form.house_id && houses.length > 0) {
      setForm(current => ({ ...current, house_id: houses[0].id }));
    }
  }, [houses, form.house_id]);

  const submit = async () => {
    if (!form.house_id) {
      setFormError('Gənclər Evi seçilməyib');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Tədbirin adı mütləqdir');
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setFormError('Bitmə vaxtı başlanğıcdan sonra olmalıdır');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await createEvent({
        youth_house_id: form.house_id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        capacity: Number(form.capacity) || 0,
        points_reward: Number(form.points_reward) || 0,
        status: 'published',
      });
      setShowForm(false);
      setForm({ ...form, title: '', description: '' });
      await Promise.all([reloadEvents(), reloadStats()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tədbir yaradıla bilmədi');
    } finally {
      setSaving(false);
    }
  };

  /* ─── İştirakçılar ───────────────────────────────────── */

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const selectedEvent = myEvents.find(e => e.id === selectedEventId) ?? null;

  const openEvent = async (event: EventRow) => {
    setSelectedEventId(event.id);
    setActiveTab('participants');
    setScanMessage(null);
    setParticipantsLoading(true);
    try {
      setParticipants(await fetchParticipants(event.id));
    } catch {
      setParticipants([]);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const toggleAttendance = async (participant: Participant) => {
    if (!selectedEvent) return;
    setBusyUser(participant.user_id);
    try {
      if (participant.attended) {
        await unmarkAttendance(selectedEvent.id, participant.user_id);
      } else {
        await markAttendance(selectedEvent.id, participant.user_id);
      }
      setParticipants(await fetchParticipants(selectedEvent.id));
      await Promise.all([reloadEvents(), reloadStats()]);
    } finally {
      setBusyUser(null);
    }
  };

  const runScan = async () => {
    if (!selectedEvent) return;
    setScanning(true);
    setScanMessage(null);
    try {
      const result = await scanAndCheckin(selectedEvent.id);
      if (result) {
        setScanMessage(
          result.already
            ? `${result.full_name ?? 'İştirakçı'} onsuz da qeyd olunub.`
            : `${result.full_name ?? 'İştirakçı'} qeyd olundu · +${result.points} xal`,
        );
        setParticipants(await fetchParticipants(selectedEvent.id));
        await Promise.all([reloadEvents(), reloadStats()]);
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : 'Skan alınmadı');
    } finally {
      setScanning(false);
    }
  };

  /* ─── Görünüşlər ─────────────────────────────────────── */

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'main', label: 'Əsas', icon: <LayoutDashboard size={18} /> },
    { key: 'trainings', label: 'Tədbirlərim', icon: <BookOpen size={18} /> },
    { key: 'participants', label: 'İştirakçılar', icon: <Users size={18} /> },
    { key: 'feedback', label: 'Rəylər', icon: <MessageSquare size={18} /> },
  ];

  const statCards = [
    { label: 'Keçirdiyi tədbir', value: stats.total_events, tone: 'from-blue-500 to-indigo-600' },
    { label: 'Qarşıdan gələn', value: stats.upcoming_events, tone: 'from-emerald-500 to-teal-600' },
    { label: 'Ümumi iştirakçı', value: stats.total_participants, tone: 'from-amber-500 to-orange-600' },
    { label: 'Təlimçi reytinqi', value: `${stats.instructor_rating}/10`, tone: 'from-purple-500 to-fuchsia-600' },
  ];

  const noHouse = !housesLoading && houses.length === 0;

  const renderMain = () => (
    <div className="space-y-5">
      {noHouse && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 shrink-0 text-amber-600" size={22} />
            <div>
              <h3 className="font-semibold text-amber-900">
                Hələ heç bir Gənclər Evi sizi komandasına əlavə etməyib
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                Tədbir yarada bilmək üçün işlədiyiniz Gənclər Evi ilə əlaqə saxlayın —
                onlar sizi öz panelindən komandaya əlavə etməlidir.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(card => (
          <div
            key={card.label}
            className={`rounded-2xl bg-gradient-to-br ${card.tone} p-4 text-white shadow-sm`}
          >
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {houses.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-800">İşlədiyiniz mərkəzlər</h3>
          <div className="flex flex-wrap gap-2">
            {houses.map(house => (
              <span
                key={house.id}
                className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
              >
                {house.name} · {house.city}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-800">Bugünkü tədbirlər</h3>
        {stats.today_events === 0 ? (
          <p className="text-sm text-gray-500">Bu gün tədbiriniz yoxdur.</p>
        ) : (
          <p className="text-sm text-gray-600">
            Bu gün <strong>{stats.today_events}</strong> tədbiriniz var — İştirakçılar
            bölməsindən QR ilə qeydiyyat apara bilərsiniz.
          </p>
        )}
      </div>
    </div>
  );

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );

  const renderTrainings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-800">Tədbirlərim</h3>
        <div className="flex gap-2">
          <button
            onClick={() => void reloadEvents()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
          >
            <RefreshCw size={15} />
            Yenilə
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={noHouse}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Bağla' : 'Yeni tədbir'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {formError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Gənclər Evi
              </label>
              <select
                value={form.house_id}
                onChange={e => setForm({ ...form, house_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                {houses.map(house => (
                  <option key={house.id} value={house.id}>
                    {house.name} — {house.city}
                  </option>
                ))}
              </select>
            </div>
            {field('Tədbirin adı', 'title')}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Kateqoriya
              </label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                {EVENT_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {field('Başlanğıc', 'starts_at', 'datetime-local')}
            {field('Bitmə', 'ends_at', 'datetime-local')}
            {field('Tutum (0 = limitsiz)', 'capacity', 'number')}
            {field('Xal mükafatı', 'points_reward', 'number')}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-600">Təsvir</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>

          <button
            onClick={() => void submit()}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Tədbiri yarat
          </button>
        </div>
      )}

      {eventsLoading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!eventsLoading && myEvents.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Calendar className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hələ tədbiriniz yoxdur.</p>
        </div>
      )}

      {myEvents.map(event => (
        <div
          key={event.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-gray-800">{event.title}</h4>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {event.category}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                {eventDate(event.starts_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-gray-400" />
                {eventTime(event.starts_at)} — {eventTime(event.ends_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-gray-400" />
                {event.registered_count} yazılıb · {event.attended_count} iştirak
              </span>
              {event.points_reward > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Trophy size={14} />+{event.points_reward}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-400">{event.house_name}</p>
          </div>

          <button
            onClick={() => void openEvent(event)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <UserCheck size={15} />
            İştirakçılar
          </button>
        </div>
      ))}
    </div>
  );

  const renderParticipants = () => {
    if (!selectedEvent) {
      return (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <Users className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Tədbirlərim bölməsindən tədbir seçin — iştirakçılar burada görünəcək.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800">{selectedEvent.title}</h3>
          <p className="text-sm text-gray-500">
            {eventDate(selectedEvent.starts_at)} ·{' '}
            {eventTime(selectedEvent.starts_at)} — {eventTime(selectedEvent.ends_at)}
          </p>

          <button
            onClick={() => void runScan()}
            disabled={scanning}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ScanLine size={18} />
            )}
            {scanning ? 'Skan edilir...' : 'QR ilə iştirakı qeyd et'}
          </button>

          {scanMessage && (
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {scanMessage}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {participantsLoading && (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Yüklənir...</p>
          )}

          {!participantsLoading && participants.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              Bu tədbirə hələ heç kim yazılmayıb.
            </p>
          )}

          <div className="divide-y divide-gray-50">
            {participants.map(participant => (
              <div
                key={participant.user_id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                  {participant.full_name ?? 'Ad göstərilməyib'}
                </p>
                <button
                  onClick={() => void toggleAttendance(participant)}
                  disabled={busyUser === participant.user_id}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
                    participant.attended
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {busyUser === participant.user_id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserCheck size={14} />
                  )}
                  {participant.attended ? 'İştirak etdi' : 'Təsdiqlə'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFeedback = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Star className="text-amber-500" size={24} />
          <div>
            <p className="text-2xl font-bold text-gray-800">
              {stats.instructor_rating}/10
            </p>
            <p className="text-sm text-gray-500">
              {stats.feedback_count} rəy əsasında
            </p>
          </div>
        </div>
      </div>

      {feedbackLoading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!feedbackLoading && feedback.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <MessageSquare className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Hələ rəy yoxdur. İştirakçılar tədbirdən sonra rəy bildirdikcə burada
            görünəcək.
          </p>
        </div>
      )}

      {feedback.map(item => (
        <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-800">{item.event_title}</p>
              <p className="text-xs text-gray-400">{relativeTime(item.created_at)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
              Təlimçi: {item.instructor_rating}/10
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Məzmun: {item.content_rating}/10</span>
            <span>Avadanlıq: {item.equipment_rating}/10</span>
          </div>

          {item.comment && (
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {item.comment}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  const content: Record<TabKey, () => React.ReactNode> = {
    main: renderMain,
    trainings: renderTrainings,
    participants: renderParticipants,
    feedback: renderFeedback,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button
            onClick={onBack}
            className="rounded-lg bg-white/15 p-2 transition hover:bg-white/25"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Təlimçi Paneli</h1>
            <p className="text-sm text-blue-100">
              Tədbirlərinizi və iştirakçıları idarə edin
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{content[activeTab]()}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                activeTab === tab.key
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export { TrainerApp };
export default TrainerApp;
