import {
  Bell,
  Calendar,
  Trophy,
  Gift,
  Target,
  Newspaper,
  Clock,
  Info,
  CheckCheck,
} from 'lucide-react';
import { useNotifications, relativeTime } from '../../lib/api/content';
import { SoundSettingsCard } from './SoundSettingsCard';

const TYPE_ICON: Record<string, typeof Bell> = {
  event: Calendar,
  points: Trophy,
  reward: Gift,
  challenge: Target,
  news: Newspaper,
  reminder: Clock,
  system: Info,
};

const TYPE_TONE: Record<string, string> = {
  event: 'bg-blue-50 text-blue-600',
  points: 'bg-amber-50 text-amber-600',
  reward: 'bg-rose-50 text-rose-600',
  challenge: 'bg-purple-50 text-purple-600',
  news: 'bg-sky-50 text-sky-600',
  reminder: 'bg-orange-50 text-orange-600',
  system: 'bg-gray-100 text-gray-600',
};

export default function NotificationsPage() {
  const { items, loading, error, unreadCount, markRead, markAllRead } =
    useNotifications();

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <Bell className="h-8 w-8 text-emerald-200" />
            <h1 className="text-3xl font-bold text-white">Bildirişlər</h1>
          </div>
          <p className="text-lg text-emerald-100">
            {unreadCount > 0 ? `${unreadCount} oxunmamış bildiriş` : 'Hamısı oxunub'}
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-2xl space-y-4 px-4 sm:px-6">
        <SoundSettingsCard />

        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-300"
          >
            <CheckCheck size={15} />
            Hamısını oxunmuş kimi işarələ
          </button>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bildirişlər yüklənmədi: {error}
          </div>
        )}

        {loading && <p className="py-10 text-center text-sm text-gray-500">Yüklənir...</p>}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <Bell className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="text-sm text-gray-500">Hələ bildirişiniz yoxdur.</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => {
            const Icon = TYPE_ICON[item.type] ?? Info;
            const tone = TYPE_TONE[item.type] ?? TYPE_TONE.system;

            return (
              <button
                key={item.id}
                onClick={() => !item.read && void markRead(item.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  item.read
                    ? 'border-gray-100 bg-white'
                    : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                }`}
              >
                <div className={`rounded-xl p-2 ${tone}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800">{item.title}</p>
                    {!item.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{item.message}</p>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {relativeTime(item.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
