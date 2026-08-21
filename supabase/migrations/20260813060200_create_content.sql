/*
# News, challenges and GəncKart

## 1. Purpose
Fills the remaining content screens: the news feed, the challenge system and
the GəncKart partner directory with its usage log.

## 2. New tables
- `news`: announcements, published by administrators.
- `challenges` and `challenge_progress`: a target the young person works
  towards; completing it awards points once.
- `genc_kart_partners` and `genc_kart_usages`: partner discounts and the record
  of each use, which the admin panel counts.

## 3. Security
- Content is readable by every approved account, writable by administrators.
- Progress rows belong to their owner; completion is awarded server-side.
*/

-- ============================================================
-- 1. news
-- ============================================================

CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Xəbər',
  short_description text,
  full_text text,
  image_path text,
  author text,
  house_id uuid REFERENCES public.youth_houses(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_published_idx ON public.news (published_at DESC);

DROP TRIGGER IF EXISTS news_touch ON public.news;
CREATE TRIGGER news_touch
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_select" ON public.news;
CREATE POLICY "news_select"
ON public.news FOR SELECT TO authenticated
USING (
  public.is_approved()
  AND (is_published AND published_at <= now() OR public.is_admin())
);

DROP POLICY IF EXISTS "news_write" ON public.news;
CREATE POLICY "news_write"
ON public.news FOR ALL TO authenticated
USING (public.is_admin() OR (house_id IS NOT NULL AND public.manages_house(house_id)))
WITH CHECK (public.is_admin() OR (house_id IS NOT NULL AND public.manages_house(house_id)));

REVOKE ALL ON public.news FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;

-- ============================================================
-- 2. challenges
-- ============================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Ümumi',
  reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  target integer NOT NULL DEFAULT 1 CHECK (target > 0),
  metric text NOT NULL DEFAULT 'manual'
    CHECK (metric IN ('manual', 'visits', 'events')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_progress_user_idx
  ON public.challenge_progress (user_id);

DROP TRIGGER IF EXISTS challenge_progress_touch ON public.challenge_progress;
CREATE TRIGGER challenge_progress_touch
  BEFORE UPDATE ON public.challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select" ON public.challenges;
CREATE POLICY "challenges_select"
ON public.challenges FOR SELECT TO authenticated
USING (public.is_approved() AND (is_active OR public.is_admin()));

DROP POLICY IF EXISTS "challenges_write_admin" ON public.challenges;
CREATE POLICY "challenges_write_admin"
ON public.challenges FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "challenge_progress_select" ON public.challenge_progress;
CREATE POLICY "challenge_progress_select"
ON public.challenge_progress FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

REVOKE ALL ON public.challenges, public.challenge_progress FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT ON public.challenge_progress TO authenticated;

-- Recalculate the caller's progress and award any newly completed challenge.
CREATE OR REPLACE FUNCTION public.sync_my_challenges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch public.challenges%ROWTYPE;
  current_value integer;
  awarded integer := 0;
  row_completed timestamptz;
BEGIN
  FOR ch IN
    SELECT * FROM public.challenges
     WHERE is_active
       AND starts_at <= now()
       AND (ends_at IS NULL OR ends_at > now())
  LOOP
    current_value := CASE ch.metric
      WHEN 'visits' THEN (
        SELECT count(*)::integer FROM public.house_visits v
         WHERE v.user_id = auth.uid()
           AND v.exited_at IS NOT NULL
           AND v.entered_at >= ch.starts_at)
      WHEN 'events' THEN (
        SELECT count(*)::integer FROM public.event_attendance a
         WHERE a.user_id = auth.uid()
           AND a.attended_at >= ch.starts_at)
      ELSE (
        SELECT COALESCE(progress, 0) FROM public.challenge_progress
         WHERE challenge_id = ch.id AND user_id = auth.uid())
    END;

    INSERT INTO public.challenge_progress (challenge_id, user_id, progress)
    VALUES (ch.id, auth.uid(), COALESCE(current_value, 0))
    ON CONFLICT (challenge_id, user_id)
    DO UPDATE SET progress = EXCLUDED.progress, updated_at = now()
    RETURNING completed_at INTO row_completed;

    IF row_completed IS NULL AND COALESCE(current_value, 0) >= ch.target THEN
      UPDATE public.challenge_progress
         SET completed_at = now()
       WHERE challenge_id = ch.id AND user_id = auth.uid();

      IF ch.reward_points > 0 THEN
        INSERT INTO public.point_transactions
          (user_id, amount, activity, source, source_id)
        VALUES
          (auth.uid(), ch.reward_points, ch.title, 'challenge', ch.id)
        ON CONFLICT DO NOTHING;
      END IF;

      awarded := awarded + 1;
    END IF;
  END LOOP;

  RETURN awarded;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_my_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_challenges() TO authenticated;

-- ============================================================
-- 3. GəncKart
-- ============================================================

CREATE TABLE IF NOT EXISTS public.genc_kart_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Digər',
  description text,
  address text,
  city text,
  discount integer NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 100),
  image_path text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.genc_kart_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.genc_kart_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS genc_kart_usages_user_idx ON public.genc_kart_usages (user_id);
CREATE INDEX IF NOT EXISTS genc_kart_usages_time_idx ON public.genc_kart_usages (used_at);

ALTER TABLE public.genc_kart_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genc_kart_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select" ON public.genc_kart_partners;
CREATE POLICY "partners_select"
ON public.genc_kart_partners FOR SELECT TO authenticated
USING (public.is_approved() AND (is_active OR public.is_admin()));

DROP POLICY IF EXISTS "partners_write_admin" ON public.genc_kart_partners;
CREATE POLICY "partners_write_admin"
ON public.genc_kart_partners FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usages_select" ON public.genc_kart_usages;
CREATE POLICY "usages_select"
ON public.genc_kart_usages FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "usages_insert_own" ON public.genc_kart_usages;
CREATE POLICY "usages_insert_own"
ON public.genc_kart_usages FOR INSERT TO authenticated
WITH CHECK (public.is_approved() AND user_id = auth.uid());

REVOKE ALL ON public.genc_kart_partners, public.genc_kart_usages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genc_kart_partners TO authenticated;
GRANT SELECT, INSERT ON public.genc_kart_usages TO authenticated;
