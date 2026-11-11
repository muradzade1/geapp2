-- Hesabın hansı platformadan (android / ios / web) istifadə olunduğu.
alter table public.profiles
  add column if not exists platform text,
  add column if not exists platform_updated_at timestamptz;

alter table public.profiles drop constraint if exists profiles_platform_check;
alter table public.profiles
  add constraint profiles_platform_check check (platform is null or platform in ('android', 'ios', 'web'));

-- Mövcud istifadəçilər üçün ilkin dolduruş: ən son sessiyanın brauzer imzasına görə.
with last_session as (
  select distinct on (user_id) user_id, user_agent
  from auth.sessions
  where user_agent is not null
  order by user_id, coalesce(updated_at, created_at) desc
)
update public.profiles p
   set platform = case
         when ls.user_agent ~* '(iphone|ipad)' and ls.user_agent !~* '(version/|crios|fxios|edgios)' then 'ios'
         when ls.user_agent ~* 'android' and ls.user_agent ~* '; wv\)' then 'android'
         else 'web'
       end,
       platform_updated_at = now()
  from last_session ls
 where ls.user_id = p.id
   and p.platform is null;

create or replace function public.set_my_platform(p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'Yanlış platforma';
  end if;
  update public.profiles
     set platform = p_platform,
         platform_updated_at = now()
   where id = auth.uid()
     and platform is distinct from p_platform;
end;
$$;

revoke all on function public.set_my_platform(text) from public, anon;
grant execute on function public.set_my_platform(text) to authenticated;

create or replace function public.admin_platform_summary()
returns table (platform text, role text, total bigint, last_24h bigint, last_7d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'İcazə yoxdur';
  end if;
  return query
    select coalesce(p.platform, 'unknown') as platform,
           p.role,
           count(*) as total,
           count(*) filter (where p.created_at > now() - interval '24 hours') as last_24h,
           count(*) filter (where p.created_at > now() - interval '7 days') as last_7d
      from public.profiles p
     group by 1, 2
     order by 1, 2;
end;
$$;

create or replace function public.admin_platform_users(
  p_platform text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid, first_name text, last_name text, email text, role text, status text,
  city text, platform text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'İcazə yoxdur';
  end if;
  return query
    select p.id, p.first_name, p.last_name, p.email, p.role, p.status,
           p.city, coalesce(p.platform, 'unknown'), p.created_at
      from public.profiles p
     where p_platform is null
        or (p_platform = 'unknown' and p.platform is null)
        or p.platform = p_platform
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 500)
    offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.admin_platform_summary() from public, anon;
revoke all on function public.admin_platform_users(text, int, int) from public, anon;
grant execute on function public.admin_platform_summary() to authenticated;
grant execute on function public.admin_platform_users(text, int, int) to authenticated;
