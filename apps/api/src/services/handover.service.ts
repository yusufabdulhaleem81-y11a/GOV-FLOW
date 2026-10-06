import type { Handover } from '@govflow/types'
import type { DbRow } from '../db/types.js'
import { mutation, rows } from '../db/types.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { recordAudit } from './audit.service.js'
import { notifyUsers } from './notification.service.js'
import type { ServiceContext } from './obligation.service.js'

export interface HandoverWithRefs extends Handover {
  obligation_reference?: string
  obligation_title?: string
}

export async function listHandovers(
  ctx: ServiceContext,
  status?: string,
): Promise<HandoverWithRefs[]> {
  let q = ctx.db
    .from('handovers')
    .select<DbRow>('*')
    .eq('organization_id', ctx.organizationId)
  // Responsible users only see handovers that concern them.
  if (ctx.role === 'member') {
    q = q.or(`from_user_id.eq.${ctx.userId},to_user_id.eq.${ctx.userId},requested_by.eq.${ctx.userId}`)
  }
  if (status) q = q.eq('status', status)
  const handovers = await rows<DbRow>(q.order('created_at', { ascending: false }).limit(100))

  const [obligationIds, userIds] = [
    [...new Set(handovers.map((h) => h.obligation_id as string))],
    [
      ...new Set(
        handovers.flatMap((h) => [h.from_user_id, h.to_user_id, h.requested_by, h.decided_by] as (string | null)[]),
      ),
    ].filter((v): v is string => !!v),
  ]
  const [obligations, profiles] = await Promise.all([
    obligationIds.length
      ? rows<DbRow>(ctx.db.from('obligations').select('id, reference, title').in('id', obligationIds))
      : Promise.resolve([]),
    userIds.length
      ? rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', userIds))
      : Promise.resolve([]),
  ])
  const obById = new Map(obligations.map((o) => [o.id as string, o]))
  const profileById = new Map(profiles.map((p) => [p.id as string, p]))
  const toProfile = (id: unknown) =>
    id ? (profileById.get(id as string) ?? null) : null

  return handovers.map((h) => ({
    ...(h as unknown as Handover),
    from_user: toProfile(h.from_user_id) as Handover['from_user'],
    to_user: toProfile(h.to_user_id) as Handover['to_user'],
    requester: toProfile(h.requested_by) as Handover['requester'],
    decider: toProfile(h.decided_by) as Handover['decider'],
    obligation_reference: (obById.get(h.obligation_id as string)?.reference as string) ?? '',
    obligation_title: (obById.get(h.obligation_id as string)?.title as string) ?? '',
  }))
}

export async function requestHandover(
  ctx: ServiceContext,
  obligationId: string,
  toUserId: string,
  reason?: string,
): Promise<Handover> {
  const found = await rows<DbRow>(
    ctx.db
      .from('obligations')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', obligationId)
      .limit(1),
  )
  const obligation = found[0]
  if (!obligation) throw notFound('Obligation')

  const isManager = ctx.role === 'admin' || ctx.role === 'manager'
  const isAssignee = obligation.assignee_id === ctx.userId
  if (!isManager && !isAssignee) {
    throw forbidden('Only the responsible user or a manager can request a handover')
  }
  if (obligation.assignee_id === toUserId) {
    throw badRequest('The selected user is already responsible for this obligation')
  }

  const members = await rows<DbRow>(
    ctx.db
      .from('organization_members')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', toUserId)
      .limit(1),
  )
  if (members.length === 0) throw badRequest('The new responsible user must be a member of your organization')

  const handover = (
    await mutation<DbRow>(
      ctx.db
        .from('handovers')
        .insert({
          organization_id: ctx.organizationId,
          obligation_id: obligationId,
          from_user_id: (obligation.assignee_id as string | null) ?? ctx.userId,
          to_user_id: toUserId,
          requested_by: ctx.userId,
          status: 'pending',
          reason: reason ?? null,
        })
        .select(),
    )
  )[0]
  if (!handover) throw new Error('Failed to create handover')

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'handover_requested',
    entityType: 'obligation',
    entityId: obligationId,
    summary: `Handover requested for "${obligation.title as string}"`,
    metadata: { handover_id: handover.id as string, to_user_id: toUserId, reason: reason ?? null },
  })
  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: [toUserId],
    type: 'handover_requested',
    title: `Handover pending approval: ${obligation.title as string}`,
    body: reason,
    obligationId,
  })

  return handover as unknown as Handover
}

async function decideHandover(
  ctx: ServiceContext,
  handoverId: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<Handover> {
  const isManager = ctx.role === 'admin' || ctx.role === 'manager'
  if (!isManager) throw forbidden('Only managers or admins can approve handovers')

  const found = await rows<DbRow>(
    ctx.db
      .from('handovers')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', handoverId)
      .limit(1),
  )
  const handover = found[0]
  if (!handover) throw notFound('Handover')
  if (handover.status !== 'pending') throw badRequest('This handover was already decided')

  const obligationId = handover.obligation_id as string
  const obligations = await rows<DbRow>(
    ctx.db.from('obligations').select('*').eq('organization_id', ctx.organizationId).eq('id', obligationId).limit(1),
  )
  const obligation = obligations[0]

  const updated = (
    await mutation<DbRow>(
      ctx.db
        .from('handovers')
        .update({
          status: decision,
          decided_by: ctx.userId,
          decided_at: (ctx.now?.() ?? new Date()).toISOString(),
          ...(note ? { reason: `${handover.reason as string | null ?? ''} | Decision note: ${note}` } : {}),
        })
        .eq('id', handoverId)
        .select(),
    )
  )[0]
  if (!updated) throw new Error('Failed to update handover')

  if (decision === 'approved' && obligation) {
    await ctx.db.from('obligations').update({ assignee_id: handover.to_user_id }).eq('id', obligationId)
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'handover_approved',
      entityType: 'obligation',
      entityId: obligationId,
      summary: `Handover approved — responsibility transferred to a new user`,
      oldValues: { assignee_id: handover.from_user_id },
      newValues: { assignee_id: handover.to_user_id },
      metadata: { handover_id: handoverId },
    })
  } else {
    await recordAudit(ctx.db, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'handover_rejected',
      entityType: 'obligation',
      entityId: obligationId,
      summary: `Handover rejected${note ? ` — ${note}` : ''}`,
      metadata: { handover_id: handoverId },
    })
  }

  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: [handover.requested_by as string, handover.to_user_id as string].filter((v) => v !== ctx.userId),
    type: decision === 'approved' ? 'handover_approved' : 'handover_rejected',
    title:
      decision === 'approved'
        ? `Handover approved: ${obligation?.title as string ?? ''}`
        : `Handover rejected: ${obligation?.title as string ?? ''}`,
    body: note,
    obligationId,
  })

  return updated as unknown as Handover
}

export const approveHandover = (ctx: ServiceContext, id: string, note?: string) =>
  decideHandover(ctx, id, 'approved', note)
export const rejectHandover = (ctx: ServiceContext, id: string, note?: string) =>
  decideHandover(ctx, id, 'rejected', note)
