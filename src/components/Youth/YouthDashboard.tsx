import React from 'react';
import {
  Trophy,
  MapPin,
  Calendar,
  QrCode,
  Gift,
  CreditCard,
  Target,
  TrendingUp,
  CheckCircle,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useProfile } from '../../lib/profile';
import { useYouthStats } from '../../lib/api/stats';
import { useEvents } from '../../lib/api/events';
import { useChallenges } from '../../lib/api/catalog';

interface YouthDashboardProps {
  onNavigate: (view: string) => void;
}

const YouthDashboard: React.FC<YouthDashboardProps> = ({ onNavigate }) => {
  const { profile, avatarUrl } = useProfile();
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Gənc';
  const { stats: youthStats } = useYouthStats();
  const { events: allEvents } = useEvents();
  const { items: allChallenges } = useChallenges();

  const upcomingEvents = allEvents
    .filter(item => item.status === 'published')
    .slice(0, 3);
  const activeChallenges = allChallenges
    .filter(item => !item.completed_at)
    .slice(0, 3);

  const stats = [
    {
      label: 'Toplam Xallarınız',
      value: `${youthStats.points} xal`,
      icon: Trophy,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      label: 'Ziyarət Sayı',
      value: String(youthStats.visit_count),
      icon: MapPin,
      gradient: 'from-cyan-500 to-blue-600',
    },
    {
      label: 'İştirak Etdiyi Tədbirlər',
      value: String(youthStats.events_attended),
      icon: Calendar,
      gradient: 'from-rose-500 to-pink-600',
    },
    {
      label: 'Tamamladığı Çağırışlar',
      value: String(youthStats.challenges_completed),
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-green-600',
    },
  ];

  const quickActions = [
    {
      label: 'QR Kod Skan Et',
      icon: QrCode,
      gradient: 'from-violet-500 to-purple-700',
      view: 'qr-scanner',
    },
    {
      label: 'Tədbirlərə Bax',
      icon: Calendar,
      gradient: 'from-blue-500 to-indigo-700',
      view: 'events',
    },
    {
      label: 'Gənclər Evləri',
      icon: MapPin,
      gradient: 'from-emerald-500 to-teal-700',
      view: 'youth-houses',
    },
    {
      label: 'GəncKart',
      icon: CreditCard,
      gradient: 'from-pink-500 to-rose-700',
      view: 'genc-kart',
    },
  ];

  const categoryColors: Record<string, string> = {
    'Startap və İnnovasiya': 'bg-violet-100 text-violet-700',
    'İdman': 'bg-blue-100 text-blue-700',
    'Sağlamlıq': 'bg-green-100 text-green-700',
    'Natiqlik': 'bg-amber-100 text-amber-700',
    'Ekoloji Fəaliyyətlər': 'bg-emerald-100 text-emerald-700',
    'Səyahət və Səyyar Fəaliyyətlər': 'bg-cyan-100 text-cyan-700',
    'İnklüzivlik': 'bg-pink-100 text-pink-700',
    'Təlim və İnkişaf': 'bg-indigo-100 text-indigo-700',
    'Mədəniyyət və İncəsənət': 'bg-rose-100 text-rose-700',
    'Könüllülük': 'bg-teal-100 text-teal-700',
  };

  const challengeBorderColors: Record<string, string> = {
    'Ziyarət': 'border-l-blue-500 bg-blue-50',
    'Tədbir': 'border-l-purple-500 bg-purple-50',
    'Feedback': 'border-l-amber-500 bg-amber-50',
    'Təlim': 'border-l-emerald-500 bg-emerald-50',
    'Könüllülük': 'border-l-rose-500 bg-rose-50',
    'İdman': 'border-l-cyan-500 bg-cyan-50',
    'Əyləncə': 'border-l-orange-500 bg-orange-50',
  };

  const challengeProgressColors: Record<string, string> = {
    'Ziyarət': 'bg-blue-500',
    'Tədbir': 'bg-purple-500',
    'Feedback': 'bg-amber-500',
    'Təlim': 'bg-emerald-500',
    'Könüllülük': 'bg-rose-500',
    'İdman': 'bg-cyan-500',
    'Əyləncə': 'bg-orange-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl ?? undefined}
              alt={displayName}
              className="w-16 h-16 rounded-full border-3 border-white/30 object-cover shadow-lg"
            />
            <div>
              <p className="text-emerald-100 text-sm font-medium">Xoş gəldiniz!</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {displayName}
              </h1>
              <p className="text-emerald-100 text-sm mt-1">
                Gənclər Evləri platformasına davam edin
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`bg-gradient-to-br ${stat.gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="w-6 h-6 text-white/80" />
                <TrendingUp className="w-4 h-4 text-white/50" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
              <p className="text-xs sm:text-sm text-white/80 mt-1 leading-tight">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
            Surətli Əməliyyatlar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className={`bg-gradient-to-br ${action.gradient} rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex flex-col items-center gap-3 text-center`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Challenges */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Aktiv bildirişlər
            </h2>
            <button
              onClick={() => onNavigate('challenges')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors"
            >
              Hamısına bax
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeChallenges.map((challenge) => {
              const progressPercent = Math.round(
                (challenge.progress / challenge.target) * 100
              );
              const borderColor =
                challengeBorderColors[challenge.category] ||
                'border-l-gray-500 bg-gray-50';
              const progressColor =
                challengeProgressColors[challenge.category] || 'bg-gray-500';

              return (
                <div
                  key={challenge.id}
                  className={`border-l-4 ${borderColor} rounded-2xl p-5 shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-800 text-sm">
                        {challenge.title}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                      +{challenge.rewardPoints} xal
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {challenge.description}
                  </p>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>
                        {challenge.progress}/{challenge.target} tamamlanıb
                      </span>
                      <span className="font-semibold">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Son tarix: {challenge.endDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Yaxınlaşan Tədbirlər
            </h2>
            <button
              onClick={() => onNavigate('events')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors"
            >
              Hamısına bax
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map((event) => {
              const categoryColor =
                categoryColors[event.category] || 'bg-gray-100 text-gray-700';

              return (
                <div
                  key={event.id}
                  onClick={() => onNavigate('events')}
                  className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 cursor-pointer border border-gray-100"
                >
                  <div className="relative">
                    <img
                      src={event.image}
                      alt={event.title}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <span
                        className={`${categoryColor} text-xs font-semibold px-3 py-1 rounded-full`}
                      >
                        {event.category}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="bg-white/90 backdrop-blur-sm text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Trophy className="w-3 h-3" />+{event.points} xal
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 text-sm mb-2 line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {event.description}
                    </p>
                    <div className="flex flex-col gap-1.5 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>
                          {event.date} | {event.startTime} - {event.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>
                          {event.registeredCount}/{event.capacity} qeydiyyat
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouthDashboard;
