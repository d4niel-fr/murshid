-- Murshid: billing (Single plan), idempotency keys, assignment forms, and indexes for the hottest queries.

-- ---------------------------------------------------------------- billing
-- Only the Single plan is sold online. A school licence is set up with the school (see schools / licences).
create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  order_id         text not null unique,
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name             text not null,
  student_id       uuid references public.students(id) on delete set null,
  plan             text not null default 'single' check (plan = 'single'),
  billing          text not null check (billing in ('monthly', 'yearly')),
  amount_aed       integer not null check (amount_aed > 0),
  status           text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  started_at       timestamptz not null default now(),
  renews_at        timestamptz not null,
  canceled_at      timestamptz,
  created_at       timestamptz not null default now()
);
-- one active plan per email: the database itself refuses a duplicate subscription
create unique index subscriptions_one_active_per_email on public.subscriptions (lower(email)) where status = 'active';
create index subscriptions_student_id_idx on public.subscriptions (student_id) where student_id is not null;
create index subscriptions_renewals_idx on public.subscriptions (renews_at) where status = 'active';

-- ---------------------------------------------------------------- idempotency
-- A POST carrying an Idempotency-Key is stored once; a retry returns the stored response instead of acting twice.
create table public.idempotency_keys (
  key            text not null,
  scope          text not null,                  -- method + path (+ actor)
  request_hash   text not null,
  status_code    integer,
  response       jsonb,
  created_at     timestamptz not null default now(),
  primary key (scope, key)
);
create index idempotency_keys_created_at_idx on public.idempotency_keys (created_at);   -- nightly cleanup of keys older than 24 h

-- ---------------------------------------------------------------- assignments and forms
create table public.school_assignments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  class_id       text not null,
  teacher_id     uuid references public.school_staff(id) on delete set null,
  title          text not null check (char_length(title) between 3 and 140),
  instructions   text,
  format         text not null default 'task' check (format in ('task', 'form', 'google_form', 'microsoft_form')),
  form_url       text check (
                   (format = 'google_form' and form_url ~ '^https://(docs\.google\.com/forms/|forms\.gle/)')
                   or (format = 'microsoft_form' and form_url ~ '^https://(forms\.office\.com/|forms\.microsoft\.com/|forms\.cloud\.microsoft/)')
                   or (format in ('task', 'form') and form_url is null)),
  questions      jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  set_date       date not null,
  due_date       date not null check (due_date > set_date),
  minutes        integer not null default 45 check (minutes between 10 and 240),
  created_at     timestamptz not null default now()
);
create index school_assignments_class_due_idx on public.school_assignments (class_id, due_date desc);
create index school_assignments_school_id_idx on public.school_assignments (school_id);

create table public.assignment_responses (
  assignment_id  uuid not null references public.school_assignments(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  answers        jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (assignment_id, student_id)        -- one response per student: resubmitting updates it
);
create index assignment_responses_student_idx on public.assignment_responses (student_id, submitted_at desc);

-- ---------------------------------------------------------------- hot-path indexes
-- the planner and Today list read a student's open tasks by due date
create index tasks_open_by_due_idx on public.tasks (student_id, due_at) where status in ('todo', 'doing');
-- the notification worker only ever scans scheduled rows
create index notifications_scheduled_idx on public.notifications (scheduled_at) where status = 'scheduled';
-- opportunity matching filters open listings by deadline
create index opportunities_open_deadline_idx on public.opportunities (deadline) where status = 'open';

-- ---------------------------------------------------------------- row level security
alter table public.subscriptions enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.school_assignments enable row level security;
alter table public.assignment_responses enable row level security;
-- service role only (the API) for billing and idempotency; staff and students reach assignments through the API.
