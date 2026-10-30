-- Murshid schema 3/4: helper functions + triggers
-- private.* helpers are SECURITY DEFINER so RLS policies can look up ownership
-- without recursing into other tables' policies. search_path is pinned to ''.

-- ---------- updated_at ----------
create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'schools','students','guardians','school_staff','goals','milestones','courses','materials',
    'material_chunks','opportunity_sources','opportunities','tasks','calendar_events','applications',
    'achievements','cv_versions','notifications','connections','consent_records','audit_logs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- ---------- age + consent ----------
create or replace function private.age_years(dob date, at_date date default current_date) returns integer
language sql immutable set search_path = '' as $$
  select extract(year from age(at_date, dob))::integer
$$;

create or replace function private.has_guardian_consent(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardians g where g.student_id = sid and g.consent_status = 'granted'
  )
$$;

-- true when the student is under 18 AND no guardian has granted consent
create or replace function private.blocked_by_missing_consent(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.age_years(s.date_of_birth) < 18 and not private.has_guardian_consent(s.id)
    from public.students s where s.id = sid
  ), true)
$$;

-- ---------- identity helpers for RLS ----------
create or replace function private.current_student_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s where s.auth_user_id = auth.uid()
$$;

create or replace function private.is_own_student(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.students s where s.id = sid and s.auth_user_id = auth.uid())
$$;

create or replace function private.is_guardian_of(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardians g where g.student_id = sid and g.auth_user_id = auth.uid())
$$;

-- Counsellor of the student's school AND the latest counsellor_access consent is 'granted'.
create or replace function private.counsellor_can_view(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.students s
    join public.school_staff st on st.school_id = s.school_id
    where s.id = sid
      and st.auth_user_id = auth.uid()
      and st.role = 'counsellor'
      and (
        select cr.status from public.consent_records cr
        where cr.student_id = s.id and cr.scope = 'counsellor_access'
        order by cr.created_at desc, cr.id desc limit 1
      ) = 'granted'
  )
$$;

create or replace function private.goal_student_id(gid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.student_id from public.goals g where g.id = gid
$$;

create or replace function private.course_student_id(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.student_id from public.courses c where c.id = cid
$$;

create or replace function private.material_student_id(mid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.student_id from public.materials m join public.courses c on c.id = m.course_id where m.id = mid
$$;

-- ---------- integrity triggers ----------
-- Contract: 13+ only. Enforced on insert and whenever DOB changes.
create or replace function private.enforce_min_age() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.age_years(new.date_of_birth) < 13 then
    raise exception 'Murshid is for students aged 13+ (dob %)', new.date_of_birth
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger students_min_age before insert or update of date_of_birth on public.students
  for each row execute function private.enforce_min_age();

-- Contract: under 18 needs guardian consent before connectors go active.
create or replace function private.enforce_connection_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and private.blocked_by_missing_consent(new.student_id) then
    raise exception 'guardian consent required before activating a connector for a minor'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger connections_require_consent before insert or update of status on public.connections
  for each row execute function private.enforce_connection_consent();

-- Contract: under 18 needs guardian consent before notifications to anyone but the student.
create or replace function private.enforce_notification_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.recipient <> 'student' and private.blocked_by_missing_consent(new.student_id) then
    raise exception 'guardian consent required before notifying % for a minor', new.recipient
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger notifications_require_consent before insert or update of recipient on public.notifications
  for each row execute function private.enforce_notification_consent();

-- Links on tasks / parent goals / milestones must point at the same student's rows.
create or replace function private.enforce_task_links() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.linked_goal_id is not null and private.goal_student_id(new.linked_goal_id) <> new.student_id then
    raise exception 'linked_goal_id belongs to another student' using errcode = 'check_violation';
  end if;
  if new.linked_material_id is not null and private.material_student_id(new.linked_material_id) <> new.student_id then
    raise exception 'linked_material_id belongs to another student' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger tasks_link_ownership before insert or update on public.tasks
  for each row execute function private.enforce_task_links();

create or replace function private.enforce_parent_goal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_goal_id is not null and private.goal_student_id(new.parent_goal_id) <> new.student_id then
    raise exception 'parent_goal_id belongs to another student' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger goals_parent_ownership before insert or update on public.goals
  for each row execute function private.enforce_parent_goal();

-- Audit log is append-only.
create or replace function private.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();

-- ---------- retrieval ----------
-- SECURITY INVOKER: RLS on material_chunks applies, so a student only matches their own chunks.
create or replace function public.match_material_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 8,
  filter_course_id uuid default null
) returns table (id uuid, material_id uuid, chunk_text text, similarity double precision)
language sql stable set search_path = public, extensions as $$
  select mc.id, mc.material_id, mc.chunk_text, 1 - (mc.embedding <=> query_embedding) as similarity
  from public.material_chunks mc
  join public.materials m on m.id = mc.material_id
  where mc.embedding is not null
    and (filter_course_id is null or m.course_id = filter_course_id)
  order by mc.embedding <=> query_embedding
  limit match_count
$$;
