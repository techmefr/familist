-- A resolved report leaves the administration screen after two weeks instead of three months.
--
-- Once the work is done, the commit and its issue are the trace; the report itself, with its free text and
-- the path it was filed from, only keeps personal data longer than it is useful. Two weeks leave room to
-- check that the fix holds. Open reports keep their six months, and the crash log its three.
create or replace function public.purge_diagnostics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bug_reports
  where status = 'resolved'
    and coalesce(resolved_at, created_at) < now() - interval '14 days';

  delete from public.bug_reports
  where status = 'open'
    and created_at < now() - interval '6 months';

  delete from public.client_errors
  where last_seen_at < now() - interval '3 months';
end;
$$;

revoke all on function public.purge_diagnostics() from public, anon, authenticated;
