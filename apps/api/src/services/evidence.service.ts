import type { CreateEvidenceInput, EvidenceFile, EvidenceReviewInput } from '@govflow/types'
import { WORKING_STATUSES, assertTransition, type ObligationStatus } from '@govflow/types'
import type { DbRow } from '../db/types.js'
import { mutation, one, rows } from '../db/types.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { recordAudit } from './audit.service.js'
import { notifyUsers } from './notification.service.js'
import type { ServiceContext } from './obligation.service.js'

const EVIDENCE_BUCKET = 'evidence-files'

export type EvidenceFileRow = DbRow

type EvidenceObligationRow = DbRow & {
  id: string
  title: string
  reference: string
  status: ObligationStatus
  assignee_id: string | null
  reviewer_id: string | null
  created_by: string
}

async function getObligationForEvidence(ctx: ServiceContext, obligationId: string): Promise<EvidenceObligationRow> {
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
  return obligation as EvidenceObligationRow
}

export async function listEvidence(
  ctx: ServiceContext,
  filters: { obligation_id?: string; status?: string },
): Promise<(EvidenceFile & { obligation_reference: string; obligation_title: string })[]> {
  let q = ctx.db
    .from('evidence_files')
    .select<DbRow>('*')
    .eq('organization_id', ctx.organizationId)
  if (filters.obligation_id) q = q.eq('obligation_id', filters.obligation_id)
  if (filters.status) q = q.eq('status', filters.status)
  const files = await rows<DbRow>(q.order('created_at', { ascending: false }).limit(200))

  const obligationIds = [...new Set(files.map((f) => f.obligation_id as string))]
  const obligations = obligationIds.length
    ? await rows<DbRow>(
        ctx.db.from('obligations').select('id, reference, title').in('id', obligationIds),
      )
    : []
  const byId = new Map(obligations.map((o) => [o.id as string, o]))
  const uploaderIds = [...new Set(files.map((f) => f.uploaded_by as string))]
  const profiles = uploaderIds.length
    ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', uploaderIds))
    : []
  const profileById = new Map(profiles.map((p) => [p.id as string, p]))

  return files.map((f) => ({
    ...(f as unknown as EvidenceFile),
    uploader: (profileById.get(f.uploaded_by as string) ?? null) as EvidenceFile['uploader'],
    obligation_reference: (byId.get(f.obligation_id as string)?.reference as string) ?? '',
    obligation_title: (byId.get(f.obligation_id as string)?.title as string) ?? '',
  }))
}

/** Registers metadata after the browser uploaded the file to private storage. */
export async function createEvidence(
  ctx: ServiceContext,
  input: CreateEvidenceInput,
): Promise<EvidenceFile> {
  const obligation = await getObligationForEvidence(ctx, input.obligation_id)
  const status = obligation.status as ObligationStatus

  const isAssignee = obligation.assignee_id === ctx.userId
  const isManager = ctx.role === 'admin' || ctx.role === 'manager'
  if (!isAssignee && !isManager) {
    throw forbidden('Only the responsible user or a manager can upload evidence for this obligation')
  }
  if (!WORKING_STATUSES.includes(status)) {
    throw badRequest(`Evidence cannot be uploaded while the obligation is ${status.replaceAll('_', ' ')}`)
  }

  // Organization-scoped storage path — prevents cross-tenant file registration.
  const expectedPrefix = `${ctx.organizationId}/`
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw forbidden('Invalid storage path')
  }

  const file = (
    await mutation<DbRow>(
      ctx.db
        .from('evidence_files')
        .insert({
          organization_id: ctx.organizationId,
          obligation_id: input.obligation_id,
          requirement_id: input.requirement_id ?? null,
          uploaded_by: ctx.userId,
          file_name: input.file_name,
          storage_path: input.storage_path,
          mime_type: input.mime_type,
          file_size: input.file_size,
          sha256: input.sha256 ?? null,
          status: 'submitted',
        })
        .select(),
    )
  )[0]
  if (!file) throw new Error('Failed to register evidence')

  if (input.requirement_id) {
    const req = await one<DbRow>(
      ctx.db
        .from('evidence_requirements')
        .select('id, title')
        .eq('obligation_id', input.obligation_id)
        .eq('id', input.requirement_id)
        .limit(1),
    )
    await ctx.db.from('evidence_requirements').update({ status: 'submitted' }).eq('id', req.id as string)
  }

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'evidence_uploaded',
    entityType: 'obligation',
    entityId: input.obligation_id,
    summary: `Uploaded evidence "${input.file_name}"`,
    metadata: { evidence_file_id: file.id, obligation_id: input.obligation_id, file_size: input.file_size, mime_type: input.mime_type },
  })

  // Submitting evidence moves the obligation into review and notifies the reviewer.
  if (WORKING_STATUSES.includes(status) && status !== 'under_review') {
    try {
      assertTransition(status, 'submit_for_review')
      await ctx.db.from('obligations').update({ status: 'under_review' }).eq('id', input.obligation_id)
      await recordAudit(ctx.db, {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: 'obligation_status_changed',
        entityType: 'obligation',
        entityId: input.obligation_id,
        summary: 'Evidence submitted — moved to review',
        oldValues: { status },
        newValues: { status: 'under_review' },
      })
    } catch {
      // Status transition not allowed from current state; leave status unchanged.
    }
  }

  const notifyIds = [obligation.reviewer_id, obligation.created_by].filter(
    (v) => v && v !== ctx.userId,
  )
  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: notifyIds,
    type: 'evidence_submitted',
    title: `Evidence submitted: ${obligation.title as string}`,
    body: `"${input.file_name}" was uploaded for ${obligation.reference as string}.`,
    obligationId: input.obligation_id,
  })

  return file as unknown as EvidenceFile
}

export async function reviewEvidence(
  ctx: ServiceContext,
  fileId: string,
  input: EvidenceReviewInput,
): Promise<EvidenceFile> {
  const canReview = ctx.role === 'admin' || ctx.role === 'manager'
  const file = await one<DbRow>(
    ctx.db
      .from('evidence_files')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', fileId)
      .limit(1),
  )
  const obligation = await getObligationForEvidence(ctx, file.obligation_id as string)
  const isAssignedReviewer = obligation.reviewer_id === ctx.userId
  if (!canReview && !isAssignedReviewer) {
    throw forbidden('Only the assigned reviewer, a manager or an admin can review evidence')
  }
  if (file.status === 'accepted') throw badRequest('This evidence was already accepted')

  const newFileStatus =
    input.decision === 'accepted' ? 'accepted' : 'rejected'
  const updated = (
    await mutation<DbRow>(
      ctx.db
        .from('evidence_files')
        .update({
          status: newFileStatus,
          review_note: input.note ?? null,
          reviewed_by: ctx.userId,
          reviewed_at: (ctx.now?.() ?? new Date()).toISOString(),
        })
        .eq('id', fileId)
        .select(),
    )
  )[0]
  if (!updated) throw new Error('Failed to update evidence')

  if (file.requirement_id) {
    const requirementStatus =
      input.decision === 'accepted' ? 'accepted' : input.decision === 'rejected' ? 'rejected' : 'submitted'
    await ctx.db
      .from('evidence_requirements')
      .update({ status: requirementStatus })
      .eq('id', file.requirement_id as string)
  }

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'evidence_reviewed',
    entityType: 'obligation',
    entityId: obligation.id as string,
    summary: `Evidence "${file.file_name as string}" was ${
      input.decision === 'accepted' ? 'accepted' : input.decision === 'rejected' ? 'rejected' : 'sent back with change requests'
    }${input.note ? ` — ${input.note}` : ''}`,
    oldValues: { status: file.status },
    newValues: { status: newFileStatus, decision: input.decision },
    metadata: { evidence_file_id: fileId, obligation_id: obligation.id },
  })

  // A rejected file sends the obligation back to the responsible user.
  const obStatus = obligation.status as ObligationStatus
  if (input.decision !== 'accepted' && obStatus === 'under_review') {
    try {
      assertTransition(obStatus, 'request_changes')
      await ctx.db
        .from('obligations')
        .update({ status: 'changes_requested' })
        .eq('id', obligation.id as string)
      await recordAudit(ctx.db, {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: 'obligation_status_changed',
        entityType: 'obligation',
        entityId: obligation.id as string,
        summary: 'Changes requested during evidence review',
        oldValues: { status: obStatus },
        newValues: { status: 'changes_requested' },
      })
    } catch {
      // not transitionable — leave status
    }
  }

  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: [obligation.assignee_id].filter((v) => v && v !== ctx.userId),
    type: input.decision === 'accepted' ? 'evidence_accepted' : 'evidence_rejected',
    title:
      input.decision === 'accepted'
        ? `Evidence accepted: ${obligation.title as string}`
        : `Evidence needs attention: ${obligation.title as string}`,
    body: input.note ?? undefined,
    obligationId: obligation.id as string,
  })

  return updated as unknown as EvidenceFile
}

/** Creates a short-lived signed URL after verifying the path belongs to the org. */
export async function createSignedEvidenceUrl(
  ctx: ServiceContext,
  path: string,
): Promise<string> {
  if (!path.startsWith(`${ctx.organizationId}/`)) {
    throw forbidden('Invalid storage path')
  }
  const { data, error } = await ctx.db.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 600)
  if (error || !data) throw notFound('Evidence file')
  return data.signedUrl
}
