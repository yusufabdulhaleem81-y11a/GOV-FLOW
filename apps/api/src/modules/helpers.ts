import type { FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import type { UserRole } from '@govflow/types'
import { badRequest } from '../lib/errors.js'
import type { AppDeps } from '../app-context.js'
import type { ServiceContext } from '../services/obligation.service.js'
import { uuidSchema } from '@govflow/validation'

export function validateBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw badRequest('Please correct the highlighted fields', result.error.flatten())
  }
  return result.data
}

export function validateQuery<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw badRequest('Invalid query parameters', result.error.flatten())
  }
  return result.data
}

export function routeId(request: FastifyRequest, name = 'id'): string {
  const params = request.params as Record<string, string | undefined>
  const parsed = uuidSchema.safeParse(params[name])
  if (!parsed.success) throw badRequest(`Invalid ${name} parameter`)
  return parsed.data
}

export function makeCtx(request: FastifyRequest, org: { organizationId: string; userId: string; role: UserRole }): ServiceContext {
  const deps = request.server.deps as AppDeps
  return {
    db: deps.dbForToken(request.token),
    serviceDB: deps.serviceDB,
    email: deps.email,
    organizationId: org.organizationId,
    userId: org.userId,
    role: org.role,
    now: deps.now,
  }
}
