import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const EVENT_CATEGORIES = [
  'Təlim və İnkişaf',
  'İdman',
  'Sağlamlıq',
  'Mədəniyyət və İncəsənət',
  'Startap və İnnovasiya',
  'Könüllülük',
  'Digər',
] as const;

export type EventRow = {
  id: string;
  youth_house_id: string;
  house_name: string;
  house_city: string;
  room_id: string | null;
  trainer_id: string | null;
  title: string;
  description: string | null;
  category: string;
  cover_path: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  points_reward: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  registered_count: number;
  attended_count: number;
};

export type EventInput = {
  youth_house_id: string;
  title: string;
  description?: string;
  category: string;
  room_id?: string | null;
  cover_path?: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  points_reward: number;
  status?: 'draft' | 'published';
};

/** Tədbirin cari vəziyyəti — vaxta görə hesablanır, bazada saxlanmır. */
export function eventPhase(event: EventRow): 'upcoming' | 'running' | 'finished' {
  const now = Date.now();
  if (now < new Date(event.starts_at).getTime()) return 'upcoming';
  if (now <= new Date(event.ends_at).getTime()) return 'running';
  return 'finished';
}

export const PHASE_LABEL: Record<ReturnType<typeof eventPhase>, string> = {
  upcoming: 'Qeydiyyat açıqdır',
  running: 'Davam edir',
  finished: 'Bitib',
};

export function eventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('az-AZ', {
    day: '2-digit',
    month: 'long',
    weekday: 'short',
  });
}

export function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Datetime-local input üçün format (yerli vaxt zonasında). */
export function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/* ─── Tədbir siyahısı ────────────────────────────────────── */

type ListOptions = {
  /** Yalnız bu mərkəzin tədbirləri. */
  houseId?: string | null;
  /** Bitmiş tədbirlər də göstərilsin. */
  includePast?: boolean;
};

export function useEvents({ houseId, includePast = false }: ListOptions = {}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let query = supabase
      .from('events_with_counts')
      .select('*')
      .order('starts_at', { ascending: true });

    if (houseId) query = query.eq('youth_house_id', houseId);
    if (!includePast) query = query.gte('ends_at', new Date().toISOString());

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else {
      setEvents((data as EventRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [houseId, includePast]);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, reload: load };
}

/* ─── Gəncin qeydiyyatları ───────────────────────────────── */

export type MyRegistration = {
  event_id: string;
  status: 'registered' | 'cancelled' | 'waitlist';
};

export function useMyRegistrations() {
  const [map, setMap] = useState<Record<string, MyRegistration['status']>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .select('event_id, status')
      .eq('user_id', uid);

    if (!error && data) {
      const next: Record<string, MyRegistration['status']> = {};
      (data as MyRegistration[]).forEach(r => {
        next[r.event_id] = r.status;
      });
      setMap(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { registrations: map, loading, reload: load };
}

/** Tədbirə yazılmaq. Tutum və vaxt yoxlanışı bazada aparılır. */
export async function registerForEvent(eventId: string) {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const { error } = await supabase
    .from('event_registrations')
    .upsert(
      { event_id: eventId, user_id: uid, status: 'registered' },
      { onConflict: 'event_id,user_id' },
    );

  if (error) throw new Error(error.message);
}

/** Qeydiyyatı ləğv etmək. */
export async function cancelRegistration(eventId: string) {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const { error } = await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('event_id', eventId)
    .eq('user_id', uid);

  if (error) throw new Error(error.message);
}

/* ─── Tədbirin idarəsi (mərkəz / təlimçi) ────────────────── */

export async function createEvent(input: EventInput) {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const { error } = await supabase.from('events').insert({
    ...input,
    created_by: uid,
    status: input.status ?? 'published',
  });

  if (error) throw new Error(error.message);
}

export async function updateEventStatus(
  eventId: string,
  status: EventRow['status'],
) {
  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

/* ─── İştirak ────────────────────────────────────────────── */

export type Participant = {
  user_id: string;
  full_name: string | null;
  registered: boolean;
  attended: boolean;
};

/** Tədbirə yazılanlar və iştirakı təsdiqlənənlər. */
export async function fetchParticipants(eventId: string): Promise<Participant[]> {
  const [regs, atts] = await Promise.all([
    supabase
      .from('event_registrations')
      .select('user_id, status, profiles(first_name, last_name)')
      .eq('event_id', eventId)
      .eq('status', 'registered'),
    supabase.from('event_attendance').select('user_id').eq('event_id', eventId),
  ]);

  if (regs.error) throw new Error(regs.error.message);

  const attended = new Set(
    ((atts.data as { user_id: string }[]) ?? []).map(a => a.user_id),
  );

  type Row = {
    user_id: string;
    profiles: { first_name: string | null; last_name: string | null } | null;
  };

  return ((regs.data as unknown as Row[]) ?? []).map(row => ({
    user_id: row.user_id,
    full_name:
      [row.profiles?.first_name, row.profiles?.last_name]
        .filter(Boolean)
        .join(' ') || null,
    registered: true,
    attended: attended.has(row.user_id),
  }));
}

/**
 * İştirakı təsdiqləmək.
 *
 * Bu, xal verən hərəkətdir — trigger `point_transactions`-a yazır.
 */
export async function markAttendance(eventId: string, userId: string) {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const { error } = await supabase.from('event_attendance').insert({
    event_id: eventId,
    user_id: userId,
    recorded_by: uid,
  });

  if (error) throw new Error(error.message);
}

export async function unmarkAttendance(eventId: string, userId: string) {
  const { error } = await supabase
    .from('event_attendance')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
