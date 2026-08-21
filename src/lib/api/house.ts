import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export type HouseStatus = 'pending' | 'approved' | 'rejected';

export type YouthHouse = {
  id: string;
  manager_id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  status: HouseStatus;
  rejection_reason: string | null;
  is_active: boolean;
  created_at: string;
};

export type HouseRegistrationInput = {
  name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
};

export type LiveActivity = {
  id: string;
  title: string;
  room_name: string | null;
  starts_at: string;
  ends_at: string;
  registered_count: number;
  attended_count: number;
  live_status: 'waiting' | 'running' | 'finished';
};

export type HouseDashboard = {
  house: { id: string; name: string; city: string } | null;
  current_visitors: number;
  today_check_ins: number;
  today_check_outs: number;
  today_events: number;
  today_participants: number;
  busiest_room: string | null;
  month_visits: number;
  average_stay_minutes: number;
  today_activity: LiveActivity[];
};

export const EMPTY_DASHBOARD: HouseDashboard = {
  house: null,
  current_visitors: 0,
  today_check_ins: 0,
  today_check_outs: 0,
  today_events: 0,
  today_participants: 0,
  busiest_room: null,
  month_visits: 0,
  average_stay_minutes: 0,
  today_activity: [],
};

/** "2s 15d" formatına çevirir. */
export function formatStay(minutes: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}d`;
  return `${h}s ${m}d`;
}

/** ISO tarixdən yalnız saat:dəqiqə. */
export function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const LIVE_STATUS_LABEL: Record<LiveActivity['live_status'], string> = {
  waiting: 'Gözləyir',
  running: 'Davam edir',
  finished: 'Bitib',
};

/**
 * Cari hesaba aid Gənclər Evi qeydi.
 *
 * `house === null` o deməkdir ki, mərkəz hələ qeydiyyatdan keçməyib —
 * bu halda qeydiyyat formu göstərilməlidir.
 */
export function useMyHouse() {
  const [house, setHouse] = useState<YouthHouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;

    if (!uid) {
      setHouse(null);
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase
      .from('youth_houses')
      .select('*')
      .eq('manager_id', uid)
      .maybeSingle();

    if (err) setError(err.message);
    else {
      setHouse((data as YouthHouse) ?? null);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useCallback(
    async (input: HouseRegistrationInput) => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error('Sessiya tapılmadı');

      const { error: err } = await supabase.from('youth_houses').insert({
        manager_id: uid,
        name: input.name.trim(),
        city: input.city.trim(),
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        description: input.description?.trim() || null,
      });

      if (err) throw err;
      await load();
    },
    [load],
  );

  return { house, loading, error, reload: load, register };
}

/** Gənclər Evi panelinin bütün göstəriciləri. */
export function useHouseDashboard(houseId: string | null, refreshMs = 30000) {
  const [data, setData] = useState<HouseDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!houseId) {
      setData(EMPTY_DASHBOARD);
      setLoading(false);
      return;
    }

    const { data: result, error: err } = await supabase.rpc('house_dashboard', {
      target_house: houseId,
    });

    if (err) setError(err.message);
    else {
      setData({ ...EMPTY_DASHBOARD, ...(result as HouseDashboard) });
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

  return { data, loading, error, reload: load };
}

/** Girişdə göstərilən QR kodu yeniləyir. */
export async function rotateHouseQr(houseId: string, validMinutes?: number) {
  const { data, error } = await supabase.rpc('rotate_house_qr', {
    target_house: houseId,
    valid_minutes: validMinutes ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Hazırda mərkəzdə olanların siyahısı. */
export async function fetchCurrentVisitors(houseId: string) {
  const { data, error } = await supabase
    .from('house_current_visitors')
    .select('*')
    .eq('house_id', houseId)
    .order('entered_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
