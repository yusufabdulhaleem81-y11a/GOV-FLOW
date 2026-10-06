import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { UserRole } from '@govflow/types'
import type { ApiEnv } from './config/env.js'
import type { AuthUser, AuthVerifier, DB, DbRow } from './db/types.js'
import { forbidden, notFound, unauthorized } from './lib/errors.js'

/** Everything the application needs from the outside world. */
export interface AppDeps {
  env: ApiEnv
  /** User-scoped database (runs under the caller's JWT; RLS applies). */
  dbForToken(token: string): DB
  /** Service-role database (system actor; bypasses RLS — use sparingly). */
  serviceDB: DB
  verifier: AuthVerifier
  email: { send(input: EmailInput): Promise<void> }
  now?: () => Date
}

export interface EmailInput {
  to: string
  subject: string
  text: string
}

export interface OrgContext {
  organizationId: string
  role: UserRole
  userId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null
    token: string
    org: OrgContext | null
  }
  interface FastifyInstance {
    deps: AppDeps
  }
}

/** Authenticates the request from the Authorization bearer token. */
export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  if (request.authUser) return request.authUser
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) throw unauthorized()
  const token = header.slice('Bearer '.length).trim()
  const user = await request.server.deps.verifier.getUser(token)
  if (!user) throw unauthorized('Invalid or expired session')
  request.token = token
  request.authUser = user
  return user
}

/**
 * Resolves and caches the organization context for the request.
 * The organization id ALWAYS comes from the X-Organization-Id header and is
 * verified against the caller's membership — never from client-supplied query
 * parameters. All subsequent queries are scoped to this organization.
 */
export async function requireOrg(request: FastifyRequest): Promise<OrgContext> {
  if (request.org) return request.org
  const user = await requireAuth(request)
  const header = request.headers['x-organization-id']
  const organizationId = Array.isArray(header) ? header[0] : header
  if (!organizationId) {
    throw unauthorized('No organization selected')
  }

  const memberships = (
    await request.server.deps
      .dbForToken(request.token)
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .limit(1)
  ).data as DbRow[] | null

  const membership = (memberships ?? [])[0]
  if (!membership) {
    throw notFound('Organization (or you are not a member of it)')
  }

  request.org = {
    organizationId,
    role: membership.role as UserRole,
    userId: user.id,
  }
  return request.org
}

const ROLE_RANK: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  reviewer: 2,
  member: 1,
  viewer: 0,
}

/** Requires the request's role to be one of the given roles. Resolves the org context if needed. */
export async function requireRole(request: FastifyRequest, ...roles: UserRole[]): Promise<OrgContext> {
  const org = request.org ?? (await requireOrg(request))
  if (!roles.includes(org.role)) throw forbidden()
  return org
}

export function roleRank(role: UserRole): number {
  return ROLE_RANK[role]
}

export function buildAppDecorations(app: FastifyInstance, deps: AppDeps): void {
  app.decorate('deps', deps)
  app.decorateRequest('authUser', null)
  app.decorateRequest('token', '')
  app.decorateRequest('org', null)
}
