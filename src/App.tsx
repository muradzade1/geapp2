import { useState } from 'react';
import { ProfileProvider, useProfile } from './lib/profile';
import { RoleEntry } from './components/RoleEntry/RoleEntry';
import { AuthFlow } from './components/Auth/AuthFlow';
import { YouthApp } from './components/Youth/YouthApp';
import { YouthHouseApp } from './components/YouthHouseStaff/YouthHouseApp';
import { TrainerApp } from './components/TrainerDashboard/TrainerApp';
import AdminApp from './components/Admin/AdminApp';

type AccountRole = 'youth' | 'trainer' | 'youth_house' | 'admin';

function StatusScreen({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-gray-600 leading-relaxed">{description}</p>
        <button onClick={onBack} className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">
          Geri qayıt
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { session, profile, loading, signOut } = useProfile();
  const [screen, setScreen] = useState<'landing' | 'auth'>('landing');
  const [requestedRole, setRequestedRole] = useState<AccountRole>('youth');

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">Yüklənir...</div>;
  }

  if (session && profile) {
    if (profile.role !== 'admin' && profile.status !== 'approved') {
      const description = profile.status === 'pending'
        ? 'Hesabınız hələ administrator tərəfindən təsdiqlənməyib.'
        : profile.status === 'rejected'
          ? 'Qeydiyyatınız administrator tərəfindən təsdiqlənməyib.'
          : 'Hesabınız müvəqqəti olaraq dayandırılıb.';
      return <StatusScreen title="Hesab təsdiqi gözlənilir" description={description} onBack={() => void signOut()} />;
    }

    const handleBack = () => void signOut();
    switch (profile.role) {
      case 'youth': return <YouthApp onBack={handleBack} />;
      case 'youth_house': return <YouthHouseApp onBack={handleBack} />;
      case 'trainer': return <TrainerApp onBack={handleBack} />;
      case 'admin': return <AdminApp onBack={handleBack} />;
    }
  }

  if (session && !profile) {
    return <StatusScreen title="Hesab məlumatları tapılmadı" description="Hesabınız üçün profil qeydiyyatı yoxdur. Administratorla əlaqə saxlayın." onBack={() => void signOut()} />;
  }

  if (screen === 'auth') {
    return <AuthFlow initialRole={requestedRole} onBack={() => setScreen('landing')} />;
  }

  return <RoleEntry onSelectRole={(role) => { setRequestedRole(role); setScreen('auth'); }} onRegister={() => { setRequestedRole('youth'); setScreen('auth'); }} />;
}

export default function App() {
  return <ProfileProvider><AppShell /></ProfileProvider>;
}
