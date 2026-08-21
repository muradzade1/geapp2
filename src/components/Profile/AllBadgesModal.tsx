import { useMemo, useState } from 'react';
import {
  X, Lock, Award, MapPin, Compass, Map, Repeat, Building2,
  Calendar, CalendarHeart, QrCode, CalendarCheck, Star,
  Heart, HandHeart, Users, HeartHandshake,
  BookOpen, GraduationCap, Mic, Cpu, ScrollText,
  MessageSquare, MessagesSquare, BadgeCheck, ClipboardCheck,
  Leaf, Sprout, Dumbbell, HeartPulse,
  Crown, Shield, Trophy, UserCheck, Sparkles, CheckCircle2,
} from 'lucide-react';
import type { Badge, BadgeCategory } from '../../types';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Compass, Map, Repeat, Building2,
  Calendar, CalendarHeart, QrCode, CalendarCheck, Star,
  Heart, HandHeart, Users, HeartHandshake,
  BookOpen, GraduationCap, Mic, Cpu, ScrollText,
  MessageSquare, MessagesSquare, BadgeCheck, ClipboardCheck,
  Leaf, Sprout, Dumbbell, HeartPulse,
  Crown, Shield, Trophy, UserCheck, Sparkles,
};

const categories: ('Hamısı' | BadgeCategory)[] = [
  'Hamısı',
  'Ziyarət',
  'Tədbir və iştirak',
  'Könüllülük',
  'Təlim və inkişaf',
  'Rəy və keyfiyyət',
  'Ekologiya, sağlamlıq və idman',
  'Liderlik və nailiyyət',
];

interface AllBadgesModalProps {
  badges: Badge[];
  onClose: () => void;
}

export default function AllBadgesModal({ badges, onClose }: AllBadgesModalProps) {
  const [activeCategory, setActiveCategory] = useState<typeof categories[number]>('Hamısı');
  const [selected, setSelected] = useState<Badge | null>(null);

  const filtered = useMemo(() => {
    if (activeCategory === 'Hamısı') return badges;
    return badges.filter((b) => b.category === activeCategory);
  }, [badges, activeCategory]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-50 w-full sm:max-w-5xl sm:max-h-[90vh] sm:rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">Bütün nişanlar</h2>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5 ml-1">
                {unlockedCount} / {badges.length}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Nişanları qazanmaq üçün şərtləri tamamlayın və fəaliyyətinizi artırın
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Bağla"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((badge) => {
              const Icon = iconMap[badge.icon] ?? Award;
              const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100));
              return (
                <button
                  key={badge.id}
                  onClick={() => setSelected(badge)}
                  className={`relative text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    badge.unlocked
                      ? 'bg-gradient-to-b from-amber-50 to-white border-amber-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        badge.unlocked
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${badge.unlocked ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    {badge.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Qazanılıb
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" />
                        Qazanılmayıb
                      </span>
                    )}
                  </div>
                  <h3 className={`text-sm font-semibold mb-0.5 ${badge.unlocked ? 'text-gray-900' : 'text-gray-700'}`}>
                    {badge.name}
                  </h3>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">{badge.category}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{badge.condition}</p>
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          badge.unlocked ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {badge.progress} / {badge.target}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-16">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Bu kateqoriyada nişan yoxdur</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function BadgeDetailModal({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  const Icon = iconMap[badge.icon] ?? Award;
  const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className={`px-6 pt-8 pb-6 text-center ${
          badge.unlocked
            ? 'bg-gradient-to-b from-amber-50 to-white'
            : 'bg-gradient-to-b from-gray-50 to-white'
        }`}>
          <div
            className={`mx-auto mb-4 w-20 h-20 rounded-2xl flex items-center justify-center ${
              badge.unlocked
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200'
                : 'bg-gray-200'
            }`}
          >
            <Icon className={`w-10 h-10 ${badge.unlocked ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{badge.category}</p>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{badge.name}</h3>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">{badge.description}</p>
        </div>

        <div className="px-6 py-5 border-t border-gray-100 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Şərt</p>
            <p className="text-sm text-gray-800">{badge.condition}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">İrəliləyiş</p>
              <p className="text-sm font-semibold text-gray-700">{badge.progress} / {badge.target}</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  badge.unlocked ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Status</p>
            {badge.unlocked ? (
              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                Qazanılıb {badge.unlockedDate && `\u00b7 ${badge.unlockedDate}`}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                <Lock className="w-4 h-4" />
                Qazanılmayıb
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
