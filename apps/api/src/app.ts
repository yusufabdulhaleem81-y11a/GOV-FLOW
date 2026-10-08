import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { ZodError } from 'zod'
import { buildAppDecorations, requireAuth, type AppDeps } from './app-context.js'
import { AppError } from './lib/errors.js'
import { UnpackedError } from './db/types.js'
import { TransitionError } from '@govflow/types'
import { authRoutes } from './modules/auth.routes.js'
import { organizationRoutes } from './modules/organizations.routes.js'
import { departmentRoutes } from './modules/departments.routes.js'
import { userRoutes } from './modules/users.routes.js'
import { obligationRoutes } from './modules/obligations.routes.js'
import { evidenceRoutes } from './modules/evidence.routes.js'
import { handoverRoutes } from './modules/handovers.routes.js'
import { escalationRoutes } from './modules/escalations.routes.js'
import { notificationRoutes } from './modules/notifications.routes.js'
import { dashboardRoutes } from './modules/dashboard.routes.js'
import { reportRoutes } from './modules/reports.routes.js'
import { auditRoutes } from './modules/audit.routes.js'
import { searchRoutes } from './modules/search.routes.js'

/** Builds the fully-wired Fastify application. Pure factory — easy to test with fastify.inject. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: 'error' },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  })

  buildAppDecorations(app, deps)

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
  await app.register(cors, {
    origin: deps.env.WEB_ORIGIN,
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })

  // Consistent error envelope for every route.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      })
      return
    }
    if (error instanceof TransitionError) {
      void reply.status(409).send({
        error: { code: 'INVALID_TRANSITION', message: error.message },
      })
      return
    }
    if (error instanceof UnpackedError) {
      void reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      })
      return
    }
    if ((error as { name?: string }).name === 'ZodError') {
      const zodError = error as unknown as ZodError
      void reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: zodError.flatten() },
      })
      return
    }
    const statusCode = error.statusCode
    if (typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
      if (statusCode >= 500) request.log.error({ err: error }, 'Fastify server error')
      const emptyJsonBody = error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
      const code = statusCode === 400
        ? 'BAD_REQUEST'
        : statusCode === 401
          ? 'UNAUTHORIZED'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : statusCode >= 500
                ? 'INTERNAL_ERROR'
                : 'REQUEST_ERROR'
      void reply.status(statusCode).send({
        error: {
          code,
          message: emptyJsonBody
            ? 'Request body is empty but Content-Type is application/json'
            : statusCode >= 500 && deps.env.NODE_ENV === 'production'
              ? 'An unexpected error occurred'
              : error.message,
        },
      })
      return
    }
    request.log.error({ err: error }, 'Unhandled API error')
    void reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message:
          deps.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : `Internal error: ${error.message}`,
      },
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  // Authentication: every /api/v1 route requires a valid session unless public.
  app.addHook('preHandler', async (request) => {
    const url = request.routeOptions?.url ?? ''
    if (url.startsWith('/api/v1/health')) return
    await requireAuth(request)
  })

  await app.register(
    async (api) => {
      api.get('/health', async () => ({ ok: true, service: 'govflow-api', time: new Date().toISOString() }))
      await api.register(authRoutes)
      await api.register(organizationRoutes, { prefix: '/organizations' })
      await api.register(departmentRoutes, { prefix: '/departments' })
      await api.register(userRoutes, { prefix: '/users' })
      await api.register(obligationRoutes, { prefix: '/obligations' })
      await api.register(evidenceRoutes, { prefix: '/evidence' })
      await api.register(handoverRoutes, { prefix: '/handovers' })
      await api.register(escalationRoutes, { prefix: '/escalations' })
      await api.register(notificationRoutes, { prefix: '/notifications' })
      await api.register(dashboardRoutes, { prefix: '/dashboard' })
      await api.register(reportRoutes, { prefix: '/reports' })
      await api.register(auditRoutes, { prefix: '/audit' })
      await api.register(searchRoutes, { prefix: '/search' })
    },
    { prefix: '/api/v1' },
  )

  return app
}
