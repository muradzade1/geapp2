import { MessageSquare, RefreshCw, Star } from 'lucide-react';
import { useAdminFeedback } from '../../lib/api/adminLogs';
import { relativeTime } from '../../lib/api/content';

const average = (row: {
  content_rating: number;
  instructor_rating: number;
  equipment_rating: number;
}) =>
  Math.round(
    ((row.content_rating + row.instructor_rating + row.equipment_rating) / 3) * 10,
  ) / 10;

/** Platforma üzrə bütün rəylər. */
export function AdminFeedback() {
  const { rows, loading, error, reload } = useAdminFeedback(300);

  const overall =
    rows.length === 0
      ? 0
      : Math.round((rows.reduce((sum, row) => sum + average(row), 0) / rows.length) * 10) /
        10;

  const scoreTone = (value: number) =>
    value >= 8
      ? 'bg-emerald-100 text-emerald-700'
      : value >= 5
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Rəylər</h3>
          <p className="text-sm text-gray-500">
            {rows.length} rəy · ortalama {overall}/10
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

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Yüklənir...</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <MessageSquare className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">
            Hələ rəy yoxdur. Gənclər tədbirlərdən sonra rəy bildirdikcə burada
            görünəcək.
          </p>
        </div>
      )}

      {rows.map(row => {
        const score = average(row);
        return (
          <div
            key={row.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{row.event_title}</p>
                <p className="text-sm text-gray-500">
                  {row.house_name ?? '—'}
                  {row.author_name && ` · ${row.author_name}`}
                </p>
                <p className="text-xs text-gray-400">{relativeTime(row.created_at)}</p>
              </div>

              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${scoreTone(score)}`}
              >
                <Star size={12} />
                {score}/10
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>Məzmun: {row.content_rating}/10</span>
              <span>Təlimçi: {row.instructor_rating}/10</span>
              <span>Avadanlıq: {row.equipment_rating}/10</span>
            </div>

            {row.comment && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {row.comment}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
