import type { FastifyInstance } from 'fastify'
import { requireOrg, requireRole } from '../app-context.js'
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '../services/department.service.js'
import { makeCtx, routeId, validateBody } from './helpers.js'
import { createDepartmentSchema, updateDepartmentSchema } from '@govflow/validation'

export async function departmentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const org = await requireOrg(request)
    return { data: await listDepartments(makeCtx(request, org)) }
  })

  app.post('/', async (request) => {
    const org = await requireRole(request, 'admin', 'manager')
    const body = validateBody(createDepartmentSchema, request.body)
    return { department: await createDepartment(makeCtx(request, org), body) }
  })

  app.patch('/:id', async (request) => {
    const org = await requireRole(request, 'admin', 'manager')
    const body = validateBody(updateDepartmentSchema, request.body)
    return {
      department: await updateDepartment(makeCtx(request, org), routeId(request), body),
    }
  })

  app.delete('/:id', async (request) => {
    const org = await requireRole(request, 'admin')
    await deleteDepartment(makeCtx(request, org), routeId(request))
    return { ok: true }
  })
}
