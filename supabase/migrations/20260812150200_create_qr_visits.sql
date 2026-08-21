/*
# QR check-in / check-out and the centre dashboard

## 1. Purpose
Records who is inside a centre right now, how long they stay, and feeds every
tile of the Gənclər Evi panel from real data instead of fixtures.

## 2. New tables
- `house_qr_codes`: the rotating code displayed at the entrance of a centre.
- `house_visits`: one row per visit — `entered_at` set on entry, `exited_at`
  set on exit. Occupancy, daily counts and average stay all derive from here,
  so no counter is stored anywhere and nothing can drift out of sync.

## 3. Scanning
`public.scan_qr(code)` is called by the young person's app. It resolves the
code to a centre, then closes an open visit if one exists, or opens a new one.
The function is SECURITY DEFINER because the caller may not read another
account's visit rows.

## 4. Security
- A code is only valid while active and within its validity window.
- Codes are readable only by the centre's own staff and administrators — a
  young person never selects a centre by hand, they scan.
- A young person reads only their own visits; staff read visits at their
  centre.
- Visit rows cannot be written directly from the browser; only `scan_qr` and
  the staff correction function may write them.

## 5. Notes
1. Stale visits (entered, never exited) are closed automatically by
   `close_stale_visits()`, intended to run nightly as a scheduled job.
2. Points for a visit are awarded in stage 4, which reads `house_visits`.
*/

-- ============================================================
-- 1. house_qr_codes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.house_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.youth_houses(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS house_qr_codes_house_idx ON public.house_qr_codes (house_id);
CREATE INDEX IF NOT EXISTS house_qr_codes_active_idx ON public.house_qr_codes (is_active);

ALTER TABLE public.house_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_qr_codes_select_staff" ON public.house_qr_codes;
CREATE POLICY "house_qr_codes_select_staff"
ON public.house_qr_codes FOR SELECT
TO authenticated
USING (public.manages_house(house_id));

DROP POLICY IF EXISTS "house_qr_codes_insert_staff" ON public.house_qr_codes;
CREATE POLICY "house_qr_codes_insert_staff"
ON public.house_qr_codes FOR INSERT
TO authenticated
WITH CHECK (public.manages_house(house_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "house_qr_codes_update_staff" ON public.house_qr_codes;
CREATE POLICY "house_qr_codes_update_staff"
ON public.house_qr_codes FOR UPDATE
TO authenticated
USING (public.manages_house(house_id))
WITH CHECK (public.manages_house(house_id));

DROP POLICY IF EXISTS "house_qr_codes_delete_staff" ON public.house_qr_codes;
CREATE POLICY "house_qr_codes_delete_staff"
ON public.house_qr_codes FOR DELETE
TO authenticated
USING (public.manages_house(house_id));

REVOKE ALL ON public.house_qr_codes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_qr_codes TO authenticated;

-- Generate (or rotate) the entrance code for a centre.
CREATE OR REPLACE FUNCTION public.rotate_house_qr(target_house uuid, valid_minutes integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Only this centre''s staff may rotate its code';
  END IF;

  UPDATE public.house_qr_codes
     SET is_active = false
   WHERE house_id = target_house AND is_active;

  new_code := encode(gen_random_bytes(18), 'hex');

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
-- 2. house_visits
-- ============================================================

CREATE TABLE IF NOT EXISTS public.house_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.youth_houses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  auto_closed boolean NOT NULL DEFAULT false,
  CONSTRAINT house_visits_time_order CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE INDEX IF NOT EXISTS house_visits_house_idx ON public.house_visits (house_id);
CREATE INDEX IF NOT EXISTS house_visits_user_idx ON public.house_visits (user_id);
CREATE INDEX IF NOT EXISTS house_visits_entered_idx ON public.house_visits (entered_at);
-- Only one open visit per person per centre.
CREATE UNIQUE INDEX IF NOT EXISTS house_visits_open_key
  ON public.house_visits (house_id, user_id)
  WHERE exited_at IS NULL;

ALTER TABLE public.house_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_visits_select" ON public.house_visits;
CREATE POLICY "house_visits_select"
ON public.house_visits FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.manages_house(house_id));

REVOKE ALL ON public.house_visits FROM anon;
GRANT SELECT ON public.house_visits TO authenticated;
-- No INSERT/UPDATE/DELETE grant: writes go through the functions below.

-- ============================================================
-- 3. Scanning
-- ============================================================

CREATE OR REPLACE FUNCTION public.scan_qr(scanned_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_house uuid;
  house_label text;
  open_visit public.house_visits%ROWTYPE;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Account is not approved';
  END IF;

  SELECT c.house_id, h.name
    INTO target_house, house_label
    FROM public.house_qr_codes c
    JOIN public.youth_houses h ON h.id = c.house_id
   WHERE c.code = scanned_code
     AND c.is_active
     AND c.valid_from <= now()
     AND (c.valid_until IS NULL OR c.valid_until > now())
     AND h.status = 'approved'
     AND h.is_active;

  IF target_house IS NULL THEN
    RAISE EXCEPTION 'QR kod etibarsızdır və ya vaxtı bitib';
  END IF;

  SELECT * INTO open_visit
    FROM public.house_visits
   WHERE house_id = target_house AND user_id = auth.uid() AND exited_at IS NULL
   LIMIT 1;

  IF open_visit.id IS NOT NULL THEN
    UPDATE public.house_visits
       SET exited_at = now()
     WHERE id = open_visit.id;

    RETURN jsonb_build_object(
      'direction', 'out',
      'house_id', target_house,
      'house_name', house_label,
      'at', now(),
      'duration_minutes',
        round(EXTRACT(EPOCH FROM (now() - open_visit.entered_at)) / 60)
    );
  END IF;

  INSERT INTO public.house_visits (house_id, user_id)
  VALUES (target_house, auth.uid());

  RETURN jsonb_build_object(
    'direction', 'in',
    'house_id', target_house,
    'house_name', house_label,
    'at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scan_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_qr(text) TO authenticated;

-- Staff correction: force a visitor out (forgotten exit scan).
CREATE OR REPLACE FUNCTION public.staff_close_visit(visit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_house uuid;
BEGIN
  SELECT house_id INTO target_house FROM public.house_visits WHERE id = visit_id;

  IF target_house IS NULL THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;

  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Only this centre''s staff may close a visit';
  END IF;

  UPDATE public.house_visits
     SET exited_at = now(), auto_closed = true
   WHERE id = visit_id AND exited_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_close_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_close_visit(uuid) TO authenticated;

-- Nightly cleanup for visitors who never scanned out.
CREATE OR REPLACE FUNCTION public.close_stale_visits(max_hours integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.house_visits
     SET exited_at = entered_at + make_interval(hours => max_hours),
         auto_closed = true
   WHERE exited_at IS NULL
     AND entered_at < now() - make_interval(hours => max_hours);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_stale_visits(integer) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4. Dashboard
-- ============================================================

-- Feeds every tile of the Gənclər Evi panel in one round trip.
CREATE OR REPLACE FUNCTION public.house_dashboard(target_house uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Only this centre''s staff may read its dashboard';
  END IF;

  SELECT jsonb_build_object(
    'house', (
      SELECT jsonb_build_object('id', h.id, 'name', h.name, 'city', h.city)
        FROM public.youth_houses h WHERE h.id = target_house
    ),

    -- Hazırda məkanda olan gənclər
    'current_visitors', (
      SELECT count(*) FROM public.house_visits v
       WHERE v.house_id = target_house AND v.exited_at IS NULL
    ),

    -- Bu gün giriş sayı
    'today_check_ins', (
      SELECT count(*) FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.entered_at >= date_trunc('day', now())
    ),

    -- Bu gün çıxış sayı
    'today_check_outs', (
      SELECT count(*) FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.exited_at >= date_trunc('day', now())
    ),

    -- Bu gün keçirilən fəaliyyətlər
    'today_events', (
      SELECT count(*) FROM public.events e
       WHERE e.youth_house_id = target_house
         AND e.status IN ('published', 'completed')
         AND e.starts_at >= date_trunc('day', now())
         AND e.starts_at < date_trunc('day', now()) + interval '1 day'
    ),

    -- Bugünkü iştirakçı sayı
    'today_participants', (
      SELECT count(*) FROM public.event_attendance a
        JOIN public.events e ON e.id = a.event_id
       WHERE e.youth_house_id = target_house
         AND a.attended_at >= date_trunc('day', now())
    ),

    -- Ən aktiv otaq (bu ay ən çox tədbir keçirilən)
    'busiest_room', (
      SELECT r.name
        FROM public.events e
        JOIN public.youth_house_rooms r ON r.id = e.room_id
       WHERE e.youth_house_id = target_house
         AND e.starts_at >= date_trunc('month', now())
       GROUP BY r.name
       ORDER BY count(*) DESC
       LIMIT 1
    ),

    -- Bu ay toplam ziyarət
    'month_visits', (
      SELECT count(*) FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.entered_at >= date_trunc('month', now())
    ),

    -- Orta qalma müddəti (dəqiqə) — bu ayın bağlanmış ziyarətləri üzrə
    'average_stay_minutes', (
      SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (v.exited_at - v.entered_at)) / 60)), 0)
        FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.exited_at IS NOT NULL
         AND v.entered_at >= date_trunc('month', now())
    ),

    -- Canlı Fəaliyyət cədvəli
    'today_activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT
          e.id,
          e.title,
          r.name AS room_name,
          e.starts_at,
          e.ends_at,
          (SELECT count(*) FROM public.event_registrations g
            WHERE g.event_id = e.id AND g.status = 'registered') AS registered_count,
          (SELECT count(*) FROM public.event_attendance a
            WHERE a.event_id = e.id) AS attended_count,
          CASE
            WHEN now() < e.starts_at THEN 'waiting'
            WHEN now() BETWEEN e.starts_at AND e.ends_at THEN 'running'
            ELSE 'finished'
          END AS live_status
        FROM public.events e
        LEFT JOIN public.youth_house_rooms r ON r.id = e.room_id
       WHERE e.youth_house_id = target_house
         AND e.status IN ('published', 'completed')
         AND e.starts_at >= date_trunc('day', now())
         AND e.starts_at < date_trunc('day', now()) + interval '1 day'
       ORDER BY e.starts_at
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.house_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.house_dashboard(uuid) TO authenticated;

-- Current visitor list for the Giriş-Çıxış screen.
CREATE OR REPLACE VIEW public.house_current_visitors
WITH (security_invoker = true) AS
SELECT
  v.id AS visit_id,
  v.house_id,
  v.user_id,
  p.first_name,
  p.last_name,
  v.entered_at,
  round(EXTRACT(EPOCH FROM (now() - v.entered_at)) / 60) AS minutes_inside
FROM public.house_visits v
JOIN public.profiles p ON p.id = v.user_id
WHERE v.exited_at IS NULL;

REVOKE ALL ON public.house_current_visitors FROM anon;
GRANT SELECT ON public.house_current_visitors TO authenticated;
