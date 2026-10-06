import type { Comment } from '@govflow/types'
import { mayComment } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { mutation, rows } from '../db/types.js'
import { forbidden, notFound } from '../lib/errors.js'
import { recordAudit } from './audit.service.js'
import { notifyUsers } from './notification.service.js'
import type { ServiceContext } from './obligation.service.js'

export async function listComments(db: DB, organizationId: string, obligationId: string): Promise<Comment[]> {
  const comments = await rows<DbRow>(
    db
      .from('comments')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('obligation_id', obligationId)
      .order('created_at', { ascending: true }),
  )
  const authorIds = [...new Set(comments.map((c) => c.author_id as string))]
  const profiles = authorIds.length
    ? await rows<DbRow>(db.from('profiles').select('id, full_name').in('id', authorIds))
    : []
  const byId = new Map(profiles.map((p) => [p.id as string, p]))
  return comments.map((c) => ({
    ...(c as unknown as Comment),
    author: (byId.get(c.author_id as string) ?? null) as Comment['author'],
  }))
}

export async function createComment(
  ctx: ServiceContext,
  obligationId: string,
  content: string,
): Promise<Comment> {
  if (!mayComment(ctx.role)) {
    throw forbidden('Viewers cannot comment on obligations')
  }
  const found = await rows<DbRow>(
    ctx.db
      .from('obligations')
      .select('id, title, assignee_id, reviewer_id, created_by')
      .eq('organization_id', ctx.organizationId)
      .eq('id', obligationId)
      .limit(1),
  )
  const obligation = found[0] as
    | { id: string; title: string; assignee_id: string | null; reviewer_id: string | null; created_by: string }
    | undefined
  if (!obligation) throw notFound('Obligation')

  const comment = (
    await mutation<DbRow>(
      ctx.db
        .from('comments')
        .insert({
          organization_id: ctx.organizationId,
          obligation_id: obligationId,
          author_id: ctx.userId,
          content,
        })
        .select(),
    )
  )[0]
  if (!comment) throw new Error('Failed to add comment')

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'comment_added',
    entityType: 'obligation',
    entityId: obligationId,
    summary: `Commented on "${obligation.title as string}"`,
    metadata: { comment_id: comment.id as string },
  })

  const notifyIds = [obligation.assignee_id, obligation.reviewer_id, obligation.created_by].filter(
    (v) => v && v !== ctx.userId,
  )
  await notifyUsers(ctx.serviceDB, ctx.email, {
    organizationId: ctx.organizationId,
    userIds: notifyIds,
    type: 'comment_added',
    title: `New comment on: ${obligation.title as string}`,
    body: content.slice(0, 200),
    obligationId,
  })

  return { ...(comment as unknown as Comment), author: { id: ctx.userId, full_name: null, email: null, job_title: null, created_at: '' } as Comment['author'] }
}
