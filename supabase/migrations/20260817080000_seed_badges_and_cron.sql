/*
# Starting content and scheduled jobs

## 1. Purpose
Two things kept the platform looking empty and slightly broken:

- The badge and challenge tables were created but never filled, so the levels
  and achievements screens had nothing to show.
- `close_stale_visits()` and `purge_expired_qr_tokens()` were written but never
  scheduled. Without them a visitor who forgets to scan out stays "inside"
  forever and the occupancy figure drifts upward permanently.

## 2. Badges
Ten badges across three tracks — points, visits and event attendance — with
thresholds spaced so a new account can earn the first one on its first visit.
Progress is calculated by `my_badges()`; nothing is stored per user until the
badge is actually unlocked.

## 3. Challenges
Four starting challenges. `visits` and `events` challenges recalculate
themselves from real records, so they work retroactively — someone who has
already visited twice sees 2/3 immediately.

## 4. Scheduled jobs
- Stale visits are closed at 02:00 UTC (06:00 Baku time), capped at 12 hours.
- Expired QR tokens are cleared at 03:30 UTC.

Both are registered idempotently: an existing job with the same name is removed
first, so re-running this migration does not create duplicates.

## 5. Notes
If `pg_cron` cannot be enabled from a migration on this plan, the DO block
records a notice instead of failing, and the extension can be switched on from
Database → Extensions in the dashboard; re-running this file then registers the
jobs.
*/

-- ============================================================
-- 1. Badges
-- ============================================================

-- Ad üzrə təkrarlanma olmasın — bu, seed-in təkrar işlədilməsini
-- də təhlükəsiz edir.
CREATE UNIQUE INDEX IF NOT EXISTS badges_name_key ON public.badges (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS challenges_title_key ON public.challenges (lower(title));

INSERT INTO public.badges (name, description, condition_text, category, icon, metric, target)
VALUES
  -- Ziyarət
  ('İlk addım', 'Gənclər Evinə ilk ziyarətiniz', 'Bir dəfə ziyarət edin',
   'Ziyarət', 'footprints', 'visits', 1),
  ('Tez-tez gələn', 'Gənclər Evinin daimi qonağı', '10 dəfə ziyarət edin',
   'Ziyarət', 'door-open', 'visits', 10),
  ('Ev sahibi', 'Mərkəzin ayrılmaz hissəsi', '50 dəfə ziyarət edin',
   'Ziyarət', 'home', 'visits', 50),

  -- Tədbir
  ('İlk tədbir', 'İlk tədbirdə iştirak', 'Bir tədbirdə iştirak edin',
   'Tədbir', 'calendar-check', 'events', 1),
  ('Fəal iştirakçı', 'Tədbirləri buraxmırsınız', '5 tədbirdə iştirak edin',
   'Tədbir', 'users', 'events', 5),
  ('Tədbir ustası', 'Tədbir həyatının mərkəzində', '20 tədbirdə iştirak edin',
   'Tədbir', 'award', 'events', 20),

  -- Xal
  ('İlk 50', 'İlk 50 xalınızı topladınız', '50 xal toplayın',
   'Xal', 'star', 'points', 50),
  ('Yüzlük', 'Üç rəqəmli hesab', '100 xal toplayın',
   'Xal', 'sparkles', 'points', 100),
  ('Beş yüz', 'Ciddi nəticə', '500 xal toplayın',
   'Xal', 'trophy', 'points', 500),
  ('Min xal', 'Platformanın liderlərindən', '1000 xal toplayın',
   'Xal', 'crown', 'points', 1000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Challenges
-- ============================================================

INSERT INTO public.challenges
  (title, description, category, reward_points, target, metric)
VALUES
  ('Tanışlıq',
   'Gənclər Evini 3 dəfə ziyarət edin və mühitlə tanış olun',
   'Ziyarət', 30, 3, 'visits'),

  ('Ayın fəalı',
   'Gənclər Evini 10 dəfə ziyarət edin',
   'Ziyarət', 100, 10, 'visits'),

  ('Tədbir marafonu',
   '5 tədbirdə iştirak edin',
   'Tədbir', 80, 5, 'events'),

  ('İlk təcrübə',
   'İlk tədbirinizdə iştirak edin',
   'Tədbir', 20, 1, 'events')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Scheduled jobs
-- ============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron açıla bilmədi (%). Dashboard → Database → Extensions bölməsindən aktivləşdirin.', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron aktiv deyil — cədvəl işləri qeydə alınmadı.';
    RETURN;
  END IF;

  -- Köhnə qeydləri sil (təkrar işlətmə üçün)
  PERFORM cron.unschedule(jobid)
     FROM cron.job
    WHERE jobname IN ('close-stale-visits', 'purge-qr-tokens');

  -- Hər gecə 02:00 UTC (Bakı vaxtı ilə 06:00)
  PERFORM cron.schedule(
    'close-stale-visits',
    '0 2 * * *',
    $job$SELECT public.close_stale_visits(12)$job$
  );

  -- Hər gecə 03:30 UTC
  PERFORM cron.schedule(
    'purge-qr-tokens',
    '30 3 * * *',
    $job$SELECT public.purge_expired_qr_tokens()$job$
  );

  RAISE NOTICE 'Cədvəl işləri qeydə alındı.';
END;
$$;
