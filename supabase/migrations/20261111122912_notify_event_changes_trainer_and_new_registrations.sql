create or replace function public.notify_on_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  centre_name text;
begin
  select h.name into centre_name from public.youth_houses h where h.id = new.youth_house_id;

  if new.trainer_id is not null
     and new.status = 'published'
     and (tg_op = 'INSERT' or new.trainer_id is distinct from old.trainer_id) then
    insert into public.notifications (user_id, title, message, type, house_id, source_id)
    values (
      new.trainer_id,
      'Sizə tədbir təyin edildi',
      new.title || ' — ' || to_char(new.starts_at at time zone 'Asia/Baku', 'DD.MM.YYYY, HH24:MI')
        || coalesce(', ' || centre_name, '') || '.',
      'event', new.youth_house_id, null
    );
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      insert into public.notifications (user_id, title, message, type, house_id, source_id)
      select r.user_id,
             'Tədbir ləğv edildi',
             new.title || ' — ' || to_char(old.starts_at at time zone 'Asia/Baku', 'DD.MM.YYYY, HH24:MI')
               || ' tarixli tədbir ləğv olundu.',
             'event', new.youth_house_id, null
        from public.event_registrations r
       where r.event_id = new.id and r.status = 'registered';
    elsif new.status = 'published'
          and new.starts_at is distinct from old.starts_at
          and new.starts_at > now() then
      insert into public.notifications (user_id, title, message, type, house_id, source_id)
      select r.user_id,
             'Tədbirin vaxtı dəyişdi',
             new.title || ' — yeni vaxt: ' || to_char(new.starts_at at time zone 'Asia/Baku', 'DD.MM.YYYY, HH24:MI')
               || coalesce(', ' || centre_name, '') || '.',
             'event', new.youth_house_id, null
        from public.event_registrations r
       where r.event_id = new.id and r.status = 'registered';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_notify_change on public.events;
create trigger events_notify_change
  after insert or update on public.events
  for each row execute function public.notify_on_event_change();

create or replace function public.notify_on_event_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'published' and old.starts_at > now() then
    insert into public.notifications (user_id, title, message, type, house_id, source_id)
    select r.user_id,
           'Tədbir ləğv edildi',
           old.title || ' — ' || to_char(old.starts_at at time zone 'Asia/Baku', 'DD.MM.YYYY, HH24:MI')
             || ' tarixli tədbir ləğv olundu.',
           'event', old.youth_house_id, null
      from public.event_registrations r
     where r.event_id = old.id and r.status = 'registered';
  end if;
  return old;
end;
$$;

drop trigger if exists events_notify_delete on public.events;
create trigger events_notify_delete
  before delete on public.events
  for each row execute function public.notify_on_event_delete();

create or replace function public.notify_admins_on_new_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  label text;
begin
  if new.status is distinct from 'pending' or new.role not in ('trainer', 'youth_house') then
    return new;
  end if;
  label := case new.role when 'trainer' then 'Təlimçi' else 'Gənclər Evi' end;
  who := coalesce(nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), ''), new.email, '');
  insert into public.notifications (user_id, title, message, type, house_id, source_id)
  select a.id,
         'Yeni qeydiyyat təsdiq gözləyir',
         label || ' qeydiyyatı: ' || who || '. Qeydiyyatlar bölməsindən təsdiqləyin.',
         'system', null, new.id
    from public.profiles a
   where a.role = 'admin' and a.status = 'approved'
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_notify_admins on public.profiles;
create trigger profiles_notify_admins
  after insert on public.profiles
  for each row execute function public.notify_admins_on_new_registration();
