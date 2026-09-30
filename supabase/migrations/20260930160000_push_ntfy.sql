-- Push without Google: a device row may carry an ntfy topic address instead of an FCM token (platform 'ntfy').
-- The Edge Function only ever posts to hosts on its own allowlist, whatever is stored here.
--
-- Reversible: delete from public.push_tokens where platform = 'ntfy';
--   alter table public.push_tokens drop constraint push_tokens_platform_check;
--   alter table public.push_tokens add constraint push_tokens_platform_check check (platform in ('android', 'ios', 'web'));

alter table public.push_tokens drop constraint if exists push_tokens_platform_check;
alter table public.push_tokens
  add constraint push_tokens_platform_check check (platform in ('android', 'ios', 'web', 'ntfy'));
