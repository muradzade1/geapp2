/*
  admin_charts(): təhsil və məşğulluq bölgüsü əlavə olunur.
  Köhnə hesablarda (NULL) "Göstərilməyib" kimi sayılır.
*/
CREATE OR REPLACE FUNCTION public.admin_charts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yalnız administrator';
  END IF;

  SELECT jsonb_build_object(

    'events_by_category', (
      SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.count DESC), '[]'::jsonb)
        FROM (
          SELECT e.category, count(*)::integer AS count
            FROM public.events e
           WHERE e.status IN ('published', 'completed')
           GROUP BY e.category
        ) c
    ),

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

    -- Təhsil bölgüsü
    'education_distribution', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.sort), '[]'::jsonb)
        FROM (
          SELECT bucket AS education, count(*)::integer AS count, min(sort) AS sort
            FROM (
              SELECT
                COALESCE(p.education, 'Göstərilməyib') AS bucket,
                CASE p.education
                  WHEN 'Orta təhsil' THEN 1
                  WHEN 'Peşə təhsili' THEN 2
                  WHEN 'Orta ixtisas təhsili' THEN 3
                  WHEN 'Ali təhsil (bakalavriat)' THEN 4
                  WHEN 'Ali təhsil (magistratura)' THEN 5
                  WHEN 'Formal təhsil almamışam' THEN 6
                  ELSE 7
                END AS sort
              FROM public.profiles p
              WHERE p.role = 'youth'
            ) t
           GROUP BY bucket
        ) d
    ),

    -- Məşğulluq bölgüsü
    'employment_distribution', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.sort), '[]'::jsonb)
        FROM (
          SELECT bucket AS employment, count(*)::integer AS count, min(sort) AS sort
            FROM (
              SELECT
                COALESCE(p.employment_status, 'Göstərilməyib') AS bucket,
                CASE p.employment_status
                  WHEN 'İşləyirəm' THEN 1
                  WHEN 'Sahibkaram' THEN 2
                  WHEN 'İşləmirəm' THEN 3
                  ELSE 4
                END AS sort
              FROM public.profiles p
              WHERE p.role = 'youth'
            ) t
           GROUP BY bucket
        ) d
    ),

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
$function$;

REVOKE ALL ON FUNCTION public.admin_charts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_charts() TO authenticated;
