/*
# Approval cascade and corrected participant counts

## 1. Problem
Approving a `youth_house` account changed `profiles.status` only. The centre
record in `youth_houses` stayed `pending`, so the centre panel kept showing
"Təsdiq gözlənilir" and the centre never reached the shared directory.

At the same time `admin_dashboard()` counted every account as a user, so staff
and trainer accounts appeared in the participant tiles alongside young people.

## 2. Changes
- Approving a `youth_house` account now approves its centre as well.
- A centre registered by an already-approved account is approved on insert.
- Existing rows are corrected once, in this migration.
- `admin_dashboard()` separates young people from staff, and reports accounts
  by role.

## 3. Notes
An administrator can still reject or deactivate a centre afterwards through
`admin_set_house_status()` / `admin_set_house_active()` — this only removes the
second, redundant approval step for accounts that were already trusted.
*/

-- ============================================================
-- 1. Approval cascade
-- ============================================================

-- Account approved -> approve its centre too.
CREATE OR REPLACE FUNCTION public.sync_house_on_profile_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'youth_house'
     AND NEW.status = 'approved'
     AND COALESCE(OLD.status, '') <> 'approved' THEN
    UPDATE public.youth_houses
       SET status = 'approved', rejection_reason = NULL, updated_at = now()
     WHERE manager_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_approve_house ON public.profiles;
CREATE TRIGGER profiles_approve_house
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_house_on_profile_approval();

-- Centre registered by an already-approved account -> approved immediately.
CREATE OR REPLACE FUNCTION public.house_status_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = NEW.manager_id AND status = 'approved'
  ) THEN
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youth_houses_initial_status ON public.youth_houses;
CREATE TRIGGER youth_houses_initial_status
  BEFORE INSERT ON public.youth_houses
  FOR EACH ROW EXECUTE FUNCTION public.house_status_on_insert();

-- Correct rows created before this migration.
UPDATE public.youth_houses h
   SET status = 'approved', updated_at = now()
  FROM public.profiles p
 WHERE p.id = h.manager_id
   AND p.status = 'approved'
   AND h.status = 'pending';

-- ============================================================
-- 2. Corrected dashboard counts
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yalnız administrator';
  END IF;

  SELECT jsonb_build_object(
    -- Gənclər (yalnız youth rolu)
    'total_users', (SELECT count(*) FROM public.profiles WHERE role = 'youth'),
    'active_users', (SELECT count(*) FROM public.profiles
                      WHERE role = 'youth' AND status = 'approved'),
    'pending_users', (SELECT count(*) FROM public.profiles
                       WHERE role = 'youth' AND status = 'pending'),

    -- Bütün hesablar (gənc + təlimçi + Gənclər Evi + admin)
    'total_accounts', (SELECT count(*) FROM public.profiles),
    'pending_accounts', (SELECT count(*) FROM public.profiles WHERE status = 'pending'),

    -- Təlimçilər
    'total_trainers', (SELECT count(*) FROM public.profiles
                        WHERE role = 'trainer' AND status = 'approved'),

    'by_role', (
      SELECT COALESCE(jsonb_object_agg(role, cnt), '{}'::jsonb)
        FROM (SELECT role, count(*) AS cnt FROM public.profiles GROUP BY role) r
    ),

    -- Gənclər Evləri
    'total_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'approved'),
    'pending_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'pending'),

    'current_visitors', (
      SELECT count(*) FROM public.house_visits WHERE exited_at IS NULL),

    'today_check_ins', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('day', now())),

    'today_events', (
      SELECT count(*) FROM public.events
       WHERE status IN ('published', 'completed')
         AND starts_at >= date_trunc('day', now())
         AND starts_at < date_trunc('day', now()) + interval '1 day'),

    'today_participants', (
      SELECT count(*) FROM public.event_attendance
       WHERE attended_at >= date_trunc('day', now())),

    'month_visits', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('month', now())),

    'total_points_awarded', (
      SELECT COALESCE(sum(amount), 0) FROM public.point_transactions WHERE amount > 0),

    'genc_kart_usages', (SELECT count(*) FROM public.genc_kart_usages),

    'feedback_count', (SELECT count(*) FROM public.feedback),

    'feedback_average', (
      SELECT COALESCE(round(avg((content_rating + instructor_rating + equipment_rating) / 3.0), 1), 0)
        FROM public.feedback),

    'redemptions_pending', (
      SELECT count(*) FROM public.reward_redemptions WHERE status = 'pending'),

    'daily_series', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT
          g.day::date AS day,
          (SELECT count(*) FROM public.house_visits v
            WHERE v.entered_at >= g.day AND v.entered_at < g.day + interval '1 day') AS visits,
          (SELECT count(*) FROM public.profiles p
            WHERE p.role = 'youth'
              AND p.created_at >= g.day
              AND p.created_at < g.day + interval '1 day') AS signups
        FROM generate_series(
               date_trunc('day', now()) - interval '6 days',
               date_trunc('day', now()),
               interval '1 day') AS g(day)
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated;

-- ============================================================
-- 3. Centre list for the admin panel
-- ============================================================

-- Adds the contact details the admin table shows, plus the manager's name.
DROP FUNCTION IF EXISTS public.admin_house_summary();
CREATE FUNCTION public.admin_house_summary()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  address text,
  phone text,
  email text,
  status text,
  is_active boolean,
  manager_name text,
  members bigint,
  current_visitors bigint,
  today_check_ins bigint,
  month_visits bigint,
  events_count bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id, h.name, h.city, h.address, h.phone, h.email, h.status, h.is_active,
    trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')),
    (SELECT count(*) FROM public.profiles m WHERE m.youth_house_id = h.id),
    (SELECT count(*) FROM public.house_visits v
      WHERE v.house_id = h.id AND v.exited_at IS NULL),
    (SELECT count(*) FROM public.house_visits v
      WHERE v.house_id = h.id AND v.entered_at >= date_trunc('day', now())),
    (SELECT count(*) FROM public.house_visits v
      WHERE v.house_id = h.id AND v.entered_at >= date_trunc('month', now())),
    (SELECT count(*) FROM public.events e WHERE e.youth_house_id = h.id),
    h.created_at
  FROM public.youth_houses h
  LEFT JOIN public.profiles p ON p.id = h.manager_id
  WHERE public.is_admin()
  ORDER BY
    CASE h.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
    h.name;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_house_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_house_summary() TO authenticated;
