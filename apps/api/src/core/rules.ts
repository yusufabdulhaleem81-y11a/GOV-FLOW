import type { EvidenceStatus } from '@govflow/types'

/** Generates an organization-scoped human reference like "GOV-26-4F7QK2". */
export function generateReference(random: () => number = Math.random): string {
  const year = String(new Date().getFullYear()).slice(-2)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(random() * alphabet.length)] ?? 'A'
  }
  return `GOV-${year}-${suffix}`
}

export interface CloseEvaluation {
  ok: boolean
  reason: string | null
}

/**
 * Closing rules: an obligation may only be closed when every required
 * evidence item has been ACCEPTED. Obligations defined without evidence
 * requirements may be closed once they are in review.
 */
export function evaluateCloseReadiness(
  requirements: { id: string; title: string; status: EvidenceStatus }[],
): CloseEvaluation {
  if (requirements.length === 0) return { ok: true, reason: null }
  const unaccepted = requirements.filter((r) => r.status !== 'accepted')
  if (unaccepted.length === 0) return { ok: true, reason: null }
  const reason =
    unaccepted.length === 1
      ? `Required evidence "${unaccepted[0]?.title}" has not been accepted yet.`
      : `${unaccepted.length} required evidence items have not been accepted yet.`
  return { ok: false, reason }
}
