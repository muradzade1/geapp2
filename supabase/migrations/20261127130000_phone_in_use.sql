-- Qeydiyyat formasında təkrar telefon xəbərdarlığı üçün yalnız true/false qaytarır.
-- Heç bir şəxsi məlumat (ad, e-poçt) qaytarmır. Nömrələr son 9 rəqəmə görə müqayisə olunur
-- (0556974333, +994556974333 və 556974333 eyni sayılır).
create or replace function public.phone_in_use(p_phone text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 then false
    else exists (
      select 1
        from public.profiles p
       where p.role = 'youth'
         and p.phone is not null
         and right(regexp_replace(p.phone, '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    )
  end;
$$;

revoke all on function public.phone_in_use(text) from public;
grant execute on function public.phone_in_use(text) to anon, authenticated;
