/*
# Nightly cleanup of check-in / check-out status notifications

## 1. Why
20261005130000_scan_qr_notifications.sql writes two notifications per
completed visit ("Giriş qeydə alındı", "Çıxış qeydə alındı"). They are only
useful for a short while, so they are deleted after 7 days. This file is
independent of that migration: it only reads/deletes rows and can be applied,
rolled back or left out on its own.

## 2. What is deleted
Rows that match ALL of:
- title IN ('Giriş qeydə alındı', 'Çıxış qeydə alındı')
- created_at older than 7 days
- user_id IS NOT NULL, house_id IS NULL and type IN ('reminder', 'points')
  (exactly how scan_qr writes them — the extra conditions only narrow the
  filter, so a broadcast, a centre message or a news/event/challenge row can
  never match even if it reused one of the titles)

Nothing else is touched: news, event, challenge, other points/reminder rows
(e.g. event reminders, "points earned" messages with other titles) stay.

## 3. Foreign keys / cascade
Only `notification_reads.notification_id` references notifications, with
ON DELETE CASCADE. Deleting a notification therefore also deletes its read
marker (the "read" flag of that notification). Nothing else references
notifications.

## 4. Schedule
pg_cron, 23:30 UTC = 03:30 Asia/Baku (night, away from the other jobs at
02:00 / 03:30 / 14:00 UTC), job name `purge-scan-notifications`.
*/

CREATE OR REPLACE FUNCTION public.purge_scan_notifications(retention_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  IF retention_days IS NULL OR retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be at least 1';
  END IF;

  DELETE FROM public.notifications
   WHERE title IN ('Giriş qeydə alındı', 'Çıxış qeydə alındı')
     AND type IN ('reminder', 'points')
     AND user_id IS NOT NULL
     AND house_id IS NULL
     AND created_at < now() - make_interval(days => retention_days);

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_scan_notifications(integer)
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron aktiv deyil — purge-scan-notifications işi qeydə alınmadı.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
     FROM cron.job
    WHERE jobname = 'purge-scan-notifications';

  -- Hər gecə 23:30 UTC (Bakı vaxtı ilə 03:30)
  PERFORM cron.schedule(
    'purge-scan-notifications',
    '30 23 * * *',
    $job$SELECT public.purge_scan_notifications(7)$job$
  );
END;
$$;
