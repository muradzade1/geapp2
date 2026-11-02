create or replace function public.event_participants(p_event_id uuid)
returns table (user_id uuid, full_name text, registered boolean, attended boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.manages_event(p_event_id) then
    raise exception 'Bu tədbirin iştirakçılarına baxmaq icazəniz yoxdur' using errcode = '42501';
  end if;

  return query
  select
    u.uid as user_id,
    nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') as full_name,
    (r.user_id is not null) as registered,
    (a.user_id is not null) as attended
  from (
    select er.user_id as uid from public.event_registrations er
      where er.event_id = p_event_id and er.status = 'registered'
    union
    select ea.user_id as uid from public.event_attendance ea
      where ea.event_id = p_event_id
  ) u
  left join public.event_registrations r
    on r.event_id = p_event_id and r.user_id = u.uid and r.status = 'registered'
  left join public.event_attendance a
    on a.event_id = p_event_id and a.user_id = u.uid
  left join public.profiles p on p.id = u.uid
  order by 2 nulls last;
end;
$$;

revoke all on function public.event_participants(uuid) from public, anon;
grant execute on function public.event_participants(uuid) to authenticated;
