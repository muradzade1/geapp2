import { supabase } from '../supabase';

const BUCKET = 'content-images';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Şəkli yükləyir və saxlanılan yolu qaytarır.
 *
 * Yol `<istifadəçi-id>/<qovluq>/<təsadüfi>.<uzantı>` şəklindədir — siyasət
 * hər kəsin yalnız öz qovluğuna yazmasına icazə verir.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Yalnız JPG, PNG və ya WEBP şəkil yükləmək olar');
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Şəklin ölçüsü 5 MB-dan çox olmamalıdır');
  }

  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error('Sessiya tapılmadı');

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}

/** Saxlanılan yoldan açıq URL düzəldir. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Şəkli silir. Uğursuz olsa da səssiz keçir — sətrin özü daha vacibdir. */
export async function removeImage(path: string | null | undefined) {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* sahibsiz fayl qalsa da problem deyil */
  }
}
