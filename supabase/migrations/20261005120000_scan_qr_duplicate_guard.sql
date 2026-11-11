/*
# Part A — duplicate-scan guard in scan_qr

Young people who saw "0" after a check-in assumed the scan had failed and
scanned again, which `scan_qr` treated as a check-out. A scan arriving less
than `duplicate_scan_window_minutes` (point_rules, default 5) after the open
visit's entry is now treated as a repeat of the check-in: nothing is written
and the visit stays open.

## Independence
This part touches only `scan_qr` and one `point_rules` row. It reads
house_qr_codes, youth_houses, house_visits (id, house_id, user_id, entered_at,
exited_at), point_transactions, point_rule() and user_points() — all of which
exist today. It does NOT reference `house_visits.staff_closed` or any change
from part B (20261005120100), and part B does not reference anything here.
The two can be applied in either order or on their own.

## Response contract (old keys unchanged, new keys additive)
- in:   direction, house_id, house_name, at                  (+ total_points)
- out:  direction, house_id, house_name, at, duration_minutes (+ points_awarded, total_points)
- repeat scan inside the window: same shape as "in", with `at` = the ORIGINAL
  entry time, plus already_checked_in = true.
The released client reads only direction, house_name, at, duration_minutes.
*/

INSERT INTO public.point_rules (key, value, description) VALUES
  ('duplicate_scan_window_minutes', 5,
   'Girişdən sonra bu müddət ərzində təkrar skan çıxış sayılmır (dəqiqə)')
ON CONFLICT (key) DO NOTHING;

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
  window_minutes integer;
  awarded integer;
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

  window_minutes := public.point_rule('duplicate_scan_window_minutes', 5);

  -- FOR UPDATE serialises two near-simultaneous scans by the same person.
  SELECT * INTO open_visit
    FROM public.house_visits
   WHERE house_id = target_house AND user_id = auth.uid() AND exited_at IS NULL
   LIMIT 1
   FOR UPDATE;

  IF open_visit.id IS NOT NULL THEN
    -- Repeat scan right after entering: keep the visit open, report "in".
    IF now() - open_visit.entered_at < make_interval(mins => window_minutes) THEN
      RETURN jsonb_build_object(
        'direction', 'in',
        'house_id', target_house,
        'house_name', house_label,
        'at', open_visit.entered_at,
        'already_checked_in', true,
        'total_points', public.user_points()
      );
    END IF;

    UPDATE public.house_visits
       SET exited_at = now()
     WHERE id = open_visit.id;

    -- The award_visit_points trigger has already run for this UPDATE.
    SELECT COALESCE(sum(amount), 0)::integer INTO awarded
      FROM public.point_transactions
     WHERE user_id = auth.uid() AND source = 'visit' AND source_id = open_visit.id;

    RETURN jsonb_build_object(
      'direction', 'out',
      'house_id', target_house,
      'house_name', house_label,
      'at', now(),
      'duration_minutes',
        round(EXTRACT(EPOCH FROM (now() - open_visit.entered_at)) / 60),
      'points_awarded', awarded,
      'total_points', public.user_points()
    );
  END IF;

  BEGIN
    INSERT INTO public.house_visits (house_id, user_id)
    VALUES (target_house, auth.uid());
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent scan opened the visit between our SELECT and INSERT.
    SELECT * INTO open_visit
      FROM public.house_visits
     WHERE house_id = target_house AND user_id = auth.uid() AND exited_at IS NULL
     LIMIT 1;

    RETURN jsonb_build_object(
      'direction', 'in',
      'house_id', target_house,
      'house_name', house_label,
      'at', COALESCE(open_visit.entered_at, now()),
      'already_checked_in', true,
      'total_points', public.user_points()
    );
  END;

  RETURN jsonb_build_object(
    'direction', 'in',
    'house_id', target_house,
    'house_name', house_label,
    'at', now(),
    'total_points', public.user_points()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scan_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_qr(text) TO authenticated;
