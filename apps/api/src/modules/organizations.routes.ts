import type { FastifyInstance } from 'fastify'
import { requireAuth, requireOrg, requireRole } from '../app-context.js'
import {
  createOrganization,
  getOrganization,
  listMembers,
  listMyOrganizations,
  regenerateInviteCode,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from '../services/organization.service.js'
import { routeId, validateBody } from './helpers.js'
import {
  createOrganizationSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from '@govflow/validation'

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const user = await requireOrg(request) // ensures valid membership context
    const memberships = await listMyOrganizations(app.deps.dbForToken(request.token), user.userId)
    return { data: memberships }
  })

  app.post('/', async (request) => {
    const user = await requireAuth(request)
    const body = validateBody(createOrganizationSchema, request.body)
    const organization = await createOrganization(
      app.deps.dbForToken(request.token),
      body,
      user.id,
    )
    return { organization }
  })

  app.get('/:id', async (request) => {
    const org = await requireOrg(request)
    routeId(request)
    return { organization: await getOrganization(app.deps.dbForToken(request.token), org.organizationId) }
  })

  app.patch('/:id', async (request) => {
    const org = await requireRole(request, 'admin')
    routeId(request)
    const body = validateBody(updateOrganizationSchema, request.body)
    const organization = await updateOrganization(
      app.deps.dbForToken(request.token),
      { organizationId: org.organizationId, userId: org.userId },
      body,
    )
    return { organization }
  })

  app.get('/:id/members', async (request) => {
    const org = await requireOrg(request)
    routeId(request)
    return { data: await listMembers(app.deps.dbForToken(request.token), org.organizationId) }
  })

  app.patch('/:id/members/:userId', async (request) => {
    const org = await requireRole(request, 'admin')
    routeId(request)
    const body = validateBody(updateMemberRoleSchema, request.body)
    await updateMemberRole(
      app.deps.dbForToken(request.token),
      { organizationId: org.organizationId, actorId: org.userId },
      routeId(request, 'userId'),
      body.role,
    )
    return { ok: true }
  })

  app.delete('/:id/members/:userId', async (request) => {
    const org = await requireRole(request, 'admin')
    routeId(request)
    await removeMember(
      app.deps.dbForToken(request.token),
      { organizationId: org.organizationId, actorId: org.userId },
      routeId(request, 'userId'),
    )
    return { ok: true }
  })

  app.post('/:id/invite-code', async (request) => {
    const org = await requireRole(request, 'admin')
    routeId(request)
    const inviteCode = await regenerateInviteCode(
      app.deps.dbForToken(request.token),
      { organizationId: org.organizationId, actorId: org.userId },
    )
    return { invite_code: inviteCode }
  })
}
