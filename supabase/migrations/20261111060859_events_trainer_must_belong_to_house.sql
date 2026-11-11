create or replace function public.events_check_trainer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Mərkəz və təlimçi dəyişikliyi yalnız mərkəz əməkdaşı və ya admin tərəfindən (sistem əməliyyatları istisna).
  if TG_OP = 'UPDATE' and auth.uid() is not null then
    if (NEW.youth_house_id is distinct from OLD.youth_house_id
        or NEW.trainer_id is distinct from OLD.trainer_id)
       and not (public.is_admin() or public.manages_house(OLD.youth_house_id)) then
      raise exception 'Tədbirin mərkəzini və təlimçisini yalnız mərkəz əməkdaşı dəyişə bilər';
    end if;
  end if;

  if NEW.trainer_id is not null
     and (TG_OP = 'INSERT' or NEW.trainer_id is distinct from OLD.trainer_id) then
    if not exists (
      select 1 from public.house_trainers ht
       where ht.house_id = NEW.youth_house_id
         and ht.trainer_id = NEW.trainer_id
    ) then
      raise exception 'Bu təlimçi seçilmiş Gənclər Evinə bağlı deyil';
    end if;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists events_check_trainer on public.events;
create trigger events_check_trainer
  before insert or update on public.events
  for each row execute function public.events_check_trainer();
