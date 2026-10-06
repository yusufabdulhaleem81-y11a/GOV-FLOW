import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import { getDashboard } from '../services/report.service.js'
import { makeCtx } from './helpers.js'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    return getDashboard(makeCtx(request, org))
  })
}
