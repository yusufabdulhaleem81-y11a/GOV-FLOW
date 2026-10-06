import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import {
  closeObligation,
  createObligation,
  getObligationDetail,
  listObligations,
  transitionObligation,
  updateObligation,
} from '../services/obligation.service.js'
import { listComments, createComment } from '../services/comment.service.js'
import { listAudit } from '../services/audit.service.js'
import { makeCtx, routeId, validateBody, validateQuery } from './helpers.js'
import {
  closeObligationSchema,
  createCommentSchema,
  createObligationSchema,
  obligationListQuerySchema,
  transitionSchema,
  updateObligationSchema,
} from '@govflow/validation'

export async function obligationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const query = validateQuery(obligationListQuerySchema, request.query)
    return listObligations(makeCtx(request, org), query)
  })

  app.post('/', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(createObligationSchema, request.body)
    return { obligation: await createObligation(makeCtx(request, org), body) }
  })

  app.get('/:id', async (request) => {
    const org = await requireOrg(request)
    return { obligation: await getObligationDetail(makeCtx(request, org), routeId(request)) }
  })

  app.patch('/:id', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(updateObligationSchema, request.body)
    return {
      obligation: await updateObligation(makeCtx(request, org), routeId(request), body),
    }
  })

  app.post('/:id/transition', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(transitionSchema, request.body)
    return {
      obligation: await transitionObligation(makeCtx(request, org), routeId(request), body.action, body.note),
    }
  })

  app.post('/:id/close', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(closeObligationSchema, request.body ?? {})
    return { obligation: await closeObligation(makeCtx(request, org), routeId(request), body.note) }
  })

  app.get('/:id/comments', async (request) => {
    const org = await requireOrg(request)
    const id = routeId(request)
    await getObligationDetail(makeCtx(request, org), id) // permission gate
    return { data: await listComments(makeCtx(request, org).db, org.organizationId, id) }
  })

  app.post('/:id/comments', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(createCommentSchema, request.body)
    return { comment: await createComment(makeCtx(request, org), routeId(request), body.content) }
  })

  app.get('/:id/audit', async (request) => {
    const org = await requireOrg(request)
    const id = routeId(request)
    await getObligationDetail(makeCtx(request, org), id) // permission gate
    const result = await listAudit(makeCtx(request, org).db, org.organizationId, { entity_id: id, pageSize: 100 })
    return { data: result.events, total: result.total }
  })
}
