-- Sending a photo in a conversation (#366).
--
-- A message keeps a single optional `photo_path`, the same choice already made for a recipe's photo
-- (20260919100000_recipe_photo_storage.sql): the pixels live in a private Storage bucket, the row only
-- remembers where. A text body and a photo are not mutually exclusive on this column — a caption is not
-- modelled here, `body` stays empty when a message is only a photo, exactly as it already is for a poll
-- message.
alter table public.messages
  add column photo_path text;

insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', false)
on conflict (id) do nothing;

-- Unlike a recipe, a message's access rule already differs by scope — a list or a direct conversation, see
-- can_access_message in 20260917140000_direct_conversations.sql. The object path therefore starts with the
-- scope id (the list id or the conversation id, whichever the message belongs to) rather than the message
-- id: the message row is not guaranteed to exist yet at upload time, but its list or conversation always
-- does, and both already have their own guard.
create or replace function public.chat_photo_scope(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid
$$;

-- Exactly one of the two guards ever matches a given scope id, since a list id and a conversation id are
-- drawn from disjoint uuid columns: trying both is simpler than carrying a second path segment to say which
-- one applies.
create policy chat_photos_all on storage.objects for all
  using (
    bucket_id = 'chat-photos'
    and (
      public.can_access_list(public.chat_photo_scope(name))
      or public.is_conversation_participant(public.chat_photo_scope(name))
    )
  )
  with check (
    bucket_id = 'chat-photos'
    and (
      public.can_access_list(public.chat_photo_scope(name))
      or public.is_conversation_participant(public.chat_photo_scope(name))
    )
  );

grant execute on function public.chat_photo_scope(text) to authenticated;
