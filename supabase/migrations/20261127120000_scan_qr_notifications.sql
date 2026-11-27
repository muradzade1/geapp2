/*
# scan_qr writes a status notification after each real check-in / check-out

## 1. Why
Installed apps (APK) cannot be updated quickly: the app bundles its web code
(no server.url, no live-update plugin), and young people who saw "0" after a
check-in scanned again and checked themselves out. A notification written by
the server reaches every installed version, because the app already lists
`my_notifications` on open and every 30 seconds and shows the unread count on
the bell.

## 2. What is written (one row per real scan)
| Scan | type | Message |
|---|---|---|
| New check-in | reminder | "{house}: giriş qeydə alındı. Xal çıxışdan sonra, ən azı {min} dəqiqə qaldıqda verilir. Çıxışda yenidən skan edin." |
| Check-out, points awarded | points | "{house}: +{X} xal əlavə olundu." |
| Check-out, stay shorter than {min} | points | "{house}: Qalma {min} dəqiqədən az olduğu üçün xal verilmədi." |
| Repeat scan inside the duplicate window (already_checked_in) | — | nothing is written |

`{min}` is `point_rules.min_visit_minutes`.

## 3. Safety
- Each notification is written through the existing `public.notify()` helper
  (SECURITY DEFINER, not executable by clients) inside its own
  `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END` block, so a notification
  failure can never fail or roll back the scan.
- `house_id` is deliberately left NULL: `house_notifications()` lists every
  row with a house_id in the centre's "sent notifications" screen, and
  per-visitor status messages must not appear there.
- Idempotent: notify() uses ON CONFLICT DO NOTHING on (user_id, type,
  source_id), source_id = the visit id; check-in and check-out use different
  types so one does not suppress the other.
- The scan response is unchanged from part A (20261005120000).

## 4. Behaviour change to be aware of
20260818180000_automatic_notifications.sql deliberately did NOT notify visit
points ("a young person who visits daily would collect a notification every
day"). This migration reverses that for scans: two notifications per
completed visit.
*/

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
  new_visit_id uuid;
  window_minutes integer;
  min_minutes integer;
  stay_minutes numeric;
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
  min_minutes := public.point_rule('min_visit_minutes', 15);

  -- FOR UPDATE serialises two near-simultaneous scans by the same person.
  SELECT * INTO open_visit
    FROM public.house_visits
   WHERE house_id = target_house AND user_id = auth.uid() AND exited_at IS NULL
   LIMIT 1
   FOR UPDATE;

  IF open_visit.id IS NOT NULL THEN
    -- Repeat scan right after entering: keep the visit open, report "in".
    -- No notification: nothing happened.
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

    stay_minutes := EXTRACT(EPOCH FROM (now() - open_visit.entered_at)) / 60;

    -- A notification failure must never break the scan.
    BEGIN
      PERFORM public.notify(
        auth.uid(),
        'Çıxış qeydə alındı',
        CASE
          WHEN awarded > 0 THEN
            house_label || ': +' || awarded || ' xal əlavə olundu.'
          WHEN stay_minutes < min_minutes THEN
            house_label || ': Qalma ' || min_minutes || ' dəqiqədən az olduğu üçün xal verilmədi.'
          ELSE
            house_label || ': çıxış qeydə alındı.'
        END,
        'points',
        NULL,
        open_visit.id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
      'direction', 'out',
      'house_id', target_house,
      'house_name', house_label,
      'at', now(),
      'duration_minutes', round(stay_minutes),
      'points_awarded', awarded,
      'total_points', public.user_points()
    );
  END IF;

  BEGIN
    INSERT INTO public.house_visits (house_id, user_id)
    VALUES (target_house, auth.uid())
    RETURNING id INTO new_visit_id;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent scan opened the visit between our SELECT and INSERT.
    -- That scan wrote the notification; this one writes none.
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

  -- A notification failure must never break the scan.
  BEGIN
    PERFORM public.notify(
      auth.uid(),
      'Giriş qeydə alındı',
      house_label || ': giriş qeydə alındı. Xal çıxışdan sonra, ən azı '
        || min_minutes || ' dəqiqə qaldıqda verilir. Çıxışda yenidən skan edin.',
      'reminder',
      NULL,
      new_visit_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
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
