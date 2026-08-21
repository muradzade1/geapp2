import { supabase } from '../supabase';
import { scanWithCamera } from './qr';

export type EventToken = {
  token: string;
  expires_at: string;
};

export type CheckinResult = {
  ok: boolean;
  already: boolean;
  full_name: string | null;
  points: number;
};

/**
 * Gəncin tədbir kodunu alır.
 *
 * Kod qısamüddətlidir — ekran şəkli paylaşılsa belə, bir neçə dəqiqədən sonra
 * yararsız olur. Etibarlıdırsa, eyni kod qaytarılır.
 */
export async function fetchEventToken(validMinutes = 5): Promise<EventToken> {
  const { data, error } = await supabase.rpc('my_event_token', {
    valid_minutes: validMinutes,
  });
  if (error) throw new Error(error.message);
  return data as EventToken;
}

/** Skan edilmiş kodu tədbir iştirakına çevirir. */
export async function checkinByQr(
  eventId: string,
  token: string,
): Promise<CheckinResult> {
  const { data, error } = await supabase.rpc('checkin_by_qr', {
    target_event: eventId,
    scanned_token: token,
  });
  if (error) throw new Error(error.message);
  return data as CheckinResult;
}

/** Kameranı açıb kodu oxuyur, sonra iştirakı qeyd edir. */
export async function scanAndCheckin(eventId: string): Promise<CheckinResult | null> {
  const code = await scanWithCamera();
  if (!code) return null;
  return checkinByQr(eventId, code);
}

/** Kodun bitməsinə qalan saniyə. */
export function secondsLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
}
