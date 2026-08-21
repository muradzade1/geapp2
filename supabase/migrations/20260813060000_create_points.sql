/*
# Points, levels and badges

## 1. Purpose
Turns attendance and visits into points, and points into levels and badges.
Everything else (leaderboard, rewards, admin totals) reads from here.

## 2. New tables
- `point_transactions`: an append-only ledger. `amount` is positive when
  earned, negative when spent. A balance is never stored — it is the sum of
  this ledger, so it can never drift out of sync with reality.
- `levels`: threshold table, editable by administrators.
- `badges` and `user_badges`: achievements and who has unlocked them.

## 3. Automatic awarding
- Confirming attendance on an event awards that event's `points_reward`.
- Closing a visit awards `points_per_visit` (see `point_rules`).
- Both are idempotent: the ledger has a unique key per source row, so a repeat
  insert cannot double-award.

## 4. Security
- Everyone reads their own ledger; staff read the ledger of their own centre's
  members; administrators read everything.
- Nobody may write to the ledger from the browser. Points move only through
  the functions in this migration and in the rewards migration.
*/

-- ============================================================
-- 1. Configurable rules
-- ============================================================

CREATE TABLE IF NOT EXISTS public.point_rules (
  key text PRIMARY KEY,
  value integer NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.point_rules (key, value, description) VALUES
  ('points_per_visit', 5, 'Gənclər Evinə hər tam ziyarətə görə'),
  ('points_per_feedback', 10, 'Tədbir haqqında rəy bildirdikdə'),
  ('min_visit_minutes', 15, 'Xal üçün minimum qalma müddəti (dəqiqə)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "point_rules_select" ON public.point_rules;
CREATE POLICY "point_rules_select"
ON public.point_rules FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "point_rules_write_admin" ON public.point_rules;
CREATE POLICY "point_rules_write_admin"
ON public.point_rules FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

REVOKE ALL ON public.point_rules FROM anon;
GRANT SELECT ON public.point_rules TO authenticated;
GRANT UPDATE (value, description, updated_at) ON public.point_rules TO authenticated;

CREATE OR REPLACE FUNCTION public.point_rule(rule_key text, fallback integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.point_rules WHERE key = rule_key), fallback);
$$;

-- ============================================================
-- 2. point_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  activity text NOT NULL,
  source text NOT NULL
    CHECK (source IN ('event', 'visit', 'feedback', 'challenge', 'reward', 'manual')),
  source_id uuid,
  house_id uuid REFERENCES public.youth_houses(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_tx_user_idx ON public.point_transactions (user_id);
CREATE INDEX IF NOT EXISTS point_tx_created_idx ON public.point_transactions (created_at);
CREATE INDEX IF NOT EXISTS point_tx_house_idx ON public.point_transactions (house_id);
-- One award per source row: prevents double-awarding on retry.
CREATE UNIQUE INDEX IF NOT EXISTS point_tx_source_key
  ON public.point_transactions (user_id, source, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "point_tx_select" ON public.point_transactions;
CREATE POLICY "point_tx_select"
ON public.point_transactions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR (house_id IS NOT NULL AND public.manages_house(house_id))
);

REVOKE ALL ON public.point_transactions FROM anon;
GRANT SELECT ON public.point_transactions TO authenticated;
-- No INSERT grant: points move only through the functions below.

CREATE OR REPLACE FUNCTION public.user_points(target uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0)::integer
    FROM public.point_transactions
   WHERE user_id = COALESCE(target, auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.user_points(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_points(uuid) TO authenticated;

-- Administrator manual adjustment (bonus or correction).
CREATE OR REPLACE FUNCTION public.admin_award_points(
  target_user uuid,
  amount integer,
  reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may adjust points';
  END IF;

  IF amount = 0 THEN
    RAISE EXCEPTION 'Amount must not be zero';
  END IF;

  INSERT INTO public.point_transactions (user_id, amount, activity, source, created_by)
  VALUES (target_user, amount, reason, 'manual', auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_award_points(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_award_points(uuid, integer, text) TO authenticated;

-- ============================================================
-- 3. Automatic awarding
-- ============================================================

-- Attendance confirmed -> award the event's points.
CREATE OR REPLACE FUNCTION public.award_event_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;

  IF ev.id IS NULL OR ev.points_reward <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, activity, source, source_id, house_id)
  VALUES
    (NEW.user_id, ev.points_reward, ev.title, 'event', NEW.event_id, ev.youth_house_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendance_points ON public.event_attendance;
CREATE TRIGGER event_attendance_points
  AFTER INSERT ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.award_event_points();

-- Visit closed -> award visit points, if the stay was long enough.
CREATE OR REPLACE FUNCTION public.award_visit_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minutes integer;
  reward integer;
BEGIN
  IF NEW.exited_at IS NULL OR OLD.exited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  minutes := EXTRACT(EPOCH FROM (NEW.exited_at - NEW.entered_at)) / 60;

  IF minutes < public.point_rule('min_visit_minutes', 15) THEN
    RETURN NEW;
  END IF;

  reward := public.point_rule('points_per_visit', 5);

  INSERT INTO public.point_transactions
    (user_id, amount, activity, source, source_id, house_id)
  VALUES
    (NEW.user_id, reward, 'Gənclər Evinə ziyarət', 'visit', NEW.id, NEW.house_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS house_visits_points ON public.house_visits;
CREATE TRIGGER house_visits_points
  AFTER UPDATE ON public.house_visits
  FOR EACH ROW EXECUTE FUNCTION public.award_visit_points();

-- ============================================================
-- 4. Levels
-- ============================================================

CREATE TABLE IF NOT EXISTS public.levels (
  id serial PRIMARY KEY,
  name text NOT NULL,
  min_points integer NOT NULL UNIQUE,
  color text
);

INSERT INTO public.levels (name, min_points, color) VALUES
  ('Başlanğıc', 0, '#94a3b8'),
  ('Fəal', 100, '#22c55e'),
  ('Təcrübəli', 300, '#0ea5e9'),
  ('Lider', 700, '#a855f7'),
  ('Elçi', 1500, '#f59e0b')
ON CONFLICT (min_points) DO NOTHING;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "levels_select" ON public.levels;
CREATE POLICY "levels_select"
ON public.levels FOR SELECT TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "levels_write_admin" ON public.levels;
CREATE POLICY "levels_write_admin"
ON public.levels FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.levels FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.levels TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.levels_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.user_level(target uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pts AS (SELECT public.user_points(COALESCE(target, auth.uid())) AS total)
  SELECT jsonb_build_object(
    'points', pts.total,
    'level', (SELECT l.name FROM public.levels l
               WHERE l.min_points <= pts.total ORDER BY l.min_points DESC LIMIT 1),
    'color', (SELECT l.color FROM public.levels l
               WHERE l.min_points <= pts.total ORDER BY l.min_points DESC LIMIT 1),
    'next_level', (SELECT l.name FROM public.levels l
                    WHERE l.min_points > pts.total ORDER BY l.min_points LIMIT 1),
    'next_at', (SELECT l.min_points FROM public.levels l
                 WHERE l.min_points > pts.total ORDER BY l.min_points LIMIT 1)
  ) FROM pts;
$$;

REVOKE EXECUTE ON FUNCTION public.user_level(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_level(uuid) TO authenticated;

-- ============================================================
-- 5. Badges
-- ============================================================

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  condition_text text,
  category text NOT NULL DEFAULT 'Tədbir və iştirak',
  icon text,
  metric text NOT NULL DEFAULT 'points'
    CHECK (metric IN ('points', 'visits', 'events', 'feedback')),
  target integer NOT NULL DEFAULT 1 CHECK (target > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx ON public.user_badges (user_id);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_select" ON public.badges;
CREATE POLICY "badges_select"
ON public.badges FOR SELECT TO authenticated
USING (public.is_approved() AND (is_active OR public.is_admin()));

DROP POLICY IF EXISTS "badges_write_admin" ON public.badges;
CREATE POLICY "badges_write_admin"
ON public.badges FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_badges_select" ON public.user_badges;
CREATE POLICY "user_badges_select"
ON public.user_badges FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

REVOKE ALL ON public.badges, public.user_badges FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT SELECT ON public.user_badges TO authenticated;

-- Progress for the caller against every active badge.
CREATE OR REPLACE FUNCTION public.my_badges()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  condition_text text,
  category text,
  icon text,
  target integer,
  progress integer,
  unlocked boolean,
  unlocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id, b.name, b.description, b.condition_text, b.category, b.icon, b.target,
    CASE b.metric
      WHEN 'points' THEN public.user_points(auth.uid())
      WHEN 'visits' THEN (SELECT count(*)::integer FROM public.house_visits v
                           WHERE v.user_id = auth.uid() AND v.exited_at IS NOT NULL)
      WHEN 'events' THEN (SELECT count(*)::integer FROM public.event_attendance a
                           WHERE a.user_id = auth.uid())
      ELSE 0
    END AS progress,
    ub.id IS NOT NULL AS unlocked,
    ub.unlocked_at
  FROM public.badges b
  LEFT JOIN public.user_badges ub ON ub.badge_id = b.id AND ub.user_id = auth.uid()
  WHERE b.is_active
  ORDER BY b.category, b.target;
$$;

REVOKE EXECUTE ON FUNCTION public.my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_badges() TO authenticated;

-- Unlock any badge whose target the caller has reached.
CREATE OR REPLACE FUNCTION public.sync_my_badges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT auth.uid(), t.id
    FROM public.my_badges() t
   WHERE NOT t.unlocked AND t.progress >= t.target
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_badges() TO authenticated;
