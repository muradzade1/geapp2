/*
# Secure platform accounts and roles

## 1. Purpose
Creates the protected profile records used alongside Supabase Authentication for the Gənclər Evləri Platforması. Passwords remain exclusively in Supabase Auth and are never stored in this table.

## 2. New table
- `profiles`: one record per authenticated account.
- `id`: account ID from Supabase Auth.
- `role`: server-controlled account type: youth, trainer, youth_house, or admin.
- Common registration details: name, email, phone, city, address, birth date.
- Youth details: assigned youth house.
- Trainer details: specialism, teaching area, workplace, experience and biography.
- Youth House details: house name and responsible person's contact details.
- `created_at` and `updated_at`: account record timestamps.

## 3. Security
- Row Level Security is enabled.
- Accounts can only read their own profile.
- Accounts may update only their own safe contact and biography fields.
- The role, email, account ownership and management fields cannot be changed from the browser.
- Profile creation and role assignment are performed by a server-side registration service.

## 4. Important notes
1. The role is not derived from user-editable metadata.
2. The `admin` role is reserved for secure server-side provisioning.
3. All password hashing and session handling remain managed by Supabase Auth.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('youth', 'trainer', 'youth_house', 'admin')),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  city text,
  address text,
  birth_date date,
  youth_house_name text,
  specialization text,
  teaching_direction text,
  workplace text,
  work_experience text,
  bio text,
  house_name text,
  responsible_name text,
  responsible_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE
TO authenticated
USING (id = auth.uid());

REVOKE ALL ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, phone, city, address, birth_date, youth_house_name, specialization, teaching_direction, workplace, work_experience, bio, house_name, responsible_name, responsible_email, updated_at) ON public.profiles TO authenticated;