// Mövcud profil şəkillərini kiçildir (Egress trafikinə qənaət).
// Önizləmə:   node scripts/shrink-avatars.mjs
// Tətbiq:     node scripts/shrink-avatars.mjs --apply
// Tələb: SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY mühit dəyişənləri (açar fayla yazılmır).
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY təyin olunmayıb.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const MIN_BYTES = 300 * 1024;
const BUCKET = 'account-photos';
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const folders = (await listAll('')).filter((item) => !item.id);
let before = 0;
let after = 0;
let changed = 0;

for (const folder of folders) {
  for (const file of await listAll(folder.name)) {
    const size = file.metadata?.size ?? 0;
    if (!file.id || size < MIN_BYTES) continue;
    const path = `${folder.name}/${file.name}`;
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !blob) {
      console.warn('Yüklənmədi:', path);
      continue;
    }
    const input = Buffer.from(await blob.arrayBuffer());
    const output = await sharp(input)
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (output.length >= input.length) continue;
    before += input.length;
    after += output.length;
    changed += 1;
    console.log(`${apply ? 'Kiçildi' : 'Kiçildilər'}: ${path}  ${(input.length / 1024).toFixed(0)} KB -> ${(output.length / 1024).toFixed(0)} KB`);
    if (apply) {
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(path, output, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (upError) console.warn('Yazılmadı:', path, upError.message);
    }
  }
}
console.log(`\n${changed} şəkil, ${(before / 1048576).toFixed(0)} MB -> ${(after / 1048576).toFixed(0)} MB${apply ? '' : '  (önizləmə, dəyişiklik edilmədi; tətbiq üçün --apply)'}`);
