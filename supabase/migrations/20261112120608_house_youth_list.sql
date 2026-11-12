-- Gənclər Evi rəhbərinin öz mərkəzinin gənclərinin siyahısı (Excel/PDF ixracı üçün).
create or replace function public.house_youth_list(target_house uuid)
returns table(id uuid, first_name text, last_name text, email text, phone text, birth_date date,
              gender text, city text, education text, employment_status text, status text,
              created_at timestamptz, points integer)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.manages_house(target_house) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.first_name, p.last_name, p.email, p.phone, p.birth_date, p.gender, p.city,
           p.education, p.employment_status, p.status, p.created_at,
           coalesce((select sum(t.amount) from public.point_transactions t where t.user_id = p.id), 0)::integer
      from public.profiles p
     where p.role = 'youth'
       and p.youth_house_id = target_house
     order by p.last_name nulls last, p.first_name nulls last
     limit 5000;
end;
$function$;

revoke all on function public.house_youth_list(uuid) from public, anon;
grant execute on function public.house_youth_list(uuid) to authenticated;
