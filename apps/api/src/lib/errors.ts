import type { FastifyReply } from 'fastify'

/** Application error with an HTTP status and machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message)

export const notFound = (entity = 'Resource') => new AppError(404, 'NOT_FOUND', `${entity} not found`)

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details)

export function sendError(reply: FastifyReply, err: AppError): void {
  void reply.status(err.statusCode).send({
    error: { code: err.code, message: err.message, details: err.details },
  })
}
