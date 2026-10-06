import type { FastifyInstance } from 'fastify'
import { requireOrg } from '../app-context.js'
import { exportReportCsv, getReportSummary } from '../services/report.service.js'
import { makeCtx } from './helpers.js'
import { badRequest } from '../lib/errors.js'
import { z } from 'zod'

const exportTypes = ['overdue', 'outstanding', 'by_department', 'by_user', 'evidence'] as const

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/summary', async (request) => {
    const org = await requireOrg(request)
    return getReportSummary(makeCtx(request, org))
  })

  app.get('/export', async (request, reply) => {
    const org = await requireOrg(request)
    const query = z.object({ type: z.enum(exportTypes) }).safeParse(request.query)
    if (!query.success) throw badRequest('Invalid export type')
    const { csv, filename } = await exportReportCsv(makeCtx(request, org), query.data.type)
    void reply.header('Content-Type', 'text/csv; charset=utf-8')
    void reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return csv
  })
}
