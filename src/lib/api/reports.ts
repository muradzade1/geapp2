import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/* ═══ Mərkəz hesabatı ══════════════════════════════════════ */

export type HouseReport = {
  from: string;
  to: string;
  total_visits: number;
  unique_visitors: number;
  average_stay_minutes: number;
  events_count: number;
  participants_count: number;
  points_awarded: number;
  top_rooms: { name: string; events_count: number }[];
  top_events: { title: string; starts_at: string; attended: number }[];
  daily: { day: string; visits: number }[];
};

export const EMPTY_REPORT: HouseReport = {
  from: '',
  to: '',
  total_visits: 0,
  unique_visitors: 0,
  average_stay_minutes: 0,
  events_count: 0,
  participants_count: 0,
  points_awarded: 0,
  top_rooms: [],
  top_events: [],
  daily: [],
};

/** Tarix aralığı üçün mərkəz hesabatı. */
export async function fetchHouseReport(
  houseId: string,
  fromDate: string,
  toDate: string,
): Promise<HouseReport> {
  const { data, error } = await supabase.rpc('house_report', {
    target_house: houseId,
    from_date: fromDate,
    to_date: toDate,
  });
  if (error) throw new Error(error.message);
  return { ...EMPTY_REPORT, ...(data as HouseReport) };
}

/* ═══ İştirak etdiyim tədbirlər ════════════════════════════ */

export type AttendedEvent = {
  event_id: string;
  title: string;
  house_name: string;
  starts_at: string;
  ends_at: string;
  attended_at: string;
  has_feedback: boolean;
};

export function useAttendedEvents(limit = 30) {
  const [events, setEvents] = useState<AttendedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_attended_events', {
      limit_count: limit,
    });
    if (!error) setEvents((data as AttendedEvent[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, reload: load };
}

export type FeedbackInput = {
  eventId: string;
  contentRating: number;
  instructorRating: number;
  equipmentRating: number;
  comment?: string;
};

/** Rəy göndərmək. Yalnız iştirakı qeydə alınmış şəxs göndərə bilər. */
export async function submitFeedback(input: FeedbackInput) {
  const { data, error } = await supabase.rpc('submit_feedback', {
    target_event: input.eventId,
    content_rating: input.contentRating,
    instructor_rating: input.instructorRating,
    equipment_rating: input.equipmentRating,
    comment: input.comment ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; points_awarded: number };
}

/* ═══ Admin: xəbər və bildiriş yaratma ═════════════════════ */

export type NewsInput = {
  title: string;
  category: string;
  short_description?: string;
  full_text?: string;
  author?: string;
  image_path?: string | null;
};

export async function createNews(input: NewsInput) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from('news').insert({
    ...input,
    created_by: session.user?.id ?? null,
    is_published: true,
  });
  if (error) throw new Error(error.message);
}

export async function deleteNews(id: string) {
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export type NotificationInput = {
  title: string;
  message: string;
  type: string;
};

/** Kütləvi bildiriş — `user_id` boş qalır, hamı görür. */
export async function createBroadcast(input: NotificationInput) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from('notifications').insert({
    ...input,
    user_id: null,
    created_by: session.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
