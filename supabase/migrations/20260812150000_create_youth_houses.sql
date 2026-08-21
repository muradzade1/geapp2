/*
# Gənclər Evləri directory and shared role helpers

## 1. Purpose
Introduces the central `youth_houses` directory that every later module
(events, QR check-ins, points, rewards) depends on, plus the shared helper
functions used by all Row Level Security policies from this point on.

## 2. Registration model
Centres register themselves: an account with the `youth_house` role creates its
own record, which starts as `pending` and is invisible to everyone else. An
administrator reviews it and sets the status to `approved`, at which point the
centre appears in the shared directory. This mirrors the existing account
approval flow on `profiles`.

## 3. Helper functions
- `public.is_approved()`: true when the caller has an approved profile.
- `public.current_role()`: the caller's role, or NULL when not approved.
- `public.is_admin()`: true when the caller is an approved administrator.
- `public.manages_house(uuid)`: true for the administrator, or for the account
  that owns the centre.

## 4. Security
- A centre is visible to everyone only once an administrator approves it.
- The owning account always sees and edits its own record, at any status.
- The owning account cannot change its own status, ownership or active flag.
- Only administrators may approve, reject or remove a centre.
- One centre per `youth_house` account.

## 5. Notes
1. `profiles.youth_house_id` is added as a proper foreign key; the existing
   free-text `youth_house_name` column is kept so nothing breaks before the
   frontend is migrated.
2. Young people and trainers cannot assign themselves to a centre from the
   browser — that is an administrator action.
*/

-- ============================================================
-- 1. Shared helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND status = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 2. youth_houses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.youth_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text NOT NULL,
  address text,
  phone text,
  email text,
  description text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One centre per account.
CREATE UNIQUE INDEX IF NOT EXISTS youth_houses_manager_key
  ON public.youth_houses (manager_id);
-- No duplicate approved centres with the same name in the same city.
CREATE UNIQUE INDEX IF NOT EXISTS youth_houses_name_city_key
  ON public.youth_houses (lower(name), lower(city))
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS youth_houses_city_idx ON public.youth_houses (city);
CREATE INDEX IF NOT EXISTS youth_houses_status_idx ON public.youth_houses (status);

-- Caller manages this centre? (administrator, or the owning account)
CREATE OR REPLACE FUNCTION public.manages_house(house_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.youth_houses h
    WHERE h.id = house_id AND h.manager_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.manages_house(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manages_house(uuid) TO authenticated;

ALTER TABLE public.youth_houses ENABLE ROW LEVEL SECURITY;

-- Approved centres are visible to every approved account.
-- Pending and rejected records are visible only to their owner and to admins.
DROP POLICY IF EXISTS "youth_houses_select" ON public.youth_houses;
CREATE POLICY "youth_houses_select"
ON public.youth_houses FOR SELECT
TO authenticated
USING (
  (public.is_approved() AND status = 'approved' AND is_active)
  OR manager_id = auth.uid()
  OR public.is_admin()
);

-- A youth_house account registers its own centre; admins may register on
-- behalf of a centre as well.
DROP POLICY IF EXISTS "youth_houses_insert_self" ON public.youth_houses;
CREATE POLICY "youth_houses_insert_self"
ON public.youth_houses FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR (public.current_role() = 'youth_house' AND manager_id = auth.uid())
);

DROP POLICY IF EXISTS "youth_houses_update_manager" ON public.youth_houses;
CREATE POLICY "youth_houses_update_manager"
ON public.youth_houses FOR UPDATE
TO authenticated
USING (public.manages_house(id))
WITH CHECK (public.manages_house(id));

DROP POLICY IF EXISTS "youth_houses_delete_admin" ON public.youth_houses;
CREATE POLICY "youth_houses_delete_admin"
ON public.youth_houses FOR DELETE
TO authenticated
USING (public.is_admin());

REVOKE ALL ON public.youth_houses FROM anon;
GRANT SELECT, INSERT, DELETE ON public.youth_houses TO authenticated;
-- Status, ownership and the active flag are deliberately excluded: an owner
-- must not be able to approve itself.
GRANT UPDATE (name, city, address, phone, email, description,
              latitude, longitude, updated_at)
  ON public.youth_houses TO authenticated;

-- ============================================================
-- 3. Administrator review
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_houses()
RETURNS SETOF public.youth_houses
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.* FROM public.youth_houses h
  WHERE public.is_admin()
  ORDER BY
    CASE h.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
    h.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_house_status(
  house_id uuid,
  new_status text,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may review a youth house';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.youth_houses
     SET status = new_status,
         rejection_reason = CASE WHEN new_status = 'rejected' THEN reason ELSE NULL END,
         updated_at = now()
   WHERE id = house_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_house_active(house_id uuid, active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may deactivate a youth house';
  END IF;

  UPDATE public.youth_houses
     SET is_active = active, updated_at = now()
   WHERE id = house_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_houses() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_house_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_house_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_houses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_house_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_house_active(uuid, boolean) TO authenticated;

-- ============================================================
-- 4. Link profiles to a centre
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS youth_house_id uuid
  REFERENCES public.youth_houses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_youth_house_idx
  ON public.profiles (youth_house_id);

REVOKE UPDATE (youth_house_id) ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_house(target_id uuid, house_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may assign a youth house';
  END IF;

  UPDATE public.profiles
     SET youth_house_id = house_id, updated_at = now()
   WHERE id = target_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_house(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_house(uuid, uuid) TO authenticated;

-- ============================================================
-- 5. updated_at trigger (reused by later migrations)
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youth_houses_touch ON public.youth_houses;
CREATE TRIGGER youth_houses_touch
  BEFORE UPDATE ON public.youth_houses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
