/*
# Events, registration and attendance

## 1. Purpose
Adds the event lifecycle: a centre or trainer publishes an event, young people
register, and attendance is confirmed on the day. Stage 4 (points) reads from
`event_attendance`, so attendance is the single source of truth for
"took part", not registration.

## 2. New tables
- `events`: one record per event held at a centre.
- `event_registrations`: a young person's seat reservation.
- `event_attendance`: confirmed participation, recorded by staff.

## 3. Security
- Approved accounts read published events.
- Trainers manage their own events; centre managers manage every event at
  their centre; administrators manage everything.
- Young people register and cancel only for themselves, only while the event
  is published and has not started.
- Attendance can only be recorded by the organising trainer or centre staff.

## 4. Notes
1. Capacity is enforced by a trigger, not by the browser.
2. `points_reward` is stored on the event so a later change to the reward does
   not silently rewrite what past participants earned.
*/

-- ============================================================
-- 1. events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_house_id uuid NOT NULL REFERENCES public.youth_houses(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.youth_house_rooms(id) ON DELETE SET NULL,
  trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Digər',
  cover_path text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  points_reward integer NOT NULL DEFAULT 0 CHECK (points_reward >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS events_house_idx ON public.events (youth_house_id);
CREATE INDEX IF NOT EXISTS events_trainer_idx ON public.events (trainer_id);
CREATE INDEX IF NOT EXISTS events_starts_idx ON public.events (starts_at);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events (status);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

DROP TRIGGER IF EXISTS events_touch ON public.events;
CREATE TRIGGER events_touch
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Caller may organise/edit this event?
CREATE OR REPLACE FUNCTION public.manages_event(event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND (
        public.is_admin()
        OR e.trainer_id = auth.uid()
        OR e.created_by = auth.uid()
        OR public.manages_house(e.youth_house_id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.manages_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manages_event(uuid) TO authenticated;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_published" ON public.events;
CREATE POLICY "events_select_published"
ON public.events FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND (status IN ('published', 'completed') OR public.manages_event(id))
);

DROP POLICY IF EXISTS "events_insert_staff" ON public.events;
CREATE POLICY "events_insert_staff"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_admin()
    OR public.manages_house(youth_house_id)
    OR public.current_role() = 'trainer'
  )
);

DROP POLICY IF EXISTS "events_update_staff" ON public.events;
CREATE POLICY "events_update_staff"
ON public.events FOR UPDATE
TO authenticated
USING (public.manages_event(id))
WITH CHECK (public.manages_event(id));

DROP POLICY IF EXISTS "events_delete_staff" ON public.events;
CREATE POLICY "events_delete_staff"
ON public.events FOR DELETE
TO authenticated
USING (public.manages_event(id));

REVOKE ALL ON public.events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- ============================================================
-- 2. event_registrations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'cancelled', 'waitlist')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_registrations_event_idx
  ON public.event_registrations (event_id);
CREATE INDEX IF NOT EXISTS event_registrations_user_idx
  ON public.event_registrations (user_id);

DROP TRIGGER IF EXISTS event_registrations_touch ON public.event_registrations;
CREATE TRIGGER event_registrations_touch
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Capacity guard: 0 means unlimited.
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
  taken integer;
BEGIN
  IF NEW.status <> 'registered' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;

  IF ev.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF ev.status <> 'published' THEN
    RAISE EXCEPTION 'Registration is closed for this event';
  END IF;

  IF ev.starts_at <= now() THEN
    RAISE EXCEPTION 'This event has already started';
  END IF;

  IF ev.capacity > 0 THEN
    SELECT count(*) INTO taken
      FROM public.event_registrations r
     WHERE r.event_id = NEW.event_id
       AND r.status = 'registered'
       AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF taken >= ev.capacity THEN
      RAISE EXCEPTION 'Event is full';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_registrations_capacity ON public.event_registrations;
CREATE TRIGGER event_registrations_capacity
  BEFORE INSERT OR UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_registrations_select" ON public.event_registrations;
CREATE POLICY "event_registrations_select"
ON public.event_registrations FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.manages_event(event_id));

DROP POLICY IF EXISTS "event_registrations_insert_own" ON public.event_registrations;
CREATE POLICY "event_registrations_insert_own"
ON public.event_registrations FOR INSERT
TO authenticated
WITH CHECK (public.is_approved() AND user_id = auth.uid());

DROP POLICY IF EXISTS "event_registrations_update" ON public.event_registrations;
CREATE POLICY "event_registrations_update"
ON public.event_registrations FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.manages_event(event_id))
WITH CHECK (user_id = auth.uid() OR public.manages_event(event_id));

DROP POLICY IF EXISTS "event_registrations_delete_own" ON public.event_registrations;
CREATE POLICY "event_registrations_delete_own"
ON public.event_registrations FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.manages_event(event_id));

REVOKE ALL ON public.event_registrations FROM anon;
GRANT SELECT, INSERT, DELETE ON public.event_registrations TO authenticated;
GRANT UPDATE (status, note, updated_at) ON public.event_registrations TO authenticated;

-- ============================================================
-- 3. event_attendance
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  attended_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_attendance_event_idx
  ON public.event_attendance (event_id);
CREATE INDEX IF NOT EXISTS event_attendance_user_idx
  ON public.event_attendance (user_id);

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_attendance_select" ON public.event_attendance;
CREATE POLICY "event_attendance_select"
ON public.event_attendance FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.manages_event(event_id));

DROP POLICY IF EXISTS "event_attendance_insert_staff" ON public.event_attendance;
CREATE POLICY "event_attendance_insert_staff"
ON public.event_attendance FOR INSERT
TO authenticated
WITH CHECK (public.manages_event(event_id) AND recorded_by = auth.uid());

DROP POLICY IF EXISTS "event_attendance_delete_staff" ON public.event_attendance;
CREATE POLICY "event_attendance_delete_staff"
ON public.event_attendance FOR DELETE
TO authenticated
USING (public.manages_event(event_id));

REVOKE ALL ON public.event_attendance FROM anon;
GRANT SELECT, INSERT, DELETE ON public.event_attendance TO authenticated;

-- ============================================================
-- 4. Convenience view: event list with seat counts
-- ============================================================

CREATE OR REPLACE VIEW public.events_with_counts
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.youth_house_id,
  h.name  AS house_name,
  h.city  AS house_city,
  e.room_id,
  e.trainer_id,
  e.title,
  e.description,
  e.category,
  e.cover_path,
  e.starts_at,
  e.ends_at,
  e.capacity,
  e.points_reward,
  e.status,
  e.created_at,
  (SELECT count(*) FROM public.event_registrations r
    WHERE r.event_id = e.id AND r.status = 'registered') AS registered_count,
  (SELECT count(*) FROM public.event_attendance a
    WHERE a.event_id = e.id) AS attended_count
FROM public.events e
JOIN public.youth_houses h ON h.id = e.youth_house_id;

REVOKE ALL ON public.events_with_counts FROM anon;
GRANT SELECT ON public.events_with_counts TO authenticated;
