-- Saved state for the API (apps/api/src/lib/durable.ts): each store is one JSON document, written with
-- compare-and-swap on `version` so several server copies never overwrite each other.
-- Only the service role reads or writes it (RLS on, no policies).
create table if not exists public.murshid_state (
  key        text primary key,
  data       jsonb not null,
  version    bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.murshid_state enable row level security;
comment on table public.murshid_state is 'API state documents (students, school, classroom, plans, live rooms, synced app data). Service role only.';

-- Uploaded files (hand-in photos, slides, PDFs) go to a private Storage bucket, served through the API by unguessable id.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('murshid-files', 'murshid-files', false, 3145728)
    on conflict (id) do nothing;
  end if;
end $$;
