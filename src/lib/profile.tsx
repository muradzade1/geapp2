import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

export type AccountRole = 'youth' | 'trainer' | 'youth_house' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface PlatformProfile {
  id: string;
  role: AccountRole;
  status: AccountStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  birth_date: string | null;
  education: string | null;
  employment_status: string | null;
  youth_house_name: string | null;
  specialization: string | null;
  teaching_direction: string | null;
  workplace: string | null;
  work_experience: string | null;
  bio: string | null;
  house_name: string | null;
  responsible_name: string | null;
  responsible_email: string | null;
  avatar_path: string | null;
  created_at: string;
}

interface ProfileContextValue {
  session: Session | null;
  profile: PlatformProfile | null;
  avatarUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Giriş qapısı: AuthFlow daxil olmazdan əvvəl seçilmiş bölmənin rolunu bildirir.
 * Hesabın rolu uyğun gəlmirsə, panel açılmır, çıxış edilir və xəta giriş ekranına ötürülür.
 */
export const loginGate: { role: AccountRole | null; at: number; mismatch: boolean; error: string } = {
  role: null,
  at: 0,
  mismatch: false,
  error: '',
};
export function armLoginGate(role: AccountRole) {
  loginGate.role = role;
  loginGate.at = Date.now();
  loginGate.mismatch = false;
  loginGate.error = '';
}
export function disarmLoginGate() {
  loginGate.role = null;
}
const GATE_ROLE_NAMES: Record<string, string> = {
  youth: 'Gənc',
  trainer: 'Təlimçi',
  youth_house: 'Gənclər Evi',
  admin: 'Administrator',
};

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAvatar = async (avatarPath: string | null) => {
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    const { data } = await supabase.storage.from('account-photos').createSignedUrl(avatarPath, 60 * 60);
    setAvatarUrl(data?.signedUrl ?? null);
  };

  const loadProfile = async (currentSession: Session | null) => {
    if (!currentSession) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      setAvatarUrl(null);
    } else {
      const nextProfile = data as PlatformProfile;
      setProfile(nextProfile);
      await refreshAvatar(nextProfile.avatar_path);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    let knownUserId: string | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      knownUserId = data.session?.user.id ?? null;
      void loadProfile(data.session);
    });

    const handleAuthChange = (event: string, nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      const nextUserId = nextSession?.user.id ?? null;
      const sameUser = nextUserId !== null && nextUserId === knownUserId;
      knownUserId = nextUserId;
      (async () => {
        // Eyni istifadəçi (tətbiqə qayıdış, token yenilənməsi): ekranı "Yüklənir"ə çevirmirik,
        // yoxsa açıq formalar və tablar silinir. Profil yalnız USER_UPDATED zamanı səssiz yenilənir.
        if (sameUser) {
          if (event === 'USER_UPDATED') await loadProfile(nextSession);
          return;
        }
        setLoading(true);
        await loadProfile(nextSession);
      })();
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const gateRole = loginGate.role;
      if (event === 'SIGNED_IN' && nextSession && gateRole && Date.now() - loginGate.at < 15000) {
        loginGate.role = null; // yalnız bir dəfə
        void (async () => {
          let wrongRole: string | null = null;
          try {
            const { data: row } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', nextSession.user.id)
              .maybeSingle();
            if (row && row.role !== gateRole) wrongRole = row.role as string;
          } catch {
            /* yoxlama alınmasa, adi qaydada davam edirik */
          }
          if (wrongRole) {
            const own = GATE_ROLE_NAMES[wrongRole] ?? wrongRole;
            const message = 'Bu hesab "' + own + '" hesabıdır. Geri qayıdıb "' + own + '" bölməsindən daxil olun.';
            loginGate.mismatch = true;
            loginGate.error = message;
            window.setTimeout(() => {
              loginGate.mismatch = false;
              loginGate.error = '';
            }, 5000);
            window.dispatchEvent(new CustomEvent('login-role-mismatch', { detail: message }));
            await supabase.auth.signOut();
            return;
          }
          handleAuthChange(event, nextSession);
        })();
        return;
      }
      handleAuthChange(event, nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Hesabın hansı platformadan (android / ios / web) istifadə olunduğunu bazaya bildirir.
  useEffect(() => {
    if (!profile?.id) return;
    void (async () => {
      try {
        await supabase.rpc('set_my_platform', { p_platform: Capacitor.getPlatform() });
      } catch {
        /* platforma yazılmasa da tətbiq işləməlidir */
      }
    })();
  }, [profile?.id]);

  const refresh = async () => {
    await loadProfile(session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAvatarUrl(null);
  };

  return <ProfileContext.Provider value={{ session, profile, avatarUrl, loading, refresh, signOut }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}

export function formatOrDash(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : '—';
}

export function fullName(profile: PlatformProfile | null) {
  if (!profile) return '—';
  const combined = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
  return combined.length > 0 ? combined : profile.email || '—';
}
