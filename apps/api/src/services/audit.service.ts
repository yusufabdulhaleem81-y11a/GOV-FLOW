import type { AuditAction } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { rows } from '../db/types.js'
import type { Profile } from '@govflow/types'

export interface AuditInput {
  organizationId: string
  actorId: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  summary: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

/** Appends an immutable audit event. Never throws into the main flow: audit failures are logged. */
export async function recordAudit(db: DB, input: AuditInput): Promise<void> {
  try {
    const { error } = await db.from('audit_events').insert({
      organization_id: input.organizationId,
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      metadata: input.metadata ?? null,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('[audit] failed to record event', input.action, err)
  }
}

export interface AuditListResult {
  events: (AuditEventRow & { actor: Pick<Profile, 'id' | 'full_name'> | null })[]
  total: number
}

export type AuditEventRow = {
  id: string
  organization_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function listAudit(
  db: DB,
  organizationId: string,
  query: { action?: string; entity_id?: string; actor_id?: string; page?: number; pageSize?: number },
): Promise<AuditListResult> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50

  let q = db
    .from('audit_events')
    .select<AuditEventRow>('*', { count: 'exact' })
    .eq('organization_id', organizationId)
  if (query.action) q = q.eq('action', query.action)
  if (query.entity_id) q = q.eq('entity_id', query.entity_id)
  if (query.actor_id) q = q.eq('actor_id', query.actor_id)

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw new Error(`Database error: ${error.message}`)

  const events = data ?? []
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter((v): v is string => !!v))]
  const profiles = actorIds.length
    ? await rows<DbRow>(
        db.from('profiles').select('id, full_name').in('id', actorIds),
      )
    : []
  const profileMap = new Map(profiles.map((p) => [p.id as string, p]))

  return {
    total: count ?? events.length,
    events: events.map((e) => ({
      ...e,
      actor: (e.actor_id ? profileMap.get(e.actor_id) : null) as
        | Pick<Profile, 'id' | 'full_name'>
        | null
        | undefined ?? null,
    })),
  }
}
