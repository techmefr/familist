-- Resolving a report closes the public issue that points back to it.
--
-- The issue carries only a number, as a trace in the backlog. Once the report is resolved that trace is
-- noise: it stays open for ever unless somebody remembers to close it by hand. The closing follows the same
-- path as the publication — a local mark here, the edge function doing the call to the tracker on its next
-- wake-up — so an unreachable repository never blocks the resolve button.
alter table public.bug_reports add column issue_closed_at timestamptz;

comment on column public.bug_reports.issue_closed_at is
  'Date de fermeture de l issue publique une fois le signalement resolu. Nul, la fermeture reste a faire.';

create index bug_reports_issue_to_close_idx
  on public.bug_reports (resolved_at)
  where status = 'resolved' and issue_number is not null and issue_closed_at is null;

create or replace function public.list_resolved_report_issues()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', p.id, 'issue_number', p.issue_number) order by p.resolved_at),
    '[]'::jsonb
  )
  from (
    select r.id, r.issue_number, r.resolved_at
    from public.bug_reports r
    where r.status = 'resolved' and r.issue_number is not null and r.issue_closed_at is null
    order by r.resolved_at
    limit 20
  ) p;
$$;

create or replace function public.mark_bug_report_issue_closed(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bug_reports set issue_closed_at = now() where id = target and issue_closed_at is null;
$$;

revoke all on function public.list_resolved_report_issues() from public, anon, authenticated;
revoke all on function public.mark_bug_report_issue_closed(uuid) from public, anon, authenticated;
grant execute on function public.list_resolved_report_issues() to service_role;
grant execute on function public.mark_bug_report_issue_closed(uuid) to service_role;

create or replace function public.flush_bug_report_issues()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (
    select 1 from public.bug_reports
    where (issue_requested_at is not null and issue_number is null)
       or (status = 'resolved' and issue_number is not null and issue_closed_at is null)
  ) then
    return;
  end if;

  select s.decrypted_secret into functions_url
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_functions_url';

  select s.decrypted_secret into service_key
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_service_key';

  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/publish-report-issues',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_bug_report_issues() from public, anon, authenticated;
