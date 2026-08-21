import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/**
 * Bildiriş səsləri.
 *
 * Səslər audio faylı kimi saxlanılmır — hər biri Web Audio ilə yerindəcə
 * yaradılır. Beləliklə app-in ölçüsü artmır, offline işləyir və fayl
 * lisenziyası məsələsi yaranmır.
 */

export type SoundId = 'chime' | 'ding' | 'pop' | 'soft' | 'alert';

export const SOUND_OPTIONS: { id: SoundId; label: string; description: string }[] = [
  { id: 'chime', label: 'Zəng', description: 'İki notlu yumşaq zəng' },
  { id: 'ding', label: 'Ding', description: 'Qısa və aydın' },
  { id: 'pop', label: 'Pop', description: 'Yüngül kliklə' },
  { id: 'soft', label: 'Mülayim', description: 'Sakit, diqqət çəkməyən' },
  { id: 'alert', label: 'Diqqət', description: 'Üç notlu, daha nəzərəçarpan' },
];

/** Notların tezliyi (Hz), müddəti (san) və başlama anı (san). */
type Note = { freq: number; duration: number; at: number; type?: OscillatorType };

const PATTERNS: Record<SoundId, Note[]> = {
  chime: [
    { freq: 880, duration: 0.18, at: 0 },
    { freq: 1174, duration: 0.28, at: 0.14 },
  ],
  ding: [{ freq: 1046, duration: 0.25, at: 0 }],
  pop: [{ freq: 620, duration: 0.09, at: 0, type: 'triangle' }],
  soft: [
    { freq: 523, duration: 0.22, at: 0, type: 'sine' },
    { freq: 659, duration: 0.26, at: 0.1, type: 'sine' },
  ],
  alert: [
    { freq: 784, duration: 0.12, at: 0 },
    { freq: 784, duration: 0.12, at: 0.16 },
    { freq: 1046, duration: 0.22, at: 0.32 },
  ],
};

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }

  // Brauzer səsi istifadəçi hərəkəti olmadan dayandıra bilər.
  if (context.state === 'suspended') void context.resume();

  return context;
}

/** Səsi çalır. Brauzer icazə verməsə, səssizcə keçir. */
export function playSound(id: SoundId) {
  const ctx = audioContext();
  if (!ctx) return;

  const notes = PATTERNS[id] ?? PATTERNS.chime;

  notes.forEach(note => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = note.type ?? 'sine';
    oscillator.frequency.value = note.freq;

    const start = ctx.currentTime + note.at;
    const end = start + note.duration;

    // Kəskin "klik" səsi olmasın deyə yumşaq başlanğıc və sönmə
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}

/* ═══ Tənzimləmə ═══════════════════════════════════════════ */

export type SoundSettings = {
  enabled: boolean;
  sound: SoundId;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  sound: 'chime',
};

function normalise(sound: string | null): SoundId {
  const known = SOUND_OPTIONS.some(option => option.id === sound);
  return known ? (sound as SoundId) : DEFAULT_SOUND_SETTINGS.sound;
}

export function useSoundSettings() {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('notification_sound_enabled, notification_sound')
      .eq('id', uid)
      .maybeSingle();

    if (!error && data) {
      setSettings({
        enabled: data.notification_sound_enabled ?? true,
        sound: normalise(data.notification_sound),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (next: SoundSettings) => {
    setSettings(next);
    setSaving(true);

    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (uid) {
      await supabase
        .from('profiles')
        .update({
          notification_sound_enabled: next.enabled,
          notification_sound: next.sound,
        })
        .eq('id', uid);
    }
    setSaving(false);
  }, []);

  return { settings, loading, saving, save, reload: load };
}

/** Yeni bildiriş gələndə çalınacaq səs — tənzimləmə nəzərə alınır. */
export function playNotificationSound(settings: SoundSettings) {
  if (!settings.enabled) return;
  playSound(settings.sound);
}
