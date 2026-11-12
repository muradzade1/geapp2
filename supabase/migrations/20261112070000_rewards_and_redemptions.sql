create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 120),
  description text check (description is null or length(description) <= 1000),
  cost integer not null check (cost > 0 and cost <= 1000000),
  stock integer check (stock is null or stock >= 0),
  house_id uuid references public.youth_houses(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rewards_house_idx on public.rewards(house_id);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid references public.rewards(id) on delete set null,
  reward_title text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  house_id uuid not null references public.youth_houses(id) on delete cascade,
  cost integer not null check (cost > 0),
  code text not null,
  status text not null default 'pending' check (status in ('pending','delivered','cancelled')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivered_by uuid references auth.users(id) on delete set null
);
create unique index if not exists reward_redemptions_code_pending on public.reward_redemptions(code) where status = 'pending';
create index if not exists reward_redemptions_user_idx on public.reward_redemptions(user_id);
create index if not exists reward_redemptions_house_idx on public.reward_redemptions(house_id, status);

alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

create policy rewards_select on public.rewards for select to authenticated
  using (
    public.is_admin()
    or (house_id is not null and public.manages_house(house_id))
    or (is_active and exists (
          select 1 from public.profiles p
           where p.id = auth.uid() and p.status = 'approved'
             and (rewards.house_id is null or rewards.house_id = p.youth_house_id)))
  );
create policy rewards_insert on public.rewards for insert to authenticated
  with check (public.is_admin() or (house_id is not null and public.manages_house(house_id)));
create policy rewards_update on public.rewards for update to authenticated
  using (public.is_admin() or (house_id is not null and public.manages_house(house_id)))
  with check (public.is_admin() or (house_id is not null and public.manages_house(house_id)));
create policy rewards_delete on public.rewards for delete to authenticated
  using (public.is_admin() or (house_id is not null and public.manages_house(house_id)));

create policy redemptions_select on public.reward_redemptions for select to authenticated
  using (user_id = auth.uid() or public.manages_house(house_id));

revoke all on public.rewards, public.reward_redemptions from anon;
grant select, insert, update, delete on public.rewards to authenticated;
grant select on public.reward_redemptions to authenticated;

create or replace function public.user_balance(target uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select case
    when coalesce(target, auth.uid()) = auth.uid() or public.is_admin() then
      coalesce((select sum(amount) from public.point_transactions where user_id = coalesce(target, auth.uid())), 0)::integer
      - coalesce((select sum(cost) from public.reward_redemptions
                   where user_id = coalesce(target, auth.uid()) and status in ('pending','delivered')), 0)::integer
    else 0 end;
$$;

create or replace function public.redeem_reward(p_reward_id uuid)
returns table (id uuid, code text, reward_title text, cost integer, house_id uuid, house_name text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prof record;
  r record;
  bal integer;
  c text;
  tries integer := 0;
  rid uuid;
begin
  if me is null then raise exception 'Giriş tələb olunur'; end if;
  select p.role, p.status, p.youth_house_id into prof from public.profiles p where p.id = me;
  if prof.role is distinct from 'youth' or prof.status is distinct from 'approved' then
    raise exception 'Yalnız təsdiqlənmiş gənclər xal xərcləyə bilər';
  end if;
  if prof.youth_house_id is null then
    raise exception 'Hədiyyəni təhvil almaq üçün Gənclər Evi seçilməlidir';
  end if;
  select * into r from public.rewards w where w.id = p_reward_id for update;
  if r.id is null or not r.is_active then raise exception 'Hədiyyə mövcud deyil'; end if;
  if r.house_id is not null and r.house_id <> prof.youth_house_id then
    raise exception 'Bu hədiyyə sizin Gənclər Evi üçün deyil';
  end if;
  if r.stock is not null and r.stock <= 0 then raise exception 'Hədiyyə bitib'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  bal := public.user_balance(me);
  if bal < r.cost then raise exception 'Xalınız çatmır (lazımdır: %, balans: %)', r.cost, bal; end if;
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.reward_redemptions x where x.code = c and x.status = 'pending');
    tries := tries + 1;
    if tries > 20 then raise exception 'Kod yaradıla bilmədi, yenidən cəhd edin'; end if;
  end loop;
  insert into public.reward_redemptions (reward_id, reward_title, user_id, house_id, cost, code)
  values (r.id, r.title, me, prof.youth_house_id, r.cost, c) returning reward_redemptions.id into rid;
  if r.stock is not null then
    update public.rewards set stock = stock - 1 where rewards.id = r.id;
  end if;
  return query
    select rid, c, r.title, r.cost, prof.youth_house_id, (select h.name from public.youth_houses h where h.id = prof.youth_house_id);
end;
$$;

create or replace function public.cancel_redemption(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public.reward_redemptions d where d.id = p_id for update;
  if x.id is null then raise exception 'Kupon tapılmadı'; end if;
  if not (x.user_id = auth.uid() or public.manages_house(x.house_id)) then raise exception 'Not authorized'; end if;
  if x.status <> 'pending' then raise exception 'Yalnız gözləyən kuponu ləğv etmək olar'; end if;
  update public.reward_redemptions set status = 'cancelled' where id = p_id;
  if x.reward_id is not null then
    update public.rewards set stock = stock + 1 where id = x.reward_id and stock is not null;
  end if;
end;
$$;

create or replace function public.lookup_redemption(p_house_id uuid, p_code text)
returns table (id uuid, reward_title text, cost integer, user_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.manages_house(p_house_id) then raise exception 'Not authorized'; end if;
  return query
    select d.id, d.reward_title, d.cost,
           nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), d.created_at
      from public.reward_redemptions d join public.profiles p on p.id = d.user_id
     where d.house_id = p_house_id and d.code = trim(p_code) and d.status = 'pending';
end;
$$;

create or replace function public.deliver_redemption(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public.reward_redemptions d where d.id = p_id for update;
  if x.id is null then raise exception 'Kupon tapılmadı'; end if;
  if not public.manages_house(x.house_id) then raise exception 'Not authorized'; end if;
  if x.status <> 'pending' then raise exception 'Kupon artıq istifadə olunub və ya ləğv edilib'; end if;
  update public.reward_redemptions set status = 'delivered', delivered_at = now(), delivered_by = auth.uid() where id = p_id;
  insert into public.notifications (user_id, title, message, type, house_id, source_id)
  values (x.user_id, 'Hədiyyə təhvil verildi', x.reward_title || ' hədiyyəniz təhvil verildi.', 'system', null, null);
end;
$$;

revoke all on function public.user_balance(uuid), public.redeem_reward(uuid), public.cancel_redemption(uuid),
  public.lookup_redemption(uuid, text), public.deliver_redemption(uuid) from public, anon;
grant execute on function public.user_balance(uuid), public.redeem_reward(uuid), public.cancel_redemption(uuid),
  public.lookup_redemption(uuid, text), public.deliver_redemption(uuid) to authenticated;
