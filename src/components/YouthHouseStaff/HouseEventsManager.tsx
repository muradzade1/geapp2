import { useEffect, useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Trophy,
  UserCheck,
  X,
  Loader2,
  ScanLine,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  useEvents,
  createEvent,
  fetchParticipants,
  markAttendance,
  unmarkAttendance,
  updateEventStatus,
  eventPhase,
  eventDate,
  eventTime,
  toLocalInput,
  EVENT_CATEGORIES,
  type EventRow,
  type Participant,
} from '../../lib/api/events';
import { scanAndCheckin } from '../../lib/api/checkin';
import { ImageUploadField } from '../shared/ImageUploadField';

interface Props {
  houseId: string | null;
}

type RoomOption = { id: string; name: string };

/**
 * Gənclər Evinin tədbir idarəsi.
 *
 * İştirakın təsdiqi burada verilir — həmin an gəncə xal yazılır, ona görə
 * bu düymə yalnız mərkəzin əməkdaşına açıqdır.
 */
export function HouseEventsManager({ houseId }: Props) {
  const { events, loading, error, reload } = useEvents({
    houseId,
    includePast: true,
  });

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const now = new Date();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: EVENT_CATEGORIES[0] as string,
    room_id: '',
    starts_at: toLocalInput(new Date(now.getTime() + 3600000)),
    ends_at: toLocalInput(new Date(now.getTime() + 7200000)),
    capacity: '20',
    points_reward: '10',
  });
  const [coverPath, setCoverPath] = useState<string | null>(null);

  useEffect(() => {
    if (!houseId) return;
    // Otaqlar `owner_id` ilə bağlıdır; RLS onsuz da yalnız öz otaqlarını qaytarır.
    void supabase
      .from('youth_house_rooms')
      .select('id, name')
      .then(({ data }) => setRooms((data as RoomOption[]) ?? []));
  }, [houseId]);

  const submit = async () => {
    if (!houseId) return;
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
        youth_house_id: houseId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        room_id: form.room_id || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        cover_path: coverPath,
        capacity: Number(form.capacity) || 0,
        points_reward: Number(form.points_reward) || 0,
        status: 'published',
      });
      setShowForm(false);
      setForm({ ...form, title: '', description: '' });
      setCoverPath(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tədbir yaradıla bilmədi');
    } finally {
      setSaving(false);
    }
  };

  const openParticipants = async (event: EventRow) => {
    setOpenEvent(event);
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
    if (!openEvent) return;
    setBusyUser(participant.user_id);
    try {
      if (participant.attended) {
        await unmarkAttendance(openEvent.id, participant.user_id);
      } else {
        await markAttendance(openEvent.id, participant.user_id);
      }
      setParticipants(await fetchParticipants(openEvent.id));
      await reload();
    } catch {
      /* xəta olarsa siyahı dəyişmir */
    } finally {
      setBusyUser(null);
    }
  };

  const runScan = async () => {
    if (!openEvent) return;
    setScanning(true);
    setScanMessage(null);
    try {
      const result = await scanAndCheckin(openEvent.id);
      if (!result) {
        setScanMessage(null);
      } else if (result.already) {
        setScanMessage(`${result.full_name ?? 'İştirakçı'} onsuz da qeyd olunub.`);
      } else {
        setScanMessage(
          `${result.full_name ?? 'İştirakçı'} qeyd olundu · +${result.points} xal`,
        );
      }
      setParticipants(await fetchParticipants(openEvent.id));
      await reload();
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : 'Skan alınmadı');
    } finally {
      setScanning(false);
    }
  };

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra tədbir yarada biləcəksiniz.
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Tədbirlər</h3>
          <p className="text-sm text-gray-500">{events.length} tədbir</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
          >
            <RefreshCw size={15} />
            Yenilə
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Otaq
              </label>
              <select
                value={form.room_id}
                onChange={e => setForm({ ...form, room_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                <option value="">Seçilməyib</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            {field('Tutum (0 = limitsiz)', 'capacity', 'number')}
            {field('Xal mükafatı', 'points_reward', 'number')}
          </div>

          <div className="mt-4">
            <ImageUploadField
              label="Örtük şəkli"
              folder="events"
              value={coverPath}
              onChange={setCoverPath}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-600">
              Təsvir
            </label>
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

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && events.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Calendar className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hələ tədbir yaradılmayıb.</p>
        </div>
      )}

      {events.map(event => {
        const phase = eventPhase(event);
        return (
          <div
            key={event.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-gray-800">{event.title}</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {event.category}
                  </span>
                  {event.status === 'cancelled' && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      Ləğv edilib
                    </span>
                  )}
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
                    {event.registered_count}
                    {event.capacity > 0 ? `/${event.capacity}` : ''} yazılıb ·{' '}
                    {event.attended_count} iştirak
                  </span>
                  {event.points_reward > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <Trophy size={14} />+{event.points_reward}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void openParticipants(event)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <UserCheck size={15} />
                  İştirak
                </button>
                {event.status === 'published' && phase === 'finished' && (
                  <button
                    onClick={async () => {
                      await updateEventStatus(event.id, 'completed');
                      await reload();
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
                  >
                    Bağla
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {openEvent && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h4 className="font-semibold text-gray-800">{openEvent.title}</h4>
                <p className="text-sm text-gray-500">İştirakı təsdiqləyin</p>
              </div>
              <button
                onClick={() => setOpenEvent(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-gray-100 px-5 py-4">
              <button
                onClick={() => void runScan()}
                disabled={scanning}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {scanning ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
                {scanning ? 'Skan edilir...' : 'QR ilə iştirakı qeyd et'}
              </button>
              {scanMessage && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {scanMessage}
                </p>
              )}
            </div>

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

            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
              İştirak təsdiqlənəndə gəncə {openEvent.points_reward} xal yazılır.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
