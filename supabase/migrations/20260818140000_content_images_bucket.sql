/*
# Image storage for events, news and partners

## 1. Purpose
`events.cover_path`, `news.image_path` and `genc_kart_partners.image_path` have
existed since their tables were created, but nothing could ever fill them:
there was no bucket and no policy, so the columns stayed empty and every card in
the app was text-only.

## 2. Bucket
`content-images` is **public**, unlike `account-photos`. The difference is
deliberate: a profile photo belongs to one person and is shown only to them,
while an event cover is meant to be seen by everyone browsing events — including
in a list of dozens, where signing every URL separately would be slow and would
expire mid-scroll.

Nothing private is ever placed here. The rule for anyone adding an upload later:
if a human would hesitate to put the file on a public website, it does not
belong in this bucket.

## 3. Who may write
- Uploading requires an approved account, and the file lands under a folder
  named after the uploader's id.
- An account may replace or remove its own files.
- Administrators may remove any file, so a wrong or inappropriate image can be
  taken down without involving whoever uploaded it.

## 4. Notes
Deleting an event or a news item does not delete its image — storage and rows
are separate systems. Orphaned images cost a few kilobytes and can be cleared
in bulk later; losing the row's image because a delete half-failed would be
worse.
*/

-- ============================================================
-- 1. Bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-images',
  'content-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ============================================================
-- 2. Siyasətlər
-- ============================================================

-- Oxumaq: hamıya açıqdır (bucket public olduğu üçün onsuz da belədir,
-- amma siyasət açıq yazılır ki, davranış aydın olsun).
DROP POLICY IF EXISTS "content_images_read" ON storage.objects;
CREATE POLICY "content_images_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'content-images');

-- Yükləmək: təsdiqlənmiş hesab, öz qovluğuna
DROP POLICY IF EXISTS "content_images_insert" ON storage.objects;
CREATE POLICY "content_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-images'
  AND public.is_approved()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Əvəz etmək: yalnız öz faylını
DROP POLICY IF EXISTS "content_images_update_own" ON storage.objects;
CREATE POLICY "content_images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'content-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Silmək: öz faylı, yaxud administrator istənilən faylı
DROP POLICY IF EXISTS "content_images_delete" ON storage.objects;
CREATE POLICY "content_images_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
  )
);
