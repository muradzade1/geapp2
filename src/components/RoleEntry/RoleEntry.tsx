import { useRef, useState } from 'react';
import { Users, Building2, GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
type EntryRole = 'youth' | 'trainer' | 'youth_house' | 'admin';

interface RoleEntryProps {
  onSelectRole: (role: EntryRole) => void;
  onRegister: () => void;
}

export function RoleEntry({ onSelectRole, onRegister }: RoleEntryProps) {
  // Admin girişi gizlidir: loqoya 10 dəfə ardıcıl basmaqla açılır.
  // Vebdə əlfəcin üçün `?admin` parametri də işləyir.
  const TAPS_NEEDED = 10;
  const TAP_TIMEOUT_MS = 3000;

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const tapCount = useRef(0);
  const lastTap = useRef(0);

  const fromUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('admin');

  const showAdminEntry = adminUnlocked || fromUrl;

  const handleLogoTap = () => {
    const now = Date.now();

    // Fasilə uzun olubsa, sayğac yenidən başlayır.
    tapCount.current = now - lastTap.current > TAP_TIMEOUT_MS ? 1 : tapCount.current + 1;
    lastTap.current = now;

    if (tapCount.current >= TAPS_NEEDED) {
      tapCount.current = 0;
      setAdminUnlocked(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12 animate-fadeIn">
            <div
              onClick={handleLogoTap}
              className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl mb-6 shadow-lg shadow-emerald-100 p-3 border border-emerald-100 select-none"
            >
              <img
                src="/Vertical-Main.png"
                alt="Gənclər Evləri"
                draggable={false}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              Gənclər Evi Platforması
            </h1>
            <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
              Azərbaycan gəncləri üçün rəqəmsal iştirak, inkişaf və motivasiya platforması
            </p>
          </div>

          <div className="space-y-4 animate-slideUp" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => onSelectRole('youth')}
              className="w-full group relative bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white rounded-2xl p-6 shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold">Gənclər üçün giriş</h2>
                    <p className="text-emerald-100 text-sm mt-0.5">Tədbirlər, xallar, mükafatlar və daha çox</p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onSelectRole('youth_house')}
                className="group bg-white border-2 border-gray-100 hover:border-blue-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-left">Gənclər Evi</h3>
                <p className="text-sm text-gray-500 text-left mt-1">QR skan, giriş-çıxış, statistika</p>
              </button>

              <button
                onClick={() => onSelectRole('trainer')}
                className="group bg-white border-2 border-gray-100 hover:border-amber-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-left">Təlimçi</h3>
                <p className="text-sm text-gray-500 text-left mt-1">Təlimlər, iştirakçılar, feedback</p>
              </button>

              {showAdminEntry && (
                <button
                  onClick={() => onSelectRole('admin')}
                  className="group bg-white border-2 border-gray-100 hover:border-rose-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-left">Admin</h3>
                  <p className="text-sm text-gray-500 text-left mt-1">Canlı analitika, idarəetmə</p>
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-10 animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            Gənclər və İdman Nazirliyi &middot; Azərbaycan Respublikası
          </p>
        </div>
      </div>
    </div>
  );
}
