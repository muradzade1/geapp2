-- Vakansiya mərkəzi: admin linkləri toplayır, yoxlayır, uyğun olanları göndərir
drop table if exists public.vacancy_applications cascade;
drop table if exists public.vacancies cascade;

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  source_key text,
  title text not null,
  organization text,
  location text,
  category text,
  deadline date,
  url text not null,
  summary text,
  review_status text not null default 'new',
  reviewed_by uuid,
  reviewed_at timestamptz,
  sent_at timestamptz,
  send_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint job_postings_url_http check (url ~* '^https?://'),
  constraint job_postings_summary_len check (summary is null or char_length(summary) <= 600),
  constraint job_postings_review_chk check (review_status in ('new','suitable','unsuitable'))
);
create unique index if not exists job_postings_url_uq on public.job_postings (lower(url));
alter table public.job_postings enable row level security;
revoke all on public.job_postings from public, anon, authenticated;

create or replace function public.job_postings_list(p_review text default null, p_search text default null, p_show_expired boolean default true)
returns table(id uuid, source text, title text, organization text, location text, category text, deadline date, url text, summary text, review_status text, sent_at timestamptz, send_count integer, created_at timestamptz, expired boolean)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  return query
    select j.id, j.source, j.title, j.organization, j.location, j.category, j.deadline, j.url, j.summary,
           j.review_status, j.sent_at, j.send_count, j.created_at,
           (j.deadline is not null and j.deadline < current_date)
      from public.job_postings j
     where (p_review is null or p_review = 'all' or j.review_status = p_review)
       and (p_show_expired or j.deadline is null or j.deadline >= current_date)
       and (coalesce(trim(p_search), '') = ''
            or j.title ilike '%' || trim(p_search) || '%'
            or coalesce(j.organization, '') ilike '%' || trim(p_search) || '%'
            or coalesce(j.location, '') ilike '%' || trim(p_search) || '%')
     order by j.created_at desc
     limit 500;
end;
$$;

create or replace function public.job_posting_save(p_id uuid, p_title text, p_org text, p_location text, p_category text, p_deadline date, p_url text, p_summary text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_url text := trim(coalesce(p_url, ''));
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_url !~* '^https?://' then raise exception 'Link http:// və ya https:// ilə başlamalıdır'; end if;
  begin
    if p_id is null then
      insert into public.job_postings (title, organization, location, category, deadline, url, summary, created_by)
      values (trim(p_title), nullif(trim(coalesce(p_org, '')), ''), nullif(trim(coalesce(p_location, '')), ''),
              nullif(trim(coalesce(p_category, '')), ''), p_deadline, v_url, nullif(trim(coalesce(p_summary, '')), ''), auth.uid())
      returning id into v_id;
    else
      update public.job_postings set title = trim(p_title), organization = nullif(trim(coalesce(p_org, '')), ''),
             location = nullif(trim(coalesce(p_location, '')), ''), category = nullif(trim(coalesce(p_category, '')), ''),
             deadline = p_deadline, url = v_url, summary = nullif(trim(coalesce(p_summary, '')), '')
       where id = p_id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Bu link artıq əlavə olunub';
  end;
  return v_id;
end;
$$;

create or replace function public.job_posting_review(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_status not in ('new','suitable','unsuitable') then raise exception 'Yanlış status'; end if;
  update public.job_postings set review_status = p_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
end;
$$;

create or replace function public.job_posting_delete(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  delete from public.job_postings where id = p_id;
end;
$$;

create or replace function public.job_posting_send(p_id uuid, p_audience text, p_house uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare j public.job_postings; v_msg text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select * into j from public.job_postings where id = p_id;
  if not found then raise exception 'Elan tapılmadı'; end if;
  if j.review_status <> 'suitable' then raise exception 'Yalnız "uyğundur" elanlar göndərilir'; end if;
  if j.deadline is not null and j.deadline < current_date then raise exception 'Elanın son tarixi keçib'; end if;
  if p_audience not in ('all','house') then raise exception 'Naməlum auditoriya'; end if;
  if p_audience = 'house' and p_house is null then raise exception 'Gənclər Evi seçilməyib'; end if;
  v_msg := left(j.title || coalesce(' — ' || j.organization, '')
                || coalesce('. Son tarix: ' || to_char(j.deadline, 'DD.MM.YYYY'), '')
                || '. Ətraflı: "Vakansiyalar" bölməsi.', 1000);
  insert into public.notifications (user_id, title, message, type, house_id, created_by)
  values (null, 'Yeni vakansiya', v_msg, 'news', case when p_audience = 'house' then p_house else null end, auth.uid());
  update public.job_postings set sent_at = now(), send_count = send_count + 1 where id = p_id;
end;
$$;

create or replace function public.job_postings_feed()
returns table(id uuid, title text, organization text, location text, category text, deadline date, url text, summary text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select j.id, j.title, j.organization, j.location, j.category, j.deadline, j.url, j.summary, j.created_at
    from public.job_postings j
   where auth.uid() is not null and j.review_status = 'suitable'
     and (j.deadline is null or j.deadline >= current_date)
   order by j.created_at desc
   limit 300;
$$;

revoke all on function public.job_postings_list(text,text,boolean), public.job_posting_save(uuid,text,text,text,text,date,text,text), public.job_posting_review(uuid,text), public.job_posting_delete(uuid), public.job_posting_send(uuid,text,uuid), public.job_postings_feed() from public, anon;
grant execute on function public.job_postings_list(text,text,boolean), public.job_posting_save(uuid,text,text,text,text,date,text,text), public.job_posting_review(uuid,text), public.job_posting_delete(uuid), public.job_posting_send(uuid,text,uuid), public.job_postings_feed() to authenticated;
