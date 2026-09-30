-- Push notifications: device tokens, per-account settings, and the buffer the Edge Function `notify` empties.
--
-- Same shape as the administrators' email (20260914100000_admin_notifications.sql), for the same reason:
-- a trigger that called the network would put the push service's latency, and its failures, inside the
-- transaction that sends a message or ticks an item. Triggers only do a local insert into `push_outbox`
-- and swallow their own errors; pg_cron wakes the function every minute; the function claims, sends, marks.
--
-- Recipients are resolved here, in SQL, from the same membership tables row-level security reads, never
-- from anything the client says: a notification reaches exactly the accounts that can already read what it
-- announces, the actor is never among them, and the text carries nothing the recipient could not open.
--
-- Nothing secret here. The functions URL and the service key live in Vault (`push_functions_url`,
-- `push_service_key`), the FCM service account in the function's secrets. Absent, the cron does nothing.
--
-- Reversible: drop table public.push_outbox, public.push_tokens;
--   alter table public.profiles drop column notification_settings;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.profiles
  add column if not exists notification_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(notification_settings) = 'object');

grant update (notification_settings) on public.profiles to authenticated;

create table if not exists public.push_tokens (
  user_id uuid not null references auth.users on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 100),
  platform text not null check (platform in ('android', 'ios', 'web')),
  token text not null check (char_length(token) between 1 and 4096),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists push_tokens_token_idx on public.push_tokens (token);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_tokens to authenticated;

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('chat', 'list_activity', 'invite', 'card_request', 'poll')),
  recipient_id uuid not null references auth.users on delete cascade,
  -- Where a tap should land (`/l/<id>/chat`, `/chat/d/<id>`, `/l/<id>`, `/cards`, `/household`).
  path text not null,
  -- What groups rows into one notification: the conversation or the list.
  group_key text not null,
  list_id uuid,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 300),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

create index if not exists push_outbox_pending_idx on public.push_outbox (created_at) where sent_at is null;
create index if not exists push_outbox_group_idx on public.push_outbox (recipient_id, group_key, sent_at);

alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Triggers. Each one inserts and never raises.
-- ---------------------------------------------------------------------------------------------------------

create or replace function public.enqueue_push_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
  list_name text;
begin
  if new.is_system then
    return new;
  end if;

  select coalesce(p.display_name, '') into sender_name from public.profiles p where p.id = new.user_id;

  if new.list_id is not null then
    select l.name into list_name from public.lists l where l.id = new.list_id;

    insert into public.push_outbox (kind, recipient_id, path, group_key, list_id, title, body)
    select 'chat', m.user_id, '/l/' || new.list_id || '/chat', 'chat:' || new.list_id, new.list_id,
           left(coalesce(list_name, ''), 120),
           left(sender_name || ': ' || coalesce(new.body, ''), 300)
    from public.list_members m
    where m.list_id = new.list_id and m.user_id <> new.user_id;
  elsif new.conversation_id is not null then
    insert into public.push_outbox (kind, recipient_id, path, group_key, title, body)
    select 'chat', c.user_id, '/chat/d/' || new.conversation_id, 'chat:' || new.conversation_id,
           left(sender_name, 120),
           left(coalesce(new.body, ''), 300)
    from public.conversation_participants c
    where c.conversation_id = new.conversation_id and c.user_id <> new.user_id;
  end if;

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages
  for each row execute function public.enqueue_push_message();

create or replace function public.enqueue_push_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  list_name text;
begin
  if actor is null then
    return new;
  end if;

  select coalesce(p.display_name, '') into actor_name from public.profiles p where p.id = actor;
  select l.name into list_name from public.lists l where l.id = new.list_id;

  insert into public.push_outbox (kind, recipient_id, path, group_key, list_id, title, body)
  select 'list_activity', m.user_id, '/l/' || new.list_id, 'list:' || new.list_id, new.list_id,
         left(coalesce(list_name, ''), 120),
         left(actor_name, 120)
  from public.list_members m
  where m.list_id = new.list_id and m.user_id <> actor;

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists items_push on public.items;
create trigger items_push after insert on public.items
  for each row execute function public.enqueue_push_item();

-- An invitation code has no recipient until somebody uses it: the account that created it hears that it was.
create or replace function public.enqueue_push_invite_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  joiner_name text;
  household_name text;
begin
  if old.used_at is not null or new.used_at is null or new.created_by is null or new.used_by = new.created_by then
    return new;
  end if;

  select coalesce(p.display_name, '') into joiner_name from public.profiles p where p.id = new.used_by;
  select h.name into household_name from public.households h where h.id = new.household_id;

  insert into public.push_outbox (kind, recipient_id, path, group_key, title, body)
  values ('invite', new.created_by, '/household', 'invite:' || new.household_id,
          left(coalesce(household_name, ''), 120), left(joiner_name, 120));

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists household_invites_push on public.household_invites;
create trigger household_invites_push after update on public.household_invites
  for each row execute function public.enqueue_push_invite_used();

create or replace function public.enqueue_push_card_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sharer_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select coalesce(p.display_name, '') into sharer_name from public.profiles p where p.id = new.shared_by;

  insert into public.push_outbox (kind, recipient_id, path, group_key, title, body)
  select 'card_request', hm.user_id, '/cards', 'card:' || new.household_id,
         left(sharer_name, 120), ''
  from public.household_members hm
  where hm.household_id = new.household_id and hm.user_id <> new.shared_by;

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists loyalty_card_shares_push on public.loyalty_card_shares;
create trigger loyalty_card_shares_push after insert on public.loyalty_card_shares
  for each row execute function public.enqueue_push_card_request();

create or replace function public.enqueue_push_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimant_name text;
  the_list uuid;
begin
  if new.claimed_by is null or new.claimed_by is not distinct from old.claimed_by then
    return new;
  end if;

  select coalesce(p.display_name, '') into claimant_name from public.profiles p where p.id = new.claimed_by;

  select m.list_id into the_list
  from public.polls po join public.messages m on m.id = po.message_id
  where po.id = new.poll_id;

  if the_list is null then
    return new;
  end if;

  insert into public.push_outbox (kind, recipient_id, path, group_key, list_id, title, body)
  select 'poll', lm.user_id, '/l/' || the_list || '/chat', 'poll:' || the_list, the_list,
         left(claimant_name, 120), left(new.label, 300)
  from public.list_members lm
  where lm.list_id = the_list and lm.user_id <> new.claimed_by;

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists poll_options_push on public.poll_options;
create trigger poll_options_push after update on public.poll_options
  for each row execute function public.enqueue_push_claim();

-- ---------------------------------------------------------------------------------------------------------
-- Claim / mark / release, for the Edge Function only.
-- ---------------------------------------------------------------------------------------------------------

-- Returns the pending rows with the recipient's tokens and settings. List activity waits for two quiet minutes
-- and is skipped while the same list notified the same person less than two minutes ago: one notification
-- per list per two minutes, however many items were added.
create or replace function public.claim_push_outbox()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  delete from public.push_outbox where sent_at is not null and sent_at < now() - interval '7 days';

  with picked as (
    update public.push_outbox o
    set claimed_at = now()
    where o.id in (
      select c.id
      from public.push_outbox c
      where c.sent_at is null
        and (c.claimed_at is null or c.claimed_at < now() - interval '5 minutes')
        and (
          c.kind <> 'list_activity'
          or (
            c.created_at < now() - interval '2 minutes'
            and not exists (
              select 1 from public.push_outbox s
              where s.recipient_id = c.recipient_id and s.group_key = c.group_key
                and s.kind = 'list_activity' and s.sent_at > now() - interval '2 minutes'
            )
          )
        )
      order by c.created_at
      limit 500
      for update skip locked
    )
    returning o.id, o.kind, o.recipient_id, o.path, o.group_key, o.list_id, o.title, o.body, o.created_at
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'recipientId', p.recipient_id, 'path', p.path, 'groupKey', p.group_key,
      'listId', p.list_id, 'title', p.title, 'body', p.body, 'createdAt', p.created_at,
      'settings', (select pr.notification_settings from public.profiles pr where pr.id = p.recipient_id),
      'tokens', coalesce((
        select jsonb_agg(jsonb_build_object('deviceId', t.device_id, 'platform', t.platform, 'token', t.token))
        from public.push_tokens t where t.user_id = p.recipient_id
      ), '[]'::jsonb)
    ) order by p.created_at
  ), '[]'::jsonb)
  into claimed
  from picked p;

  return claimed;
end;
$$;

create or replace function public.mark_push_sent(ids uuid[])
returns void language sql security definer set search_path = ''
as $$ update public.push_outbox set sent_at = now() where id = any(ids) and sent_at is null; $$;

create or replace function public.release_push(ids uuid[])
returns void language sql security definer set search_path = ''
as $$ update public.push_outbox set claimed_at = null where id = any(ids) and sent_at is null; $$;

create or replace function public.prune_push_tokens(bad text[])
returns void language sql security definer set search_path = ''
as $$ delete from public.push_tokens where token = any(bad); $$;

revoke all on function public.claim_push_outbox() from public, anon, authenticated;
revoke all on function public.mark_push_sent(uuid[]) from public, anon, authenticated;
revoke all on function public.release_push(uuid[]) from public, anon, authenticated;
revoke all on function public.prune_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.claim_push_outbox() to service_role;
grant execute on function public.mark_push_sent(uuid[]) to service_role;
grant execute on function public.release_push(uuid[]) to service_role;
grant execute on function public.prune_push_tokens(text[]) to service_role;

create or replace function public.flush_push_outbox()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (select 1 from public.push_outbox where sent_at is null) then
    return;
  end if;

  select s.decrypted_secret into functions_url from vault.decrypted_secrets s where s.name = 'push_functions_url';
  select s.decrypted_secret into service_key from vault.decrypted_secrets s where s.name = 'push_service_key';

  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_push_outbox() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('familist-push-outbox')
  where exists (select 1 from cron.job where jobname = 'familist-push-outbox');

  perform cron.schedule('familist-push-outbox', '* * * * *', $cron$select public.flush_push_outbox()$cron$);
end;
$$;
