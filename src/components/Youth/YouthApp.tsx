import { useState } from 'react';
import { YouthHeader } from './YouthHeader';
import YouthDashboard from './YouthDashboard';
import YouthHousesPage from '../YouthHouses/YouthHousesPage';
import EventsPage from '../Events/EventsPage';
import QRCodePage from '../QRScanner/QRCodePage';
import LeaderboardPage from '../Leaderboard/LeaderboardPage';
import GencKartPage from '../GencKart/GencKartPage';
import { NewsPage } from '../News/NewsPage';
import { ProfilePage } from '../Profile/ProfilePage';
import { ChallengesPage } from '../Challenges/ChallengesPage';
import NotificationsPage from '../Notifications/NotificationsPage';
import FeedbackPage from '../Feedback/FeedbackPage';
import { useBackHandler } from '../../lib/backHandler';

interface YouthAppProps {
  onBack: () => void;
}

export function YouthApp({ onBack }: YouthAppProps) {
  const [view, setView] = useState('dashboard');

  useBackHandler(() => {
    if (view !== 'dashboard') { setView('dashboard'); return true; }
    return false;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <YouthHeader currentView={view} onNavigate={setView} onBack={onBack} />
      <main className="pb-20 lg:pb-0">
        {view === 'dashboard' && <YouthDashboard onNavigate={setView} />}
        {view === 'youth-houses' && <YouthHousesPage />}
        {view === 'events' && <EventsPage />}
        {view === 'qr-code' && <QRCodePage />}
        {view === 'leaderboard' && <LeaderboardPage />}
        {view === 'genc-kart' && <GencKartPage />}
        {view === 'news' && <NewsPage />}
        {view === 'profile' && <ProfilePage />}
        {view === 'challenges' && <ChallengesPage />}
        {view === 'notifications' && <NotificationsPage />}
        {view === 'feedback' && <FeedbackPage />}
      </main>
      <MobileNav currentView={view} onNavigate={setView} />
    </div>
  );
}

function MobileNav({ currentView, onNavigate }: { currentView: string; onNavigate: (v: string) => void }) {
  const items = [
    { id: 'dashboard', label: 'Ana səhifə', icon: 'home' },
    { id: 'events', label: 'Tədbirlər', icon: 'calendar' },
    { id: 'qr-code', label: 'QR Kod', icon: 'qr' },
    { id: 'profile', label: 'Profil', icon: 'user' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                active ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <NavIcon name={item.icon} active={active} />
              <span className="mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const cls = `w-5 h-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`;
  switch (name) {
    case 'home':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case 'calendar':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case 'qr':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>;
    case 'gift':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a4 4 0 00-4-4c-1.38 0-2.63.56-3.54 1.46M12 8V6a4 4 0 014-4c1.38 0 2.63.56 3.54 1.46M21 12h-9m9 0v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8m18 0H3m0 0V8a2 2 0 012-2h14a2 2 0 012 2v4" /></svg>;
    case 'user':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    default:
      return null;
  }
}
