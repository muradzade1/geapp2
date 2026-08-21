import React, { useState } from 'react';
import {
  Bell,
  ArrowLeft,
  LayoutDashboard,
  QrCode,
  LogIn,
  Calendar,
  DoorOpen,
  FileBarChart,
  Users,
  TrendingUp,
  Activity,
  Clock,
  Monitor,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ScanLine,
  FileDown,
  FileSpreadsheet,
  Building2,
  UserCheck,
  UserMinus,
  Zap,
} from 'lucide-react';
import { youthHouses, events, qrScans } from '../../data/mockData';
import { useProfile } from '../../lib/profile';
import { AccountProfileCard } from '../Profile/AccountProfileCard';
import { RoomsManager } from './RoomsManager';
import { HouseRegistration } from './HouseRegistration';
import { HouseQrDisplay } from './HouseQrDisplay';
import { HouseEventsManager } from './HouseEventsManager';
import { HouseTrainersManager } from './HouseTrainersManager';
import { HouseNotifications } from './HouseNotifications';
import { HouseReports } from './HouseReports';
import { useHouseTodayLog, formatDuration, clock } from '../../lib/api/stats';
import {
  useMyHouse,
  useHouseDashboard,
  formatStay,
  formatTime,
  LIVE_STATUS_LABEL,
} from '../../lib/api/house';
import { useBackHandler } from '../../lib/backHandler';

interface YouthHouseAppProps {
  onBack: () => void;
}

type ViewType = 'dashboard' | 'scanner' | 'checkinout' | 'events' | 'trainers' | 'notifications' | 'rooms' | 'reports';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Xülasə', icon: <LayoutDashboard size={20} /> },
  { id: 'scanner', label: 'QR Skan', icon: <QrCode size={20} /> },
  { id: 'checkinout', label: 'Giriş', icon: <LogIn size={20} /> },
  { id: 'events', label: 'Tədbirlər', icon: <Calendar size={20} /> },
  { id: 'trainers', label: 'Təlimçilər', icon: <Users size={20} /> },
  { id: 'notifications', label: 'Bildirişlər', icon: <Bell size={20} /> },
  { id: 'rooms', label: 'Otaqlar', icon: <DoorOpen size={20} /> },
  { id: 'reports', label: 'Hesabatlar', icon: <FileBarChart size={20} /> },
];

const selectedHouse = youthHouses[0] ?? { id: '', name: '', city: '', region: '', address: '', coordinates: { lat: 0, lng: 0 }, photos: [], services: [], rating: 0, activeEvents: 0, currentVisitors: 0, todayCheckIns: 0, todayCheckOuts: 0, contactPhone: '', workingHours: '', description: '', rooms: [], isActive: false, averageStayDuration: '', feedbackScore: 0, status: 'Sakit' as const };

const liveActivities: Array<{ id: number; name: string; room: string; start: string; end: string; registered: number; attended: number; status: string }> = [];

const checkInOutLog: Array<{ id: number; name: string; timeIn: string; timeOut: string; duration: string; status: string }> = [];

// Room data with occupancy


export function YouthHouseApp({ onBack }: YouthHouseAppProps) {
  const { profile } = useProfile();
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const { house, register: registerHouse } = useMyHouse();
  const { data: hd, error: hdError } = useHouseDashboard(
    house?.status === 'approved' ? house.id : null,
  );
  const { rows: houseLog } = useHouseTodayLog(
    house?.status === 'approved' ? house.id : null,
  );

  useBackHandler(() => {
    if (activeView !== 'dashboard') { setActiveView('dashboard'); return true; }
    return false;
  });
  const houseName = profile?.house_name || '—';
  const [scanType, setScanType] = useState('Giriş');
  const [scanResult, setScanResult] = useState<null | {
    name: string;
    type: string;
    status: string;
    points: number;
  }>(null);
  const [isScanning, setIsScanning] = useState(false);

  const houseEvents = events.filter((e) => e.youthHouseId === selectedHouse.id);
  const houseScans = qrScans.filter((s) => s.youthHouseId === selectedHouse.id).slice(0, 5);

  const handleScan = () => {
    setIsScanning(false);
    setScanResult(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Davam edir':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {status}
          </span>
        );
      case 'Bitib':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            <CheckCircle2 size={12} />
            {status}
          </span>
        );
      case 'Gözləyir':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
            <Clock size={12} />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {status}
          </span>
        );
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <HouseRegistration house={house} onRegister={registerHouse} />
      {hdError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Statistika yüklənmədi: {hdError}
        </div>
      )}
      <AccountProfileCard
        title="Gənclər Evi profili"
        role="youth_house"
        editableFields={[
          { key: 'house_name', label: 'Gənclər Evinin adı' },
          { key: 'city', label: 'Şəhər/Rayon' },
          { key: 'address', label: 'Ünvan' },
          { key: 'phone', label: 'Telefon', type: 'tel' },
          { key: 'responsible_name', label: 'Məsul şəxs' },
          { key: 'responsible_email', label: 'Məsul şəxsin e-poçtu', type: 'email' },
        ]}
        extras={[
          { label: 'Şəhər', value: profile?.city ?? '' },
          { label: 'Ünvan', value: profile?.address ?? '' },
          { label: 'Telefon', value: profile?.phone ?? '' },
          { label: 'Məsul şəxs', value: profile?.responsible_name ?? '' },
        ]}
      />
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Users size={22} className="opacity-80" />
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Canlı</span>
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.current_visitors}</p>
          <p className="mt-1 text-xs opacity-80">Hazırda məkanda olan gənclər</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <UserCheck size={22} className="opacity-80" />
            <TrendingUp size={16} className="opacity-60" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.today_check_ins}</p>
          <p className="mt-1 text-xs opacity-80">Bu gün giriş sayı</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-red-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <UserMinus size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.today_check_outs}</p>
          <p className="mt-1 text-xs opacity-80">Bu gün çıxış sayı</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Zap size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.today_events}</p>
          <p className="mt-1 text-xs opacity-80">Bu gün keçirilən fəaliyyətlər</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Activity size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.today_participants}</p>
          <p className="mt-1 text-xs opacity-80">Bugünkü iştirakçı sayı</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-teal-500 to-green-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Monitor size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-lg font-bold sm:text-xl">{hd.busiest_room ?? '—'}</p>
          <p className="mt-1 text-xs opacity-80">Ən aktiv otaq</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <TrendingUp size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{hd.month_visits}</p>
          <p className="mt-1 text-xs opacity-80">Bu ay toplam ziyarət</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <Timer size={22} className="opacity-80" />
          </div>
          <p className="mt-3 text-2xl font-bold sm:text-3xl">{formatStay(hd.average_stay_minutes)}</p>
          <p className="mt-1 text-xs opacity-80">Orta qalma müddəti</p>
        </div>
      </div>

      {/* Live Activities Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800">Canlı Fəaliyyət</h3>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500">Canlı</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Fəaliyyət adı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Otaq</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Başlanğıc</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Bitmə</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Qeydiyyat</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">İştirak</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hd.today_activity.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Bu gün fəaliyyət yoxdur</td></tr>}{hd.today_activity.map((act) => (
                <tr key={act.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{act.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{act.room_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTime(act.starts_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTime(act.ends_at)}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{act.registered_count}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{act.attended_count}</td>
                  <td className="px-4 py-3">{getStatusBadge(LIVE_STATUS_LABEL[act.live_status])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderScanner = () => (
    <HouseQrDisplay
      houseId={house?.status === 'approved' ? house.id : null}
      houseName={house?.name}
    />
  );

  const renderCheckInOut = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Bugünkü Giriş-Çıxış Qeydləri</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Cəmi: {houseLog.length} nəfər
          </span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Məkanda: {houseLog.filter((l) => l.is_inside).length}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Ad Soyad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Giriş vaxtı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Çıxış vaxtı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Müddət</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {houseLog.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Bu gün hələ giriş qeydə alınmayıb</td></tr>}{houseLog.map((entry, index) => (
                <tr key={entry.visit_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{entry.full_name ?? 'Ad göstərilməyib'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{clock(entry.entered_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{clock(entry.exited_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDuration(entry.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    {entry.is_inside ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Məkanda
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <XCircle size={12} />
                        {entry.auto_closed ? 'Avtomatik bağlanıb' : 'Çıxıb'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <HouseNotifications
      houseId={house?.status === 'approved' ? house.id : null}
    />
  );

  const renderTrainers = () => (
    <HouseTrainersManager
      houseId={house?.status === 'approved' ? house.id : null}
    />
  );

  const renderEvents = () => (
    <HouseEventsManager
      houseId={house?.status === 'approved' ? house.id : null}
    />
  );

  const renderRooms = () => <RoomsManager />;

  const renderReports = () => (
    <HouseReports
      houseId={house?.status === 'approved' ? house.id : null}
    />
  );

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return renderDashboard();
      case 'scanner':
        return renderScanner();
      case 'checkinout':
        return renderCheckInOut();
      case 'events':
        return renderEvents();
      case 'trainers':
        return renderTrainers();
      case 'notifications':
        return renderNotifications();
      case 'rooms':
        return renderRooms();
      case 'reports':
        return renderReports();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 px-4 py-3 text-white shadow-lg sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold sm:text-lg">Gənclər Evi Paneli</h1>
              <p className="text-xs text-blue-200">{houseName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium">Canlı rejim</span>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px]">Canlı</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-56 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span className={activeView === item.id ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-colors ${
                activeView === item.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={activeView === item.id ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {activeView === item.id && (
                <span className="mt-0.5 h-0.5 w-4 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
