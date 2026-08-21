import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export type AdminCharts = {
  events_by_category: { category: string; count: number }[];
  monthly_trend: { month: string; users: number; events: number; visits: number }[];
  age_distribution: { age: string; count: number }[];
  gender_distribution: { gender: string; count: number }[];
  top_houses: { name: string; visitors: number; members: number }[];
};

export const EMPTY_CHARTS: AdminCharts = {
  events_by_category: [],
  monthly_trend: [],
  age_distribution: [],
  gender_distribution: [],
  top_houses: [],
};

/** Nazirlik panelindəki qrafiklərin məlumatı. */
export function useAdminCharts(refreshMs = 120000) {
  const [charts, setCharts] = useState<AdminCharts>(EMPTY_CHARTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_charts');
    if (!error) setCharts({ ...EMPTY_CHARTS, ...(data as AdminCharts) });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { charts, loading, reload: load };
}
