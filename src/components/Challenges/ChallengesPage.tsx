import { Target, Trophy, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useChallenges } from '../../lib/api/catalog';

const METRIC_LABEL: Record<string, string> = {
  visits: 'Gənclər Evinə ziyarət',
  events: 'Tədbir iştirakı',
  manual: 'Əl ilə qeyd olunur',
};

export function ChallengesPage() {
  const { items, loading, error, reload } = useChallenges();

  const active = items.filter(item => !item.completed_at);
  const completed = items.filter(item => item.completed_at);

  const card = (item: (typeof items)[number]) => {
    const percent = Math.min(100, Math.round((item.progress / item.target) * 100));
    const done = item.completed_at != null;

    return (
      <div
        key={item.id}
        className={`rounded-2xl border p-5 shadow-sm transition ${
          done ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-white'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="mb-1.5 inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
              {item.category}
            </span>
            <h3 className="font-bold text-gray-800">{item.title}</h3>
          </div>
          {item.reward_points > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
              <Trophy size={12} />+{item.reward_points}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mb-3 text-sm text-gray-500">{item.description}</p>
        )}

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">{METRIC_LABEL[item.metric] ?? item.metric}</span>
          <span className="font-semibold text-gray-800">
            {item.progress} / {item.target}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              done ? 'bg-emerald-500' : 'bg-purple-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          {done ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 size={14} />
              Tamamlandı
            </span>
          ) : (
            <span className="text-gray-400">{percent}% tamamlanıb</span>
          )}

          {item.ends_at && !done && (
            <span className="flex items-center gap-1 text-gray-400">
              <Clock size={12} />
              {new Date(item.ends_at).toLocaleDateString('az-AZ')} tarixinə qədər
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/40 to-fuchsia-50/40 pb-12">
      <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <Target className="h-8 w-8 text-purple-200" />
            <h1 className="text-3xl font-bold text-white">Çağırışlar</h1>
          </div>
          <p className="text-lg text-purple-100">
            Hədəfləri tamamlayın, əlavə xal qazanın
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl space-y-6 px-4 sm:px-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-lg">
          <div>
            <p className="text-sm text-gray-500">Aktiv çağırış</p>
            <p className="text-2xl font-bold text-gray-800">{active.length}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Tamamlanmış</p>
            <p className="text-2xl font-bold text-emerald-600">{completed.length}</p>
          </div>
          <button
            onClick={() => void reload()}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-50"
            aria-label="Yenilə"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Çağırışlar yüklənmədi: {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <Target className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hazırda aktiv çağırış yoxdur. Yeni çağırışlar əlavə olunanda burada
              görünəcək.
            </p>
          </div>
        )}

        {active.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-700">Aktiv çağırışlar</h2>
            {active.map(card)}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-700">Tamamlanmışlar</h2>
            {completed.map(card)}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChallengesPage;
