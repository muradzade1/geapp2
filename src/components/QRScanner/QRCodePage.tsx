import { QrCode, Award, History, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { HouseScanCard } from './HouseScanCard';
import { EventTokenCard } from './EventTokenCard';
import {
  useMyVisits,
  useYouthStats,
  formatDuration,
  clock,
  dateClock,
} from '../../lib/api/stats';

/**
 * Gəncin QR səhifəsi.
 *
 * Axın: mərkəz girişdə kodu göstərir, gənc skan edir. Gəncin şəxsi QR kodu
 * yoxdur — tədbir iştirakı ayrıca mərhələdə qurulacaq.
 */
export default function QRCodePage() {
  const { stats, loading: statsLoading, reload: reloadStats } = useYouthStats();
  const { visits, loading: visitsLoading, reload: reloadVisits } = useMyVisits(15);

  const refresh = () => {
    void reloadStats();
    void reloadVisits();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 pb-8">
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <QrCode className="h-8 w-8 text-emerald-200" />
            <h1 className="text-3xl font-bold text-white">QR Kod</h1>
          </div>
          <p className="text-lg text-emerald-100">
            Gənclər Evinə giriş və çıxış üçün kodu skan edin
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-2xl space-y-6 px-4 sm:px-6">
        <HouseScanCard />

        <EventTokenCard />

        {/* Xal balansı */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award size={26} className="opacity-90" />
              <div>
                <p className="text-sm opacity-90">Toplam xalınız</p>
                <p className="text-3xl font-bold">{stats.points}</p>
                {stats.level?.level && (
                  <p className="text-xs opacity-90">
                    Səviyyə: {stats.level.level}
                    {stats.level.next_at != null &&
                      ` · növbəti səviyyəyə ${stats.level.next_at - stats.points} xal`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={refresh}
              className="rounded-lg bg-white/20 p-2 transition hover:bg-white/30"
              aria-label="Yenilə"
            >
              <RefreshCw
                size={18}
                className={statsLoading || visitsLoading ? 'animate-spin' : ''}
              />
            </button>
          </div>
        </div>

        {/* Ziyarət tarixçəsi */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <History size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Ziyarət tarixçəsi</h3>
            <span className="ml-auto text-sm text-gray-500">
              {stats.visit_count} tamamlanmış
            </span>
          </div>

          {visitsLoading && (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Yüklənir...</p>
          )}

          {!visitsLoading && visits.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              Hələ ziyarət qeydiniz yoxdur. İlk skanınızdan sonra burada görünəcək.
            </p>
          )}

          <div className="divide-y divide-gray-50">
            {visits.map(visit => {
              const inside = visit.exited_at === null;
              return (
                <div key={visit.visit_id} className="flex items-start gap-3 px-5 py-3.5">
                  <div
                    className={`mt-0.5 rounded-lg p-1.5 ${
                      inside ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {inside ? <LogIn size={16} /> : <LogOut size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {visit.house_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dateClock(visit.entered_at)}
                      {!inside && ` → ${clock(visit.exited_at)}`}
                      {' · '}
                      {formatDuration(visit.duration_seconds)}
                      {inside && ' (davam edir)'}
                    </p>
                  </div>

                  {inside && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      İçəridə
                    </span>
                  )}
                  {visit.auto_closed && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      Avtomatik
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
