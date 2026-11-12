-- Mərkəz qrup çatı (v1): mutes + giriş funksiyaları. Mesaj cədvəli v2-də əvəz olunur.
create table if not exists public.house_chat_messages (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.youth_houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index if not exists house_chat_messages_house_created_idx
  on public.house_chat_messages (house_id, created_at desc);

create table if not exists public.house_chat_mutes (
  house_id uuid not null references public.youth_houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_by uuid,
  created_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

alter table public.house_chat_messages enable row level security;
alter table public.house_chat_mutes enable row level security;

create or replace function public.chat_can_access(p_house uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_house is not null and (
    public.manages_house(p_house)
    or exists (select 1 from public.house_trainers t where t.house_id = p_house and t.trainer_id = auth.uid())
    or exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'youth'
                  and p.youth_house_id = p_house and p.status = 'approved')
  );
$$;

create or replace function public.chat_set_mute(p_house uuid, p_user uuid, p_mute boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.manages_house(p_house) then
    raise exception 'Not authorized';
  end if;
  if p_user = auth.uid() then
    raise exception 'Özünüzü susdura bilməzsiniz';
  end if;
  if p_mute then
    insert into public.house_chat_mutes (house_id, user_id, muted_by)
    values (p_house, p_user, auth.uid())
    on conflict (house_id, user_id) do nothing;
  else
    delete from public.house_chat_mutes where house_id = p_house and user_id = p_user;
  end if;
end;
$$;

create or replace function public.chat_my_house_ids()
returns table(house_id uuid, house_name text)
language sql stable security definer set search_path to 'public' as $$
  select h.id, h.name
    from public.youth_houses h
   where h.status = 'approved' and public.chat_can_access(h.id)
   order by h.name;
$$;

revoke all on function public.chat_can_access(uuid), public.chat_set_mute(uuid, uuid, boolean),
  public.chat_my_house_ids() from public, anon;
grant execute on function public.chat_can_access(uuid), public.chat_set_mute(uuid, uuid, boolean),
  public.chat_my_house_ids() to authenticated;
