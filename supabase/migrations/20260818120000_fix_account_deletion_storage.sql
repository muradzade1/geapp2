/*
# Account deletion without direct storage writes

## 1. Problem
`delete_my_account()` and `admin_delete_account()` tried to remove the account's
photo with `DELETE FROM storage.objects`. Supabase blocks direct writes to the
storage tables — files must go through the Storage API — so every deletion
failed with "Direct deletion from storage tables is not allowed".

## 2. Fix
Both functions now delete only database rows. The photo is removed by the
client, through the Storage API, before the account is deleted. Two policies are
added so that is possible:

- an account may delete its own photo;
- an administrator may delete any account photo.

## 3. If the file removal fails
The account is still deleted. A leftover photo is a private file in a closed
bucket with no row pointing at it — it leaks nothing, and it can be cleared in
bulk later. Blocking the deletion of an account because a file did not delete
would be the worse outcome, especially since Google Play requires deletion to
work.
*/

-- ============================================================
-- 1. Storage siyasətləri
-- ============================================================

DROP POLICY IF EXISTS "account_photos_delete_own" ON storage.objects;
CREATE POLICY "account_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'account-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "account_photos_delete_admin" ON storage.objects;
CREATE POLICY "account_photos_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'account-photos' AND public.is_admin());

-- ============================================================
-- 2. Öz hesabını silmək
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  verdict jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sessiya tapılmadı';
  END IF;

  verdict := public.can_delete_my_account();

  IF NOT (verdict->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', verdict->>'reason';
  END IF;

  -- Mərkəz qeydi kaskadla getməsin deyə əvvəlcə açıq şəkildə silinir
  DELETE FROM public.youth_houses WHERE manager_id = uid;

  -- Qalan hər şey auth.users-dən kaskadla silinir
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ============================================================
-- 3. Administratorun başqa hesabı silməsi
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_account(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admins_left integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yalnız administrator';
  END IF;

  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'Öz hesabınızı bu yolla silə bilməzsiniz';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = target_id AND role = 'admin' AND status = 'approved'
  ) THEN
    SELECT count(*) INTO admins_left
      FROM public.profiles
     WHERE role = 'admin' AND status = 'approved' AND id <> target_id;

    IF admins_left = 0 THEN
      RAISE EXCEPTION 'Platformada ən azı bir administrator qalmalıdır';
    END IF;
  END IF;

  DELETE FROM public.youth_houses WHERE manager_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;
