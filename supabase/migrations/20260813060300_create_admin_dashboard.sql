/*
# Notifications, feedback, leaderboard and the ministry dashboard

## 1. Purpose
Completes the backend: in-app notifications, event feedback with its ratings,
the public leaderboard, and the single RPC that fills every tile of the
Nazirlik İdarəetmə Paneli.

## 2. New tables
- `notifications`: personal or broadcast messages.
- `feedback`: ratings and comment for an attended event.

## 3. Awarding
Submitting feedback awards `points_per_feedback` once per event.

## 4. Security
- A notification is visible to its recipient, or to everyone when broadcast.
- Feedback may only be submitted by someone whose attendance was recorded.
- The dashboard RPC refuses anyone who is not an administrator.
*/

-- ============================================================
-- 1. notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system'
    CHECK (type IN ('event', 'points', 'reward', 'challenge', 'news', 'reminder', 'system')),
  house_id uuid REFERENCES public.youth_houses(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- user_id NULL means broadcast.
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.is_approved()
  AND (
    user_id = auth.uid()
    OR user_id IS NULL
    OR public.is_admin()
  )
);

DROP POLICY IF EXISTS "notifications_write" ON public.notifications;
CREATE POLICY "notifications_write"
ON public.notifications FOR ALL TO authenticated
USING (public.is_admin() OR (house_id IS NOT NULL AND public.manages_house(house_id)))
WITH CHECK (public.is_admin() OR (house_id IS NOT NULL AND public.manages_house(house_id)));

DROP POLICY IF EXISTS "notification_reads_own" ON public.notification_reads;
CREATE POLICY "notification_reads_own"
ON public.notification_reads FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.notifications, public.notification_reads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;

-- Notifications for the caller, with a read flag.
CREATE OR REPLACE VIEW public.my_notifications
WITH (security_invoker = true) AS
SELECT
  n.id,
  n.title,
  n.message,
  n.type,
  n.created_at,
  (r.notification_id IS NOT NULL) AS read
FROM public.notifications n
LEFT JOIN public.notification_reads r
  ON r.notification_id = n.id AND r.user_id = auth.uid()
WHERE n.user_id = auth.uid() OR n.user_id IS NULL;

REVOKE ALL ON public.my_notifications FROM anon;
GRANT SELECT ON public.my_notifications TO authenticated;

-- ============================================================
-- 2. feedback
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_rating integer NOT NULL CHECK (content_rating BETWEEN 1 AND 10),
  instructor_rating integer NOT NULL CHECK (instructor_rating BETWEEN 1 AND 10),
  equipment_rating integer NOT NULL CHECK (equipment_rating BETWEEN 1 AND 10),
  comment text,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS feedback_event_idx ON public.feedback (event_id);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select" ON public.feedback;
CREATE POLICY "feedback_select"
ON public.feedback FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin() OR public.manages_event(event_id));

REVOKE ALL ON public.feedback FROM anon;
GRANT SELECT ON public.feedback TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_feedback(
  target_event uuid,
  content_rating integer,
  instructor_rating integer,
  equipment_rating integer,
  comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward integer;
  attended boolean;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Hesab təsdiqlənməyib';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_attendance
     WHERE event_id = target_event AND user_id = auth.uid()
  ) INTO attended;

  IF NOT attended THEN
    RAISE EXCEPTION 'Yalnız iştirak etdiyiniz tədbir haqqında rəy bildirə bilərsiniz';
  END IF;

  reward := public.point_rule('points_per_feedback', 10);

  INSERT INTO public.feedback
    (event_id, user_id, content_rating, instructor_rating, equipment_rating,
     comment, points_awarded)
  VALUES
    (target_event, auth.uid(), content_rating, instructor_rating, equipment_rating,
     comment, reward);

  IF reward > 0 THEN
    INSERT INTO public.point_transactions
      (user_id, amount, activity, source, source_id)
    VALUES
      (auth.uid(), reward, 'Tədbir haqqında rəy', 'feedback', target_event)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'points_awarded', reward);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, integer, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, integer, integer, text)
  TO authenticated;

-- ============================================================
-- 3. Leaderboard
-- ============================================================

CREATE OR REPLACE FUNCTION public.leaderboard(limit_count integer DEFAULT 50)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  first_name text,
  last_name text,
  avatar_path text,
  city text,
  points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    row_number() OVER (ORDER BY COALESCE(sum(t.amount), 0) DESC, p.created_at) AS rank,
    p.id,
    p.first_name,
    p.last_name,
    p.avatar_path,
    p.city,
    COALESCE(sum(t.amount), 0)::integer AS points
  FROM public.profiles p
  LEFT JOIN public.point_transactions t ON t.user_id = p.id
  WHERE p.role = 'youth' AND p.status = 'approved'
    AND public.is_approved()
  GROUP BY p.id, p.first_name, p.last_name, p.avatar_path, p.city, p.created_at
  ORDER BY points DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaderboard(integer) TO authenticated;

-- ============================================================
-- 4. Ministry dashboard
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
    -- Ümumi qeydiyyatdan keçən
    'total_users', (SELECT count(*) FROM public.profiles),

    -- Aktiv istifadəçilər (təsdiqlənmiş)
    'active_users', (SELECT count(*) FROM public.profiles WHERE status = 'approved'),

    -- Təsdiq gözləyənlər
    'pending_users', (SELECT count(*) FROM public.profiles WHERE status = 'pending'),

    -- Rol üzrə bölgü
    'by_role', (
      SELECT COALESCE(jsonb_object_agg(role, cnt), '{}'::jsonb)
        FROM (SELECT role, count(*) AS cnt FROM public.profiles GROUP BY role) r
    ),

    -- Gənclər Evləri
    'total_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'approved'),
    'pending_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'pending'),

    -- Hazırda Gənclər Evlərində olanlar
    'current_visitors', (
      SELECT count(*) FROM public.house_visits WHERE exited_at IS NULL),

    -- Bu gün giriş
    'today_check_ins', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('day', now())),

    -- Bu gün tədbir
    'today_events', (
      SELECT count(*) FROM public.events
       WHERE status IN ('published', 'completed')
         AND starts_at >= date_trunc('day', now())
         AND starts_at < date_trunc('day', now()) + interval '1 day'),

    -- Bu gün iştirakçı
    'today_participants', (
      SELECT count(*) FROM public.event_attendance
       WHERE attended_at >= date_trunc('day', now())),

    -- Bu ay ziyarət
    'month_visits', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('month', now())),

    -- Verilən xallar (müsbət hərəkətlərin cəmi)
    'total_points_awarded', (
      SELECT COALESCE(sum(amount), 0) FROM public.point_transactions WHERE amount > 0),

    -- GəncKart istifadə
    'genc_kart_usages', (SELECT count(*) FROM public.genc_kart_usages),

    -- Feedback sayı
    'feedback_count', (SELECT count(*) FROM public.feedback),

    -- Orta feedback (10 üzrə)
    'feedback_average', (
      SELECT COALESCE(round(avg((content_rating + instructor_rating + equipment_rating) / 3.0), 1), 0)
        FROM public.feedback),

    -- Mükafat statistikası
    'redemptions_pending', (
      SELECT count(*) FROM public.reward_redemptions WHERE status = 'pending'),

    -- Son 7 gün üzrə qrafik
    'daily_series', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT
          g.day::date AS day,
          (SELECT count(*) FROM public.house_visits v
            WHERE v.entered_at >= g.day AND v.entered_at < g.day + interval '1 day') AS visits,
          (SELECT count(*) FROM public.profiles p
            WHERE p.created_at >= g.day AND p.created_at < g.day + interval '1 day') AS signups
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

-- Per-centre summary for the admin table view.
CREATE OR REPLACE FUNCTION public.admin_house_summary()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  status text,
  members bigint,
  current_visitors bigint,
  month_visits bigint,
  events_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id, h.name, h.city, h.status,
    (SELECT count(*) FROM public.profiles p WHERE p.youth_house_id = h.id),
    (SELECT count(*) FROM public.house_visits v
      WHERE v.house_id = h.id AND v.exited_at IS NULL),
    (SELECT count(*) FROM public.house_visits v
      WHERE v.house_id = h.id AND v.entered_at >= date_trunc('month', now())),
    (SELECT count(*) FROM public.events e WHERE e.youth_house_id = h.id)
  FROM public.youth_houses h
  WHERE public.is_admin()
  ORDER BY h.name;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_house_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_house_summary() TO authenticated;
