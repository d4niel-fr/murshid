-- Murshid schema 2/4: tables, constraints, indexes

-- ---------- schools & people ----------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emirate     public.emirate not null,
  curriculum  public.curriculum not null,
  lms         public.lms not null default 'other',
  domain      text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.students (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique,                       -- auth.users.id (no FK so seeds/tests run without GoTrue)
  full_name       text not null,
  preferred_name  text,
  date_of_birth   date not null,
  grade           smallint not null check (grade between 6 and 13),
  school_id       uuid references public.schools(id) on delete set null,
  curriculum      public.curriculum not null,
  emirate         public.emirate,
  nationality     text,                              -- ISO 3166-1 alpha-2 preferred
  languages       text[] not null default '{}',
  interests       text[] not null default '{}',
  strengths       text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index students_school_id_idx on public.students(school_id);

create table public.guardians (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  auth_user_id    uuid,                              -- set once the guardian signs in
  name            text not null,
  email           text,
  phone           text,                              -- E.164
  relation        text not null default 'guardian',  -- mother | father | guardian | other
  consent_status  public.consent_status not null default 'pending',
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint guardians_contact_chk check (email is not null or phone is not null)
);
create index guardians_student_id_idx on public.guardians(student_id);
create index guardians_auth_user_id_idx on public.guardians(auth_user_id);

-- Not in the contract entity list; needed for the counsellor RLS role.
create table public.school_staff (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  school_id     uuid not null references public.schools(id) on delete cascade,
  full_name     text not null,
  email         text,
  role          public.staff_role not null default 'counsellor',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index school_staff_school_id_idx on public.school_staff(school_id);

-- ---------- goals ----------
create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  title           text not null,
  category        public.goal_category not null,
  target_date     date,
  status          public.goal_status not null default 'active',
  parent_goal_id  uuid references public.goals(id) on delete set null,
  progress        smallint not null default 0 check (progress between 0 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint goals_not_own_parent check (parent_goal_id is null or parent_goal_id <> id)
);
create index goals_student_id_idx on public.goals(student_id, status);
create index goals_parent_goal_id_idx on public.goals(parent_goal_id);

create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals(id) on delete cascade,
  title       text not null,
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index milestones_goal_id_idx on public.milestones(goal_id);

-- ---------- school work ----------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  name         text not null,
  teacher      text,
  source       public.data_source not null default 'manual',
  external_id  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index courses_student_id_idx on public.courses(student_id);
create unique index courses_external_uq on public.courses(student_id, source, external_id) where external_id is not null;

create table public.materials (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  kind         public.material_kind not null,
  body_text    text,
  file_url     text,
  due_at       timestamptz,
  source       public.data_source not null default 'manual',
  external_id  text,
  ingested_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index materials_course_id_idx on public.materials(course_id);
create index materials_due_at_idx on public.materials(due_at) where due_at is not null;
create unique index materials_external_uq on public.materials(course_id, source, external_id) where external_id is not null;

-- Embeddings for retrieval over study material (768-d, model chosen by agent-gateway).
create table public.material_chunks (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials(id) on delete cascade,
  chunk_index  integer not null default 0,
  chunk_text   text not null,
  embedding    extensions.vector(768),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (material_id, chunk_index)
);
create index material_chunks_material_id_idx on public.material_chunks(material_id);
create index material_chunks_embedding_hnsw on public.material_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- opportunities ----------
create table public.opportunity_sources (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  url              text,
  kind             text not null default 'manual',   -- manual | rss | api | scrape
  active           boolean not null default true,
  last_crawled_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.opportunities (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  organizer                text not null,
  type                     public.opportunity_type not null,
  url                      text not null,
  emirate                  public.emirate,              -- null = not emirate-specific
  country                  text not null default 'AE',  -- ISO 3166-1 alpha-2, 'XX' = online/global
  min_grade                smallint check (min_grade between 6 and 13),
  max_grade                smallint check (max_grade between 6 and 13),
  eligibility_text         text,
  nationality_restriction  text,                        -- null = open to all nationalities
  cost_aed                 numeric(10,2) not null default 0 check (cost_aed >= 0),
  deadline                 timestamptz,
  tags                     text[] not null default '{}',
  source_id                uuid references public.opportunity_sources(id) on delete set null,
  last_seen_at             timestamptz not null default now(),
  status                   public.opportunity_status not null default 'unknown',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint opportunities_grade_range check (min_grade is null or max_grade is null or min_grade <= max_grade)
);
create index opportunities_status_deadline_idx on public.opportunities(status, deadline);
create index opportunities_type_idx on public.opportunities(type);
create index opportunities_tags_gin on public.opportunities using gin (tags);
create index opportunities_source_id_idx on public.opportunities(source_id);

-- ---------- tasks & calendar ----------
create table public.tasks (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references public.students(id) on delete cascade,
  title                  text not null,
  kind                   public.task_kind not null default 'study',
  due_at                 timestamptz,
  est_minutes            integer check (est_minutes is null or est_minutes > 0),
  status                 public.task_status not null default 'todo',
  linked_goal_id         uuid references public.goals(id) on delete set null,
  linked_material_id     uuid references public.materials(id) on delete set null,
  linked_opportunity_id  uuid references public.opportunities(id) on delete set null,
  ai_use_level           public.ai_use_level not null default 'none',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index tasks_student_due_idx on public.tasks(student_id, status, due_at);
create index tasks_linked_goal_idx on public.tasks(linked_goal_id);
create index tasks_linked_material_idx on public.tasks(linked_material_id);
create index tasks_linked_opportunity_idx on public.tasks(linked_opportunity_id);

create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  title        text not null,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  source       public.data_source not null default 'manual',
  external_id  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint calendar_events_time_chk check (end_at >= start_at)
);
create index calendar_events_student_start_idx on public.calendar_events(student_id, start_at);
create unique index calendar_events_external_uq on public.calendar_events(student_id, source, external_id) where external_id is not null;

-- ---------- applications, achievements, CVs ----------
create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  status          public.application_status not null default 'saved',
  checklist       jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  notes           text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, opportunity_id)
);
create index applications_opportunity_id_idx on public.applications(opportunity_id);

create table public.achievements (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  title         text not null,
  category      public.achievement_category not null,
  date          date,
  description   text,
  evidence_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index achievements_student_id_idx on public.achievements(student_id, date desc);

create table public.cv_versions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  template    text not null default 'classic',
  target      public.cv_target not null default 'general',
  "json"      jsonb not null default '{}'::jsonb,       -- JSON Resume schema
  pdf_url     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index cv_versions_student_id_idx on public.cv_versions(student_id, created_at desc);

-- ---------- notifications & connections ----------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  recipient     public.notification_recipient not null default 'student',
  channel       public.notification_channel not null,
  template      text not null,
  payload       jsonb not null default '{}'::jsonb,
  scheduled_at  timestamptz not null default now(),
  sent_at       timestamptz,
  status        public.notification_status not null default 'scheduled',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index notifications_due_idx on public.notifications(status, scheduled_at);
create index notifications_student_id_idx on public.notifications(student_id);

create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  provider      text not null,                     -- google | microsoft | phoenix | managebac | toddle | ...
  scopes        text[] not null default '{}',
  status        public.connection_status not null default 'pending',
  token_ref     text,                              -- vault reference ONLY, never a raw token
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, provider),
  constraint connections_token_ref_is_vault_ref check (
    token_ref is null
    or token_ref ~ '^vault:'
    or token_ref ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  )
);

-- ---------- privacy: consent + audit ----------
-- Shape is a starting point for the privacy team (contract: "privacy team defines").
create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  guardian_id     uuid references public.guardians(id) on delete set null,
  granted_by      public.consent_actor not null,
  scope           text not null,                   -- e.g. account | connectors | notifications | counsellor_access | ai_processing
  status          public.consent_status not null,
  policy_version  text not null default 'v1',
  method          text,                            -- e.g. email_link | otp | in_app
  evidence        jsonb not null default '{}'::jsonb,
  granted_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index consent_records_student_scope_idx on public.consent_records(student_id, scope, created_at desc);

create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor          text not null,                    -- e.g. 'connector:google_classroom', 'agent:planner', auth user id
  actor_type     public.audit_actor_type not null,
  action         text not null,                    -- e.g. 'read', 'sync', 'export', 'delete'
  resource       text not null,                    -- table or logical resource name
  resource_id    uuid,
  student_id     uuid references public.students(id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index audit_logs_student_at_idx on public.audit_logs(student_id, at desc);
create index audit_logs_actor_idx on public.audit_logs(actor, at desc);
