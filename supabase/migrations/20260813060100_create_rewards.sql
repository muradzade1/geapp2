/*
# Rewards and redemptions

## 1. Purpose
Lets young people spend points on rewards, with stock and balance checked in
the database rather than in the browser.

## 2. New tables
- `rewards`: catalogue, editable by administrators.
- `reward_redemptions`: one row per redemption, carrying a pickup code.

## 3. Spending
`redeem_reward(reward_id)` checks the balance and the remaining stock, writes a
negative ledger entry and creates the redemption in a single transaction, so a
double tap cannot spend the same points twice.

## 4. Security
- Everyone reads the active catalogue; only administrators change it.
- A young person sees only their own redemptions; staff mark them as used.
*/

-- ============================================================
-- 1. rewards
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Digər',
  description text,
  required_points integer NOT NULL CHECK (required_points > 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  image_path text,
  valid_until timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rewards_status_idx ON public.rewards (status);

DROP TRIGGER IF EXISTS rewards_touch ON public.rewards;
CREATE TRIGGER rewards_touch
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_select" ON public.rewards;
CREATE POLICY "rewards_select"
ON public.rewards FOR SELECT TO authenticated
USING (public.is_approved() AND (status = 'active' OR public.is_admin()));

DROP POLICY IF EXISTS "rewards_write_admin" ON public.rewards;
CREATE POLICY "rewards_write_admin"
ON public.rewards FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.rewards FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;

-- ============================================================
-- 2. reward_redemptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'used', 'cancelled')),
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redemptions_user_idx ON public.reward_redemptions (user_id);
CREATE INDEX IF NOT EXISTS redemptions_status_idx ON public.reward_redemptions (status);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redemptions_select" ON public.reward_redemptions;
CREATE POLICY "redemptions_select"
ON public.reward_redemptions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR public.current_role() = 'youth_house'
);

REVOKE ALL ON public.reward_redemptions FROM anon;
GRANT SELECT ON public.reward_redemptions TO authenticated;
-- No direct writes: redemption goes through the functions below.

-- ============================================================
-- 3. Redeeming
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_reward(target_reward uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rw public.rewards%ROWTYPE;
  balance integer;
  new_code text;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Hesab təsdiqlənməyib';
  END IF;

  -- Lock the row so two taps cannot take the last item.
  SELECT * INTO rw FROM public.rewards WHERE id = target_reward FOR UPDATE;

  IF rw.id IS NULL OR rw.status <> 'active' THEN
    RAISE EXCEPTION 'Mükafat mövcud deyil';
  END IF;

  IF rw.valid_until IS NOT NULL AND rw.valid_until < now() THEN
    RAISE EXCEPTION 'Mükafatın müddəti bitib';
  END IF;

  IF rw.quantity <= 0 THEN
    RAISE EXCEPTION 'Mükafat tükənib';
  END IF;

  balance := public.user_points(auth.uid());

  IF balance < rw.required_points THEN
    RAISE EXCEPTION 'Kifayət qədər xal yoxdur';
  END IF;

  new_code := upper(encode(gen_random_bytes(4), 'hex'));

  INSERT INTO public.point_transactions
    (user_id, amount, activity, source, source_id)
  VALUES
    (auth.uid(), -rw.required_points, rw.title, 'reward', gen_random_uuid());

  INSERT INTO public.reward_redemptions
    (reward_id, user_id, code, points_spent)
  VALUES
    (target_reward, auth.uid(), new_code, rw.required_points);

  UPDATE public.rewards
     SET quantity = quantity - 1, updated_at = now()
   WHERE id = target_reward;

  RETURN jsonb_build_object(
    'code', new_code,
    'reward', rw.title,
    'points_spent', rw.required_points,
    'balance', balance - rw.required_points
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- Staff marks a pickup code as used.
CREATE OR REPLACE FUNCTION public.mark_redemption_used(redemption_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.reward_redemptions%ROWTYPE;
BEGIN
  IF public.current_role() NOT IN ('youth_house', 'admin') THEN
    RAISE EXCEPTION 'İcazə yoxdur';
  END IF;

  SELECT * INTO rec FROM public.reward_redemptions
   WHERE code = upper(redemption_code) FOR UPDATE;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Kod tapılmadı';
  END IF;

  IF rec.status <> 'pending' THEN
    RAISE EXCEPTION 'Bu kod artıq istifadə olunub';
  END IF;

  UPDATE public.reward_redemptions
     SET status = 'used', used_at = now(), used_by = auth.uid()
   WHERE id = rec.id;

  RETURN jsonb_build_object('ok', true, 'redemption_id', rec.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_redemption_used(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_redemption_used(text) TO authenticated;
