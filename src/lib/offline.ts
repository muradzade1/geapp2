import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Oflayn rejim: internet olmayanda gəncin QR skanları cihazda saxlanılır
 * və internet qayıdanda avtomatik bazaya göndərilir.
 */

const QUEUE_KEY = 'ge_offline_scan_queue_v1';
const PROFILE_KEY = 'ge_cached_profile_v1';

export interface QueuedScan {
  id: string;
  code: string;
  scanned_at: string;
  user_id: string;
}

export interface SyncResult {
  sent: number;
  failed: string[];
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* aşağıdakı ehtiyat üsul */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function getQueue(): QueuedScan[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedScan[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* yaddaş dolubsa, heç nə edə bilmərik */
  }
  window.dispatchEvent(new CustomEvent('offline-queue-change'));
}

export function pendingCount(userId: string | null | undefined): number {
  if (!userId) return 0;
  return getQueue().filter((q) => q.user_id === userId).length;
}

export function pendingScans(userId: string | null | undefined): QueuedScan[] {
  if (!userId) return [];
  return getQueue().filter((q) => q.user_id === userId);
}

/** Skanı növbəyə əlavə edir və gözləyən qeydlərin sayını qaytarır. */
export function enqueueScan(code: string, userId: string): number {
  const queue = getQueue();
  const now = Date.now();
  // Kamera eyni kodu saniyə içində iki dəfə oxuyarsa, təkrarı atırıq.
  const last = [...queue].reverse().find((q) => q.user_id === userId);
  if (last && last.code === code && now - new Date(last.scanned_at).getTime() < 4000) {
    return pendingCount(userId);
  }
  queue.push({ id: uuid(), code, scanned_at: new Date(now).toISOString(), user_id: userId });
  saveQueue(queue);
  return pendingCount(userId);
}

function removeFromQueue(id: string) {
  saveQueue(getQueue().filter((q) => q.id !== id));
}

function errText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const e = err as { message?: string; details?: string };
  return `${e.message ?? ''} ${e.details ?? ''}`.trim();
}

/** Şəbəkə (bağlantı) xətasıdır, yoxsa server cavab verib rədd edib? */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string }).code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return false; // Postgres xətası — server cavab verib
  if (typeof code === 'string' && /^PGRST/.test(code)) return false;
  return /failed to fetch|network|load failed|timeout|timed out|abort|fetch|offline|internet/i.test(errText(err));
}

function isRetryableServerError(err: unknown): boolean {
  const e = err as { code?: string; status?: number };
  const text = errText(err);
  if (e?.status === 401 || e?.status === 403) return true;
  if (e?.code === 'PGRST301' || e?.code === 'PGRST302' || e?.code === 'PGRST202') return true;
  return /jwt|token.*expired|expired.*token|could not find the function|not authenticated/i.test(text);
}

let flushing = false;

/** Növbədəki skanları ardıcıl göndərir. Şəbəkə yoxdursa, qalanı növbədə qalır. */
export async function flushScanQueue(): Promise<SyncResult | null> {
  if (flushing) return null;
  if (getQueue().length === 0) return null;
  flushing = true;
  try {
    let uid: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      uid = data.session?.user.id;
    } catch {
      return null;
    }
    if (!uid) return null;

    let sent = 0;
    const failed: string[] = [];
    const mine = getQueue().filter((q) => q.user_id === uid);
    for (const item of mine) {
      let error: unknown = null;
      try {
        const res = await supabase.rpc('scan_qr_offline', {
          p_code: item.code,
          p_scanned_at: item.scanned_at,
          p_client_id: item.id,
        });
        error = res.error;
      } catch (e) {
        error = e;
      }
      if (error) {
        if (isNetworkError(error) || isRetryableServerError(error)) break;
        failed.push(errText(error) || 'Naməlum xəta');
        removeFromQueue(item.id);
        continue;
      }
      sent += 1;
      removeFromQueue(item.id);
    }
    const result: SyncResult = { sent, failed };
    if (sent > 0 || failed.length > 0) {
      window.dispatchEvent(new CustomEvent('offline-sync-result', { detail: result }));
    }
    return result;
  } finally {
    flushing = false;
  }
}

/* ---------- Profilin cihazda saxlanması ---------- */

export function cacheProfile(profile: { id: string }) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ userId: profile.id, profile, at: Date.now() }));
  } catch {
    /* vacib deyil */
  }
}

export function readCachedProfile<T>(userId: string): T | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; profile?: T };
    if (parsed.userId !== userId || !parsed.profile) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

export function clearCachedProfile() {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* vacib deyil */
  }
}

/* ---------- Supabase sessiyasının cihazdakı surəti ---------- */

function storedSessionKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) keys.push(key);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/** Token müddəti bitib yeniləmək mümkün olmayanda belə, cihazda saxlanmış sessiyanı oxuyur. */
export function readStoredSession(): Session | null {
  try {
    for (const key of storedSessionKeys()) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Session | null;
      if (parsed && parsed.user && parsed.user.id) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearStoredSession() {
  try {
    for (const key of storedSessionKeys()) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
