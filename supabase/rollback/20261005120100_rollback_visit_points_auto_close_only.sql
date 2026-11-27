/*
Rollback for 20261005120100_visit_points_auto_close_only.sql (part B).

Restores award_visit_points and staff_close_visit as captured with
pg_get_functiondef on 2026-10-05, then drops the staff_closed column.
Does not touch visit rows or point transactions; points that were withheld
from auto-closed visits while part B was live are not back-filled.
*/

CREATE OR REPLACE FUNCTION public.award_visit_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.staff_close_visit(visit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.staff_close_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_close_visit(uuid) TO authenticated;

ALTER TABLE public.house_visits DROP COLUMN IF EXISTS staff_closed;
