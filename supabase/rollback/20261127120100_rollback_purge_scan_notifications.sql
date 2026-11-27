/*
Rollback for 20261005130100_purge_scan_notifications.sql.

Removes the nightly job and the function. Notifications already deleted by the
job are not restored. Independent of the scan_qr notifications migration.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'purge-scan-notifications';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.purge_scan_notifications(integer);
