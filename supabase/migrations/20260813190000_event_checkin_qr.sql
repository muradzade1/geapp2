/*
# Event check-in with the young person's own QR code

## 1. Purpose
Until now attendance was confirmed by finding a name in a list. This adds the
faster path: the young person shows a code, staff scans it, attendance is
recorded and the event's points are awarded by the existing trigger.

## 2. Why a short-lived token
The obvious code would be the person's own id, but an id never changes: a
screenshot shared once would let someone else be marked present at every future
event. Instead each code lives for a few minutes and is replaced on demand, so a
leaked image is worthless almost immediately.

## 3. New table
- `user_qr_tokens`: one active token per person, with an expiry.

## 4. New functions
- `my_event_token()`: issues (or reuses) the caller's current token.
- `checkin_by_qr(event_id, token)`: resolves the token, verifies the caller
  organises that event, records attendance.

## 5. Security
- A token resolves to a person only inside `checkin_by_qr`, which is
  SECURITY DEFINER — nobody can read the token table to enumerate accounts.
- Only the event's trainer, its centre's staff or an administrator may check
  anyone in; `manages_event()` decides.
- Check-in is refused outside a sensible window around the event, so a code
  cannot be used days later.
*/

-- ============================================================
-- 1. user_qr_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_qr_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_qr_tokens_expiry_idx
  ON public.user_qr_tokens (expires_at);

ALTER TABLE public.user_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: the table is unreadable from the browser.
-- Both sides go through the SECURITY DEFINER functions below.
REVOKE ALL ON public.user_qr_tokens FROM anon, authenticated;

-- ============================================================
-- 2. Issuing a token
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_event_token(valid_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.user_qr_tokens%ROWTYPE;
  fresh text;
  expiry timestamptz;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Hesab təsdiqlənməyib';
  END IF;

  SELECT * INTO existing FROM public.user_qr_tokens WHERE user_id = uid;

  -- Hələ etibarlıdırsa, yenisini yaratmırıq.
  IF existing.token IS NOT NULL AND existing.expires_at > now() THEN
    RETURN jsonb_build_object(
      'token', existing.token,
      'expires_at', existing.expires_at
    );
  END IF;

  fresh := replace(gen_random_uuid()::text, '-', '');
  expiry := now() + make_interval(mins => GREATEST(valid_minutes, 1));

  INSERT INTO public.user_qr_tokens (user_id, token, expires_at)
  VALUES (uid, fresh, expiry)
  ON CONFLICT (user_id)
  DO UPDATE SET token = EXCLUDED.token,
                expires_at = EXCLUDED.expires_at,
                created_at = now();

  RETURN jsonb_build_object('token', fresh, 'expires_at', expiry);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_event_token(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_token(integer) TO authenticated;

-- ============================================================
-- 3. Checking someone in
-- ============================================================

CREATE OR REPLACE FUNCTION public.checkin_by_qr(target_event uuid, scanned_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
  target_user uuid;
  person_name text;
  already boolean;
BEGIN
  IF NOT public.manages_event(target_event) THEN
    RAISE EXCEPTION 'Bu tədbiri idarə etmək səlahiyyətiniz yoxdur';
  END IF;

  SELECT * INTO ev FROM public.events WHERE id = target_event;

  IF ev.id IS NULL THEN
    RAISE EXCEPTION 'Tədbir tapılmadı';
  END IF;

  IF ev.status = 'cancelled' THEN
    RAISE EXCEPTION 'Tədbir ləğv edilib';
  END IF;

  -- Tədbirdən 2 saat əvvəl açılır, bitdikdən 2 saat sonra bağlanır.
  IF now() < ev.starts_at - interval '2 hours'
     OR now() > ev.ends_at + interval '2 hours' THEN
    RAISE EXCEPTION 'İştirakı yalnız tədbir vaxtı ətrafında qeyd etmək olar';
  END IF;

  SELECT t.user_id INTO target_user
    FROM public.user_qr_tokens t
   WHERE t.token = scanned_token AND t.expires_at > now();

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Kod etibarsızdır və ya vaxtı bitib';
  END IF;

  SELECT NULLIF(trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    INTO person_name
    FROM public.profiles
   WHERE id = target_user;

  SELECT EXISTS (
    SELECT 1 FROM public.event_attendance
     WHERE event_id = target_event AND user_id = target_user
  ) INTO already;

  IF already THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'full_name', person_name,
      'points', 0
    );
  END IF;

  -- Yazılmayıbsa, avtomatik qeydiyyat da açılır: gəlib iştirak edən
  -- şəxsi geri qaytarmaq mənasızdır.
  INSERT INTO public.event_registrations (event_id, user_id, status)
  VALUES (target_event, target_user, 'registered')
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'registered';

  INSERT INTO public.event_attendance (event_id, user_id, recorded_by)
  VALUES (target_event, target_user, auth.uid());

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'full_name', person_name,
    'points', ev.points_reward
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checkin_by_qr(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_by_qr(uuid, text) TO authenticated;

-- ============================================================
-- 4. Cleanup
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_expired_qr_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.user_qr_tokens WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_qr_tokens()
  FROM PUBLIC, anon, authenticated;
