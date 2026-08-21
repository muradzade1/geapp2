import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/** admin_dashboard() RPC-nin qaytardığı xam JSON. */
type RawDashboard = {
  total_users: number;
  active_users: number;
  pending_users: number;
  by_role: Record<string, number>;
  total_houses: number;
  pending_houses: number;
  current_visitors: number;
  today_check_ins: number;
  today_events: number;
  today_participants: number;
  month_visits: number;
  total_points_awarded: number;
  genc_kart_usages: number;
  feedback_count: number;
  feedback_average: number;
  redemptions_pending: number;
  daily_series: { day: string; visits: number; signups: number }[];
};

/** Komponentlərin gözlədiyi forma (köhnə mockData.adminStats ilə eyni adlar). */
export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  currentVisitors: number;
  todayCheckIns: number;
  todayActiveEvents: number;
  todayParticipants: number;
  monthlyVisits: number;
  pointsIssued: number;
  gencKartUsage: number;
  feedbackCount: number;
  averageFeedbackScore: number;
  totalHouses: number;
  pendingHouses: number;
  pendingRedemptions: number;
  byRole: Record<string, number>;
};

export type DailyPoint = { day: string; entries: number; signups: number };

export const EMPTY_STATS: AdminStats = {
  totalUsers: 0,
  activeUsers: 0,
  pendingUsers: 0,
  currentVisitors: 0,
  todayCheckIns: 0,
  todayActiveEvents: 0,
  todayParticipants: 0,
  monthlyVisits: 0,
  pointsIssued: 0,
  gencKartUsage: 0,
  feedbackCount: 0,
  averageFeedbackScore: 0,
  totalHouses: 0,
  pendingHouses: 0,
  pendingRedemptions: 0,
  byRole: {},
};

const WEEKDAYS = ['B.', 'B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.'];

function toStats(raw: RawDashboard): AdminStats {
  return {
    totalUsers: raw.total_users ?? 0,
    activeUsers: raw.active_users ?? 0,
    pendingUsers: raw.pending_users ?? 0,
    currentVisitors: raw.current_visitors ?? 0,
    todayCheckIns: raw.today_check_ins ?? 0,
    todayActiveEvents: raw.today_events ?? 0,
    todayParticipants: raw.today_participants ?? 0,
    monthlyVisits: raw.month_visits ?? 0,
    pointsIssued: raw.total_points_awarded ?? 0,
    gencKartUsage: raw.genc_kart_usages ?? 0,
    feedbackCount: raw.feedback_count ?? 0,
    averageFeedbackScore: raw.feedback_average ?? 0,
    totalHouses: raw.total_houses ?? 0,
    pendingHouses: raw.pending_houses ?? 0,
    pendingRedemptions: raw.redemptions_pending ?? 0,
    byRole: raw.by_role ?? {},
  };
}

function toSeries(raw: RawDashboard): DailyPoint[] {
  return (raw.daily_series ?? []).map(d => ({
    day: WEEKDAYS[new Date(d.day).getDay()] ?? d.day,
    entries: d.visits ?? 0,
    signups: d.signups ?? 0,
  }));
}

export async function fetchAdminDashboard(): Promise<{
  stats: AdminStats;
  series: DailyPoint[];
}> {
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) throw error;
  const raw = data as RawDashboard;
  return { stats: toStats(raw), series: toSeries(raw) };
}

/** Gənclər Evləri üzrə xülasə cədvəli. */
export async function fetchHouseSummary() {
  const { data, error } = await supabase.rpc('admin_house_summary');
  if (error) throw error;
  return data ?? [];
}

/**
 * Admin panelinin göstəriciləri.
 *
 * Yüklənən müddətdə sıfırlar qaytarır ki, interfeys sınmasın;
 * `loading` ilə spinner göstərmək olar.
 */
export function useAdminDashboard(refreshMs = 60000) {
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchAdminDashboard();
      setStats(result.stats);
      setSeries(result.series);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumat yüklənmədi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { stats, series, loading, error, reload: load };
}
