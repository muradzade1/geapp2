import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { playNotificationSound, DEFAULT_SOUND_SETTINGS, type SoundSettings } from './sound';

/* ═══ Reytinq ══════════════════════════════════════════════ */

export type LeaderboardRow = {
  rank: number;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  city: string | null;
  points: number;
};

export function useLeaderboard(limit = 50) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: session }, result] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('leaderboard', { limit_count: limit }),
    ]);

    setMyId(session.user?.id ?? null);

    if (result.error) setError(result.error.message);
    else {
      setRows((result.data as LeaderboardRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, myId, loading, error, reload: load };
}

/* ═══ Xəbərlər ═════════════════════════════════════════════ */

export type NewsItem = {
  id: string;
  title: string;
  category: string;
  short_description: string | null;
  full_text: string | null;
  image_path: string | null;
  author: string | null;
  published_at: string;
};

export function useNews(limit = 30) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (err) setError(err.message);
    else {
      setItems((data as NewsItem[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

/* ═══ Bildirişlər ══════════════════════════════════════════ */

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
};

export function useNotifications(refreshMs = 30000) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Səs tənzimləməsi bir dəfə oxunur; ilk yükləmədə səs çalınmır,
  // yalnız sonradan gələn bildirişlərdə.
  const soundSettings = useRef<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  const seenIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('my_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) setError(err.message);
    else {
      const rows = (data as Notification[]) ?? [];

      if (seenIds.current === null) {
        seenIds.current = new Set(rows.map((row) => row.id));
      } else {
        const fresh = rows.filter(
          (row) => !row.read && !seenIds.current?.has(row.id),
        );
        rows.forEach((row) => seenIds.current?.add(row.id));
        if (fresh.length > 0) playNotificationSound(soundSettings.current);
      }

      setItems(rows);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: session }) => {
      const uid = session.user?.id;
      if (!uid) return;
      void supabase
        .from('profiles')
        .select('notification_sound_enabled, notification_sound')
        .eq('id', uid)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            soundSettings.current = {
              enabled: data.notification_sound_enabled ?? true,
              sound: data.notification_sound ?? 'chime',
            };
          }
        });
    });
  }, []);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  const markRead = useCallback(
    async (id: string) => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return;

      await supabase
        .from('notification_reads')
        .upsert(
          { notification_id: id, user_id: uid },
          { onConflict: 'notification_id,user_id' },
        );

      setItems(current =>
        current.map(n => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) return;

    const unread = items.filter(n => !n.read);
    if (unread.length === 0) return;

    await supabase.from('notification_reads').upsert(
      unread.map(n => ({ notification_id: n.id, user_id: uid })),
      { onConflict: 'notification_id,user_id' },
    );

    setItems(current => current.map(n => ({ ...n, read: true })));
  }, [items]);

  const unreadCount = items.filter(n => !n.read).length;

  return { items, loading, error, unreadCount, markRead, markAllRead, reload: load };
}

/* ═══ Ortaq köməkçilər ═════════════════════════════════════ */

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'İndicə';
  if (minutes < 60) return `${minutes} dəq əvvəl`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat əvvəl`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün əvvəl`;

  return new Date(iso).toLocaleDateString('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
