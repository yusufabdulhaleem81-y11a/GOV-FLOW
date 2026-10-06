import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import {
  createEvidence,
  createSignedEvidenceUrl,
  listEvidence,
  reviewEvidence,
} from '../services/evidence.service.js'
import { makeCtx, routeId, validateBody, validateQuery } from './helpers.js'
import {
  createEvidenceSchema,
  evidenceReviewSchema,
  signedUrlSchema,
} from '@govflow/validation'
import { z } from 'zod'

export async function evidenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    const query = validateQuery(
      z.object({
        obligation_id: z.string().uuid().optional(),
        status: z.string().max(20).optional(),
      }),
      request.query,
    )
    return { data: await listEvidence(makeCtx(request, org), query) }
  })

  /** Registers an already-uploaded file (browser → private Supabase Storage). */
  app.post('/', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(createEvidenceSchema, request.body)
    return { evidence: await createEvidence(makeCtx(request, org), body) }
  })

  app.post('/:id/review', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(evidenceReviewSchema, request.body)
    return {
      evidence: await reviewEvidence(makeCtx(request, org), routeId(request), body),
    }
  })

  /** Short-lived signed URL for a private evidence file. */
  app.post('/signed-url', async (request) => {
    const org = await requireOrg(request)
    const body = validateBody(signedUrlSchema, request.body)
    return { signed_url: await createSignedEvidenceUrl(makeCtx(request, org), body.path) }
  })
}
