/*
# Profile photos, rooms and public listings

## 1. Purpose
Adds the storage bucket used for account profile images, a rooms table managed by each Youth House, and an approved-profile read function so administrators and dashboards can list approved accounts safely.

## 2. Schema changes
- `profiles.avatar_path`: reference to a file inside the account photos bucket.
- `youth_house_rooms`: rooms managed by each Youth House.

## 3. Storage
- Bucket `account-photos` is private; each account may only manage its own folder.
- Files are served through short-lived signed URLs.

## 4. Access
- `youth_house_rooms` is protected by row-level security so a house may only manage its own records; administrators may read every row through `admin_list_rooms`.
- `list_approved_profiles(target_role)` allows any signed-in account to see basic details of approved Youth Houses, Trainers or Youths for listings and dashboards.

## 5. Important notes
1. Sensitive fields such as password remain in Supabase Auth.
2. RLS remains enabled on every new table.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;

GRANT UPDATE (avatar_path) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.youth_house_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS youth_house_rooms_owner_idx ON public.youth_house_rooms (owner_id);

ALTER TABLE public.youth_house_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youth_house_rooms_select_own" ON public.youth_house_rooms;
CREATE POLICY "youth_house_rooms_select_own"
ON public.youth_house_rooms FOR SELECT TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "youth_house_rooms_insert_own" ON public.youth_house_rooms;
CREATE POLICY "youth_house_rooms_insert_own"
ON public.youth_house_rooms FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "youth_house_rooms_update_own" ON public.youth_house_rooms;
CREATE POLICY "youth_house_rooms_update_own"
ON public.youth_house_rooms FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "youth_house_rooms_delete_own" ON public.youth_house_rooms;
CREATE POLICY "youth_house_rooms_delete_own"
ON public.youth_house_rooms FOR DELETE TO authenticated
USING (owner_id = auth.uid());

REVOKE ALL ON public.youth_house_rooms FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youth_house_rooms TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_rooms()
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  house_name text,
  city text,
  name text,
  capacity integer,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT r.id, r.owner_id, p.house_name, p.city, r.name, r.capacity, r.description, r.created_at
  FROM public.youth_house_rooms r
  JOIN public.profiles p ON p.id = r.owner_id
  ORDER BY p.house_name NULLS LAST, r.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_rooms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_rooms() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_approved_profiles(target_role text)
RETURNS TABLE (
  id uuid,
  role text,
  first_name text,
  last_name text,
  email text,
  phone text,
  city text,
  address text,
  youth_house_name text,
  specialization text,
  teaching_direction text,
  workplace text,
  work_experience text,
  bio text,
  house_name text,
  responsible_name text,
  responsible_email text,
  avatar_path text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_role NOT IN ('youth', 'trainer', 'youth_house') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.role, p.first_name, p.last_name, p.email, p.phone, p.city, p.address,
         p.youth_house_name, p.specialization, p.teaching_direction, p.workplace,
         p.work_experience, p.bio, p.house_name, p.responsible_name, p.responsible_email,
         p.avatar_path, p.created_at
  FROM public.profiles p
  WHERE p.role = target_role AND p.status = 'approved'
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_approved_profiles(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_approved_profiles(text) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('account-photos', 'account-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "account_photos_read_own" ON storage.objects;
CREATE POLICY "account_photos_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "account_photos_insert_own" ON storage.objects;
CREATE POLICY "account_photos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "account_photos_update_own" ON storage.objects;
CREATE POLICY "account_photos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "account_photos_delete_own" ON storage.objects;
CREATE POLICY "account_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = auth.uid()::text);