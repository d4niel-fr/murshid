-- Murshid schema 1/4: extensions + enums
-- Canonical names come from docs/CONTRACT.md. Tables are snake_case plurals.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- Helper functions used by RLS live here (not exposed through PostgREST).
create schema if not exists private;

-- ---------- enums ----------
create type public.curriculum as enum ('british','indian_cbse','indian_icse','american','ib','uae_moe','other');
create type public.lms as enum ('google_classroom','teams','phoenix','managebac','toddle','other');
create type public.emirate as enum ('abu_dhabi','dubai','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah');
create type public.consent_status as enum ('pending','granted','revoked');
create type public.goal_category as enum ('academic','university','career','sport','skill','personal');
create type public.goal_status as enum ('active','done','paused');
-- Where a course / material / calendar event came from. Superset of lms values.
create type public.data_source as enum ('google_classroom','google_calendar','teams','outlook','phoenix','managebac','toddle','manual','other');
create type public.material_kind as enum ('note','assignment','announcement','exam');
create type public.task_kind as enum ('study','assignment','application','activity','habit');
create type public.task_status as enum ('todo','doing','done','skipped');
create type public.ai_use_level as enum ('none','support','led');
create type public.opportunity_type as enum ('competition','internship','scholarship','summer_program','volunteering','olympiad','mun','hackathon','course');
create type public.opportunity_status as enum ('open','closed','unknown');
create type public.application_status as enum ('saved','preparing','submitted','accepted','rejected');
create type public.achievement_category as enum ('academic','award','sport','project','volunteering','work','certificate','leadership');
create type public.cv_target as enum ('general','university','internship');
create type public.notification_channel as enum ('push','email','whatsapp','in_app');
create type public.notification_status as enum ('scheduled','sent','failed','cancelled');
create type public.notification_recipient as enum ('student','guardian','counsellor');
create type public.connection_status as enum ('pending','active','error','revoked');
create type public.staff_role as enum ('counsellor','teacher','admin');
create type public.audit_actor_type as enum ('student','guardian','counsellor','connector','agent','system');
create type public.consent_actor as enum ('student','guardian');
