import { useCallback, useEffect, useState } from 'react';
import {
  FileBarChart,
  Users,
  Clock,
  Calendar,
  Trophy,
  DoorOpen,
  Loader2,
} from 'lucide-react';
import { fetchHouseReport, EMPTY_REPORT, type HouseReport } from '../../lib/api/reports';
import { formatDuration } from '../../lib/api/stats';

interface Props {
  houseId: string | null;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Mərkəzin fəaliyyət hesabatı — seçilmiş tarix aralığı üzrə. */
export function HouseReports({ houseId }: Props) {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 86400000);

  const [from, setFrom] = useState(isoDay(monthAgo));
  const [to, setTo] = useState(isoDay(today));
  const [report, setReport] = useState<HouseReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setReport(await fetchHouseReport(houseId, from, to));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesabat yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, [houseId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!houseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Mərkəz təsdiqləndikdən sonra hesabat hazır olacaq.
      </div>
    );
  }

  const cards = [
    { label: 'Ümumi ziyarət', value: report.total_visits, icon: DoorOpen, tone: 'from-blue-500 to-indigo-600' },
    { label: 'Fərqli ziyarətçi', value: report.unique_visitors, icon: Users, tone: 'from-emerald-500 to-teal-600' },
    { label: 'Orta qalma', value: formatDuration(report.average_stay_minutes * 60), icon: Clock, tone: 'from-amber-500 to-orange-600' },
    { label: 'Tədbir', value: report.events_count, icon: Calendar, tone: 'from-rose-500 to-pink-600' },
    { label: 'İştirakçı', value: report.participants_count, icon: Users, tone: 'from-cyan-500 to-blue-600' },
    { label: 'Verilən xal', value: report.points_awarded, icon: Trophy, tone: 'from-purple-500 to-fuchsia-600' },
  ];

  const maxDaily = Math.max(1, ...report.daily.map(d => d.visits));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Hesabatlar</h3>
          <p className="text-sm text-gray-500">Seçilmiş aralıq üzrə göstəricilər</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Başlanğıc</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Son</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FileBarChart size={15} />}
            Hesabla
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(card => (
          <div
            key={card.label}
            className={`rounded-2xl bg-gradient-to-br ${card.tone} p-4 text-white shadow-sm`}
          >
            <card.icon size={20} className="mb-2 opacity-80" />
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="mt-0.5 text-xs opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Günlük ziyarətlər */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="mb-4 font-semibold text-gray-800">Günlük ziyarətlər</h4>
        {report.daily.length === 0 ? (
          <p className="text-sm text-gray-500">Bu aralıqda məlumat yoxdur.</p>
        ) : (
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {report.daily.map(day => (
              <div key={day.day} className="flex min-w-[14px] flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-blue-500 transition-all"
                  style={{ height: `${(day.visits / maxDaily) * 100}%` }}
                  title={`${day.day}: ${day.visits}`}
                />
                <span className="text-[10px] text-gray-400">
                  {new Date(day.day).getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ən aktiv otaqlar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 font-semibold text-gray-800">Ən aktiv otaqlar</h4>
          {report.top_rooms.length === 0 ? (
            <p className="text-sm text-gray-500">Otağa bağlı tədbir yoxdur.</p>
          ) : (
            <div className="space-y-2">
              {report.top_rooms.map(room => (
                <div
                  key={room.name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm text-gray-700">{room.name}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {room.events_count} tədbir
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ən çox iştirak olunan tədbirlər */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 font-semibold text-gray-800">Ən çox iştirak olunan tədbirlər</h4>
          {report.top_events.length === 0 ? (
            <p className="text-sm text-gray-500">Bu aralıqda tədbir yoxdur.</p>
          ) : (
            <div className="space-y-2">
              {report.top_events.map(event => (
                <div
                  key={`${event.title}-${event.starts_at}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-700">{event.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(event.starts_at).toLocaleDateString('az-AZ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-800">
                    {event.attended}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
