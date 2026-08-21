/*
# Youth statistics and the daily check-in log

## 1. Purpose
Two screens still had no data source behind them: the young person's own
counters (points, visits, events) and the centre's "Bugünkü Giriş-Çıxış"
table. Both are added here as read-only functions.

## 2. New functions
- `my_youth_stats()`: the caller's own totals, in one round trip.
- `house_today_log(uuid)`: every visit at a centre today, with the visitor's
  name, both timestamps and the duration in seconds.

## 3. Duration
Duration is returned in **seconds**, not minutes. A visit that lasts under a
minute was previously rounded to "0 dəqiqə", which read as a bug rather than as
a very short visit. The interface decides how to present it.

## 4. Security
- `my_youth_stats()` reports only the caller's own figures.
- `house_today_log()` refuses anyone who does not manage that centre.
*/

-- ============================================================
-- 1. Young person's own totals
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_youth_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sessiya tapılmadı';
  END IF;

  SELECT jsonb_build_object(
    'points', public.user_points(uid),

    -- Tamamlanmış ziyarətlər (çıxış edilmiş)
    'visit_count', (
      SELECT count(*) FROM public.house_visits
       WHERE user_id = uid AND exited_at IS NOT NULL),

    -- Hazırda hansısa mərkəzdədirmi
    'currently_inside', (
      SELECT count(*) > 0 FROM public.house_visits
       WHERE user_id = uid AND exited_at IS NULL),

    -- İştirak etdiyi tədbirlər
    'events_attended', (
      SELECT count(*) FROM public.event_attendance WHERE user_id = uid),

    -- Qeydiyyatdan keçdiyi, hələ keçməmiş tədbirlər
    'events_upcoming', (
      SELECT count(*) FROM public.event_registrations r
        JOIN public.events e ON e.id = r.event_id
       WHERE r.user_id = uid
         AND r.status = 'registered'
         AND e.starts_at > now()),

    -- Tamamladığı çağırışlar
    'challenges_completed', (
      SELECT count(*) FROM public.challenge_progress
       WHERE user_id = uid AND completed_at IS NOT NULL),

    -- Qazandığı nişanlar
    'badges', (SELECT count(*) FROM public.user_badges WHERE user_id = uid),

    -- Bu ayın ziyarətləri
    'month_visits', (
      SELECT count(*) FROM public.house_visits
       WHERE user_id = uid AND entered_at >= date_trunc('month', now())),

    'level', public.user_level(uid)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_youth_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_youth_stats() TO authenticated;

-- ============================================================
-- 2. Centre's daily check-in log
-- ============================================================

CREATE OR REPLACE FUNCTION public.house_today_log(target_house uuid)
RETURNS TABLE (
  visit_id uuid,
  user_id uuid,
  full_name text,
  entered_at timestamptz,
  exited_at timestamptz,
  duration_seconds integer,
  auto_closed boolean,
  is_inside boolean
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
    v.entered_at,
    v.exited_at,
    CASE
      WHEN v.exited_at IS NULL
        THEN EXTRACT(EPOCH FROM (now() - v.entered_at))::integer
      ELSE EXTRACT(EPOCH FROM (v.exited_at - v.entered_at))::integer
    END,
    v.auto_closed,
    v.exited_at IS NULL
  FROM public.house_visits v
  LEFT JOIN public.profiles p ON p.id = v.user_id
  WHERE v.house_id = target_house
    AND public.manages_house(target_house)
    AND (
      v.entered_at >= date_trunc('day', now())
      OR v.exited_at IS NULL          -- dünəndən qalan açıq ziyarətlər də görünsün
    )
  ORDER BY v.entered_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.house_today_log(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.house_today_log(uuid) TO authenticated;

-- ============================================================
-- 3. Visit history for the young person, with the centre's name
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_visits(limit_count integer DEFAULT 20)
RETURNS TABLE (
  visit_id uuid,
  house_name text,
  entered_at timestamptz,
  exited_at timestamptz,
  duration_seconds integer,
  auto_closed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    h.name,
    v.entered_at,
    v.exited_at,
    CASE
      WHEN v.exited_at IS NULL
        THEN EXTRACT(EPOCH FROM (now() - v.entered_at))::integer
      ELSE EXTRACT(EPOCH FROM (v.exited_at - v.entered_at))::integer
    END,
    v.auto_closed
  FROM public.house_visits v
  JOIN public.youth_houses h ON h.id = v.house_id
  WHERE v.user_id = auth.uid()
  ORDER BY v.entered_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.my_visits(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_visits(integer) TO authenticated;
