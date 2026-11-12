-- Çat v2: mərkəz otağı + qruplar + şəxsi yazışma. Şəxsi/qrup mesajlarını yalnız iştirakçılar görür.
drop function if exists public.chat_list(uuid, integer);
drop function if exists public.chat_send(uuid, text);
drop function if exists public.chat_delete(uuid);
drop table if exists public.house_chat_messages;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.youth_houses(id) on delete cascade,
  kind text not null check (kind in ('house','group','dm')),
  title text check (title is null or char_length(title) between 1 and 60),
  dm_key text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_conv_house_room on public.chat_conversations (house_id) where kind = 'house';
create unique index if not exists chat_conv_dm_key on public.chat_conversations (house_id, dm_key) where kind = 'dm';

create table if not exists public.chat_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

create table if not exists public.chat_reads (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index if not exists chat_messages_conv_created_idx on public.chat_messages (conversation_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_conversations, public.chat_members, public.chat_reads, public.chat_messages from anon, authenticated;

-- ===== Köməkçilər =====
create or replace function public.chat_name(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'İstifadəçi')
    from public.profiles p where p.id = p_user
  union all select 'İstifadəçi' limit 1;
$$;

create or replace function public.chat_is_member(p_house uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.youth_houses h where h.id = p_house and h.manager_id = p_user)
      or exists (select 1 from public.house_trainers t where t.house_id = p_house and t.trainer_id = p_user)
      or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'youth'
                  and p.youth_house_id = p_house and p.status = 'approved');
$$;

create or replace function public.chat_is_staff(p_house uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.youth_houses h where h.id = p_house and h.manager_id = p_user)
      or exists (select 1 from public.house_trainers t where t.house_id = p_house and t.trainer_id = p_user);
$$;

create or replace function public.chat_conv_can_read(p_conv uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.chat_conversations c
     where c.id = p_conv and (
       (c.kind = 'house' and public.chat_can_access(c.house_id))
       or (c.kind in ('group','dm')
           and exists (select 1 from public.chat_members m where m.conversation_id = c.id and m.user_id = auth.uid())
           and public.chat_is_member(c.house_id, auth.uid()))
     ));
$$;

create or replace function public.chat_my_role(p_house uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from public.youth_houses h where h.id = p_house and h.manager_id = auth.uid()) then 'manager'
    when exists (select 1 from public.house_trainers t where t.house_id = p_house and t.trainer_id = auth.uid()) then 'trainer'
    when public.is_admin() then 'admin'
    when public.chat_is_member(p_house, auth.uid()) then 'youth'
    else null end;
$$;

-- ===== Siyahı (aşağıdakı fix miqrasiyası ilə yenilənir) =====
create or replace function public.chat_list_conversations(p_house uuid)
returns table(id uuid, kind text, title text, last_body text, last_at timestamptz, unread integer, member_count integer)
language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not public.chat_can_access(p_house) then
    raise exception 'Not authorized';
  end if;
  insert into public.chat_conversations as cc (house_id, kind, title)
  values (p_house, 'house', 'Mərkəz çatı')
  on conflict (house_id) where cc.kind = 'house' do nothing;

  return query
    select c.id, c.kind,
           case c.kind
             when 'house' then 'Mərkəz çatı'
             when 'group' then coalesce(c.title, 'Qrup')
             else public.chat_name((select m.user_id from public.chat_members m
                                     where m.conversation_id = c.id and m.user_id <> auth.uid() limit 1))
           end,
           lm.body, lm.created_at,
           (select count(*)::integer from public.chat_messages x
             where x.conversation_id = c.id and x.deleted_at is null and x.user_id <> auth.uid()
               and x.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                             where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity')),
           case when c.kind = 'house' then 0
                else (select count(*)::integer from public.chat_members m where m.conversation_id = c.id) end
      from public.chat_conversations c
      left join lateral (
        select x.body, x.created_at from public.chat_messages x
         where x.conversation_id = c.id and x.deleted_at is null
         order by x.created_at desc limit 1) lm on true
     where c.house_id = p_house and public.chat_conv_can_read(c.id)
     order by (c.kind = 'house') desc, coalesce(lm.created_at, c.created_at) desc;
end;
$$;

-- ===== Mesajlar =====
create or replace function public.chat_messages_list(p_conv uuid, p_limit integer default 100)
returns table(id uuid, user_id uuid, sender_name text, sender_role text, body text,
              created_at timestamptz, mine boolean, sender_muted boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_house uuid;
begin
  if not public.chat_conv_can_read(p_conv) then
    raise exception 'Not authorized';
  end if;
  select c.house_id into v_house from public.chat_conversations c where c.id = p_conv;
  return query
    select m.id, m.user_id, public.chat_name(m.user_id),
           case when exists (select 1 from public.youth_houses h where h.id = v_house and h.manager_id = m.user_id) then 'youth_house'
                when exists (select 1 from public.house_trainers t where t.house_id = v_house and t.trainer_id = m.user_id) then 'trainer'
                else coalesce((select p.role from public.profiles p where p.id = m.user_id), 'youth') end,
           m.body, m.created_at, (m.user_id = auth.uid()),
           exists (select 1 from public.house_chat_mutes x where x.house_id = v_house and x.user_id = m.user_id)
      from public.chat_messages m
     where m.conversation_id = p_conv and m.deleted_at is null
     order by m.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create or replace function public.chat_mark_read(p_conv uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.chat_conv_can_read(p_conv) then return; end if;
  insert into public.chat_reads (conversation_id, user_id, last_read_at)
  values (p_conv, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.chat_send_msg(p_conv uuid, p_body text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_house uuid;
  v_id uuid;
begin
  if auth.uid() is null or not public.chat_conv_can_read(p_conv) then
    raise exception 'Not authorized';
  end if;
  select c.house_id into v_house from public.chat_conversations c where c.id = p_conv;
  if v_body = '' then raise exception 'Mesaj boşdur'; end if;
  if char_length(v_body) > 1000 then raise exception 'Mesaj çox uzundur (maksimum 1000 simvol)'; end if;
  if exists (select 1 from public.house_chat_mutes where house_id = v_house and user_id = auth.uid()) then
    raise exception 'Çatda yazmaq icazəniz məhdudlaşdırılıb';
  end if;
  if (select count(*) from public.chat_messages
       where user_id = auth.uid() and created_at > now() - interval '30 seconds') >= 8 then
    raise exception 'Çox tez yazırsınız, bir az gözləyin';
  end if;
  insert into public.chat_messages (conversation_id, user_id, body)
  values (p_conv, auth.uid(), v_body) returning id into v_id;
  perform public.chat_mark_read(p_conv);
  return v_id;
end;
$$;

create or replace function public.chat_delete_msg(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  m public.chat_messages;
  c public.chat_conversations;
begin
  select * into m from public.chat_messages where id = p_id and deleted_at is null;
  if not found then return; end if;
  select * into c from public.chat_conversations where id = m.conversation_id;
  if not public.chat_conv_can_read(m.conversation_id) then
    raise exception 'Not authorized';
  end if;
  if not (m.user_id = auth.uid()
          or (c.kind = 'house' and public.manages_house(c.house_id))
          or (c.kind = 'group' and public.chat_is_staff(c.house_id, auth.uid()))) then
    raise exception 'Not authorized';
  end if;
  update public.chat_messages set deleted_at = now(), deleted_by = auth.uid() where id = p_id;
end;
$$;

-- ===== Əlaqələr, şəxsi yazışma, qruplar =====
create or replace function public.chat_contacts(p_house uuid)
returns table(user_id uuid, name text, role text)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_staff boolean;
begin
  if not public.chat_is_member(p_house, auth.uid()) and not public.manages_house(p_house) then
    raise exception 'Not authorized';
  end if;
  v_staff := public.chat_is_staff(p_house, auth.uid());
  return query
    select p.id, public.chat_name(p.id), 'youth'::text
      from public.profiles p
     where p.role = 'youth' and p.youth_house_id = p_house and p.status = 'approved' and p.id <> auth.uid()
    union all
    select t.trainer_id, public.chat_name(t.trainer_id), 'trainer'::text
      from public.house_trainers t where v_staff and t.house_id = p_house and t.trainer_id <> auth.uid()
    union all
    select h.manager_id, public.chat_name(h.manager_id), 'youth_house'::text
      from public.youth_houses h where v_staff and h.id = p_house and h.manager_id is not null and h.manager_id <> auth.uid()
    order by 2;
end;
$$;

create or replace function public.chat_start_dm(p_house uuid, p_other uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_key text;
  v_id uuid;
begin
  if auth.uid() is null or p_other is null or p_other = auth.uid() then
    raise exception 'Yanlış seçim';
  end if;
  -- Şəxsi yazışma: yalnız eyni mərkəzin gəncləri arasında
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'youth'
                   and p.youth_house_id = p_house and p.status = 'approved')
     or not exists (select 1 from public.profiles p where p.id = p_other and p.role = 'youth'
                   and p.youth_house_id = p_house and p.status = 'approved') then
    raise exception 'Şəxsi yazışma yalnız eyni mərkəzin gəncləri arasında mümkündür';
  end if;
  v_key := least(auth.uid()::text, p_other::text) || ':' || greatest(auth.uid()::text, p_other::text);
  select c.id into v_id from public.chat_conversations c where c.house_id = p_house and c.kind = 'dm' and c.dm_key = v_key;
  if v_id is null then
    insert into public.chat_conversations (house_id, kind, dm_key, created_by)
    values (p_house, 'dm', v_key, auth.uid())
    on conflict (house_id, dm_key) where kind = 'dm' do nothing
    returning id into v_id;
    if v_id is null then
      select c.id into v_id from public.chat_conversations c where c.house_id = p_house and c.kind = 'dm' and c.dm_key = v_key;
    end if;
  end if;
  insert into public.chat_members (conversation_id, user_id, added_by)
  values (v_id, auth.uid(), auth.uid()), (v_id, p_other, auth.uid())
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.chat_create_group(p_house uuid, p_title text, p_users uuid[])
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_id uuid;
  u uuid;
begin
  if not public.chat_is_staff(p_house, auth.uid()) then
    raise exception 'Qrupu yalnız təlimçi və ya mərkəz rəhbəri yarada bilər';
  end if;
  if v_title = '' or char_length(v_title) > 60 then raise exception 'Qrup adı 1-60 simvol olmalıdır'; end if;
  if coalesce(array_length(p_users, 1), 0) > 200 then raise exception 'Çox üzv'; end if;
  insert into public.chat_conversations (house_id, kind, title, created_by)
  values (p_house, 'group', v_title, auth.uid()) returning id into v_id;
  insert into public.chat_members (conversation_id, user_id, added_by) values (v_id, auth.uid(), auth.uid());
  foreach u in array coalesce(p_users, '{}'::uuid[]) loop
    if public.chat_is_member(p_house, u) then
      insert into public.chat_members (conversation_id, user_id, added_by) values (v_id, u, auth.uid())
      on conflict do nothing;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.chat_group_members(p_conv uuid)
returns table(user_id uuid, name text, role text)
language plpgsql stable security definer set search_path to 'public' as $$
declare c public.chat_conversations;
begin
  select * into c from public.chat_conversations where id = p_conv and kind in ('group','dm');
  if not found then raise exception 'Not authorized'; end if;
  if not (public.chat_conv_can_read(p_conv)
          or (c.kind = 'group' and exists (select 1 from public.youth_houses h where h.id = c.house_id and h.manager_id = auth.uid()))) then
    raise exception 'Not authorized';
  end if;
  return query
    select m.user_id, public.chat_name(m.user_id),
           case when exists (select 1 from public.youth_houses h where h.id = c.house_id and h.manager_id = m.user_id) then 'youth_house'
                when exists (select 1 from public.house_trainers t where t.house_id = c.house_id and t.trainer_id = m.user_id) then 'trainer'
                else 'youth' end
      from public.chat_members m where m.conversation_id = p_conv
     order by 2;
end;
$$;

create or replace function public.chat_add_member(p_conv uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.chat_conversations;
begin
  select * into c from public.chat_conversations where id = p_conv and kind = 'group';
  if not found then raise exception 'Qrup tapılmadı'; end if;
  if not ((public.chat_is_staff(c.house_id, auth.uid())
           and exists (select 1 from public.chat_members m where m.conversation_id = p_conv and m.user_id = auth.uid()))
          or exists (select 1 from public.youth_houses h where h.id = c.house_id and h.manager_id = auth.uid())) then
    raise exception 'Üzvü yalnız təlimçi və ya mərkəz rəhbəri əlavə edə bilər';
  end if;
  if not public.chat_is_member(c.house_id, p_user) then
    raise exception 'Bu istifadəçi mərkəzin üzvü deyil';
  end if;
  insert into public.chat_members (conversation_id, user_id, added_by) values (p_conv, p_user, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.chat_remove_member(p_conv uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.chat_conversations;
begin
  select * into c from public.chat_conversations where id = p_conv and kind = 'group';
  if not found then raise exception 'Qrup tapılmadı'; end if;
  if not (p_user = auth.uid()
          or (public.chat_is_staff(c.house_id, auth.uid())
              and exists (select 1 from public.chat_members m where m.conversation_id = p_conv and m.user_id = auth.uid()))
          or exists (select 1 from public.youth_houses h where h.id = c.house_id and h.manager_id = auth.uid())) then
    raise exception 'Not authorized';
  end if;
  delete from public.chat_members where conversation_id = p_conv and user_id = p_user;
end;
$$;

-- İcazələr: köməkçilər yalnız daxildən çağırılır
revoke all on function public.chat_name(uuid), public.chat_is_member(uuid, uuid), public.chat_is_staff(uuid, uuid),
  public.chat_conv_can_read(uuid), public.chat_my_role(uuid), public.chat_list_conversations(uuid),
  public.chat_messages_list(uuid, integer), public.chat_mark_read(uuid), public.chat_send_msg(uuid, text),
  public.chat_delete_msg(uuid), public.chat_contacts(uuid), public.chat_start_dm(uuid, uuid),
  public.chat_create_group(uuid, text, uuid[]), public.chat_group_members(uuid), public.chat_add_member(uuid, uuid),
  public.chat_remove_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.chat_my_role(uuid), public.chat_list_conversations(uuid),
  public.chat_messages_list(uuid, integer), public.chat_mark_read(uuid), public.chat_send_msg(uuid, text),
  public.chat_delete_msg(uuid), public.chat_contacts(uuid), public.chat_start_dm(uuid, uuid),
  public.chat_create_group(uuid, text, uuid[]), public.chat_group_members(uuid), public.chat_add_member(uuid, uuid),
  public.chat_remove_member(uuid, uuid) to authenticated;
