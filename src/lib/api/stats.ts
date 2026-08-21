import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/* ─── Müddət formatı ─────────────────────────────────────── */

/**
 * Saniyəni oxunaqlı müddətə çevirir.
 *
 * Bir dəqiqədən qısa ziyarətlər "0 dəqiqə" kimi görünməsin deyə saniyə ilə
 * göstərilir — həmin hal skan səhvi kimi oxunurdu.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} san`;

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} dəq`;
  return `${hours} saat ${minutes} dəq`;
}

/** Yalnız saat:dəqiqə. */
export function clock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Tarix + saat. */
export function dateClock(iso: string): string {
  return new Date(iso).toLocaleString('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Gəncin göstəriciləri ───────────────────────────────── */

export type YouthStats = {
  points: number;
  visit_count: number;
  currently_inside: boolean;
  events_attended: number;
  events_upcoming: number;
  challenges_completed: number;
  badges: number;
  month_visits: number;
  level: {
    points: number;
    level: string | null;
    color: string | null;
    next_level: string | null;
    next_at: number | null;
  } | null;
};

export const EMPTY_YOUTH_STATS: YouthStats = {
  points: 0,
  visit_count: 0,
  currently_inside: false,
  events_attended: 0,
  events_upcoming: 0,
  challenges_completed: 0,
  badges: 0,
  month_visits: 0,
  level: null,
};

export function useYouthStats(refreshMs = 30000) {
  const [stats, setStats] = useState<YouthStats>(EMPTY_YOUTH_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('my_youth_stats');
    if (err) setError(err.message);
    else {
      setStats({ ...EMPTY_YOUTH_STATS, ...(data as YouthStats) });
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { stats, loading, error, reload: load };
}

/* ─── Gəncin ziyarətləri ─────────────────────────────────── */

export type MyVisit = {
  visit_id: string;
  house_name: string;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number;
  auto_closed: boolean;
};

export function useMyVisits(limit = 20) {
  const [visits, setVisits] = useState<MyVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_visits', { limit_count: limit });
    if (!error) setVisits((data as MyVisit[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { visits, loading, reload: load };
}

/* ─── Mərkəzin gündəlik jurnalı ──────────────────────────── */

export type HouseLogRow = {
  visit_id: string;
  user_id: string;
  full_name: string | null;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number;
  auto_closed: boolean;
  is_inside: boolean;
};

export function useHouseTodayLog(houseId: string | null, refreshMs = 30000) {
  const [rows, setRows] = useState<HouseLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase.rpc('house_today_log', {
      target_house: houseId,
    });

    if (err) setError(err.message);
    else {
      setRows((data as HouseLogRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [houseId]);

  useEffect(() => {
    void load();
    if (!refreshMs || !houseId) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs, houseId]);

  return { rows, loading, error, reload: load };
}
