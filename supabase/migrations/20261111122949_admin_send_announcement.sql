create or replace function public.admin_send_announcement(
  p_title text,
  p_message text,
  p_audience text,
  p_house_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer := 0;
  t text := trim(coalesce(p_title, ''));
  m text := trim(coalesce(p_message, ''));
begin
  if not public.is_admin() then
    raise exception 'Yalnız administrator elan göndərə bilər';
  end if;
  if t = '' or m = '' then
    raise exception 'Başlıq və mətn boş ola bilməz';
  end if;
  if length(t) > 120 or length(m) > 1000 then
    raise exception 'Başlıq 120, mətn 1000 simvoldan uzun ola bilməz';
  end if;

  if p_audience = 'all' then
    insert into public.notifications (user_id, title, message, type, house_id, created_by)
    values (null, t, m, 'system', null, auth.uid());
    return 1;
  elsif p_audience = 'house' then
    if p_house_id is null then raise exception 'Gənclər Evi seçilməyib'; end if;
    insert into public.notifications (user_id, title, message, type, house_id, created_by)
    values (null, t, m, 'system', p_house_id, auth.uid());
    return 1;
  elsif p_audience in ('youth', 'trainer', 'youth_house') then
    insert into public.notifications (user_id, title, message, type, house_id, created_by)
    select p.id, t, m, 'system', null, auth.uid()
      from public.profiles p
     where p.role = p_audience and p.status = 'approved'
       and (p_house_id is null or p.youth_house_id = p_house_id);
    get diagnostics cnt = row_count;
    return cnt;
  else
    raise exception 'Naməlum auditoriya';
  end if;
end;
$$;

revoke all on function public.admin_send_announcement(text, text, text, uuid) from public, anon;
grant execute on function public.admin_send_announcement(text, text, text, uuid) to authenticated;
