/*
# Notifications addressed to one centre

## 1. Problem
`notifications` already had a `house_id` column and centres were already
allowed to write rows with it, but nobody could use it safely: the read policy
treated every row with an empty `user_id` as a platform-wide broadcast. A
message written for Mingəçevir would have appeared on every account in the
country.

## 2. Rules after this migration
A notification is visible when one of these holds:

- it is addressed to the reader personally (`user_id`);
- it has no `user_id` and no `house_id` — a platform-wide announcement;
- it has a `house_id` and the reader belongs to that centre, or manages it;
- the reader is an administrator.

## 3. Who may write
Unchanged: administrators write anything; a centre writes only rows carrying
its own `house_id`. A centre therefore cannot send a platform-wide message even
by leaving the field empty — the policy rejects the row.

## 4. Notes
Young people are attached to a centre through `profiles.youth_house_id`, which
is filled automatically when the centre they named is approved. Someone who
named a centre that has not registered yet simply receives nothing from it,
which is the correct outcome.
*/

-- ============================================================
-- 1. Oxuma siyasəti
-- ============================================================

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND (
    user_id = auth.uid()
    OR (user_id IS NULL AND house_id IS NULL)
    OR (
      user_id IS NULL
      AND house_id IS NOT NULL
      AND (
        house_id = (SELECT p.youth_house_id FROM public.profiles p WHERE p.id = auth.uid())
        OR public.manages_house(house_id)
      )
    )
    OR public.is_admin()
  )
);

-- ============================================================
-- 2. Görünüş
-- ============================================================

-- Sütun sırası dəyişdiyi üçün görünüş əvvəlcə silinir:
-- CREATE OR REPLACE mövcud görünüşə ortadan sütun əlavə edə bilmir.
DROP VIEW IF EXISTS public.my_notifications;

CREATE VIEW public.my_notifications
WITH (security_invoker = true) AS
SELECT
  n.id,
  n.title,
  n.message,
  n.type,
  n.house_id,
  n.created_at,
  (r.notification_id IS NOT NULL) AS read
FROM public.notifications n
LEFT JOIN public.notification_reads r
  ON r.notification_id = n.id AND r.user_id = auth.uid()
WHERE
  n.user_id = auth.uid()
  OR (n.user_id IS NULL AND n.house_id IS NULL)
  OR (
    n.user_id IS NULL
    AND n.house_id IS NOT NULL
    AND (
      n.house_id = (SELECT p.youth_house_id FROM public.profiles p WHERE p.id = auth.uid())
      OR public.manages_house(n.house_id)
    )
  );

REVOKE ALL ON public.my_notifications FROM anon;
GRANT SELECT ON public.my_notifications TO authenticated;

-- ============================================================
-- 3. Mərkəzin göndərdiyi bildirişlər
-- ============================================================

CREATE OR REPLACE FUNCTION public.house_notifications(target_house uuid, limit_count integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  type text,
  created_at timestamptz,
  recipients bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.title,
    n.message,
    n.type,
    n.created_at,
    (SELECT count(*) FROM public.profiles p
      WHERE p.youth_house_id = target_house AND p.status = 'approved')
  FROM public.notifications n
  WHERE n.house_id = target_house
    AND public.manages_house(target_house)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(limit_count, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.house_notifications(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.house_notifications(uuid, integer) TO authenticated;
