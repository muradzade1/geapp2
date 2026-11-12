-- Menyudakı "Çat" nişanı üçün: istifadəçinin bütün söhbətləri üzrə oxunmamış mesajların cəmi.
create or replace function public.chat_unread_total()
returns integer
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(sum((
    select count(*) from public.chat_messages x
     where x.conversation_id = c.id and x.deleted_at is null and x.user_id <> auth.uid()
       and x.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                     where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity')
  )), 0)::integer
  from public.chat_conversations c
  where auth.uid() is not null and public.chat_conv_can_read(c.id);
$$;
revoke all on function public.chat_unread_total() from public, anon, authenticated;
grant execute on function public.chat_unread_total() to authenticated;
