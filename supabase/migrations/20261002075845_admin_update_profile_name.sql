/*
# Administrator ad/soyad düzəlişi

## 1. Səbəb
Bəzi Android klaviaturalarında Azərbaycan dilinə məxsus hərflər (ə, ş, ü, ö,
ğ, ı) IME composition vasitəsilə daxil edilir. Qeydiyyat formu composition
bitmədən submit edildikdə, sonuncu hərf bəzən itir və ya təhrif olunur
(məs. "Əlizadə" → "Əlizad"). Klient tərəfdə bu composition-aware input ilə
qarşısı alınır, lakin artıq bazaya düşmüş korrupt qeydləri düzəltmək üçün
adminə ad/soyad sahələrini əl ilə redaktə etmək imkanı lazımdır.

## 2. Funksiya
`admin_update_profile_name` yalnız təsdiqlənmiş admin hesabı tərəfindən
çağırıla bilər, admin profilini (role = 'admin') redaktə edə bilməz.
*/

CREATE OR REPLACE FUNCTION public.admin_update_profile_name(target_id uuid, new_first_name text, new_last_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yalnız administrator';
  END IF;

  IF trim(coalesce(new_first_name, '')) = '' OR trim(coalesce(new_last_name, '')) = '' THEN
    RAISE EXCEPTION 'Ad və soyad boş ola bilməz';
  END IF;

  UPDATE public.profiles
     SET first_name = trim(new_first_name), last_name = trim(new_last_name), updated_at = now()
   WHERE id = target_id AND role <> 'admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_profile_name(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_name(uuid, text, text) TO authenticated;
