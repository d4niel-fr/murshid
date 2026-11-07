-- Murshid validation survey: anonymous responses (no names, emails or IDs; optional grade/role only).
-- Anyone with the public (anon) key may INSERT; nobody may SELECT directly. Results are read through
-- survey_results(code), which checks a code held only in the API's server-side env (SURVEY_ADMIN_CODE).
create table if not exists public.survey_responses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  version text not null check (version in ('student', 'teacher')),
  answers jsonb not null,
  consent boolean not null check (consent = true)
);
alter table public.survey_responses enable row level security;
-- the anon key may only insert (granted explicitly: new tables get no anon grants by default, see migration 7)
revoke all on public.survey_responses from anon, authenticated;
grant insert on public.survey_responses to anon, authenticated;
drop policy if exists survey_insert on public.survey_responses;
create policy survey_insert on public.survey_responses for insert to anon, authenticated
  with check (consent = true and version in ('student', 'teacher') and pg_column_size(answers) < 8000);

create table if not exists public.survey_config (k text primary key, v text not null);
alter table public.survey_config enable row level security; -- no policies: not readable with the anon key
insert into public.survey_config (k, v) values ('admin_code', 'REPLACE_WITH_SURVEY_ADMIN_CODE')
  on conflict (k) do update set v = excluded.v;

create or replace function public.survey_results(code text)
returns setof public.survey_responses
language plpgsql security definer set search_path = public as $$
begin
  -- the code must be set (not the placeholder) and long enough that guessing it through the public API is hopeless
  if code is null or length(code) < 24
     or (select v from survey_config where k = 'admin_code') in ('REPLACE_WITH_SURVEY_ADMIN_CODE', '')
     or code <> (select v from survey_config where k = 'admin_code') then
    raise exception 'not allowed';
  end if;
  return query select * from survey_responses order by created_at desc limit 5000;
end $$;
revoke all on function public.survey_results(text) from public;
grant execute on function public.survey_results(text) to anon, authenticated;
