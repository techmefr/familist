create table public.conversation_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,
 last_read_at bigint not null check (last_read_at >= 0),
 primary key (user_id, conversation_id)
);
alter table public.conversation_reads enable row level security;
create policy read_own_markers on public.conversation_reads for select to authenticated using (user_id = auth.uid());
grant select on public.conversation_reads to authenticated;

create function public.read_markers()
returns table(conversation_id uuid, last_read_at bigint)
language sql stable security invoker set search_path = ''
as $$ select conversation_id, last_read_at from public.conversation_reads where user_id = auth.uid(); $$;

create function public.mark_conversation_read(target uuid, read_at bigint, expected_user uuid)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare result bigint;
begin
 if auth.uid() is null or auth.uid() is distinct from expected_user or not (public.can_access_list(target) or public.is_conversation_participant(target)) then
  raise exception 'Conversation unavailable' using errcode = '42501';
 end if;
 insert into public.conversation_reads(user_id, conversation_id, last_read_at)
 values(auth.uid(), target, greatest(0, least(read_at, floor(extract(epoch from now()) * 1000)::bigint)))
 on conflict (user_id, conversation_id) do update set last_read_at = greatest(conversation_reads.last_read_at, excluded.last_read_at)
 returning last_read_at into result;
 return result;
end;
$$;
revoke all on function public.read_markers() from public, anon;
revoke all on function public.mark_conversation_read(uuid, bigint, uuid) from public, anon;
grant execute on function public.read_markers() to authenticated;
grant execute on function public.mark_conversation_read(uuid, bigint, uuid) to authenticated;
alter publication supabase_realtime add table public.conversation_reads;
