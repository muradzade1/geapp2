import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/* ═══ Mərkəz–təlimçi əlaqəsi ═══════════════════════════════ */

export type TrainerHouse = { id: string; name: string; city: string };

export type TeamMember = {
  trainer_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  events_count: number;
  added_at: string;
};

export type AvailableTrainer = {
  trainer_id: string;
  full_name: string | null;
  email: string | null;
  specialization: string | null;
};

/** Təlimçinin işlədiyi mərkəzlər. */
export function useTrainerHouses() {
  const [houses, setHouses] = useState<TrainerHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('my_trainer_houses');
    if (err) setError(err.message);
    else {
      setHouses((data as TrainerHouse[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { houses, loading, error, reload: load };
}

/** Mərkəzin təlimçi komandası. */
export function useHouseTeam(houseId: string | null) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [available, setAvailable] = useState<AvailableTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setTeam([]);
      setAvailable([]);
      setLoading(false);
      return;
    }

    const [teamResult, availableResult] = await Promise.all([
      supabase.rpc('house_trainer_list', { target_house: houseId }),
      supabase.rpc('available_trainers', { target_house: houseId }),
    ]);

    if (teamResult.error) setError(teamResult.error.message);
    else {
      setTeam((teamResult.data as TeamMember[]) ?? []);
      setError(null);
    }

    if (!availableResult.error) {
      setAvailable((availableResult.data as AvailableTrainer[]) ?? []);
    }

    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { team, available, loading, error, reload: load };
}

export async function addTrainer(houseId: string, trainerId: string) {
  const { error } = await supabase.rpc('add_house_trainer', {
    target_house: houseId,
    target_trainer: trainerId,
  });
  if (error) throw new Error(error.message);
}

export async function removeTrainer(houseId: string, trainerId: string) {
  const { error } = await supabase.rpc('remove_house_trainer', {
    target_house: houseId,
    target_trainer: trainerId,
  });
  if (error) throw new Error(error.message);
}

/* ═══ Təlimçinin göstəriciləri ═════════════════════════════ */

export type TrainerStats = {
  houses: number;
  total_events: number;
  upcoming_events: number;
  today_events: number;
  total_participants: number;
  feedback_count: number;
  instructor_rating: number;
};

export const EMPTY_TRAINER_STATS: TrainerStats = {
  houses: 0,
  total_events: 0,
  upcoming_events: 0,
  today_events: 0,
  total_participants: 0,
  feedback_count: 0,
  instructor_rating: 0,
};

export function useTrainerStats(refreshMs = 60000) {
  const [stats, setStats] = useState<TrainerStats>(EMPTY_TRAINER_STATS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_trainer_stats');
    if (!error) setStats({ ...EMPTY_TRAINER_STATS, ...(data as TrainerStats) });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { stats, loading, reload: load };
}

/* ═══ Təlimçiyə gələn rəylər ═══════════════════════════════ */

export type TrainerFeedback = {
  id: string;
  event_title: string;
  content_rating: number;
  instructor_rating: number;
  equipment_rating: number;
  comment: string | null;
  created_at: string;
};

export function useTrainerFeedback(limit = 30) {
  const [items, setItems] = useState<TrainerFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_trainer_feedback', {
      limit_count: limit,
    });
    if (!error) setItems((data as TrainerFeedback[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, reload: load };
}
