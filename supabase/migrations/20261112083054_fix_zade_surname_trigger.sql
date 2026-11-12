-- Android klaviaturası bəzən sonuncu "ə" hərfini itirir: Məmmədzad -> Məmmədzadə.
create or replace function public.fix_truncated_zade_surname()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.last_name is not null
     and new.last_name ~* '.{3,}zad$'
     and new.last_name !~* '^(behzad|shahzad|şahzad|mehrzad|pirzad)$' then
    new.last_name := new.last_name || 'ə';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_fix_zade_surname on public.profiles;
create trigger profiles_fix_zade_surname
  before insert or update of last_name on public.profiles
  for each row execute function public.fix_truncated_zade_surname();
-- Mövcud məlumatların bir dəfəlik düzəlişi bazada birbaşa aparılıb (145 soyad).
