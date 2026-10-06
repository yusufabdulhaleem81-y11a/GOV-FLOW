import type { FastifyInstance } from 'fastify'
import { requireRole } from '../app-context.js'
import { listAudit } from '../services/audit.service.js'
import { makeCtx, validateQuery } from './helpers.js'
import { auditListQuerySchema } from '@govflow/validation'

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  /** Organization-wide audit history (admin/manager only). */
  app.get('/', async (request) => {
    const org = await requireRole(request, 'admin', 'manager')
    const query = validateQuery(auditListQuerySchema, request.query)
    const result = await listAudit(makeCtx(request, org).db, org.organizationId, query)
    return { data: result.events, page: query.page ?? 1, pageSize: query.pageSize ?? 50, total: result.total }
  })
}
