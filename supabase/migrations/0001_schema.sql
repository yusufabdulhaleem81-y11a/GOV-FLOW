-- ═══════════════════════════════════════════════════════════════════════════
-- GovFlow 0001 — schema: enums, tables, indexes, triggers, storage bucket
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'manager', 'reviewer', 'member', 'viewer');
create type public.obligation_status as enum (
  'draft', 'open', 'in_progress', 'awaiting_evidence', 'under_review',
  'changes_requested', 'overdue', 'escalated', 'closed', 'cancelled'
);
create type public.obligation_priority as enum ('low', 'medium', 'high', 'critical');
create type public.evidence_status as enum ('pending', 'submitted', 'under_review', 'accepted', 'rejected');
create type public.handover_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.escalation_status as enum ('active', 'resolved');

-- ── Organizations & identity ─────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_members_user on public.organization_members (user_id);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- ── Obligations (the core entity) ────────────────────────────────────────────
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  title text not null,
  description text,
  department_id uuid references public.departments (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  status public.obligation_status not null default 'draft',
  priority public.obligation_priority not null default 'medium',
  category text,
  source_reference text,
  tags text[] not null default '{}',
  due_date date not null,
  escalation_enabled boolean not null default true,
  escalate_after_days integer not null default 3,
  previous_status public.obligation_status,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);
create index idx_obligations_org_status on public.obligations (organization_id, status);
create index idx_obligations_org_due on public.obligations (organization_id, due_date);
create index idx_obligations_assignee on public.obligations (assignee_id) where assignee_id is not null;
create index idx_obligations_reviewer on public.obligations (reviewer_id) where reviewer_id is not null;

-- ── Evidence ─────────────────────────────────────────────────────────────────
create table public.evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  title text not null,
  description text,
  status public.evidence_status not null default 'pending',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_evidence_req_obligation on public.evidence_requirements (obligation_id);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  requirement_id uuid references public.evidence_requirements (id) on delete set null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null,
  sha256 text,
  status public.evidence_status not null default 'submitted',
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_evidence_files_obligation on public.evidence_files (obligation_id);
create index idx_evidence_files_org on public.evidence_files (organization_id, status);

-- ── Collaboration ────────────────────────────────────────────────────────────
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_comments_obligation on public.comments (obligation_id);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  from_user_id uuid references public.profiles (id) on delete set null,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  status public.handover_status not null default 'pending',
  reason text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_handovers_org_status on public.handovers (organization_id, status);

create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  escalated_by uuid references public.profiles (id) on delete set null,
  reason text,
  status public.escalation_status not null default 'active',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolved_to_status public.obligation_status,
  created_at timestamptz not null default now()
);
create index idx_escalations_org_status on public.escalations (organization_id, status);

-- ── Notifications & audit ────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  obligation_id uuid references public.obligations (id) on delete cascade,
  data jsonb not null default '{}',
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, read_at);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null default 'obligation',
  entity_id uuid,
  summary text not null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_events_org_time on public.audit_events (organization_id, created_at desc);
create index idx_audit_events_entity on public.audit_events (entity_id) where entity_id is not null;

-- ── Triggers ─────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_departments_updated before update on public.departments
  for each row execute function public.set_updated_at();
create trigger trg_obligations_updated before update on public.obligations
  for each row execute function public.set_updated_at();
create trigger trg_evidence_requirements_updated before update on public.evidence_requirements
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a Supabase auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Private evidence storage bucket ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('evidence-files', 'evidence-files', false)
on conflict (id) do nothing;
