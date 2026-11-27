/*
Rollback for 20261005120000_scan_qr_duplicate_guard.sql (part A).

Restores the live scan_qr captured with pg_get_functiondef on 2026-10-05,
before part A was applied, and removes the point_rules row part A added.
Does not touch visit rows or point transactions.
*/

CREATE OR REPLACE FUNCTION public.scan_qr(scanned_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.scan_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_qr(text) TO authenticated;

DELETE FROM public.point_rules WHERE key = 'duplicate_scan_window_minutes';
