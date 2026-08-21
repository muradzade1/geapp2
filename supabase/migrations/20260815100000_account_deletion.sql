/*
# Account deletion

## 1. Why
Google Play requires an app that creates accounts to offer deletion from inside
the app, and the privacy policy already promises it. Nothing implemented it
until now.

## 2. What deletion means here
`delete_my_account()` removes the row from `auth.users`. Everything personal
hangs off that row through `ON DELETE CASCADE` — the profile, visits, event
registrations and attendance, the points ledger, feedback, badges, challenge
progress, GəncKart usage, notifications and QR tokens all go with it. The
account's uploaded photo is removed from storage in the same call.

## 3. Two accounts that cannot delete themselves
- **Administrators.** Removing the last administrator would leave the platform
  with nobody able to approve anyone. Another administrator must do it.
- **Centre accounts whose centre already holds records.** The visits, events and
  attendance of a Gənclər Evi belong to the institution, not to the person
  holding the login; cascading them away would erase other people's history.
  Such an account is told to contact an administrator, who can reassign or
  archive the centre first.

Both refusals return a clear message so the interface can show it.

## 4. Notes
An account with no dependent records deletes cleanly in every role, so a centre
account created by mistake can still remove itself.
*/

-- ============================================================
-- 1. Can this account delete itself?
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  my_role text;
  house record;
  records_count integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sessiya tapılmadı';
  END IF;

  SELECT role INTO my_role FROM public.profiles WHERE id = uid;

  IF my_role = 'admin' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',
      'Administrator hesabı özünü silə bilməz. Başqa administratora müraciət edin.'
    );
  END IF;

  IF my_role = 'youth_house' THEN
    SELECT * INTO house FROM public.youth_houses WHERE manager_id = uid;

    IF house.id IS NOT NULL THEN
      SELECT
        (SELECT count(*) FROM public.house_visits WHERE house_id = house.id)
        + (SELECT count(*) FROM public.events WHERE youth_house_id = house.id)
      INTO records_count;

      IF records_count > 0 THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason',
          'Mərkəzinizdə ziyarət və tədbir qeydləri var. Bu məlumatlar '
          || 'Gənclər Evinə aiddir və hesabla birlikdə silinə bilməz. '
          || 'Administratorla əlaqə saxlayın.'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_my_account() TO authenticated;

-- ============================================================
-- 2. Delete
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

  -- Yüklənmiş profil şəkli
  DELETE FROM storage.objects
   WHERE bucket_id = 'account-photos'
     AND (storage.foldername(name))[1] = uid::text;

  -- Sahibsiz qalmamalı olan qeydlər
  DELETE FROM public.youth_houses WHERE manager_id = uid;

  -- Qalan hər şey auth.users-dən kaskadla silinir
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ============================================================
-- 3. Administrator deletion of another account
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

  -- Sonuncu administrator qorunur
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

  DELETE FROM storage.objects
   WHERE bucket_id = 'account-photos'
     AND (storage.foldername(name))[1] = target_id::text;

  DELETE FROM public.youth_houses WHERE manager_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;
