import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/* ═══ Ziyarət logları ══════════════════════════════════════ */

export type VisitLog = {
  visit_id: string;
  user_id: string;
  full_name: string | null;
  house_id: string | null;
  house_name: string | null;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number;
  auto_closed: boolean;
  is_inside: boolean;
  points_awarded: number;
};

export function useAdminVisitLogs(limit = 200) {
  const [rows, setRows] = useState<VisitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_visit_logs', {
      limit_count: limit,
      target_house: null,
    });
    if (err) setError(err.message);
    else {
      setRows((data as VisitLog[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

/* ═══ Tədbirlər ════════════════════════════════════════════ */

export type AdminEvent = {
  id: string;
  title: string;
  category: string;
  house_name: string | null;
  organiser_name: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  points_reward: number;
  status: string;
  registered_count: number;
  attended_count: number;
};

export function useAdminEvents(limit = 200) {
  const [rows, setRows] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_events', {
      limit_count: limit,
    });
    if (err) setError(err.message);
    else {
      setRows((data as AdminEvent[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

/* ═══ Rəylər ═══════════════════════════════════════════════ */

export type AdminFeedbackRow = {
  id: string;
  event_title: string;
  house_name: string | null;
  author_name: string | null;
  content_rating: number;
  instructor_rating: number;
  equipment_rating: number;
  comment: string | null;
  created_at: string;
};

export function useAdminFeedback(limit = 200) {
  const [rows, setRows] = useState<AdminFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_feedback', {
      limit_count: limit,
    });
    if (err) setError(err.message);
    else {
      setRows((data as AdminFeedbackRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}
