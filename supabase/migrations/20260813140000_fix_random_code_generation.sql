/*
# Random code generation without pgcrypto

## 1. Problem
`rotate_house_qr()` and `redeem_reward()` built their codes with
`gen_random_bytes()`, which belongs to the pgcrypto extension. On Supabase that
extension lives in the `extensions` schema, while both functions pin
`search_path = public` for safety — so the call could not be resolved and every
attempt failed with "Kod yaradıla bilmədi".

## 2. Solution
Both now derive their code from `gen_random_uuid()`, which is part of the
PostgreSQL core and needs no extension. A UUID carries 122 bits of randomness,
so a 32-character entrance code is no weaker than the previous 36-character
hex string.

## 3. Notes
Existing codes keep working — only the generator changes.
*/

-- ============================================================
-- 1. Entrance QR code
-- ============================================================

CREATE OR REPLACE FUNCTION public.rotate_house_qr(
  target_house uuid,
  valid_minutes integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Yalnız bu mərkəzin əməkdaşı kodu yeniləyə bilər';
  END IF;

  UPDATE public.house_qr_codes
     SET is_active = false
   WHERE house_id = target_house AND is_active;

  -- gen_random_uuid() nüvənin bir hissəsidir, pgcrypto tələb etmir.
  new_code := replace(gen_random_uuid()::text, '-', '')
              || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.house_qr_codes (house_id, code, valid_until, created_by)
  VALUES (
    target_house,
    new_code,
    CASE WHEN valid_minutes IS NULL THEN NULL
         ELSE now() + make_interval(mins => valid_minutes) END,
    auth.uid()
  );

  RETURN new_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_house_qr(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_house_qr(uuid, integer) TO authenticated;

-- ============================================================
-- 2. Reward pickup code
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

  -- Qısa, oxunaqlı kod: 8 simvol, əl ilə yazmaq üçün rahatdır.
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

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
