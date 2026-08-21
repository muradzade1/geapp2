import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/* ═══ Çağırışlar ═══════════════════════════════════════════ */

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  reward_points: number;
  target: number;
  metric: 'manual' | 'visits' | 'events';
  starts_at: string;
  ends_at: string | null;
};

export type ChallengeProgress = {
  challenge_id: string;
  progress: number;
  completed_at: string | null;
};

export type ChallengeWithProgress = Challenge & {
  progress: number;
  completed_at: string | null;
};

/**
 * Aktiv çağırışlar və istifadəçinin irəliləyişi.
 *
 * Yüklənməzdən əvvəl `sync_my_challenges()` çağırılır — irəliləyiş ziyarət və
 * tədbir sayından yenidən hesablanır, tamamlanan varsa xal verilir.
 */
export function useChallenges() {
  const [items, setItems] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(0);

  const load = useCallback(async () => {
    // İrəliləyişi yenilə
    const sync = await supabase.rpc('sync_my_challenges');
    if (!sync.error) setJustCompleted((sync.data as number) ?? 0);

    const [list, progress] = await Promise.all([
      supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase.from('challenge_progress').select('challenge_id, progress, completed_at'),
    ]);

    if (list.error) {
      setError(list.error.message);
      setLoading(false);
      return;
    }

    const progressMap: Record<string, ChallengeProgress> = {};
    ((progress.data as ChallengeProgress[]) ?? []).forEach(row => {
      progressMap[row.challenge_id] = row;
    });

    setItems(
      ((list.data as Challenge[]) ?? []).map(challenge => ({
        ...challenge,
        progress: progressMap[challenge.id]?.progress ?? 0,
        completed_at: progressMap[challenge.id]?.completed_at ?? null,
      })),
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, justCompleted, reload: load };
}

/* ═══ GəncKart ═════════════════════════════════════════════ */

export type Partner = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  discount: number;
  is_active: boolean;
};

export type PartnerUsage = {
  id: string;
  partner_id: string;
  used_at: string;
};

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [usages, setUsages] = useState<PartnerUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, mine] = await Promise.all([
      supabase
        .from('genc_kart_partners')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('genc_kart_usages')
        .select('id, partner_id, used_at')
        .order('used_at', { ascending: false })
        .limit(50),
    ]);

    if (list.error) setError(list.error.message);
    else {
      setPartners((list.data as Partner[]) ?? []);
      setError(null);
    }

    if (!mine.error) setUsages((mine.data as PartnerUsage[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { partners, usages, loading, error, reload: load };
}

/** Endirimdən istifadəni qeyd edir. */
export async function recordPartnerUsage(partnerId: string) {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const { error } = await supabase
    .from('genc_kart_usages')
    .insert({ partner_id: partnerId, user_id: uid });

  if (error) throw new Error(error.message);
}

/* ═══ Gənclər Evləri (gənc üçün siyahı) ════════════════════ */

export type PublicHouse = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function usePublicHouses() {
  const [houses, setHouses] = useState<PublicHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('youth_houses')
      .select('id, name, city, address, phone, email, description, latitude, longitude')
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('name');

    if (err) setError(err.message);
    else {
      setHouses((data as PublicHouse[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { houses, loading, error, reload: load };
}
