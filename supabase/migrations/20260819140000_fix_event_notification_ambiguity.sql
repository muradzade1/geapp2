/*
# Fixing an ambiguous name in the new-event notification

## 1. Problem
`notify_on_event_published()` declared a variable called `house_name` and then
selected from `profiles` — which has a column of exactly that name. Inside the
INSERT ... SELECT, PostgreSQL could not tell the variable from the column and
refused the statement with "column reference house_name is ambiguous".

Because the trigger runs as part of the insert, the whole event creation failed:
a centre could not add an event at all.

## 2. Fix
The variable is renamed to `centre_name`, which no table uses. Nothing else
changes — the notification text and recipients stay the same.

## 3. Why this was not caught earlier
The trigger only fires when a published event is created. It was written and
applied before any event had been created through the new form, so the clash
first appeared in real use rather than at migration time.
*/

CREATE OR REPLACE FUNCTION public.notify_on_event_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  centre_name text;
BEGIN
  -- Yalnız dərc olunan və hələ başlamamış tədbirlər
  IF NEW.status <> 'published' OR NEW.starts_at <= now() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT h.name INTO centre_name
    FROM public.youth_houses h
   WHERE h.id = NEW.youth_house_id;

  INSERT INTO public.notifications
    (user_id, title, message, type, house_id, source_id)
  SELECT
    p.id,
    'Yeni tədbir',
    NEW.title || ' — ' ||
    to_char(NEW.starts_at AT TIME ZONE 'Asia/Baku', 'DD.MM.YYYY, HH24:MI') ||
    COALESCE(', ' || centre_name, '') || '. Qeydiyyatdan keçə bilərsiniz.',
    'news',
    NEW.youth_house_id,
    NEW.id
  FROM public.profiles p
  WHERE p.youth_house_id = NEW.youth_house_id
    AND p.role = 'youth'
    AND p.status = 'approved'
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
