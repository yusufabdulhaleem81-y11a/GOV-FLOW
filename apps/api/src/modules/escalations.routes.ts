import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import {
  escalateObligation,
  listEscalations,
  resolveEscalation,
  runDeadlineScan,
} from '../services/escalation.service.js'
import { makeCtx, routeId, validateBody, validateQuery } from './helpers.js'
import { escalateSchema, resolveEscalationSchema } from '@govflow/validation'
import { z } from 'zod'
import { forbidden } from '../lib/errors.js'

export async function escalationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const query = validateQuery(z.object({ status: z.string().max(20).optional() }), request.query)
    return { data: await listEscalations(makeCtx(request, org), query.status) }
  })

  /** Escalate an obligation (admin/manager). */
  app.post('/obligations/:obligationId', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(escalateSchema, request.body)
    return {
      escalation: await escalateObligation(makeCtx(request, org), routeId(request, 'obligationId'), body.reason),
    }
  })

  app.post('/:id/resolve', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(resolveEscalationSchema, request.body ?? {})
    return { escalation: await resolveEscalation(makeCtx(request, org), routeId(request), body.note) }
  })

  /** Manual deadline sweep for admins (the scheduled job calls the service directly). */
  app.post('/scan', async (request) => {
    const org = await requireOrg(request)
    if (org.role !== 'admin') {
      throw forbidden('Only organization admins can run the deadline scan from the app')
    }
    return runDeadlineScan(app.deps.serviceDB, app.deps.email, { now: app.deps.now?.() })
  })
}
