import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import { approveHandover, listHandovers, rejectHandover, requestHandover } from '../services/handover.service.js'
import { makeCtx, routeId, validateBody, validateQuery } from './helpers.js'
import { createHandoverSchema, handoverDecisionSchema } from '@govflow/validation'
import { z } from 'zod'
export async function handoverRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const query = validateQuery(z.object({ status: z.string().max(20).optional() }), request.query)
    return { data: await listHandovers(makeCtx(request, org), query.status) }
  })

  app.post('/', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(createHandoverSchema, request.body)
    return {
      handover: await requestHandover(
        makeCtx(request, org),
        body.obligation_id,
        body.to_user_id,
        body.reason,
      ),
    }
  })

  app.post('/:id/approve', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(handoverDecisionSchema, request.body ?? {})
    return { handover: await approveHandover(makeCtx(request, org), routeId(request), body.note) }
  })

  app.post('/:id/reject', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(handoverDecisionSchema, request.body ?? {})
    return { handover: await rejectHandover(makeCtx(request, org), routeId(request), body.note) }
  })
}
