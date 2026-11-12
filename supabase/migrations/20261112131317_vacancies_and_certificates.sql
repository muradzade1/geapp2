-- Sertifikatlar: tədbirə qatılanlar üçün avtomatik sertifikat (vakansiya hissəsi sonradan job_center ilə əvəz olunub)
alter table public.events add column if not exists certificate_enabled boolean not null default true;
update public.events set certificate_enabled = false where created_at < now() - interval '1 minute' and certificate_enabled;

create or replace function public.my_certificates()
returns table(attendance_id uuid, event_id uuid, event_title text, event_date timestamptz, house_name text, full_name text, code text)
language sql stable security definer set search_path to 'public' as $$
  select a.id, e.id, e.title, e.starts_at, h.name, public.chat_name(a.user_id),
         'GE-' || upper(substr(md5(a.id::text), 1, 8))
    from public.event_attendance a
    join public.events e on e.id = a.event_id
    left join public.youth_houses h on h.id = e.youth_house_id
   where a.user_id = auth.uid() and e.certificate_enabled and e.status <> 'cancelled' and e.ends_at < now()
   order by e.starts_at desc;
$$;

create or replace function public.verify_certificate(p_code text)
returns table(full_name text, event_title text, event_date timestamptz, house_name text)
language sql stable security definer set search_path to 'public' as $$
  select public.chat_name(a.user_id), e.title, e.starts_at, h.name
    from public.event_attendance a
    join public.events e on e.id = a.event_id
    left join public.youth_houses h on h.id = e.youth_house_id
   where auth.uid() is not null and e.certificate_enabled
     and 'GE-' || upper(substr(md5(a.id::text), 1, 8)) = upper(trim(p_code))
   limit 1;
$$;

create or replace function public.house_events_certificates(p_house uuid)
returns table(event_id uuid, title text, starts_at timestamptz, ends_at timestamptz, status text, certificate_enabled boolean, attended integer)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not public.manages_house(p_house) then raise exception 'Not authorized'; end if;
  return query
    select e.id, e.title, e.starts_at, e.ends_at, e.status, e.certificate_enabled,
           (select count(*)::integer from public.event_attendance a where a.event_id = e.id)
      from public.events e
     where e.youth_house_id = p_house and e.status <> 'cancelled'
     order by e.starts_at desc
     limit 300;
end;
$$;

create or replace function public.set_event_certificate(p_event uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.manages_event(p_event) then raise exception 'Not authorized'; end if;
  update public.events set certificate_enabled = p_enabled where id = p_event;
end;
$$;

revoke all on function public.my_certificates(), public.verify_certificate(text), public.house_events_certificates(uuid), public.set_event_certificate(uuid, boolean) from public, anon;
grant execute on function public.my_certificates(), public.verify_certificate(text), public.house_events_certificates(uuid), public.set_event_certificate(uuid, boolean) to authenticated;
