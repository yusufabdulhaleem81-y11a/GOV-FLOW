import type { Department } from '@govflow/types'
import type { DbRow } from '../db/types.js'
import { mutation, rows } from '../db/types.js'
import { badRequest, notFound } from '../lib/errors.js'
import { recordAudit } from './audit.service.js'
import type { ServiceContext } from './obligation.service.js'

export interface DepartmentWithCount extends Department {
  obligation_count: number
}

export async function listDepartments(ctx: ServiceContext): Promise<DepartmentWithCount[]> {
  const departments = await rows<DbRow>(
    ctx.db
      .from('departments')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('name', { ascending: true }),
  )
  const obligations = await rows<DbRow>(
    ctx.db.from('obligations').select('department_id, status').eq('organization_id', ctx.organizationId),
  )

  const deptIds = new Set(departments.map((d) => d.id as string))
  const obligationCount = new Map<string, number>()
  for (const o of obligations) {
    const key = o.department_id as string | null
    if (key && deptIds.has(key) && o.status !== 'closed' && o.status !== 'cancelled') {
      obligationCount.set(key, (obligationCount.get(key) ?? 0) + 1)
    }
  }

  return departments.map((d) => ({
    ...(d as unknown as Department),
    obligation_count: obligationCount.get(d.id as string) ?? 0,
  }))
}

export async function createDepartment(
  ctx: ServiceContext,
  input: { name: string; description?: string },
): Promise<Department> {
  const existing = await rows<DbRow>(
    ctx.db
      .from('departments')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('name', input.name)
      .limit(1),
  )
  if (existing.length > 0) throw badRequest('A department with this name already exists')

  const created = (
    await mutation<DbRow>(
      ctx.db
        .from('departments')
        .insert({
          organization_id: ctx.organizationId,
          name: input.name,
          description: input.description ?? null,
        })
        .select(),
    )
  )[0]
  if (!created) throw new Error('Failed to create department')

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'department_created',
    entityType: 'department',
    entityId: created.id as string,
    summary: `Created department "${input.name}"`,
  })
  return created as unknown as Department
}

export async function updateDepartment(
  ctx: ServiceContext,
  departmentId: string,
  patch: { name?: string; description?: string },
): Promise<Department> {
  const updated = (
    await mutation<DbRow>(
      ctx.db
        .from('departments')
        .update(patch)
        .eq('organization_id', ctx.organizationId)
        .eq('id', departmentId)
        .select(),
    )
  )[0]
  if (!updated) throw notFound('Department')

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'department_updated',
    entityType: 'department',
    entityId: departmentId,
    summary: `Updated department "${updated.name as string}"`,
    newValues: patch as Record<string, unknown>,
  })
  return updated as unknown as Department
}

export async function deleteDepartment(ctx: ServiceContext, departmentId: string): Promise<void> {
  const inUse = await rows<DbRow>(
    ctx.db
      .from('obligations')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('department_id', departmentId)
      .limit(1),
  )
  if (inUse.length > 0) {
    throw badRequest('This department still has obligations assigned to it. Reassign them first.')
  }

  const { error } = await ctx.db
    .from('departments')
    .delete()
    .eq('organization_id', ctx.organizationId)
    .eq('id', departmentId)
  if (error) throw new Error(`Database error: ${error.message}`)

  await recordAudit(ctx.db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'department_deleted',
    entityType: 'department',
    entityId: departmentId,
    summary: 'Deleted a department',
  })
}
