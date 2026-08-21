/*
# Account status and admin approval workflow

## 1. Purpose
Introduces the account lifecycle needed for real-user operation: registrations are held pending, administrators approve or reject them, and only approved accounts reach the platform panels.

## 2. Schema change
- `profiles.status`: account lifecycle: pending, approved, rejected, suspended. Default value is `pending`. Admin accounts remain `approved`.

## 3. Access changes
- Administrators may view every profile through the security-definer function `admin_list_profiles`.
- Administrators may update a profile's status through the security-definer function `admin_set_profile_status`.
- Registrations no longer default to approved; the browser cannot change the status column.

## 4. Important notes
1. All authorization checks happen server-side using the caller's own profile record.
2. Regular accounts can still only read and update their own profile.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

UPDATE public.profiles SET status = 'approved' WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
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

  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_profile_status(target_id uuid, new_status text)
RETURNS void
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

  IF new_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.profiles
     SET status = new_status, updated_at = now()
   WHERE id = target_id AND role <> 'admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_profile_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_status(uuid, text) TO authenticated;

REVOKE UPDATE (status) ON public.profiles FROM authenticated;