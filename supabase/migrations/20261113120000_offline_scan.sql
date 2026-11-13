-- Oflayn QR skan: gənc internetsiz skan edir, internet qayıdanda skan vaxtı ilə bazaya yazılır.

create table if not exists public.offline_scans (
  client_id   uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scanned_at  timestamptz not null,
  received_at timestamptz not null default now(),
  result      jsonb
);

alter table public.offline_scans enable row level security;
revoke all on public.offline_scans from anon, authenticated;

create or replace function public.scan_qr_offline(
  p_code text,
  p_scanned_at timestamptz,
  p_client_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  scan_at timestamptz := p_scanned_at;
  target_house uuid;
  house_label text;
  open_visit public.house_visits%rowtype;
  window_minutes integer;
  awarded integer;
  stored jsonb;
  res jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_approved() then
    raise exception 'Account is not approved';
  end if;
  if p_client_id is null or p_code is null or scan_at is null then
    raise exception 'Yanlış sorğu';
  end if;

  -- Cihazın saatı irəli getsə, indiki vaxta qədər çəkirik.
  if scan_at > now() then
    scan_at := now();
  end if;
  if scan_at < now() - interval '48 hours' then
    raise exception 'Skan 48 saatdan köhnədir və qəbul edilmədi';
  end if;

  -- Eyni skan ikinci dəfə gələrsə (məs. cavab itibsə), əvvəlki nəticə qaytarılır.
  insert into public.offline_scans (client_id, user_id, scanned_at)
  values (p_client_id, v_uid, scan_at)
  on conflict (client_id) do nothing;

  if not found then
    select o.result into stored
      from public.offline_scans o
     where o.client_id = p_client_id and o.user_id = v_uid;
    if not found then
      raise exception 'Yanlış sorğu';
    end if;
    return coalesce(stored, jsonb_build_object('duplicate', true, 'offline', true));
  end if;

  select c.house_id, h.name
    into target_house, house_label
    from public.house_qr_codes c
    join public.youth_houses h on h.id = c.house_id
   where c.code = p_code
     and c.is_active
     and c.valid_from <= scan_at
     and (c.valid_until is null or c.valid_until > scan_at)
     and h.status = 'approved'
     and h.is_active;

  if target_house is null then
    raise exception 'QR kod etibarsızdır və ya vaxtı bitib';
  end if;

  window_minutes := public.point_rule('duplicate_scan_window_minutes', 5);

  select * into open_visit
    from public.house_visits
   where house_id = target_house and user_id = v_uid and exited_at is null
   limit 1
   for update;

  if open_visit.id is not null then
    if scan_at - open_visit.entered_at < make_interval(mins => window_minutes) then
      res := jsonb_build_object(
        'direction', 'in',
        'house_id', target_house,
        'house_name', house_label,
        'at', open_visit.entered_at,
        'already_checked_in', true,
        'total_points', public.user_points()
      );
    else
      update public.house_visits
         set exited_at = scan_at
       where id = open_visit.id;

      select coalesce(sum(amount), 0)::integer into awarded
        from public.point_transactions
       where user_id = v_uid and source = 'visit' and source_id = open_visit.id;

      res := jsonb_build_object(
        'direction', 'out',
        'house_id', target_house,
        'house_name', house_label,
        'at', scan_at,
        'duration_minutes', round(extract(epoch from (scan_at - open_visit.entered_at)) / 60),
        'points_awarded', awarded,
        'total_points', public.user_points()
      );
    end if;
  elsif exists (
    select 1 from public.house_visits
     where house_id = target_house and user_id = v_uid and entered_at > scan_at
  ) then
    -- Bu skandan sonra artıq başqa ziyarət qeydə alınıb; qarışıqlıq yaratmamaq üçün nəzərə alınmır.
    res := jsonb_build_object(
      'direction', 'in',
      'house_id', target_house,
      'house_name', house_label,
      'at', scan_at,
      'ignored', true,
      'total_points', public.user_points()
    );
  else
    begin
      insert into public.house_visits (house_id, user_id, entered_at)
      values (target_house, v_uid, scan_at);
    exception when unique_violation then
      null;
    end;

    res := jsonb_build_object(
      'direction', 'in',
      'house_id', target_house,
      'house_name', house_label,
      'at', scan_at,
      'total_points', public.user_points()
    );
  end if;

  res := res || jsonb_build_object('offline', true);

  update public.offline_scans set result = res where client_id = p_client_id;

  return res;
end;
$function$;

revoke all on function public.scan_qr_offline(text, timestamptz, uuid) from public, anon;
grant execute on function public.scan_qr_offline(text, timestamptz, uuid) to authenticated;
