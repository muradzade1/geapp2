/*
# Centre reports and the young person's attended events

## 1. Purpose
Two screens still had no data source: the centre's "Hesabatlar" tab, and the
young person's ability to leave feedback on an event they actually attended.

## 2. New functions
- `house_report(house, from, to)`: aggregated figures for a date range —
  visits, unique visitors, average stay, events, participants, busiest rooms
  and a per-day series.
- `my_attended_events()`: the caller's attended events, flagged with whether
  feedback has already been left.

## 3. Notes
Ranges are inclusive of the start day and exclusive of the day after `to`, so
passing the same date twice reports that single day.
*/

-- ============================================================
-- 1. Centre report
-- ============================================================

CREATE OR REPLACE FUNCTION public.house_report(
  target_house uuid,
  from_date date DEFAULT (now() - interval '30 days')::date,
  to_date date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  range_start timestamptz := from_date::timestamptz;
  range_end timestamptz := (to_date + 1)::timestamptz;
  result jsonb;
BEGIN
  IF NOT public.manages_house(target_house) THEN
    RAISE EXCEPTION 'Yalnız bu mərkəzin əməkdaşı hesabata baxa bilər';
  END IF;

  SELECT jsonb_build_object(
    'from', from_date,
    'to', to_date,

    'total_visits', (
      SELECT count(*) FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.entered_at >= range_start AND v.entered_at < range_end),

    'unique_visitors', (
      SELECT count(DISTINCT v.user_id) FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.entered_at >= range_start AND v.entered_at < range_end),

    'average_stay_minutes', (
      SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (v.exited_at - v.entered_at)) / 60)), 0)
        FROM public.house_visits v
       WHERE v.house_id = target_house
         AND v.exited_at IS NOT NULL
         AND v.entered_at >= range_start AND v.entered_at < range_end),

    'events_count', (
      SELECT count(*) FROM public.events e
       WHERE e.youth_house_id = target_house
         AND e.starts_at >= range_start AND e.starts_at < range_end),

    'participants_count', (
      SELECT count(*) FROM public.event_attendance a
        JOIN public.events e ON e.id = a.event_id
       WHERE e.youth_house_id = target_house
         AND a.attended_at >= range_start AND a.attended_at < range_end),

    'points_awarded', (
      SELECT COALESCE(sum(t.amount), 0) FROM public.point_transactions t
       WHERE t.house_id = target_house
         AND t.amount > 0
         AND t.created_at >= range_start AND t.created_at < range_end),

    'top_rooms', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
        SELECT ro.name, count(*) AS events_count
          FROM public.events e
          JOIN public.youth_house_rooms ro ON ro.id = e.room_id
         WHERE e.youth_house_id = target_house
           AND e.starts_at >= range_start AND e.starts_at < range_end
         GROUP BY ro.name
         ORDER BY count(*) DESC
         LIMIT 5
      ) r),

    'top_events', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT e.title,
               e.starts_at,
               (SELECT count(*) FROM public.event_attendance a
                 WHERE a.event_id = e.id) AS attended
          FROM public.events e
         WHERE e.youth_house_id = target_house
           AND e.starts_at >= range_start AND e.starts_at < range_end
         ORDER BY attended DESC, e.starts_at DESC
         LIMIT 5
      ) t),

    'daily', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT g.day::date AS day,
               (SELECT count(*) FROM public.house_visits v
                 WHERE v.house_id = target_house
                   AND v.entered_at >= g.day
                   AND v.entered_at < g.day + interval '1 day') AS visits
          FROM generate_series(range_start, range_end - interval '1 day', interval '1 day') AS g(day)
      ) d)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.house_report(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.house_report(uuid, date, date) TO authenticated;

-- ============================================================
-- 2. Attended events, for feedback
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_attended_events(limit_count integer DEFAULT 30)
RETURNS TABLE (
  event_id uuid,
  title text,
  house_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  attended_at timestamptz,
  has_feedback boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.title,
    h.name,
    e.starts_at,
    e.ends_at,
    a.attended_at,
    EXISTS (
      SELECT 1 FROM public.feedback f
       WHERE f.event_id = e.id AND f.user_id = auth.uid()
    )
  FROM public.event_attendance a
  JOIN public.events e ON e.id = a.event_id
  JOIN public.youth_houses h ON h.id = e.youth_house_id
  WHERE a.user_id = auth.uid()
  ORDER BY a.attended_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.my_attended_events(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_attended_events(integer) TO authenticated;
