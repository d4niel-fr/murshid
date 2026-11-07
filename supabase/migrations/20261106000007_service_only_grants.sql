-- Defense in depth for tables only the API (service role) uses.
--
-- Every public table has row level security on, and these have no policies for anon or authenticated, so the
-- browser keys already see no rows. Supabase still grants new tables to anon and authenticated by default, so a
-- policy added by mistake later would open them. Take the grants away too: only the service role keeps access.
do $$
declare t text;
begin
  foreach t in array array['murshid_state', 'subscriptions', 'idempotency_keys', 'school_assignments', 'assignment_responses', 'opportunity_sources'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- The anon key (public, in every browser) never reads or writes tables directly. Tables created from now on get no
-- anon grants unless a migration grants them on purpose (the survey grants its one insert explicitly).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
