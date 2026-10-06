import type { Escalation, ObligationStatus, ScanResponse } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { mutation, rows } from '../db/types.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { decideScanActions } from '../core/escalation-policy.js'
import { recordAudit } from './audit.service.js'
import { notifyUsers } from './notification.service.js'
import type { ServiceContext } from './obligation.service.js'

export interface EscalationWithRefs extends Escalation {
  obligation_reference?: string
  obligation_title?: string
}

const OPEN_ACTIVE_STATUSES: ObligationStatus[] = [
  'open',
  'in_progress',
  'awaiting_evidence',
  'changes_requested',
  'under_review',
  'overdue',
]

export async function listEscalations(
  ctx: ServiceContext,
  status?: string,
): Promise<EscalationWithRefs[]> {
  let q = ctx.db
    .from('escalations')
    .select<DbRow>('*')
    .eq('organization_id', ctx.organizationId)
  if (status) q = q.eq('status', status)
  const escalations = await rows<DbRow>(q.order('created_at', { ascending: false }).limit(100))

  let filtered = escalations
  if (ctx.role === 'member') {
    const obligationIds = [...new Set(escalations.map((e) => e.obligation_id as string))]
    const obligations = obligationIds.length
      ? await rows<DbRow>(
          ctx.db
            .from('obligations')
            .select('id')
            .in('id', obligationIds)
            .or(`assignee_id.eq.${ctx.userId},reviewer_id.eq.${ctx.userId},created_by.eq.${ctx.userId}`),
        )
      : []
    const visible = new Set(obligations.map((o) => o.id as string))
    filtered = escalations.filter((e) => visible.has(e.obligation_id as string))
  }

  const obligationIds = [...new Set(filtered.map((e) => e.obligation_id as string))]
  const obligations = obligationIds.length
    ? await rows<DbRow>(ctx.db.from('obligations').select('id, reference, title').in('id', obligationIds))
    : []
  const obById = new Map(obligations.map((o) => [o.id as string, o]))
  const escalatorIds = [...new Set(filtered.map((e) => e.escalated_by as string | null).filter((v): v is string => !!v))]
  const profiles = escalatorIds.length
    ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', escalatorIds))
    : []
  const profileById = new Map(profiles.map((p) => [p.id as string, p]))

  return filtered.map((e) => ({
    ...(e as unknown as Escalation),
    escalator: (e.escalated_by ? (profileById.get(e.escalated_by as string) ?? null) : null) as Escalation['escalator'],
    obligation_reference: (obById.get(e.obligation_id as string)?.reference as string) ?? '',
    obligation_title: (obById.get(e.obligation_id as string)?.title as string) ?? '',
  }))
}

export async function escalateObligation(
  ctx: ServiceContext,
  obligationId: string,
  reason: string,
): Promise<Escalation> {
  if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw forbidden('Only managers or admins can escalate obligations')
  }
  const found = await rows<DbRow>(
    ctx.db
      .from('obligations')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', obligationId)
      .limit(1),
  )
  const obligation = found[0] as
    | { id: string; title: string; status: ObligationStatus; assignee_id: string | null; reviewer_id: string | null; previous_status?: ObligationStatus | null }
    | undefined
  if (!obligation) throw notFound('Obligation')
  const from = obligation.status as ObligationStatus
  if (!OPEN_ACTIVE_STATUSES.includes(from)) {
    throw badRequest(`An obligation in status "${from.replaceAll('_', ' ')}" cannot be escalated`)
  }

  const escalation = (
    await mutation<DbRow>(
      ctx.db
        .from('escalations')
        .insert({
          organization_id: ctx.organizationId,
          obligation_id: obligationId,
          escalated_by: ctx.userId,
          reason,
          status: 'active',
        })
        .select(),
    )
  )[0]
  if (!escalation) throw new Error('Failed to create escalation')

  await ctx.db
    .from('obligations')
    .update({ status: 'escalated', previous_status: from })
    .eq('id', obligationId)

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'obligation_escalated',
    entityType: 'obligation',
    entityId: obligationId,
    summary: `Escalated "${obligation.title as string}" — ${reason}`,
    oldValues: { status: from },
    newValues: { status: 'escalated' },
  })
  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: [obligation.assignee_id, obligation.reviewer_id].filter((v) => v && v !== ctx.userId),
    type: 'obligation_escalated',
    title: `Obligation escalated: ${obligation.title as string}`,
    body: reason,
    obligationId,
  })

  return escalation as unknown as Escalation
}

export async function resolveEscalation(
  ctx: ServiceContext,
  escalationId: string,
  note?: string,
): Promise<Escalation> {
  if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    throw forbidden('Only managers or admins can resolve escalations')
  }
  const found = await rows<DbRow>(
    ctx.db
      .from('escalations')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', escalationId)
      .limit(1),
  )
  const escalation = found[0] as
    | { id: string; status: string; obligation_id: string; reason: string | null }
    | undefined
  if (!escalation) throw notFound('Escalation')
  if (escalation.status !== 'active') throw badRequest('This escalation was already resolved')

  const obligationId = escalation.obligation_id as string
  const obligations = await rows<DbRow>(
    ctx.db.from('obligations').select('id, previous_status, status').eq('organization_id', ctx.organizationId).eq('id', obligationId).limit(1),
  )
  const obligation = obligations[0]
  const restoreTo = (obligation?.previous_status as ObligationStatus | null) ?? 'in_progress'

  const updated = (
    await mutation<DbRow>(
      ctx.db
        .from('escalations')
        .update({
          status: 'resolved',
          resolved_by: ctx.userId,
          resolved_at: (ctx.now?.() ?? new Date()).toISOString(),
          resolved_to_status: restoreTo,
          ...(note ? { reason: `${escalation.reason as string | null ?? ''} | Resolution: ${note}` } : {}),
        })
        .eq('id', escalationId)
        .select(),
    )
  )[0]
  if (!updated) throw new Error('Failed to resolve escalation')

  if (obligation && (obligation.status as string) === 'escalated') {
    await ctx.db
      .from('obligations')
      .update({ status: restoreTo, previous_status: null })
      .eq('id', obligationId)
  }

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'escalation_resolved',
    entityType: 'obligation',
    entityId: obligationId,
    summary: `Escalation resolved${note ? ` — ${note}` : ''}`,
    oldValues: { status: 'escalated' },
    newValues: { status: restoreTo },
  })

  return updated as unknown as Escalation
}

/**
 * Deadline & escalation sweep. Runs with the service client (system actor) so
 * it can sweep every organization. Designed to be invoked by a scheduled cron
 * job or an authenticated admin ("escalation:scan" permission).
 */
export async function runDeadlineScan(
  serviceDB: DB,
  email: Parameters<typeof notifyUsers>[1],
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<ScanResponse> {
  const now = options.now ?? new Date()
  const all = await rows<DbRow>(serviceDB.from('obligations').select('id, organization_id, title, reference, status, due_date, assignee_id, reviewer_id, escalation_enabled, escalate_after_days'))
  const decisions = decideScanActions(
    all.map((r) => ({
      id: r.id as string,
      organization_id: r.organization_id as string,
      title: r.title as string,
      reference: r.reference as string,
      status: r.status as ObligationStatus,
      due_date: r.due_date as string,
      assignee_id: (r.assignee_id as string | null) ?? null,
      reviewer_id: (r.reviewer_id as string | null) ?? null,
      escalation_enabled: (r.escalation_enabled as boolean) ?? true,
      escalate_after_days: (r.escalate_after_days as number) ?? 3,
    })),
    now,
  )

  let markedOverdue = 0
  let autoEscalated = 0
  let reminders = 0
  const doneEscalations = new Set<string>()

  for (const d of decisions) {
    if (d.action === 'remind') {
      reminders += 1
      if (options.dryRun) continue
      await notifyUsers(serviceDB, email, {
        organizationId: d.organizationId,
        userIds: await assigneeOf(serviceDB, d.obligationId),
        type: 'deadline_approaching',
        title: 'Deadline approaching',
        body: 'An obligation you are responsible for is due within 2 days.',
        obligationId: d.obligationId,
        data: { scan: now.toISOString() },
      })
      continue
    }

    if (d.action === 'mark_overdue') {
      markedOverdue += 1
      if (options.dryRun) continue
      await serviceDB.from('obligations').update({ status: 'overdue' }).eq('id', d.obligationId)
      await recordAudit(serviceDB, {
        organizationId: d.organizationId,
        actorId: null,
        action: 'obligation_marked_overdue',
        entityType: 'obligation',
        entityId: d.obligationId,
        summary: `Deadline passed ${d.daysOverdue ?? 1} day(s) ago — marked overdue`,
      })
      await notifyUsers(serviceDB, email, {
        organizationId: d.organizationId,
        userIds: await assigneeOf(serviceDB, d.obligationId),
        type: 'obligation_overdue',
        title: 'Obligation overdue',
        body: `An obligation you are responsible for is ${d.daysOverdue ?? 1} day(s) overdue.`,
        obligationId: d.obligationId,
      })
      continue
    }

    if (d.action === 'escalate' && !doneEscalations.has(d.obligationId)) {
      doneEscalations.add(d.obligationId)
      autoEscalated += 1
      if (options.dryRun) continue
      const current = await rows<DbRow>(
        serviceDB.from('obligations').select('id, previous_status, status').eq('id', d.obligationId).limit(1),
      )
      const prev = (current[0]?.previous_status as string | null) ?? 'overdue'
      await serviceDB
        .from('escalations')
        .insert({
          organization_id: d.organizationId,
          obligation_id: d.obligationId,
          escalated_by: null,
          reason: `Automatically escalated: ${d.daysOverdue ?? 1} day(s) overdue (escalation policy)`,
          status: 'active',
        })
      await serviceDB
        .from('obligations')
        .update({ status: 'escalated', previous_status: prev === 'escalated' ? 'overdue' : prev })
        .eq('id', d.obligationId)
      await recordAudit(serviceDB, {
        organizationId: d.organizationId,
        actorId: null,
        action: 'obligation_escalated',
        entityType: 'obligation',
        entityId: d.obligationId,
        summary: `Automatically escalated after ${d.daysOverdue ?? 1} day(s) overdue`,
        oldValues: { status: 'overdue' },
        newValues: { status: 'escalated' },
      })
      await notifyUsers(serviceDB, email, {
        organizationId: d.organizationId,
        userIds: await assigneeOf(serviceDB, d.obligationId),
        type: 'obligation_escalated',
        title: 'Obligation escalated',
        body: 'The obligation passed its escalation threshold and was escalated automatically.',
        obligationId: d.obligationId,
      })
    }
  }

  return { marked_overdue: markedOverdue, auto_escalated: autoEscalated, deadline_reminders: reminders }
}

async function assigneeOf(db: DB, obligationId: string): Promise<string[]> {
  const found = await rows<DbRow>(
    db.from('obligations').select('assignee_id, reviewer_id').eq('id', obligationId).limit(1),
  )
  const o = found[0]
  return [o?.assignee_id as string | null, o?.reviewer_id as string | null].filter((v): v is string => !!v)
}
