import { describe, expect, it } from 'vitest'
import { TRANSITIONS, assertTransition, canTransition, mayPerform, type ObligationStatus } from '@govflow/types'
import { evaluateCloseReadiness, generateReference } from '../../src/core/rules.js'
import { decideScanActions, type ScanCandidate } from '../../src/core/escalation-policy.js'

describe('status machine', () => {
  it('allows the happy path: draft → open → in_progress → under_review → closed', () => {
    expect(canTransition('draft', 'open')).toBe(true)
    expect(canTransition('open', 'start_progress')).toBe(true)
    expect(canTransition('in_progress', 'submit_for_review')).toBe(true)
    expect(canTransition('under_review', 'close')).toBe(true)
  })

  it('rejects illegal transitions', () => {
    expect(canTransition('closed', 'open')).toBe(false)
    expect(canTransition('draft', 'close')).toBe(false)
    expect(canTransition('open', 'close')).toBe(false)
    expect(canTransition('cancelled', 'start_progress')).toBe(false)
    expect(() => assertTransition('draft', 'close')).toThrowError(/Cannot apply/)
  })

  it('allows rework loops through changes_requested', () => {
    expect(canTransition('under_review', 'request_changes')).toBe(true)
    expect(canTransition('changes_requested', 'reopen')).toBe(true)
    expect(canTransition('awaiting_evidence', 'submit_for_review')).toBe(true)
  })

  it('escalate works from any active status but not closed/cancelled/draft', () => {
    for (const status of ['open', 'in_progress', 'awaiting_evidence', 'changes_requested', 'overdue', 'under_review'] as ObligationStatus[]) {
      expect(canTransition(status, 'escalate')).toBe(true)
    }
    for (const status of ['draft', 'closed', 'cancelled'] as ObligationStatus[]) {
      expect(canTransition(status, 'escalate')).toBe(false)
    }
  })

  it('mark_overdue only applies to working statuses', () => {
    expect(canTransition('open', 'mark_overdue')).toBe(true)
    expect(canTransition('draft', 'mark_overdue')).toBe(false)
    expect(canTransition('closed', 'mark_overdue')).toBe(false)
  })

  it('every action defines transitions, roles and relation flags', () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(rule.from.length).toBeGreaterThan(0)
      expect(rule.roles.length).toBeGreaterThan(0)
      expect(typeof rule.assigneeAllowed).toBe('boolean')
      expect(typeof rule.reviewerAllowed).toBe('boolean')
      expect(typeof rule.creatorAllowed).toBe('boolean')
    }
  })
})

describe('permission relations', () => {
  const base = { userId: 'u1' }

  it('managers can do everything workflow-related', () => {
    const actor = { ...base, role: 'manager', isAssignee: false, isReviewer: false, isCreator: false } as const
    expect(mayPerform('open', actor)).toBe(true)
    expect(mayPerform('close', actor)).toBe(true)
    expect(mayPerform('escalate', actor)).toBe(true)
    expect(mayPerform('cancel', actor)).toBe(true)
  })

  it('assignee can progress work but cannot close or escalate', () => {
    const actor = { ...base, role: 'member', isAssignee: true, isReviewer: false, isCreator: false } as const
    expect(mayPerform('start_progress', actor)).toBe(true)
    expect(mayPerform('submit_for_review', actor)).toBe(true)
    expect(mayPerform('close', actor)).toBe(false)
    expect(mayPerform('escalate', actor)).toBe(false)
    expect(mayPerform('cancel', actor)).toBe(false)
  })

  it('assigned reviewer can request changes and close but not escalate', () => {
    const actor = { ...base, role: 'reviewer', isAssignee: false, isReviewer: true, isCreator: false } as const
    expect(mayPerform('request_changes', actor)).toBe(true)
    expect(mayPerform('close', actor)).toBe(true)
    expect(mayPerform('escalate', actor)).toBe(false)
  })

  it('creator can publish a draft and cancel, but not close', () => {
    const actor = { ...base, role: 'member', isAssignee: false, isReviewer: false, isCreator: true } as const
    expect(mayPerform('open', actor)).toBe(true)
    expect(mayPerform('cancel', actor)).toBe(true)
    expect(mayPerform('close', actor)).toBe(false)
  })

  it('viewers can do nothing', () => {
    const actor = { ...base, role: 'viewer', isAssignee: false, isReviewer: false, isCreator: false } as const
    for (const action of Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[]) {
      expect(mayPerform(action, actor)).toBe(false)
    }
  })
})

describe('close readiness', () => {
  it('blocks closure while required evidence is not accepted', () => {
    const result = evaluateCloseReadiness([
      { id: '1', title: 'Payment voucher', status: 'accepted' },
      { id: '2', title: 'Receipt', status: 'submitted' },
    ])
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Receipt')
  })

  it('allows closure when all evidence is accepted', () => {
    const result = evaluateCloseReadiness([
      { id: '1', title: 'Payment voucher', status: 'accepted' },
      { id: '2', title: 'Receipt', status: 'accepted' },
    ])
    expect(result.ok).toBe(true)
  })

  it('allows closure with no evidence requirements', () => {
    expect(evaluateCloseReadiness([]).ok).toBe(true)
  })
})

describe('reference generation', () => {
  it('produces GOV-YY-XXXXXX shaped references', () => {
    const ref = generateReference()
    expect(ref).toMatch(/^GOV-\d{2}-[A-HJ-NP-Z2-9]{6}$/)
  })
})

describe('escalation policy', () => {
  const mk = (over: Partial<ScanCandidate>): ScanCandidate => ({
    id: 'o1',
    organization_id: 'org-a',
    title: 'T',
    reference: 'GOV-1',
    status: 'open',
    due_date: '2020-01-01',
    assignee_id: 'u1',
    reviewer_id: null,
    escalation_enabled: true,
    escalate_after_days: 3,
    ...over,
  })

  it('marks active obligations past their deadline as overdue', () => {
    const decisions = decideScanActions([mk({ due_date: '2020-01-01' })], new Date('2026-01-10T12:00:00Z'))
    expect(decisions.some((d) => d.action === 'mark_overdue')).toBe(true)
  })

  it('auto-escalates overdue obligations past the threshold', () => {
    const decisions = decideScanActions([mk({ due_date: '2020-01-01', escalate_after_days: 3 })], new Date('2026-01-10T12:00:00Z'))
    expect(decisions.some((d) => d.action === 'escalate')).toBe(true)
  })

  it('does not escalate when escalation is disabled or threshold not reached', () => {
    const disabled = decideScanActions([mk({ escalation_enabled: false })], new Date('2026-01-10T12:00:00Z'))
    expect(disabled.some((d) => d.action === 'escalate')).toBe(false)

    const fresh = decideScanActions([mk({ due_date: '2026-01-09', escalate_after_days: 3 })], new Date('2026-01-10T12:00:00Z'))
    expect(fresh.some((d) => d.action === 'escalate')).toBe(false)
    expect(fresh.some((d) => d.action === 'mark_overdue')).toBe(true)
  })

  it('reminds for deadlines within 2 days', () => {
    const decisions = decideScanActions([mk({ due_date: '2026-01-11' })], new Date('2026-01-10T12:00:00Z'))
    expect(decisions.some((d) => d.action === 'remind')).toBe(true)
  })

  it('skips already-escalated and terminal obligations', () => {
    const decisions = decideScanActions(
      [mk({ status: 'escalated' }), mk({ status: 'closed' }), mk({ status: 'cancelled' })],
      new Date('2026-01-10T12:00:00Z'),
    )
    expect(decisions).toHaveLength(0)
  })
})
