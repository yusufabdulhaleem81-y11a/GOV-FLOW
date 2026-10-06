-- ═══════════════════════════════════════════════════════════════════════════
-- GovFlow 0002 — Row Level Security
--
-- Organization isolation is enforced here as an independent defense layer
-- behind the API's own authorization checks. A user can only ever see rows
-- belonging to organizations they are a member of, and can only write rows
-- their role allows.
-- ═══════════════════════════════════════════════════════════════════════════

-- Membership helper. SECURITY DEFINER so policies on organization_members do
-- not recurse. Null role = any role.
create or replace function public.is_org_member(_org uuid, _roles public.user_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = _org
      and m.user_id = auth.uid()
      and (_roles is null or m.role = any(_roles))
  );
$$;

-- ── organizations ────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

create policy "org_select_members" on public.organizations
  for select to authenticated using (public.is_org_member(id));

create policy "org_insert_authenticated" on public.organizations
  for insert to authenticated with check (true);

create policy "org_update_admin" on public.organizations
  for update to authenticated
  using (public.is_org_member(id, array['admin']::public.user_role[]))
  with check (public.is_org_member(id, array['admin']::public.user_role[]));

-- ── profiles ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profile_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profile_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── organization_members ─────────────────────────────────────────────────────
alter table public.organization_members enable row level security;

create policy "member_select_org" on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));

create policy "member_insert_self_or_admin" on public.organization_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_org_member(organization_id, array['admin']::public.user_role[])
  );

create policy "member_update_admin" on public.organization_members
  for update to authenticated
  using (public.is_org_member(organization_id, array['admin']::public.user_role[]))
  with check (public.is_org_member(organization_id, array['admin']::public.user_role[]));

create policy "member_delete_self_or_admin" on public.organization_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id, array['admin']::public.user_role[])
  );

-- ── departments ──────────────────────────────────────────────────────────────
alter table public.departments enable row level security;

create policy "dept_select_member" on public.departments
  for select to authenticated using (public.is_org_member(organization_id));

create policy "dept_insert_manager" on public.departments
  for insert to authenticated
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

create policy "dept_update_manager" on public.departments
  for update to authenticated
  using (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]))
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

create policy "dept_delete_admin" on public.departments
  for delete to authenticated
  using (public.is_org_member(organization_id, array['admin']::public.user_role[]));

-- ── obligations ──────────────────────────────────────────────────────────────
alter table public.obligations enable row level security;

create policy "obligation_select_member" on public.obligations
  for select to authenticated using (public.is_org_member(organization_id));

create policy "obligation_insert_manager" on public.obligations
  for insert to authenticated
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

create policy "obligation_update_involved" on public.obligations
  for update to authenticated
  using (
    public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[])
    or assignee_id = auth.uid()
    or reviewer_id = auth.uid()
    or created_by = auth.uid()
  )
  with check (
    public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[])
    or assignee_id = auth.uid()
    or reviewer_id = auth.uid()
    or created_by = auth.uid()
  );

-- No delete policy: obligations are cancelled, never hard-deleted.

-- ── evidence_requirements ────────────────────────────────────────────────────
alter table public.evidence_requirements enable row level security;

create policy "evreq_select_member" on public.evidence_requirements
  for select to authenticated using (public.is_org_member(organization_id));

create policy "evreq_insert_manager" on public.evidence_requirements
  for insert to authenticated
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

create policy "evreq_update_involved" on public.evidence_requirements
  for update to authenticated
  using (
    public.is_org_member(organization_id, array['admin', 'manager', 'reviewer']::public.user_role[])
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id
        and (o.assignee_id = auth.uid() or o.reviewer_id = auth.uid() or o.created_by = auth.uid())
    )
  )
  with check (
    public.is_org_member(organization_id, array['admin', 'manager', 'reviewer']::public.user_role[])
    or exists (
      select 1 from public.obligations o
      where o.id = obligation_id
        and (o.assignee_id = auth.uid() or o.reviewer_id = auth.uid() or o.created_by = auth.uid())
    )
  );

create policy "evreq_delete_admin" on public.evidence_requirements
  for delete to authenticated
  using (public.is_org_member(organization_id, array['admin']::public.user_role[]));

-- ── evidence_files ───────────────────────────────────────────────────────────
alter table public.evidence_files enable row level security;

create policy "evfile_select_member" on public.evidence_files
  for select to authenticated using (public.is_org_member(organization_id));

create policy "evfile_insert_member" on public.evidence_files
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "evfile_update_reviewer" on public.evidence_files
  for update to authenticated
  using (public.is_org_member(organization_id, array['admin', 'manager', 'reviewer']::public.user_role[]))
  with check (public.is_org_member(organization_id, array['admin', 'manager', 'reviewer']::public.user_role[]));

-- No delete policy: evidence is immutable once submitted.

-- ── comments ─────────────────────────────────────────────────────────────────
alter table public.comments enable row level security;

create policy "comment_select_member" on public.comments
  for select to authenticated using (public.is_org_member(organization_id));

create policy "comment_insert_member" on public.comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_org_member(organization_id));

-- No delete policy: comments are part of the record.

-- ── handovers ────────────────────────────────────────────────────────────────
alter table public.handovers enable row level security;

create policy "handover_select_member" on public.handovers
  for select to authenticated using (public.is_org_member(organization_id));

create policy "handover_insert_member" on public.handovers
  for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "handover_update_manager" on public.handovers
  for update to authenticated
  using (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]))
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

-- ── escalations ──────────────────────────────────────────────────────────────
alter table public.escalations enable row level security;

create policy "escalation_select_member" on public.escalations
  for select to authenticated using (public.is_org_member(organization_id));

create policy "escalation_insert_manager" on public.escalations
  for insert to authenticated
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

create policy "escalation_update_manager" on public.escalations
  for update to authenticated
  using (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]))
  with check (public.is_org_member(organization_id, array['admin', 'manager']::public.user_role[]));

-- ── notifications ────────────────────────────────────────────────────────────
-- Inserts happen exclusively through the API's service client (system actor).
alter table public.notifications enable row level security;

create policy "notification_select_owner" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notification_update_owner" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notification_delete_owner" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ── audit_events (append-only) ───────────────────────────────────────────────
alter table public.audit_events enable row level security;

create policy "audit_select_member" on public.audit_events
  for select to authenticated using (public.is_org_member(organization_id));

create policy "audit_insert_member" on public.audit_events
  for insert to authenticated
  with check (public.is_org_member(organization_id));

-- Deliberately NO update / delete policies: history is immutable.

-- ── Storage: private evidence-files bucket ───────────────────────────────────
-- Path convention: {organization_id}/{obligation_id}/{uuid}.{ext}

create policy "storage_evidence_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "storage_evidence_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence-files'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "storage_evidence_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.is_org_member(((storage.foldername(name))[1])::uuid, array['admin', 'manager']::public.user_role[])
  );
