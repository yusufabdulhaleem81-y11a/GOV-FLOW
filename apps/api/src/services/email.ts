import type { ApiEnv } from '../config/env.js'

export interface EmailInput {
  to: string
  subject: string
  text: string
}

export interface EmailSender {
  send(input: EmailInput): Promise<void>
}

/**
 * Development notification mode: emails are printed to the API console instead
 * of being delivered. Keeps the notification architecture real without
 * requiring SMTP credentials during development.
 */
export class ConsoleEmailSender implements EmailSender {
  async send(input: EmailInput): Promise<void> {
    console.info(
      `📧 [dev email mode] to=${input.to} subject="${input.subject}"\n${input.text}`,
    )
  }
}

/** Transactional email via the Resend HTTP API (no SDK dependency). */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: EmailInput): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Resend email failed (${res.status}): ${body}`)
    }
  }
}

export function createEmailSender(env: ApiEnv): EmailSender {
  if (env.RESEND_API_KEY) {
    const from = env.EMAIL_FROM || 'GovFlow <onboarding@resend.dev>'
    console.info('📧 Email provider: Resend')
    return new ResendEmailSender(env.RESEND_API_KEY, from)
  }
  console.info('📧 Email provider: console (development mode — set RESEND_API_KEY to send real email)')
  return new ConsoleEmailSender()
}
