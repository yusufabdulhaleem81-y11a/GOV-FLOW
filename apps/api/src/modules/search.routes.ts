import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import { listObligations } from '../services/obligation.service.js'
import { makeCtx } from './helpers.js'

/** Application-level search across obligations (title, reference, category). */
export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const q = String((request.query as Record<string, unknown>).q ?? '').trim()
    if (q.length < 2) return { obligations: [] }
    const result = await listObligations(makeCtx(request, org), { q, pageSize: 10, sort: 'updated_at', dir: 'desc' })
    return { obligations: result.data }
  })
}
