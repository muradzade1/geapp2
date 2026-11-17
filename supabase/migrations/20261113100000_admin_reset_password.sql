-- Admin / Gənclər Evi rəhbəri üçün müvəqqəti parol təyin etmə (bazada artıq tətbiq olunub; bu fayl repo üçündür).

create table if not exists public.password_reset_log (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null,
  target_email text,
  reset_by uuid,
  reset_by_email text,
  reset_at timestamptz not null default now()
);
alter table public.password_reset_log enable row level security;
revoke all on public.password_reset_log from anon, authenticated;

create or replace function public.admin_reset_password(p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_role text; v_house uuid; v_email text;
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea; v_pw text := ''; i int;
begin
  if v_caller is null then raise exception 'Not authorized'; end if;
  select role, youth_house_id into v_role, v_house from public.profiles where id = p_user;
  if not found then raise exception 'İstifadəçi tapılmadı'; end if;
  if v_role = 'admin' then raise exception 'Admin hesabının parolu bu yolla dəyişdirilmir'; end if;
  if not (public.is_admin() or (v_role = 'youth' and v_house is not null and public.manages_house(v_house))) then
    raise exception 'Not authorized';
  end if;
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_pw := v_pw || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  v_pw := 'Genc-' || substr(v_pw, 1, 4) || '-' || substr(v_pw, 5, 4);
  update auth.users set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')), updated_at = now()
   where id = p_user returning email into v_email;
  if v_email is null then raise exception 'İstifadəçi tapılmadı'; end if;
  delete from auth.sessions where user_id = p_user;
  insert into public.password_reset_log (target_id, target_email, reset_by, reset_by_email)
  values (p_user, v_email, v_caller, (select email from auth.users where id = v_caller));
  return v_pw;
end;
$function$;

revoke all on function public.admin_reset_password(uuid) from public, anon;
grant execute on function public.admin_reset_password(uuid) to authenticated;
