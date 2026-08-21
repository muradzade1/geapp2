import { Trophy, Medal, Award, MapPin, RefreshCw } from 'lucide-react';
import { useLeaderboard } from '../../lib/api/content';

const MEDAL_TONE = [
  'bg-gradient-to-br from-amber-400 to-yellow-500 text-white',
  'bg-gradient-to-br from-slate-300 to-slate-400 text-white',
  'bg-gradient-to-br from-orange-400 to-amber-600 text-white',
];

export default function LeaderboardPage() {
  const { rows, myId, loading, error, reload } = useLeaderboard(50);

  const myRow = rows.find(row => row.user_id === myId);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const fullName = (row: (typeof rows)[number]) =>
    [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Ad göstərilməyib';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/40 pb-8">
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-300" />
            <h1 className="text-3xl font-bold text-white">Reytinq</h1>
          </div>
          <p className="text-lg text-purple-100">
            Ən çox xal toplayan gənclər
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl space-y-6 px-4 sm:px-6">
        {/* Öz yeriniz */}
        {myRow && (
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
              {myRow.rank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">Sizin yeriniz</p>
              <p className="truncate font-semibold text-gray-800">{fullName(myRow)}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-800">{myRow.points}</p>
              <p className="text-xs text-gray-500">xal</p>
            </div>
            <button
              onClick={() => void reload()}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-50"
              aria-label="Yenilə"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Reytinq yüklənmədi: {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <Award className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">
              Hələ xal toplayan yoxdur. İlk ziyarət və tədbirlərdən sonra reytinq
              formalaşacaq.
            </p>
          </div>
        )}

        {/* İlk üçlük */}
        {podium.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {podium.map((row, index) => (
              <div
                key={row.user_id}
                className={`rounded-2xl p-5 text-center shadow-sm ${MEDAL_TONE[index]}`}
              >
                <Medal className="mx-auto mb-2 opacity-90" size={28} />
                <p className="truncate font-bold">{fullName(row)}</p>
                {row.city && (
                  <p className="flex items-center justify-center gap-1 text-xs opacity-90">
                    <MapPin size={11} />
                    {row.city}
                  </p>
                )}
                <p className="mt-2 text-2xl font-bold">{row.points}</p>
                <p className="text-xs opacity-90">xal</p>
              </div>
            ))}
          </div>
        )}

        {/* Qalanlar */}
        {rest.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-50">
              {rest.map(row => (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-4 px-5 py-3.5 ${
                    row.user_id === myId ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <span className="w-7 text-center text-sm font-semibold text-gray-500">
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {fullName(row)}
                    </p>
                    {row.city && <p className="text-xs text-gray-500">{row.city}</p>}
                  </div>
                  <span className="text-sm font-bold text-gray-800">{row.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
