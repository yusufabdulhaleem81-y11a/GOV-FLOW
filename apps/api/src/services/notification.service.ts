import type { NotificationType } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { rows } from '../db/types.js'
import type { EmailSender } from './email.js'

export interface NotifyInput {
  organizationId: string
  userIds: (string | null | undefined)[]
  type: NotificationType
  title: string
  body?: string
  obligationId?: string | null
  data?: Record<string, unknown>
}

/**
 * Creates in-app notifications (service role — users receive notifications
 * about actions performed by others, which RLS forbids them from inserting)
 * and dispatches emails through the configured provider.
 */
export async function notifyUsers(
  serviceDB: DB,
  email: EmailSender,
  input: NotifyInput,
): Promise<void> {
  const userIds = [...new Set(input.userIds.filter((v): v is string => !!v))]
  if (userIds.length === 0) return

  const { error } = await serviceDB.from('notifications').insert(
    userIds.map((userId) => ({
      organization_id: input.organizationId,
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      obligation_id: input.obligationId ?? null,
      data: input.data ?? {},
    })),
  )
  if (error) {
    console.error('[notifications] failed to insert', error.message)
    return
  }

  // Email delivery is best-effort and must never break the main flow.
  void deliverEmails(serviceDB, email, userIds, input).catch((err) =>
    console.error('[notifications] email delivery failed', err),
  )
}

async function deliverEmails(
  serviceDB: DB,
  email: EmailSender,
  userIds: string[],
  input: NotifyInput,
): Promise<void> {
  const profiles = await rows<DbRow>(
    serviceDB.from('profiles').select('id, email').in('id', userIds),
  )
  await Promise.all(
    profiles.map((p) => {
      const to = p.email as string | null
      if (!to) return Promise.resolve()
      return email
        .send({
          to,
          subject: `GovFlow — ${input.title}`,
          text: input.body ?? input.title,
        })
        .catch((err) => console.error(`[notifications] email to ${to} failed`, err))
    }),
  )
}
