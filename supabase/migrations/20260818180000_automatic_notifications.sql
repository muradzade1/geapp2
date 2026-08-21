/*
# Automatic notifications

## 1. Purpose
Until now every notification was typed by hand. The events people actually care
about — being approved, registering for something, earning points, a new event
at their centre — passed silently. This adds them.

## 2. What triggers a notification
| Event | Who receives it |
|---|---|
| Account approved or rejected | the account |
| Registered for an event | the person registering |
| Attendance confirmed | the participant, with the points earned |
| Badge unlocked | the earner |
| Challenge completed | the earner |
| Event published at a centre | that centre's members |
| Event starts tomorrow | everyone registered for it |

## 3. Avoiding repeats
`notifications.source_id` records what a message was about, and a unique index
covers (`user_id`, `type`, `source_id`). A trigger that fires twice — or a
nightly job that runs twice — cannot produce a second copy.

## 4. Deliberately not notified
Points from a visit produce no message. A young person who visits daily would
collect a notification every day for something they already saw on screen at
the moment of scanning; the ledger in their profile is the right place for that
history, not the notification list.

## 5. Notes
The reminder job runs at 14:00 UTC (18:00 Baku time), so a reminder for
tomorrow arrives during the evening rather than overnight.
*/

-- ============================================================
-- 1. Təkrarlanmanın qarşısı
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_key
  ON public.notifications (user_id, type, source_id)
  WHERE source_id IS NOT NULL AND user_id IS NOT NULL;

-- ============================================================
-- 2. Ortaq köməkçi
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify(
  target_user uuid,
  notification_title text,
  notification_message text,
  notification_type text DEFAULT 'system',
  target_house uuid DEFAULT NULL,
  source uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications
    (user_id, title, message, type, house_id, source_id)
  VALUES
    (target_user, notification_title, notification_message,
     notification_type, target_house, source)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. Hesab təsdiqi / rəddi
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = COALESCE(OLD.status, '') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    PERFORM public.notify(
      NEW.id,
      'Hesabınız təsdiqləndi',
      'Artıq platformadan tam istifadə edə bilərsiniz. Tədbirlərə qeydiyyatdan keçin və Gənclər Evinə daxil olarkən QR kodu skan edin.',
      'system',
      NULL,
      NULL
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.notify(
      NEW.id,
      'Qeydiyyat rədd edildi',
      'Məlumatlarınız təsdiqlənmədi. Ətraflı məlumat üçün Gənclər Evi ilə əlaqə saxlayın.',
      'system',
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_notify_status ON public.profiles;
CREATE TRIGGER profiles_notify_status
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_profile_status();

-- ============================================================
-- 4. Tədbirə qeydiyyat
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  IF NEW.status <> 'registered' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;
  IF ev.id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify(
    NEW.user_id,
    'Tədbirə qeydiyyatdan keçdiniz',
    ev.title || ' — ' ||
    to_char(ev.starts_at AT TIME ZONE 'Asia/Baku', 'DD.MM.YYYY, HH24:MI') ||
    '. Tədbirdə iştirakınızı qeyd etdirmək üçün QR kodunuzu göstərin.',
    'event',
    ev.youth_house_id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_notify ON public.event_registrations;
CREATE TRIGGER registrations_notify
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_registration();

-- ============================================================
-- 5. İştirakın təsdiqi
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;
  IF ev.id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify(
    NEW.user_id,
    'İştirakınız qeyd olundu',
    ev.title ||
    CASE WHEN ev.points_reward > 0
         THEN ' — hesabınıza ' || ev.points_reward || ' xal əlavə edildi.'
         ELSE ' tədbirində iştirakınız təsdiqləndi.'
    END,
    'points',
    ev.youth_house_id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_notify ON public.event_attendance;
CREATE TRIGGER attendance_notify
  AFTER INSERT ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_attendance();

-- ============================================================
-- 6. Nişan qazanma
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_name text;
BEGIN
  SELECT name INTO badge_name FROM public.badges WHERE id = NEW.badge_id;

  PERFORM public.notify(
    NEW.user_id,
    'Yeni nişan qazandınız',
    COALESCE(badge_name, 'Nişan') || ' — profilinizdə görə bilərsiniz.',
    'points',
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS badges_notify ON public.user_badges;
CREATE TRIGGER badges_notify
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_badge();

-- ============================================================
-- 7. Çağırışın tamamlanması
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch public.challenges%ROWTYPE;
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ch FROM public.challenges WHERE id = NEW.challenge_id;
  IF ch.id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify(
    NEW.user_id,
    'Çağırışı tamamladınız',
    ch.title ||
    CASE WHEN ch.reward_points > 0
         THEN ' — ' || ch.reward_points || ' xal qazandınız.'
         ELSE ' tamamlandı.'
    END,
    'challenge',
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenge_notify ON public.challenge_progress;
CREATE TRIGGER challenge_notify
  AFTER UPDATE ON public.challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_challenge();

-- ============================================================
-- 8. Mərkəzdə yeni tədbir
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_event_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  house_name text;
BEGIN
  -- Yalnız dərc olunan və hələ başlamamış tədbirlər
  IF NEW.status <> 'published' OR NEW.starts_at <= now() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO house_name
    FROM public.youth_houses WHERE id = NEW.youth_house_id;

  INSERT INTO public.notifications
    (user_id, title, message, type, house_id, source_id)
  SELECT
    p.id,
    'Yeni tədbir',
    NEW.title || ' — ' ||
    to_char(NEW.starts_at AT TIME ZONE 'Asia/Baku', 'DD.MM.YYYY, HH24:MI') ||
    COALESCE(', ' || house_name, '') || '. Qeydiyyatdan keçə bilərsiniz.',
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

DROP TRIGGER IF EXISTS events_notify_published ON public.events;
CREATE TRIGGER events_notify_published
  AFTER INSERT OR UPDATE OF status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_published();

-- ============================================================
-- 9. Sabahkı tədbirlər üçün xatırlatma
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created integer;
BEGIN
  INSERT INTO public.notifications
    (user_id, title, message, type, house_id, source_id)
  SELECT
    r.user_id,
    'Sabah tədbiriniz var',
    e.title || ' — ' ||
    to_char(e.starts_at AT TIME ZONE 'Asia/Baku', 'DD.MM.YYYY, HH24:MI') || '.',
    'reminder',
    e.youth_house_id,
    e.id
  FROM public.event_registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.status = 'registered'
    AND e.status = 'published'
    AND e.starts_at >= now() + interval '12 hours'
    AND e.starts_at <  now() + interval '36 hours'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_event_reminders()
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron aktiv deyil — xatirlatma isi qeyde alinmadi.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'event-reminders';

  -- 14:00 UTC = Bakı vaxtı ilə 18:00
  PERFORM cron.schedule(
    'event-reminders',
    '0 14 * * *',
    $job$SELECT public.send_event_reminders()$job$
  );
END;
$$;
