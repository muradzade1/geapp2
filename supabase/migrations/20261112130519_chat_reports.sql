-- Çat şikayətləri: istifadəçi mesajı rəhbərə şikayət edir; rəhbər yalnız şikayət olunan mesajı görür.
create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.youth_houses(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  conv_kind text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  message_body text not null,
  message_created_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 300),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  unique (message_id, reporter_id)
);
create index if not exists chat_reports_house_status_idx on public.chat_reports (house_id, status, created_at desc);
alter table public.chat_reports enable row level security;
revoke all on public.chat_reports from anon, authenticated;

create or replace function public.chat_report_message(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  m public.chat_messages;
  c public.chat_conversations;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into m from public.chat_messages where id = p_id and deleted_at is null;
  if not found then raise exception 'Mesaj tapılmadı'; end if;
  if not public.chat_conv_can_read(m.conversation_id) then raise exception 'Not authorized'; end if;
  if m.user_id = auth.uid() then raise exception 'Öz mesajınızı şikayət edə bilməzsiniz'; end if;
  if v_reason is not null and char_length(v_reason) > 300 then raise exception 'Səbəb çox uzundur (maksimum 300 simvol)'; end if;
  select * into c from public.chat_conversations where id = m.conversation_id;
  insert into public.chat_reports (house_id, conversation_id, message_id, conv_kind, reporter_id, reported_user_id,
                                   message_body, message_created_at, reason)
  values (c.house_id, c.id, m.id, c.kind, auth.uid(), m.user_id, m.body, m.created_at, v_reason)
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

create or replace function public.chat_reports_list(p_house uuid, p_status text default 'open')
returns table(id uuid, conv_kind text, reporter_name text, reported_user_id uuid, reported_name text,
              body text, message_created_at timestamptz, reason text, status text, created_at timestamptz,
              reported_muted boolean)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not public.manages_house(p_house) then raise exception 'Not authorized'; end if;
  return query
    select r.id, r.conv_kind, public.chat_name(r.reporter_id), r.reported_user_id, public.chat_name(r.reported_user_id),
           r.message_body, r.message_created_at, r.reason, r.status, r.created_at,
           exists (select 1 from public.house_chat_mutes x where x.house_id = r.house_id and x.user_id = r.reported_user_id)
      from public.chat_reports r
     where r.house_id = p_house and (p_status = 'all' or r.status = p_status)
     order by r.created_at desc
     limit 200;
end;
$$;

create or replace function public.chat_resolve_report(p_id uuid, p_delete_message boolean default false)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r public.chat_reports;
begin
  select * into r from public.chat_reports where id = p_id;
  if not found then return; end if;
  if not public.manages_house(r.house_id) then raise exception 'Not authorized'; end if;
  if p_delete_message and r.message_id is not null then
    update public.chat_messages set deleted_at = now(), deleted_by = auth.uid()
     where id = r.message_id and deleted_at is null;
  end if;
  update public.chat_reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = p_id;
end;
$$;

-- Nişan: rəhbər üçün açıq şikayətlər də sayılır
create or replace function public.chat_unread_total()
returns integer language sql stable security definer set search_path to 'public' as $$
  select (
    coalesce((select sum((
      select count(*) from public.chat_messages x
       where x.conversation_id = c.id and x.deleted_at is null and x.user_id <> auth.uid()
         and x.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                       where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity')
    )) from public.chat_conversations c
      where auth.uid() is not null and public.chat_conv_can_read(c.id)), 0)
    +
    coalesce((select count(*) from public.chat_reports rp
               join public.youth_houses h on h.id = rp.house_id
              where rp.status = 'open' and h.manager_id = auth.uid()), 0)
  )::integer;
$$;

revoke all on function public.chat_report_message(uuid, text), public.chat_reports_list(uuid, text),
  public.chat_resolve_report(uuid, boolean), public.chat_unread_total() from public, anon, authenticated;
grant execute on function public.chat_report_message(uuid, text), public.chat_reports_list(uuid, text),
  public.chat_resolve_report(uuid, boolean), public.chat_unread_total() to authenticated;
