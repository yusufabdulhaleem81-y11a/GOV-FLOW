import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import { listMembers } from '../services/organization.service.js'

/** Directory of organization members (used for assignment pickers and the Users page). */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const members = await listMembers(app.deps.dbForToken(request.token), org.organizationId)
    return {
      data: members.map((m) => ({
        id: m.user_id,
        role: m.role,
        full_name: m.profile?.full_name ?? null,
        email: m.profile?.email ?? null,
        job_title: m.profile?.job_title ?? null,
      })),
    }
  })
}
