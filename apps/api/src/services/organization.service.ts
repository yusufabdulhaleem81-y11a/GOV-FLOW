import { randomUUID } from 'node:crypto'
import type { Organization, Profile, UserRole } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { mutation, one, rows } from '../db/types.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { recordAudit } from './audit.service.js'

export type OrgRow = Organization
export type ProfileRow = Profile

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  )
}

function randomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function listMyOrganizations(db: DB, userId: string) {
  const memberships = await rows<DbRow>(
    db.from('organization_members').select('organization_id, role').eq('user_id', userId),
  )
  if (memberships.length === 0) return []
  const orgIds = memberships.map((m) => m.organization_id as string)
  const orgs = await rows<DbRow>(db.from('organizations').select('*').in('id', orgIds))
  const byId = new Map(orgs.map((o) => [o.id as string, o]))
  return memberships
    .map((m) => {
      const org = byId.get(m.organization_id as string)
      return org ? { organization: org as unknown as Organization, role: m.role as UserRole } : null
    })
    .filter((v): v is { organization: Organization; role: UserRole } => v !== null)
}

export async function createOrganization(
  db: DB,
  input: { name: string; description?: string },
  userId: string,
): Promise<Organization> {
  const organizationId = randomUUID()
  await mutation<DbRow>(
    db
      .from('organizations')
      .insert({
        id: organizationId,
        name: input.name,
        slug: `${slugify(input.name)}-${randomCode(4).toLowerCase()}`,
        description: input.description ?? null,
        invite_code: randomCode(),
      }, { returning: false }),
  )

  const { error: memberError } = await db
    .from('organization_members')
    .insert({ organization_id: organizationId, user_id: userId, role: 'admin' }, { returning: false })
  if (memberError) throw new Error(`Failed to add owner as member: ${memberError.message}`)

  const org = await one<DbRow>(
    db.from('organizations').select('*').eq('id', organizationId).limit(1),
  )

  await recordAudit(db, {
    organizationId,
    actorId: userId,
    action: 'organization_created',
    entityType: 'organization',
    entityId: organizationId,
    summary: `Created organization "${org.name as string}"`,
  })
  return org as unknown as Organization
}

export async function getOrganization(db: DB, organizationId: string): Promise<Organization> {
  const org = await one<DbRow>(
    db.from('organizations').select('*').eq('id', organizationId).limit(1),
  )
  return org as unknown as Organization
}

export async function updateOrganization(
  db: DB,
  ctx: { organizationId: string; userId: string },
  patch: { name?: string; description?: string | null },
): Promise<Organization> {
  const current = await getOrganization(db, ctx.organizationId)
  const updated = (
    await mutation<DbRow>(
      db
        .from('organizations')
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
        })
        .eq('id', ctx.organizationId)
        .select(),
    )
  )[0]
  if (!updated) throw notFound('Organization')

  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    action: 'organization_updated',
    entityType: 'organization',
    entityId: ctx.organizationId,
    summary: 'Updated organization settings',
    oldValues: { name: current.name, description: current.description },
    newValues: { name: updated.name, description: updated.description },
  })
  return updated as unknown as Organization
}

export interface MemberRow {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  created_at: string
  profile: Pick<Profile, 'id' | 'full_name' | 'job_title' | 'email'> | null
}

export async function listMembers(db: DB, organizationId: string): Promise<MemberRow[]> {
  const members = await rows<DbRow>(
    db.from('organization_members').select('*').eq('organization_id', organizationId),
  )
  if (members.length === 0) return []
  const userIds = members.map((m) => m.user_id as string)
  const profiles = await rows<DbRow>(
    db.from('profiles').select('id, full_name, job_title, email').in('id', userIds),
  )
  const byId = new Map(profiles.map((p) => [p.id as string, p]))
  return members.map((m) => ({
    ...(m as unknown as Omit<MemberRow, 'profile'>),
    profile: (byId.get(m.user_id as string) ?? null) as MemberRow['profile'],
  }))
}

export async function isMember(db: DB, organizationId: string, userId: string): Promise<boolean> {
  const m = await rows<DbRow>(
    db
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .limit(1),
  )
  return m.length > 0
}

export async function updateMemberRole(
  db: DB,
  ctx: { organizationId: string; actorId: string },
  targetUserId: string,
  role: UserRole,
): Promise<void> {
  const members = await listMembers(db, ctx.organizationId)
  const target = members.find((m) => m.user_id === targetUserId)
  if (!target) throw notFound('Member')

  const admins = members.filter((m) => m.role === 'admin')
  if (target.role === 'admin' && role !== 'admin' && admins.length <= 1) {
    throw conflict('Cannot demote the last administrator of the organization')
  }
  if (target.role === role) return

  const { error } = await db
    .from('organization_members')
    .update({ role })
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', targetUserId)
  if (error) throw new Error(`Database error: ${error.message}`)

  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorId: ctx.actorId,
    action: 'member_role_changed',
    entityType: 'member',
    entityId: target.id,
    summary: `Changed role of ${target.profile?.full_name ?? targetUserId} to ${role}`,
    oldValues: { role: target.role },
    newValues: { role },
  })
}

export async function removeMember(
  db: DB,
  ctx: { organizationId: string; actorId: string },
  targetUserId: string,
): Promise<void> {
  const members = await listMembers(db, ctx.organizationId)
  const target = members.find((m) => m.user_id === targetUserId)
  if (!target) throw notFound('Member')

  const admins = members.filter((m) => m.role === 'admin')
  if (target.role === 'admin' && admins.length <= 1) {
    throw conflict('Cannot remove the last administrator of the organization')
  }

  const { error } = await db
    .from('organization_members')
    .delete()
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', targetUserId)
  if (error) throw new Error(`Database error: ${error.message}`)

  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorId: ctx.actorId,
    action: 'member_removed',
    entityType: 'member',
    entityId: target.id,
    summary: `Removed ${target.profile?.full_name ?? targetUserId} from the organization`,
  })
}

export async function regenerateInviteCode(
  db: DB,
  ctx: { organizationId: string; actorId: string },
): Promise<string> {
  const code = randomCode()
  const { data, error } = await db
    .from('organizations')
    .update({ invite_code: code })
    .eq('id', ctx.organizationId)
    .select()
  if (error?.code === '42501') throw forbidden()
  if (error) throw new Error(`Database error: ${error.message}`)
  if (!data?.length) throw notFound('Organization')

  await recordAudit(db, {
    organizationId: ctx.organizationId,
    actorId: ctx.actorId,
    action: 'invite_code_regenerated',
    entityType: 'organization',
    entityId: ctx.organizationId,
    summary: 'Regenerated the organization invite code',
  })
  return code
}

/** Joins an organization via invite code. The code is looked up with the service client. */
export async function joinByCode(
  db: DB,
  serviceDB: DB,
  userId: string,
  code: string,
): Promise<Organization> {
  const orgs = await rows<DbRow>(
    serviceDB.from('organizations').select('*').eq('invite_code', code.trim().toUpperCase()).limit(1),
  )
  const org = orgs[0]
  if (!org) throw notFound('Invalid invite code')
  const organizationId = org.id as string

  if (await isMember(db, organizationId, userId)) {
    throw badRequest('You are already a member of this organization')
  }

  const { error } = await db
    .from('organization_members')
    .insert({ organization_id: organizationId, user_id: userId, role: 'member' }, { returning: false })
  if (error) throw new Error(`Database error: ${error.message}`)

  await recordAudit(db, {
    organizationId,
    actorId: userId,
    action: 'member_joined',
    entityType: 'member',
    summary: 'Joined the organization via invite code',
  })
  return org as unknown as Organization
}
