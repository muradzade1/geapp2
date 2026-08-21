import { useState } from 'react';
import { Bell, User, LogOut, Menu, X, Home, MapPin, Calendar, QrCode, Award, CreditCard, Newspaper, Target } from 'lucide-react';
import { useNotifications } from '../../lib/api/content';
import { fullName, useProfile } from '../../lib/profile';

interface YouthHeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onBack: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Ana səhifə', icon: Home },
  { id: 'youth-houses', label: 'Gənclər Evləri', icon: MapPin },
  { id: 'events', label: 'Tədbirlər', icon: Calendar },
  { id: 'qr-code', label: 'QR Kod', icon: QrCode },
  { id: 'leaderboard', label: 'Liderlik', icon: Award },
  { id: 'genc-kart', label: 'GəncKart', icon: CreditCard },
  { id: 'news', label: 'Xəbərlər', icon: Newspaper },
  { id: 'challenges', label: 'Çağırışlar', icon: Target },
  { id: 'profile', label: 'Şəxsi kabinet', icon: User },
];

export function YouthHeader({ currentView, onNavigate, onBack }: YouthHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { profile, avatarUrl } = useProfile();
  const displayName = fullName(profile);
  const initial = displayName === '—' ? '?' : displayName.charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900">
                <Menu className="w-5 h-5" />
              </button>
              <button onClick={() => onNavigate('dashboard')} className="flex items-center">
                <img
                  src="/Vertical-Main.png"
                  alt="Gənclər Evləri"
                  className="w-9 h-9 object-contain"
                />
              </button>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <button onClick={() => onNavigate('notifications')} className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => onNavigate('profile')} className="p-1.5">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full border-2 border-gray-100 object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-100 bg-emerald-100 text-sm font-semibold text-emerald-700">{initial}</span>}
              </button>
              <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Çıxış">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center">
                <img
                  src="/Vertical-Main.png"
                  alt="Gənclər Evləri"
                  className="w-9 h-9 object-contain"
                />
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-3 p-2">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700">{initial}</span>}
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{displayName}</p>
                  <p className="text-xs text-emerald-700 font-medium">{profile?.email ?? '—'}</p>
                </div>
              </div>
            </div>
            <nav className="p-2 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
