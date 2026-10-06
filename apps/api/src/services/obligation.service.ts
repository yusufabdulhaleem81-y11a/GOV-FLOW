import type {
  CreateObligationInput,
  EvidenceFile,
  EvidenceRequirement,
  Obligation,
  ObligationDetail,
  ObligationListItem,
  ObligationListQuery,
  Paginated,
  UpdateObligationInput,
} from '@govflow/types'
import {
  OPEN_STATUSES,
  TRANSITIONS,
  assertTransition,
  computeDue,
  mayPerform,
  todayDateOnly,
  type ObligationStatus,
  type Priority,
  type UserRole,
} from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { rows } from '../db/types.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { generateReference, evaluateCloseReadiness } from '../core/rules.js'
import { recordAudit } from './audit.service.js'
import { notifyUsers } from './notification.service.js'
import type { EmailSender } from './email.js'

export interface ServiceContext {
  db: DB
  serviceDB: DB
  email: EmailSender
  organizationId: string
  userId: string
  role: UserRole
  now?: () => Date
}

/** Obligation row with the fields services rely on, concretely typed. */
export type ObligationRowView = DbRow & {
  id: string
  title: string
  reference: string
  status: ObligationStatus
  priority: Priority
  due_date: string
  category: string | null
  department_id: string | null
  assignee_id: string | null
  reviewer_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface RequirementRow {
  id: string
  organization_id: string
  obligation_id: string
  title: string
  description: string | null
  status: string
  sort_order: number
  created_at: string
  updated_at: string
}

function isMemberRole(role: UserRole): boolean {
  return role === 'member'
}

function escapeIlike(value: string): string {
  return value.replaceAll('%', '\\%').replaceAll(',', '')
}

// ── Hydration ─────────────────────────────────────────────────────────────────

interface HydratedRefs {
  departments: Map<string, DbRow>
  profiles: Map<string, DbRow>
}

async function hydrateRefs(db: DB, rowsData: DbRow[]): Promise<HydratedRefs> {
  const deptIds = new Set<string>()
  const userIds = new Set<string>()
  for (const r of rowsData) {
    if (r.department_id) deptIds.add(r.department_id as string)
    for (const key of ['assignee_id', 'reviewer_id', 'created_by'] as const) {
      if (r[key]) userIds.add(r[key] as string)
    }
  }
  const [departments, profiles] = await Promise.all([
    deptIds.size
      ? rows<DbRow>(db.from('departments').select('id, name').in('id', [...deptIds]))
      : Promise.resolve([]),
    userIds.size
      ? rows<DbRow>(db.from('profiles').select('id, full_name, email').in('id', [...userIds]))
      : Promise.resolve([]),
  ])
  return {
    departments: new Map(departments.map((d) => [d.id as string, d])),
    profiles: new Map(profiles.map((p) => [p.id as string, p])),
  }
}

async function evidenceSummaryByObligation(
  db: DB,
  obligationIds: string[],
): Promise<Map<string, { required: number; submitted: number; accepted: number }>> {
  const map = new Map<string, { required: number; submitted: number; accepted: number }>()
  if (obligationIds.length === 0) return map
  const reqs = await rows<DbRow>(
    db
      .from('evidence_requirements')
      .select('obligation_id, status')
      .in('obligation_id', obligationIds),
  )
  for (const r of reqs) {
    const key = r.obligation_id as string
    const summary = map.get(key) ?? { required: 0, submitted: 0, accepted: 0 }
    summary.required += 1
    if (r.status === 'submitted' || r.status === 'under_review') summary.submitted += 1
    if (r.status === 'accepted') summary.accepted += 1
    map.set(key, summary)
  }
  return map
}

async function commentCounts(
  db: DB,
  obligationIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (obligationIds.length === 0) return map
  const comments = await rows<DbRow>(
    db.from('comments').select('obligation_id').in('obligation_id', obligationIds),
  )
  for (const c of comments) {
    const key = c.obligation_id as string
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export async function toListItems(
  db: DB,
  orgRows: DbRow[],
): Promise<ObligationListItem[]> {
  const refs = await hydrateRefs(db, orgRows)
  const ids = orgRows.map((r) => r.id as string)
  const [evidence, comments] = await Promise.all([
    evidenceSummaryByObligation(db, ids),
    commentCounts(db, ids),
  ])

  return orgRows.map((r) => {
    const assignee = r.assignee_id ? refs.profiles.get(r.assignee_id as string) : null
    const reviewer = r.reviewer_id ? refs.profiles.get(r.reviewer_id as string) : null
    const department = r.department_id ? refs.departments.get(r.department_id as string) : null
    const status = r.status as ObligationStatus
    const due = computeDue(r.due_date as string)
    return {
      id: r.id as string,
      reference: r.reference as string,
      title: r.title as string,
      status,
      priority: r.priority as Priority,
      category: (r.category as string | null) ?? null,
      due_date: r.due_date as string,
      tags: (r.tags as string[]) ?? [],
      department: department ? { id: department.id as string, name: department.name as string } : null,
      assignee: assignee ? { id: assignee.id as string, full_name: (assignee.full_name as string | null) ?? null } : null,
      reviewer: reviewer ? { id: reviewer.id as string, full_name: (reviewer.full_name as string | null) ?? null } : null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      is_overdue: due.bucket === 'overdue' && OPEN_STATUSES.includes(status),
      comment_count: comments.get(r.id as string) ?? 0,
      evidence: evidence.get(r.id as string) ?? { required: 0, submitted: 0, accepted: 0 },
    }
  })
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listObligations(
  ctx: ServiceContext,
  query: ObligationListQuery,
): Promise<Paginated<ObligationListItem>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const today = todayDateOnly(ctx.now?.())

  let q = ctx.db
    .from('obligations')
    .select<DbRow>('*', { count: 'exact' })
    .eq('organization_id', ctx.organizationId)

  // Responsible users only see obligations they are involved in.
  if (isMemberRole(ctx.role)) {
    q = q.or(
      `assignee_id.eq.${ctx.userId},reviewer_id.eq.${ctx.userId},created_by.eq.${ctx.userId}`,
    )
  }

  if (query.q) {
    const needle = escapeIlike(query.q)
    q = q.or(`title.ilike.%${needle}%,reference.ilike.%${needle}%,category.ilike.%${needle}%`)
  }
  if (query.status === 'all_open') {
    q = q.in('status', [...OPEN_STATUSES])
  } else if (query.status) {
    q = q.eq('status', query.status)
  }
  if (query.department_id) q = q.eq('department_id', query.department_id)
  if (query.assignee_id) q = q.eq('assignee_id', query.assignee_id)
  if (query.reviewer_id) q = q.eq('reviewer_id', query.reviewer_id)
  if (query.priority) q = q.eq('priority', query.priority)
  if (query.category) q = q.eq('category', query.category)
  if (query.overdue === 'true') {
    q = q.in('status', [...OPEN_STATUSES]).lt('due_date', today)
  }
  if (query.due_before) q = q.lte('due_date', query.due_before)
  if (query.due_after) q = q.gte('due_date', query.due_after)

  const sortColumn =
    query.sort === 'deadline' ? 'due_date' : (query.sort ?? 'created_at')
  const ascending = query.dir === 'asc'
  q = q
    .order(sortColumn, { ascending })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await q
  if (error) throw new Error(`Database error: ${error.message}`)
  const items = await toListItems(ctx.db, data ?? [])
  return { data: items, page, pageSize, total: count ?? items.length }
}

export async function getObligationOr404(ctx: ServiceContext, id: string): Promise<ObligationRowView> {
  const found = await rows<DbRow>(
    ctx.db
      .from('obligations')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .limit(1),
  )
  const obligation = found[0]
  if (!obligation) throw notFound('Obligation')

  if (isMemberRole(ctx.role)) {
    const involved =
      obligation.assignee_id === ctx.userId ||
      obligation.reviewer_id === ctx.userId ||
      obligation.created_by === ctx.userId
    if (!involved) throw notFound('Obligation')
  }
  return obligation as ObligationRowView
}

export async function getObligationDetail(
  ctx: ServiceContext,
  id: string,
): Promise<ObligationDetail> {
  const obligation = await getObligationOr404(ctx, id)
  const [requirements, files, comments] = await Promise.all([
    rows<DbRow>(
      ctx.db
        .from('evidence_requirements')
        .select('*')
        .eq('obligation_id', id)
        .order('sort_order', { ascending: true }),
    ),
    rows<DbRow>(
      ctx.db.from('evidence_files').select('*').eq('obligation_id', id).order('created_at', { ascending: false }),
    ),
    commentCounts(ctx.db, [id]),
  ])

  const refs = await hydrateRefs(ctx.db, [obligation])
  const uploaderIds = [...new Set(files.map((f) => f.uploaded_by as string))]
  const reviewerIds = files.map((f) => f.reviewed_by as string | null).filter((v): v is string => !!v)
  const extraProfiles = [...new Set([...uploaderIds, ...reviewerIds])]
  const fileProfiles = extraProfiles.length
    ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', extraProfiles))
    : []
  const profileById = new Map(fileProfiles.map((p) => [p.id as string, p]))

  const dept = obligation.department_id
    ? refs.departments.get(obligation.department_id as string)
    : null
  const profileFor = (uid: unknown) => {
    const p = uid ? refs.profiles.get(uid as string) : null
    return p ? { id: p.id as string, full_name: (p.full_name as string | null) ?? null, email: (p.email as string | null) ?? null, job_title: null, created_at: '' } : null
  }

  return {
    ...(obligation as unknown as Obligation),
    department: dept
      ? ({ id: dept.id as string, name: dept.name as string, organization_id: ctx.organizationId, description: null, created_at: '', updated_at: '' })
      : null,
    assignee: profileFor(obligation.assignee_id),
    reviewer: profileFor(obligation.reviewer_id),
    creator: profileFor(obligation.created_by),
    requirements: requirements.map((r) => r as unknown as EvidenceRequirement),
    files: files.map((f) => ({
      ...(f as unknown as EvidenceFile),
      uploader: (profileById.get(f.uploaded_by as string) ?? null) as EvidenceFile['uploader'],
      reviewer: (f.reviewed_by ? (profileById.get(f.reviewed_by as string) ?? null) : null) as EvidenceFile['reviewer'],
    })),
    comment_count: comments.get(id) ?? 0,
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

async function assertUserInOrg(ctx: ServiceContext, userId: string, label: string): Promise<void> {
  const found = await rows<DbRow>(
    ctx.db
      .from('organization_members')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', userId)
      .limit(1),
  )
  if (found.length === 0) throw badRequest(`${label} must be a member of your organization`)
}

async function assertDepartmentInOrg(ctx: ServiceContext, departmentId: string): Promise<void> {
  const found = await rows<DbRow>(
    ctx.db
      .from('departments')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('id', departmentId)
      .limit(1),
  )
  if (found.length === 0) throw badRequest('Department not found in your organization')
}

export async function createObligation(
  ctx: ServiceContext,
  input: CreateObligationInput,
): Promise<ObligationDetail> {
  if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw forbidden('Only managers or admins can create obligations')
  }
  if (input.assignee_id) await assertUserInOrg(ctx, input.assignee_id, 'Responsible user')
  if (input.reviewer_id) await assertUserInOrg(ctx, input.reviewer_id, 'Reviewer')
  if (input.department_id) await assertDepartmentInOrg(ctx, input.department_id)

  const status: ObligationStatus = input.publish === false ? 'draft' : 'open'
  let inserted: DbRow | undefined
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const { data, error } = await ctx.db
      .from('obligations')
      .insert({
        organization_id: ctx.organizationId,
        reference: generateReference(),
        title: input.title,
        description: input.description ?? null,
        department_id: input.department_id ?? null,
        assignee_id: input.assignee_id ?? null,
        reviewer_id: input.reviewer_id ?? null,
        created_by: ctx.userId,
        status,
        priority: input.priority ?? 'medium',
        category: input.category ?? null,
        source_reference: input.source_reference ?? null,
        tags: input.tags ?? [],
        due_date: input.due_date,
        escalation_enabled: input.escalation_enabled ?? true,
        escalate_after_days: input.escalate_after_days ?? 3,
      })
      .select()
    if (error) {
      if (error.code === '23505') continue // reference collision — regenerate
      throw new Error(`Database error: ${error.message}`)
    }
    inserted = (data ?? [])[0]
  }
  if (!inserted) throw new Error('Could not generate a unique obligation reference')

  if (input.requirements.length > 0) {
    const { error } = await ctx.db.from('evidence_requirements').insert(
      input.requirements.map((r, i) => ({
        organization_id: ctx.organizationId,
        obligation_id: inserted.id,
        title: r.title,
        description: r.description ?? null,
        status: 'pending',
        sort_order: i,
      })),
    )
    if (error) throw new Error(`Database error: ${error.message}`)
  }

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'obligation_created',
    entityType: 'obligation',
    entityId: inserted.id as string,
    summary: `Created obligation "${input.title}" (${inserted.reference as string})`,
    newValues: { status, due_date: input.due_date, priority: input.priority ?? 'medium' },
  })

  if (input.assignee_id) {
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'obligation_assigned',
      entityType: 'obligation',
      entityId: inserted.id as string,
      summary: `Assigned "${input.title}" to a responsible user`,
      newValues: { assignee_id: input.assignee_id },
    })
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: [input.assignee_id],
      type: 'obligation_assigned',
      title: `New obligation assigned: ${input.title}`,
      body: `You are responsible for "${input.title}". Deadline: ${input.due_date}.`,
      obligationId: inserted.id as string,
    })
  }
  if (input.reviewer_id) {
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: [input.reviewer_id],
      type: 'obligation_assigned',
      title: `You are the reviewer of: ${input.title}`,
      body: `You will review evidence for "${input.title}". Deadline: ${input.due_date}.`,
      obligationId: inserted.id as string,
    })
  }

  return getObligationDetail(ctx, inserted.id as string)
}

export async function updateObligation(
  ctx: ServiceContext,
  id: string,
  patch: UpdateObligationInput,
): Promise<ObligationDetail> {
  const obligation = await getObligationOr404(ctx, id)
  const isManager = ctx.role === 'admin' || ctx.role === 'manager'
  const isCreator = obligation.created_by === ctx.userId
  if (!isManager && !isCreator) throw forbidden('Only managers or the creator can edit this obligation')

  if (patch.assignee_id) await assertUserInOrg(ctx, patch.assignee_id, 'Responsible user')
  if (patch.reviewer_id) await assertUserInOrg(ctx, patch.reviewer_id, 'Reviewer')
  if (patch.department_id) await assertDepartmentInOrg(ctx, patch.department_id)

  const oldDue = obligation.due_date as string
  const oldAssignee = obligation.assignee_id as string | null
  const { data, error } = await ctx.db.from('obligations').update(patch as unknown as DbRow).eq('id', id).select()
  if (error) throw new Error(`Database error: ${error.message}`)
  const updated = (data ?? [])[0]
  if (!updated) throw notFound('Obligation')

  if (patch.due_date && patch.due_date !== oldDue) {
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'deadline_changed',
      entityType: 'obligation',
      entityId: id,
      summary: `Changed deadline from ${oldDue} to ${patch.due_date}`,
      oldValues: { due_date: oldDue },
      newValues: { due_date: patch.due_date },
    })
  }

  const changedFields = Object.keys(patch).filter(
    (k) => k !== 'due_date' && (patch as Record<string, unknown>)[k] !== undefined,
  )
  if (changedFields.length > 0) {
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'obligation_updated',
      entityType: 'obligation',
      entityId: id,
      summary: `Updated ${changedFields.join(', ')}`,
      newValues: patch as Record<string, unknown>,
    })
  }

  if (patch.assignee_id && patch.assignee_id !== oldAssignee) {
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'obligation_assigned',
      entityType: 'obligation',
      entityId: id,
      summary: 'Reassigned the obligation to a new responsible user',
      oldValues: { assignee_id: oldAssignee },
      newValues: { assignee_id: patch.assignee_id },
    })
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: [patch.assignee_id],
      type: 'obligation_assigned',
      title: `New obligation assigned: ${obligation.title as string}`,
      obligationId: id,
    })
  }

  return getObligationDetail(ctx, id)
}

export async function transitionObligation(
  ctx: ServiceContext,
  id: string,
  action: 'open' | 'start_progress' | 'submit_for_review' | 'request_changes' | 'reopen' | 'cancel',
  note?: string,
): Promise<ObligationDetail> {
  const obligation = await getObligationOr404(ctx, id)
  const from = obligation.status as ObligationStatus
  const rule = assertTransition(from, action)

  const actor = {
    userId: ctx.userId,
    role: ctx.role,
    isAssignee: obligation.assignee_id === ctx.userId,
    isReviewer: obligation.reviewer_id === ctx.userId,
    isCreator: obligation.created_by === ctx.userId,
  }
  if (!mayPerform(action, actor)) {
    throw forbidden(`You are not allowed to ${TRANSITIONS[action].label.toLowerCase()} on this obligation`)
  }

  const to = rule.to
  const { error } = await ctx.db.from('obligations').update({ status: to }).eq('id', id)
  if (error) throw new Error(`Database error: ${error.message}`)

  const auditAction =
    action === 'cancel' ? ('obligation_cancelled' as const) : ('obligation_status_changed' as const)
  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: auditAction,
    entityType: 'obligation',
    entityId: id,
    summary: `${rule.label}${note ? ` — ${note}` : ''}`,
    oldValues: { status: from },
    newValues: { status: to },
  })

  const notifyIds = [obligation.assignee_id, obligation.reviewer_id].filter(
    (v) => v && v !== ctx.userId,
  )
  if (action === 'submit_for_review') {
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: notifyIds,
      type: 'evidence_submitted',
      title: `Ready for review: ${obligation.title as string}`,
      body: `${obligation.reference as string} was submitted for review.`,
      obligationId: id,
    })
  } else if (action === 'request_changes') {
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: notifyIds,
      type: 'changes_requested',
      title: `Changes requested: ${obligation.title as string}`,
      body: note ?? 'The reviewer requested changes before this obligation can proceed.',
      obligationId: id,
    })
  } else if (action === 'cancel') {
    await notifyUsers(ctx.serviceDB, ctx.email, {
      organizationId: ctx.organizationId,
      userIds: notifyIds,
      type: 'obligation_cancelled',
      title: `Obligation cancelled: ${obligation.title as string}`,
      body: note ?? undefined,
      obligationId: id,
    })
  }

  return getObligationDetail(ctx, id)
}

export async function closeObligation(
  ctx: ServiceContext,
  id: string,
  note?: string,
): Promise<ObligationDetail> {
  const obligation = await getObligationOr404(ctx, id)
  const from = obligation.status as ObligationStatus
  const rule = assertTransition(from, 'close')

  const actor = {
    userId: ctx.userId,
    role: ctx.role,
    isAssignee: obligation.assignee_id === ctx.userId,
    isReviewer: obligation.reviewer_id === ctx.userId,
    isCreator: obligation.created_by === ctx.userId,
  }
  if (!mayPerform('close', actor)) {
    throw forbidden('Only the assigned reviewer, a manager or an admin can close this obligation')
  }

  const requirements = await rows<DbRow>(
    ctx.db.from('evidence_requirements').select('id, title, status').eq('obligation_id', id),
  )
  const readiness = evaluateCloseReadiness(
    requirements.map((r) => ({ id: r.id as string, title: r.title as string, status: r.status as never })),
  )
  if (!readiness.ok) {
    throw conflict(`Cannot close: ${readiness.reason}`)
  }

  const { error } = await ctx.db
    .from('obligations')
    .update({ status: 'closed', closed_at: (ctx.now?.() ?? new Date()).toISOString(), closed_by: ctx.userId })
    .eq('id', id)
  if (error) throw new Error(`Database error: ${error.message}`)

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'obligation_closed',
    entityType: 'obligation',
    entityId: id,
    summary: `Closed obligation "${obligation.title as string}"${note ? ` — ${note}` : ''}`,
    oldValues: { status: from },
    newValues: { status: rule.to },
  })
  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: [obligation.assignee_id, obligation.reviewer_id, obligation.created_by].filter(
      (v) => v && v !== ctx.userId,
    ),
    type: 'obligation_closed',
    title: `Obligation closed: ${obligation.title as string}`,
    obligationId: id,
  })

  return getObligationDetail(ctx, id)
}
