import { useState } from 'react';
import { MessageSquare, Star, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  useAttendedEvents,
  submitFeedback,
  type AttendedEvent,
} from '../../lib/api/reports';

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * İştirak etdiyi tədbirlər üçün rəy bildirmə.
 *
 * Rəy yalnız iştirakı qeydə alınmış tədbirlərə verilə bilər — bu qayda
 * `submit_feedback()` funksiyasında yoxlanılır.
 */
export default function FeedbackPage() {
  const { events, loading, reload } = useAttendedEvents();
  const [open, setOpen] = useState<AttendedEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [ratings, setRatings] = useState({
    content: 8,
    instructor: 8,
    equipment: 8,
    comment: '',
  });

  const send = async () => {
    if (!open) return;
    setSaving(true);
    setError(null);
    try {
      const result = await submitFeedback({
        eventId: open.event_id,
        contentRating: ratings.content,
        instructorRating: ratings.instructor,
        equipmentRating: ratings.equipment,
        comment: ratings.comment.trim() || undefined,
      });
      setDone(
        result.points_awarded > 0
          ? `Rəyiniz göndərildi · +${result.points_awarded} xal`
          : 'Rəyiniz göndərildi',
      );
      setOpen(null);
      setRatings({ content: 8, instructor: 8, equipment: 8, comment: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rəy göndərilmədi');
    } finally {
      setSaving(false);
    }
  };

  const scaleRow = (
    label: string,
    value: number,
    onChange: (value: number) => void,
  ) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-emerald-600">{value}/10</span>
      </div>
      <div className="flex gap-1">
        {SCALE.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-9 flex-1 rounded-lg text-xs font-semibold transition ${
              n <= value
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-emerald-200" />
            <h1 className="text-3xl font-bold text-white">Rəylər</h1>
          </div>
          <p className="text-lg text-emerald-100">
            İştirak etdiyiniz tədbirləri qiymətləndirin
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-2xl space-y-4 px-4 sm:px-6">
        {done && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            {done}
          </div>
        )}

        {error && !open && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <MessageSquare className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hələ iştirak etdiyiniz tədbir yoxdur. Tədbirdən sonra burada rəy
              bildirə biləcəksiniz.
            </p>
          </div>
        )}

        {events.map(event => (
          <div
            key={event.event_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold text-gray-800">{event.title}</p>
              <p className="text-sm text-gray-500">{event.house_name}</p>
              <p className="text-xs text-gray-400">
                {new Date(event.starts_at).toLocaleDateString('az-AZ', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            {event.has_feedback ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-500">
                <CheckCircle2 size={15} />
                Rəy verilib
              </span>
            ) : (
              <button
                onClick={() => {
                  setOpen(event);
                  setError(null);
                  setDone(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Star size={15} />
                Rəy bildir
              </button>
            )}
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-800">{open.title}</h3>
                <p className="text-sm text-gray-500">{open.house_name}</p>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {scaleRow('Tədbirin məzmunu', ratings.content, v =>
                setRatings({ ...ratings, content: v }),
              )}
              {scaleRow('Təlimçi', ratings.instructor, v =>
                setRatings({ ...ratings, instructor: v }),
              )}
              {scaleRow('Şərait və avadanlıq', ratings.equipment, v =>
                setRatings({ ...ratings, equipment: v }),
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Şərh (istəyə bağlı)
                </label>
                <textarea
                  value={ratings.comment}
                  onChange={e => setRatings({ ...ratings, comment: e.target.value })}
                  rows={3}
                  placeholder="Nə xoşunuza gəldi, nə daha yaxşı ola bilərdi?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                onClick={() => void send()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Rəyi göndər
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
