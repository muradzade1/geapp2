/*
# Trainers attached to centres

## 1. Problem
`events_insert_staff` accepted any account with the `trainer` role, regardless
of which centre the event belonged to. A trainer in one town could therefore
publish an event in another town's centre. With a handful of test accounts this
was harmless; across 35 centres it is not.

## 2. Model
A centre adds trainers to its own team. A trainer can belong to several centres,
which matches reality — trainers often work across districts — and keeps the
decision with the centre that owns the room and the schedule, rather than
requiring an administrator for every assignment.

## 3. New table
- `house_trainers`: which trainer works with which centre.

## 4. New functions
- `my_trainer_houses()`: the centres the calling trainer may work with.
- `house_trainer_list(uuid)`: a centre's team, for its own panel.
- `available_trainers()`: approved trainers a centre can add.
- `add_house_trainer()` / `remove_house_trainer()`.
- `my_trainer_stats()`: the calling trainer's totals.
- `my_trainer_feedback()`: feedback left on the trainer's own events.

## 5. Security
- Only the centre's staff (or an administrator) changes that centre's team.
- Event creation now requires the trainer to be on the team of the centre the
  event belongs to.
- Administrators keep full access everywhere.
*/

-- ============================================================
-- 1. house_trainers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.house_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.youth_houses(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (house_id, trainer_id)
);

CREATE INDEX IF NOT EXISTS house_trainers_house_idx ON public.house_trainers (house_id);
CREATE INDEX IF NOT EXISTS house_trainers_trainer_idx ON public.house_trainers (trainer_id);

ALTER TABLE public.house_trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_trainers_select" ON public.house_trainers;
CREATE POLICY "house_trainers_select"
ON public.house_trainers FOR SELECT
TO authenticated
USING (trainer_id = auth.uid() OR public.manages_house(house_id));

DROP POLICY IF EXISTS "house_trainers_write" ON public.house_trainers;
CREATE POLICY "house_trainers_write"
ON public.house_trainers FOR ALL
TO authenticated
USING (public.manages_house(house_id))
WITH CHECK (public.manages_house(house_id));

REVOKE ALL ON public.house_trainers FROM anon;
GRANT SELECT, INSERT, DELETE ON public.house_trainers TO authenticated;

-- Caller is on this centre's team?
CREATE OR REPLACE FUNCTION public.works_with_house(target_house uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.manages_house(target_house)
      OR EXISTS (
           SELECT 1 FROM public.house_trainers t
            WHERE t.house_id = target_house AND t.trainer_id = auth.uid()
         );
$$;

REVOKE EXECUTE ON FUNCTION public.works_with_house(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.works_with_house(uuid) TO authenticated;

-- ============================================================
-- 2. Tighten event creation
-- ============================================================

DROP POLICY IF EXISTS "events_insert_staff" ON public.events;
CREATE POLICY "events_insert_staff"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND public.works_with_house(youth_house_id));

-- ============================================================
-- 3. Team management
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_trainer_houses()
RETURNS TABLE (id uuid, name text, city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.name, h.city
    FROM public.house_trainers t
    JOIN public.youth_houses h ON h.id = t.house_id
   WHERE t.trainer_id = auth.uid()
     AND h.status = 'approved'
     AND h.is_active
   ORDER BY h.name;
$$;

CREATE OR REPLACE FUNCTION public.house_trainer_list(target_house uuid)
RETURNS TABLE (
  trainer_id uuid,
  full_name text,
  email text,
  phone text,
  specialization text,
  events_count bigint,
  added_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    p.email,
    p.phone,
    p.specialization,
    (SELECT count(*) FROM public.events e
      WHERE e.trainer_id = p.id AND e.youth_house_id = target_house),
    t.created_at
  FROM public.house_trainers t
  JOIN public.profiles p ON p.id = t.trainer_id
  WHERE t.house_id = target_house
    AND public.manages_house(target_house)
  ORDER BY p.first_name;
$$;

-- Approved trainers not yet on this centre's team.
CREATE OR REPLACE FUNCTION public.available_trainers(target_house uuid)
RETURNS TABLE (
  trainer_id uuid,
  full_name text,
  email text,
  specialization text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    p.email,
    p.specialization
  FROM public.profiles p
  WHERE p.role = 'trainer'
    AND p.status = 'approved'
    AND public.manages_house(target_house)
    AND NOT EXISTS (
      SELECT 1 FROM public.house_trainers t
       WHERE t.house_id = target_house AND t.trainer_id = p.id
    )
  ORDER BY p.first_name;
$$;

CREATE OR REPLACE FUNCTION public.add_house_trainer(target_house uuid, target_trainer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Yalnız mərkəzin əməkdaşı təlimçi əlavə edə bilər';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = target_trainer AND role = 'trainer' AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Təsdiqlənmiş təlimçi tapılmadı';
  END IF;

  INSERT INTO public.house_trainers (house_id, trainer_id, added_by)
  VALUES (target_house, target_trainer, auth.uid())
  ON CONFLICT (house_id, trainer_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_house_trainer(target_house uuid, target_trainer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Yalnız mərkəzin əməkdaşı təlimçini çıxara bilər';
  END IF;

  DELETE FROM public.house_trainers
   WHERE house_id = target_house AND trainer_id = target_trainer;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_trainer_houses() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.house_trainer_list(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.available_trainers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_house_trainer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_house_trainer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_trainer_houses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.house_trainer_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.available_trainers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_house_trainer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_house_trainer(uuid, uuid) TO authenticated;

-- ============================================================
-- 4. Trainer's own figures
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_trainer_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'houses', (SELECT count(*) FROM public.house_trainers WHERE trainer_id = uid),

    'total_events', (
      SELECT count(*) FROM public.events
       WHERE trainer_id = uid OR created_by = uid),

    'upcoming_events', (
      SELECT count(*) FROM public.events
       WHERE (trainer_id = uid OR created_by = uid)
         AND status = 'published'
         AND starts_at > now()),

    'today_events', (
      SELECT count(*) FROM public.events
       WHERE (trainer_id = uid OR created_by = uid)
         AND starts_at >= date_trunc('day', now())
         AND starts_at < date_trunc('day', now()) + interval '1 day'),

    'total_participants', (
      SELECT count(*) FROM public.event_attendance a
        JOIN public.events e ON e.id = a.event_id
       WHERE e.trainer_id = uid OR e.created_by = uid),

    'feedback_count', (
      SELECT count(*) FROM public.feedback f
        JOIN public.events e ON e.id = f.event_id
       WHERE e.trainer_id = uid OR e.created_by = uid),

    'instructor_rating', (
      SELECT COALESCE(round(avg(f.instructor_rating), 1), 0)
        FROM public.feedback f
        JOIN public.events e ON e.id = f.event_id
       WHERE e.trainer_id = uid OR e.created_by = uid)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_trainer_feedback(limit_count integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  event_title text,
  content_rating integer,
  instructor_rating integer,
  equipment_rating integer,
  comment text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    e.title,
    f.content_rating,
    f.instructor_rating,
    f.equipment_rating,
    f.comment,
    f.created_at
  FROM public.feedback f
  JOIN public.events e ON e.id = f.event_id
  WHERE e.trainer_id = auth.uid() OR e.created_by = auth.uid()
  ORDER BY f.created_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.my_trainer_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_trainer_feedback(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_trainer_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_trainer_feedback(integer) TO authenticated;
