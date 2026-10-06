import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../app-context.js'
import { joinByCode, listMyOrganizations } from '../services/organization.service.js'
import { rows } from '../db/types.js'
import { notFound } from '../lib/errors.js'
import { validateBody } from './helpers.js'
import { joinOrganizationSchema } from '@govflow/validation'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** Current user + organization memberships. */
  app.get('/me', async (request) => {
    const user = await requireAuth(request)
    const db = app.deps.dbForToken(request.token)

    const profiles = await rows(
      db.from('profiles').select('id, email, full_name, job_title, created_at').eq('id', user.id).limit(1),
    )
    const profile = profiles[0]
    if (!profile) throw notFound('Profile')

    const memberships = await listMyOrganizations(db, user.id)
    return { user: profile, memberships }
  })

  /** Join an organization using an invite code. */
  app.post('/join', async (request) => {
    const user = await requireAuth(request)
    const body = validateBody(joinOrganizationSchema, request.body)
    const db = app.deps.dbForToken(request.token)
    const organization = await joinByCode(db, app.deps.serviceDB, user.id, body.code)
    return { organization }
  })
}
