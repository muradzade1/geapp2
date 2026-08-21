/*
# Platform-wide logs for the ministry panel

## 1. Purpose
Three sections of the admin panel — QR logs, events and feedback — still had no
data source and rendered empty tables. Each needs a cross-centre view, which
ordinary queries cannot give: the row level policies scope `house_visits`,
`events` and `feedback` to the centre that owns them, deliberately. These
functions provide the platform-wide read that only an administrator may make.

## 2. New functions
- `admin_visit_logs(limit, house)`: every check-in across the platform, with the
  visitor's name, the centre, both timestamps and the points the visit earned.
- `admin_events(limit)`: every event with its centre, organiser and counts.
- `admin_feedback(limit)`: every rating with the event and centre it belongs to.

## 3. Security
All three refuse anyone who is not an approved administrator.

## 4. Notes
`admin_visit_logs` reports the points actually awarded for that visit by joining
the ledger, rather than assuming the current rule value — a visit made before a
rule change keeps the figure it was given.
*/

-- ============================================================
-- 1. Visit log
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_visit_logs(
  limit_count integer DEFAULT 200,
  target_house uuid DEFAULT NULL
)
RETURNS TABLE (
  visit_id uuid,
  user_id uuid,
  full_name text,
  house_id uuid,
  house_name text,
  entered_at timestamptz,
  exited_at timestamptz,
  duration_seconds integer,
  auto_closed boolean,
  is_inside boolean,
  points_awarded integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.user_id,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    v.house_id,
    h.name,
    v.entered_at,
    v.exited_at,
    CASE
      WHEN v.exited_at IS NULL THEN EXTRACT(EPOCH FROM (now() - v.entered_at))::integer
      ELSE EXTRACT(EPOCH FROM (v.exited_at - v.entered_at))::integer
    END,
    v.auto_closed,
    v.exited_at IS NULL,
    COALESCE((
      SELECT t.amount FROM public.point_transactions t
       WHERE t.source = 'visit' AND t.source_id = v.id AND t.user_id = v.user_id
       LIMIT 1
    ), 0)
  FROM public.house_visits v
  LEFT JOIN public.profiles p ON p.id = v.user_id
  LEFT JOIN public.youth_houses h ON h.id = v.house_id
  WHERE public.is_admin()
    AND (target_house IS NULL OR v.house_id = target_house)
  ORDER BY v.entered_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_visit_logs(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_visit_logs(integer, uuid) TO authenticated;

-- ============================================================
-- 2. Events
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_events(limit_count integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  title text,
  category text,
  house_name text,
  organiser_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  points_reward integer,
  status text,
  registered_count bigint,
  attended_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.title,
    e.category,
    h.name,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    e.starts_at,
    e.ends_at,
    e.capacity,
    e.points_reward,
    e.status,
    (SELECT count(*) FROM public.event_registrations r
      WHERE r.event_id = e.id AND r.status = 'registered'),
    (SELECT count(*) FROM public.event_attendance a WHERE a.event_id = e.id)
  FROM public.events e
  LEFT JOIN public.youth_houses h ON h.id = e.youth_house_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(e.trainer_id, e.created_by)
  WHERE public.is_admin()
  ORDER BY e.starts_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_events(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_events(integer) TO authenticated;

-- ============================================================
-- 3. Feedback
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_feedback(limit_count integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  event_title text,
  house_name text,
  author_name text,
  content_rating integer,
  instructor_rating integer,
  equipment_rating integer,
  comment text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    e.title,
    h.name,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    f.content_rating,
    f.instructor_rating,
    f.equipment_rating,
    f.comment,
    f.created_at
  FROM public.feedback f
  JOIN public.events e ON e.id = f.event_id
  LEFT JOIN public.youth_houses h ON h.id = e.youth_house_id
  LEFT JOIN public.profiles p ON p.id = f.user_id
  WHERE public.is_admin()
  ORDER BY f.created_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_feedback(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_feedback(integer) TO authenticated;
