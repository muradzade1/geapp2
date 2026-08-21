import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      (async () => {
        setLoading(true);
        await loadProfile(nextSession);
      })();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
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
