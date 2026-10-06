import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../app-context.js'
import { rows } from '../db/types.js'
import { routeId } from './helpers.js'

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const user = await requireAuth(request)
    const db = app.deps.dbForToken(request.token)
    const data = await rows(
      db
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    )
    return { data, unread: data.filter((n) => !n.read_at).length }
  })

  app.post('/:id/read', async (request) => {
    const user = await requireAuth(request)
    const db = app.deps.dbForToken(request.token)
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', routeId(request))
      .eq('user_id', user.id)
    return { ok: true }
  })

  app.post('/read-all', async (request) => {
    const user = await requireAuth(request)
    const db = app.deps.dbForToken(request.token)
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    return { ok: true }
  })
}
