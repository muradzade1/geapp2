/*
# Events belong to a centre, and registration stays open once it starts

## 1. Two problems
A young person attached to Mingəçevir saw events published by Suraxanı. The
read policy allowed every approved account to see every published event, which
made the list meaningless outside a single city.

Separately, registration closed the moment an event began. Someone walking into
the room five minutes late could not register — but they are exactly the person
who should be able to, since attendance is confirmed on the spot.

## 2. New rules
- A young person sees events only from the centre they belong to.
- Staff, trainers and administrators keep seeing everything, as before.
- Registration is open until the event **ends**, not until it starts.

## 3. A deliberate consequence
A young person not yet attached to any centre sees no events at all. That is
correct rather than unfortunate: they picked a centre during registration, and
the link is created the moment that centre is approved. Showing them another
city's events instead would be worse than showing none.
*/

-- ============================================================
-- 1. Görünmə: gənc yalnız öz mərkəzinin tədbirlərini görür
-- ============================================================

DROP POLICY IF EXISTS "events_select_published" ON public.events;
CREATE POLICY "events_select_published"
ON public.events FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND (
    -- Təşkilatçı öz tədbirini həmişə görür
    public.manages_event(id)
    OR (
      status IN ('published', 'completed')
      AND (
        -- Gənc olmayan rollar (təlimçi, mərkəz, admin) hamısını görür
        public.current_role() <> 'youth'
        -- Gənc yalnız öz mərkəzinin tədbirlərini
        OR youth_house_id = (
             SELECT p.youth_house_id FROM public.profiles p WHERE p.id = auth.uid()
           )
      )
    )
  )
);

-- ============================================================
-- 2. Qeydiyyat tədbir bitənə qədər açıqdır
-- ============================================================

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
    RAISE EXCEPTION 'Tədbir tapılmadı';
  END IF;

  IF ev.status <> 'published' THEN
    RAISE EXCEPTION 'Bu tədbirə qeydiyyat bağlıdır';
  END IF;

  -- Başlamış tədbirə də yazılmaq olar; yalnız bitmiş tədbirə olmaz.
  IF ev.ends_at <= now() THEN
    RAISE EXCEPTION 'Bu tədbir artıq bitib';
  END IF;

  IF ev.capacity > 0 THEN
    SELECT count(*) INTO taken
      FROM public.event_registrations r
     WHERE r.event_id = NEW.event_id
       AND r.status = 'registered'
       AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF taken >= ev.capacity THEN
      RAISE EXCEPTION 'Tədbirdə boş yer qalmayıb';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
