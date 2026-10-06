import type { ObligationStatus } from '@govflow/types'
import { computeDue } from '@govflow/types'

export interface ScanCandidate {
  id: string
  organization_id: string
  title: string
  reference: string
  status: ObligationStatus
  due_date: string
  assignee_id: string | null
  reviewer_id: string | null
  escalation_enabled: boolean
  escalate_after_days: number
}

export type ScanAction = 'remind' | 'mark_overdue' | 'escalate'

export interface ScanDecision {
  obligationId: string
  organizationId: string
  action: ScanAction
  /** Days overdue (for mark_overdue / escalate) */
  daysOverdue?: number
}

const WORKING_STATUSES: ObligationStatus[] = [
  'open',
  'in_progress',
  'awaiting_evidence',
  'changes_requested',
  'under_review',
  'escalated',
]

/**
 * Pure escalation policy:
 *  1. active obligations due within 2 days get a deadline reminder (deduplicated upstream)
 *  2. active obligations past their deadline are marked overdue
 *  3. overdue obligations past their escalate_after_days threshold are escalated
 */
export function decideScanActions(candidates: ScanCandidate[], now: Date = new Date()): ScanDecision[] {
  const decisions: ScanDecision[] = []

  for (const c of candidates) {
    const due = computeDue(c.due_date, now)

    if (c.status === 'escalated') continue // already at the top of the escalation chain

    if (WORKING_STATUSES.includes(c.status) && due.days < 0) {
      decisions.push({
        obligationId: c.id,
        organizationId: c.organization_id,
        action: 'mark_overdue',
        daysOverdue: Math.abs(due.days),
      })
      if (c.escalation_enabled && Math.abs(due.days) >= c.escalate_after_days && c.escalate_after_days > 0) {
        decisions.push({
          obligationId: c.id,
          organizationId: c.organization_id,
          action: 'escalate',
          daysOverdue: Math.abs(due.days),
        })
      }
      continue
    }

    // Deadline reminder: active, not yet overdue, due within the next 2 days
    if (WORKING_STATUSES.includes(c.status) && c.status !== 'overdue' && due.days >= 0 && due.days <= 2) {
      decisions.push({
        obligationId: c.id,
        organizationId: c.organization_id,
        action: 'remind',
      })
    }
  }
  return decisions
}
