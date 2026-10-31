-- Murshid schema 4/4: grants, Row Level Security, guardian summary view
--
-- Roles (Supabase): anon (no access), authenticated (student / guardian / counsellor,
-- told apart by auth.uid() lookups), service_role (backend jobs; bypasses RLS in
-- Supabase, explicit policies below document intent and cover non-Supabase Postgres).
--
--   student     : full CRUD on own rows; read-only on notifications, connections,
--                 consent_records, audit_logs, material_chunks.
--   guardian    : own guardians row + public.guardian_student_summaries only.
--   counsellor  : read students/goals/milestones/applications/achievements/cv_versions
--                 of their school's students whose latest counsellor_access consent is granted.

grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
grant usage on schema extensions to authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- Students may only edit profile fields, never identity / school / DOB.
revoke update on public.students from authenticated;
grant update (preferred_name, emirate, nationality, languages, interests, strengths) on public.students to authenticated;

-- Enable RLS everywhere + a service_role catch-all.
do $$
declare t text;
begin
  foreach t in array array[
    'schools','students','guardians','school_staff','goals','milestones','courses','materials',
    'material_chunks','opportunity_sources','opportunities','tasks','calendar_events','applications',
    'achievements','cv_versions','notifications','connections','consent_records','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy service_all on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- student-owned tables (student_id column) ----------
do $$
declare t text;
begin
  foreach t in array array['goals','courses','tasks','calendar_events','applications','achievements','cv_versions'] loop
    execute format($f$
      create policy student_all on public.%I for all to authenticated
        using (private.is_own_student(student_id))
        with check (private.is_own_student(student_id))$f$, t);
  end loop;
  foreach t in array array['goals','applications','achievements','cv_versions'] loop
    execute format($f$
      create policy counsellor_select on public.%I for select to authenticated
        using (private.counsellor_can_view(student_id))$f$, t);
  end loop;
  foreach t in array array['notifications','connections','consent_records','audit_logs'] loop
    execute format($f$
      create policy student_select on public.%I for select to authenticated
        using (private.is_own_student(student_id))$f$, t);
  end loop;
end $$;

-- ---------- students ----------
create policy student_select_self on public.students for select to authenticated
  using (auth_user_id = auth.uid());
create policy student_update_self on public.students for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy counsellor_select on public.students for select to authenticated
  using (private.counsellor_can_view(id));
-- inserts happen via service_role during onboarding (age gate + consent flow)

-- ---------- schools / staff ----------
create policy authenticated_select on public.schools for select to authenticated using (true);
create policy staff_select_self on public.school_staff for select to authenticated
  using (auth_user_id = auth.uid());

-- ---------- guardians ----------
create policy student_select on public.guardians for select to authenticated
  using (private.is_own_student(student_id));
-- a student may invite a guardian, but cannot mark consent granted/verified
create policy student_invite on public.guardians for insert to authenticated
  with check (private.is_own_student(student_id) and consent_status = 'pending' and verified_at is null and auth_user_id is null);
create policy guardian_select_self on public.guardians for select to authenticated
  using (auth_user_id = auth.uid());

-- ---------- milestones (via goal) ----------
create policy student_all on public.milestones for all to authenticated
  using (private.is_own_student(private.goal_student_id(goal_id)))
  with check (private.is_own_student(private.goal_student_id(goal_id)));
create policy counsellor_select on public.milestones for select to authenticated
  using (private.counsellor_can_view(private.goal_student_id(goal_id)));

-- ---------- materials (via course) + chunks (via material) ----------
create policy student_all on public.materials for all to authenticated
  using (private.is_own_student(private.course_student_id(course_id)))
  with check (private.is_own_student(private.course_student_id(course_id)));
create policy student_select on public.material_chunks for select to authenticated
  using (private.is_own_student(private.material_student_id(material_id)));

-- ---------- opportunities (global catalogue, read-only for users) ----------
create policy authenticated_select on public.opportunities for select to authenticated using (true);
-- opportunity_sources: service_role only

-- ---------- guardian summary view ----------
-- Runs with the view owner's rights (bypasses base-table RLS) and filters to the
-- caller's linked students, exposing aggregates only - no material, task titles,
-- notes or messages.
create view public.guardian_student_summaries with (security_barrier = true) as
select
  s.id                                   as student_id,
  coalesce(s.preferred_name, s.full_name) as display_name,
  s.grade,
  sc.name                                as school_name,
  (select count(*) from public.goals g where g.student_id = s.id and g.status = 'active')::int as active_goals,
  (select coalesce(round(avg(g.progress)), 0) from public.goals g where g.student_id = s.id and g.status = 'active')::int as avg_goal_progress,
  (select count(*) from public.tasks t where t.student_id = s.id and t.status in ('todo','doing')
     and t.due_at between now() and now() + interval '7 days')::int as tasks_due_next_7_days,
  (select count(*) from public.tasks t where t.student_id = s.id and t.status in ('todo','doing')
     and t.due_at < now())::int as tasks_overdue,
  (select count(*) from public.tasks t where t.student_id = s.id and t.status = 'done'
     and t.updated_at > now() - interval '7 days')::int as tasks_done_last_7_days,
  (select count(*) from public.applications a where a.student_id = s.id and a.status in ('submitted','accepted','rejected'))::int as applications_submitted,
  (select count(*) from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.student_id = s.id and a.status in ('saved','preparing')
       and o.deadline between now() and now() + interval '30 days')::int as application_deadlines_next_30_days,
  (select count(*) from public.achievements ac where ac.student_id = s.id)::int as achievements_count
from public.students s
left join public.schools sc on sc.id = s.school_id
where private.is_guardian_of(s.id);

revoke all on public.guardian_student_summaries from anon;
grant select on public.guardian_student_summaries to authenticated, service_role;
