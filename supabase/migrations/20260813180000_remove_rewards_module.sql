/*
# Removing the rewards module

## 1. Reason
The rewards catalogue is being dropped from the product. The points system
stays: points are still earned from visits, event attendance, feedback and
challenges, and still drive levels, badges and the leaderboard. Only the
"spend points on a reward" half is removed.

## 2. Dropped
- `reward_redemptions`, then `rewards` (redemptions reference rewards).
- `redeem_reward()` and `mark_redemption_used()`.
- The `redemptions_pending` tile from `admin_dashboard()`.

## 3. Kept deliberately
- Any `point_transactions` rows with `source = 'reward'` stay, and the source
  value stays allowed by the CHECK constraint. Deleting them would silently
  change people's balances; the ledger is meant to be append-only, so past
  spending remains recorded even though nothing new can be spent.
*/

-- ============================================================
-- 1. Drop functions first (they reference the tables)
-- ============================================================

DROP FUNCTION IF EXISTS public.redeem_reward(uuid);
DROP FUNCTION IF EXISTS public.mark_redemption_used(text);

-- ============================================================
-- 2. Drop tables (redemptions first — foreign key)
-- ============================================================

DROP TABLE IF EXISTS public.reward_redemptions;
DROP TABLE IF EXISTS public.rewards;

-- ============================================================
-- 3. Rebuild the dashboard without the rewards tile
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yalnız administrator';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles WHERE role = 'youth'),
    'active_users', (SELECT count(*) FROM public.profiles
                      WHERE role = 'youth' AND status = 'approved'),
    'pending_users', (SELECT count(*) FROM public.profiles
                       WHERE role = 'youth' AND status = 'pending'),

    'total_accounts', (SELECT count(*) FROM public.profiles),
    'pending_accounts', (SELECT count(*) FROM public.profiles WHERE status = 'pending'),

    'total_trainers', (SELECT count(*) FROM public.profiles
                        WHERE role = 'trainer' AND status = 'approved'),

    'by_role', (
      SELECT COALESCE(jsonb_object_agg(role, cnt), '{}'::jsonb)
        FROM (SELECT role, count(*) AS cnt FROM public.profiles GROUP BY role) r
    ),

    'total_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'approved'),
    'pending_houses', (SELECT count(*) FROM public.youth_houses WHERE status = 'pending'),

    'current_visitors', (
      SELECT count(*) FROM public.house_visits WHERE exited_at IS NULL),

    'today_check_ins', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('day', now())),

    'today_events', (
      SELECT count(*) FROM public.events
       WHERE status IN ('published', 'completed')
         AND starts_at >= date_trunc('day', now())
         AND starts_at < date_trunc('day', now()) + interval '1 day'),

    'today_participants', (
      SELECT count(*) FROM public.event_attendance
       WHERE attended_at >= date_trunc('day', now())),

    'month_visits', (
      SELECT count(*) FROM public.house_visits
       WHERE entered_at >= date_trunc('month', now())),

    'total_points_awarded', (
      SELECT COALESCE(sum(amount), 0) FROM public.point_transactions WHERE amount > 0),

    'genc_kart_usages', (SELECT count(*) FROM public.genc_kart_usages),

    'feedback_count', (SELECT count(*) FROM public.feedback),

    'feedback_average', (
      SELECT COALESCE(round(avg((content_rating + instructor_rating + equipment_rating) / 3.0), 1), 0)
        FROM public.feedback),

    'daily_series', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT
          g.day::date AS day,
          (SELECT count(*) FROM public.house_visits v
            WHERE v.entered_at >= g.day AND v.entered_at < g.day + interval '1 day') AS visits,
          (SELECT count(*) FROM public.profiles p
            WHERE p.role = 'youth'
              AND p.created_at >= g.day
              AND p.created_at < g.day + interval '1 day') AS signups
        FROM generate_series(
               date_trunc('day', now()) - interval '6 days',
               date_trunc('day', now()),
               interval '1 day') AS g(day)
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated;
