create or replace function public.house_pending_youth(target_house uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  birth_date date,
  city text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.manages_house(target_house) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.first_name, p.last_name, p.email, p.phone, p.birth_date, p.city, p.status, p.created_at
      from public.profiles p
     where p.role = 'youth'
       and p.youth_house_id = target_house
       and p.status in ('pending', 'rejected')
     order by (p.status = 'pending') desc, p.created_at desc
     limit 300;
end;
$$;

create or replace function public.house_set_youth_status(target_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if new_status not in ('approved', 'rejected') then
    raise exception 'Invalid status';
  end if;
  select p.id, p.role, p.status, p.youth_house_id into t from public.profiles p where p.id = target_id;
  if t.id is null or t.role <> 'youth' or t.youth_house_id is null then
    raise exception 'Not authorized';
  end if;
  if not public.manages_house(t.youth_house_id) then
    raise exception 'Not authorized';
  end if;
  if t.status not in ('pending', 'rejected') then
    raise exception 'Bu hesabın statusunu dəyişmək olmaz';
  end if;
  update public.profiles set status = new_status, updated_at = now() where id = target_id;
end;
$$;

revoke all on function public.house_pending_youth(uuid) from public, anon;
revoke all on function public.house_set_youth_status(uuid, text) from public, anon;
grant execute on function public.house_pending_youth(uuid) to authenticated;
grant execute on function public.house_set_youth_status(uuid, text) to authenticated;

create or replace function public.notify_manager_on_youth_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mgr uuid;
  who text;
begin
  if new.role <> 'youth' or new.status is distinct from 'pending' or new.youth_house_id is null then
    return new;
  end if;
  select h.manager_id into mgr from public.youth_houses h where h.id = new.youth_house_id;
  if mgr is null then
    return new;
  end if;
  who := coalesce(nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), ''), new.email, '');
  insert into public.notifications (user_id, title, message, type, house_id, source_id)
  values (mgr, 'Yeni gənc qeydiyyatı təsdiq gözləyir',
          who || ' mərkəzinizə qoşulmaq üçün qeydiyyatdan keçdi. "Qeydiyyatlar" bölməsindən təsdiqləyin.',
          'system', null, new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_notify_manager on public.profiles;
create trigger profiles_notify_manager
  after insert on public.profiles
  for each row execute function public.notify_manager_on_youth_registration();
