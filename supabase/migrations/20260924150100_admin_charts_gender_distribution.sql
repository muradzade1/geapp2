/*
# Gender chart now has real data

`profiles.gender` exists now (20260924150000), optional and youth-only in the
UI. This replaces the hardcoded empty `gender_distribution` in
`admin_charts()` with real counts, bucketed the same way as `age_distribution`
— accounts with no gender fall under "Göstərilməyib" so the total still
matches the account count.
*/

CREATE OR REPLACE FUNCTION public.admin_charts()
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

    -- Kateqoriya üzrə tədbirlər
    'events_by_category', (
      SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.count DESC), '[]'::jsonb)
        FROM (
          SELECT e.category, count(*)::integer AS count
            FROM public.events e
           WHERE e.status IN ('published', 'completed')
           GROUP BY e.category
        ) c
    ),

    -- Son 6 ay
    'monthly_trend', (
      SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.sort), '[]'::jsonb)
        FROM (
          SELECT
            to_char(g.month, 'MM.YYYY') AS month,
            g.month AS sort,
            (SELECT count(*)::integer FROM public.profiles p
              WHERE p.role = 'youth'
                AND p.created_at >= g.month
                AND p.created_at < g.month + interval '1 month') AS users,
            (SELECT count(*)::integer FROM public.events e
              WHERE e.starts_at >= g.month
                AND e.starts_at < g.month + interval '1 month') AS events,
            (SELECT count(*)::integer FROM public.house_visits v
              WHERE v.entered_at >= g.month
                AND v.entered_at < g.month + interval '1 month') AS visits
          FROM generate_series(
                 date_trunc('month', now()) - interval '5 months',
                 date_trunc('month', now()),
                 interval '1 month') AS g(month)
        ) m
    ),

    -- Yaş bölgüsü
    'age_distribution', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.sort), '[]'::jsonb)
        FROM (
          SELECT bucket AS age, count(*)::integer AS count, min(sort) AS sort
            FROM (
              SELECT
                CASE
                  WHEN p.birth_date IS NULL THEN 'Göstərilməyib'
                  WHEN date_part('year', age(p.birth_date)) < 18 THEN '13-17'
                  WHEN date_part('year', age(p.birth_date)) < 25 THEN '18-24'
                  WHEN date_part('year', age(p.birth_date)) < 30 THEN '25-29'
                  ELSE '30+'
                END AS bucket,
                CASE
                  WHEN p.birth_date IS NULL THEN 5
                  WHEN date_part('year', age(p.birth_date)) < 18 THEN 1
                  WHEN date_part('year', age(p.birth_date)) < 25 THEN 2
                  WHEN date_part('year', age(p.birth_date)) < 30 THEN 3
                  ELSE 4
                END AS sort
              FROM public.profiles p
              WHERE p.role = 'youth'
            ) t
           GROUP BY bucket
        ) a
    ),

    -- Cins bölgüsü
    'gender_distribution', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.sort), '[]'::jsonb)
        FROM (
          SELECT bucket AS gender, count(*)::integer AS count, min(sort) AS sort
            FROM (
              SELECT
                CASE
                  WHEN p.gender = 'kişi' THEN 'Kişi'
                  WHEN p.gender = 'qadın' THEN 'Qadın'
                  ELSE 'Göstərilməyib'
                END AS bucket,
                CASE
                  WHEN p.gender = 'kişi' THEN 1
                  WHEN p.gender = 'qadın' THEN 2
                  ELSE 3
                END AS sort
              FROM public.profiles p
              WHERE p.role = 'youth'
            ) t
           GROUP BY bucket
        ) g
    ),

    -- Ən aktiv mərkəzlər
    'top_houses', (
      SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.visitors DESC), '[]'::jsonb)
        FROM (
          SELECT
            y.name,
            (SELECT count(*)::integer FROM public.house_visits v
              WHERE v.house_id = y.id) AS visitors,
            (SELECT count(*)::integer FROM public.profiles p
              WHERE p.youth_house_id = y.id) AS members
          FROM public.youth_houses y
          WHERE y.status = 'approved'
          ORDER BY visitors DESC
          LIMIT 8
        ) h
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_charts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_charts() TO authenticated;
