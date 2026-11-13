import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import {
  cacheProfile,
  clearCachedProfile,
  clearStoredSession,
  flushScanQueue,
  isNetworkError,
  readCachedProfile,
  readStoredSession,
} from './offline'; // OFFLINE-PATCH

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
  offline: boolean;
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
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);
  const markOffline = (value: boolean) => {
    offlineRef.current = value;
    setOffline(value);
  };

  const refreshAvatar = async (avatarPath: string | null) => {
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    const { data } = await supabase.storage.from('account-photos').createSignedUrl(avatarPath, 60 * 60);
    setAvatarUrl(data?.signedUrl ?? null);
  };

  const loadProfile = async (currentSession: Session | null, provisional = false) => {
    if (!currentSession) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let data: unknown = null;
    let error: unknown = null;
    try {
      const result = await Promise.race([
        supabase.from('profiles').select('*').eq('id', currentSession.user.id).maybeSingle(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('timeout')), 8000);
        }),
      ]);
      data = result.data;
      error = result.error;
    } catch (e) {
      error = e;
    }

    // İnternet yoxdur: əvvəl saxlanmış profil ilə oflayn rejimə keçirik.
    if (error && isNetworkError(error)) {
      const cached = readCachedProfile<PlatformProfile>(currentSession.user.id);
      setSession(currentSession);
      setProfile(cached);
      markOffline(true);
      setLoading(false);
      return;
    }

    if (error || !data) {
      if (provisional) {
        // Cihazdakı köhnə sessiya artıq etibarsızdır.
        setSession(null);
      }
      setProfile(null);
      setAvatarUrl(null);
    } else {
      const nextProfile = data as PlatformProfile;
      if (provisional) setSession(currentSession);
      setProfile(nextProfile);
      cacheProfile(nextProfile);
      markOffline(false);
      void flushScanQueue();
      void import('./api/qr').then((m) => m.prepareScanner()).catch(() => {});
      try {
        await refreshAvatar(nextProfile.avatar_path);
      } catch {
        /* şəkil yüklənməsə də tətbiq işləməlidir */
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    let knownUserId: string | null = null;
    void (async () => {
      let found: Session | null = null;
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), 6000);
          }),
        ]);
        found = result ? result.data.session : null;
      } catch {
        found = null;
      }
      if (!active) return;
      let provisional = false;
      if (!found) {
        // İnternet yoxdur və token yenilənə bilmir: cihazdakı sessiya ilə davam edirik.
        found = readStoredSession();
        provisional = found !== null;
      }
      setSession(found);
      knownUserId = found?.user.id ?? null;
      void loadProfile(found, provisional);
    })();

    const handleAuthChange = (event: string, nextSession: Session | null) => {
      if (!active) return;
      // Oflayn başlanğıcda boş INITIAL_SESSION cihazdakı sessiyanı silməsin.
      if (event === 'INITIAL_SESSION' && !nextSession && readStoredSession()) return;
      setSession(nextSession);
      const nextUserId = nextSession?.user.id ?? null;
      const sameUser = nextUserId !== null && nextUserId === knownUserId;
      knownUserId = nextUserId;
      (async () => {
        // Eyni istifadəçi (tətbiqə qayıdış, token yenilənməsi): ekranı "Yüklənir"ə çevirmirik,
        // yoxsa açıq formalar və tablar silinir. Profil yalnız USER_UPDATED zamanı səssiz yenilənir.
        if (sameUser) {
          if (event === 'USER_UPDATED' || offlineRef.current) await loadProfile(nextSession);
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

  // Oflayn rejimdə: internet qayıdanda (və ya hər 20 saniyədən bir) yenidən qoşulmağa çalışır.
  useEffect(() => {
    if (!offline) return;
    let stop = false;
    const tryReconnect = async () => {
      if (stop) return;
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), 6000);
          }),
        ]);
        const live = result ? result.data.session : null;
        const current = live ?? readStoredSession();
        if (current && !stop) await loadProfile(current, !live);
      } catch {
        /* hələ də oflayn */
      }
    };
    window.addEventListener('online', tryReconnect);
    const timer = window.setInterval(tryReconnect, 20000);
    return () => {
      stop = true;
      window.removeEventListener('online', tryReconnect);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  // Növbədə gözləyən oflayn skanları internet olanda göndərir.
  useEffect(() => {
    if (!profile?.id) return;
    const run = () => {
      void flushScanQueue();
    };
    window.addEventListener('online', run);
    const timer = window.setInterval(run, 30000);
    return () => {
      window.removeEventListener('online', run);
      window.clearInterval(timer);
    };
  }, [profile?.id]);

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
    try {
      await supabase.auth.signOut();
    } catch {
      /* oflayn çıxış */
    }
    clearCachedProfile();
    clearStoredSession();
    markOffline(false);
    setSession(null);
    setProfile(null);
    setAvatarUrl(null);
  };

  return <ProfileContext.Provider value={{ session, profile, avatarUrl, loading, offline, refresh, signOut }}>{children}</ProfileContext.Provider>;
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
