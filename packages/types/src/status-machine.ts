import type { ObligationAction, ObligationStatus, UserRole } from './enums.js'

/**
 * The single source of truth for the obligation lifecycle.
 *
 * CREATE → ASSIGN → DEADLINE → WORK → EVIDENCE → REVIEW → ACCEPT / CHANGES
 * REQUESTED → ESCALATE IF OVERDUE → CLOSE → AUDIT HISTORY
 */
export interface TransitionRule {
  from: ObligationStatus[]
  to: ObligationStatus
  /** Roles that may perform the action; relation-based checks are applied in the service layer. */
  roles: UserRole[]
  /** The assignee may perform the action on their own obligation. */
  assigneeAllowed: boolean
  /** The assigned reviewer may perform the action. */
  reviewerAllowed: boolean
  /** The creator may perform the action. */
  creatorAllowed: boolean
  label: string
}

const ACTIVE_STATUSES: ObligationStatus[] = [
  'open',
  'in_progress',
  'awaiting_evidence',
  'changes_requested',
]

export const TRANSITIONS: Record<ObligationAction, TransitionRule> = {
  open: {
    from: ['draft'],
    to: 'open',
    roles: ['admin', 'manager'],
    assigneeAllowed: true,
    reviewerAllowed: false,
    creatorAllowed: true,
    label: 'Publish obligation',
  },
  start_progress: {
    from: ['open', 'awaiting_evidence', 'changes_requested'],
    to: 'in_progress',
    roles: ['admin', 'manager'],
    assigneeAllowed: true,
    reviewerAllowed: false,
    creatorAllowed: false,
    label: 'Start work',
  },
  submit_for_review: {
    from: ['open', 'in_progress', 'awaiting_evidence', 'changes_requested'],
    to: 'under_review',
    roles: ['admin', 'manager'],
    assigneeAllowed: true,
    reviewerAllowed: false,
    creatorAllowed: false,
    label: 'Submit for review',
  },
  request_changes: {
    from: ['under_review'],
    to: 'changes_requested',
    roles: ['admin', 'manager'],
    assigneeAllowed: false,
    reviewerAllowed: true,
    creatorAllowed: false,
    label: 'Request changes',
  },
  reopen: {
    from: ['changes_requested'],
    to: 'awaiting_evidence',
    roles: ['admin', 'manager'],
    assigneeAllowed: true,
    reviewerAllowed: false,
    creatorAllowed: false,
    label: 'Resume work',
  },
  close: {
    from: ['under_review', 'escalated', 'overdue'],
    to: 'closed',
    roles: ['admin', 'manager'],
    assigneeAllowed: false,
    reviewerAllowed: true,
    creatorAllowed: false,
    label: 'Close obligation',
  },
  escalate: {
    from: [...ACTIVE_STATUSES, 'under_review', 'overdue'],
    to: 'escalated',
    roles: ['admin', 'manager'],
    assigneeAllowed: false,
    reviewerAllowed: false,
    creatorAllowed: false,
    label: 'Escalate',
  },
  cancel: {
    from: [
      'draft',
      'open',
      'in_progress',
      'awaiting_evidence',
      'under_review',
      'changes_requested',
      'overdue',
      'escalated',
    ],
    to: 'cancelled',
    roles: ['admin', 'manager'],
    assigneeAllowed: false,
    reviewerAllowed: false,
    creatorAllowed: true,
    label: 'Cancel obligation',
  },
  mark_overdue: {
    from: [...ACTIVE_STATUSES, 'under_review'],
    to: 'overdue',
    roles: ['admin', 'manager'],
    assigneeAllowed: false,
    reviewerAllowed: false,
    creatorAllowed: false,
    label: 'Mark overdue',
  },
}

export class TransitionError extends Error {
  readonly code = 'INVALID_TRANSITION'
  constructor(
    public readonly from: ObligationStatus,
    public readonly action: ObligationAction,
  ) {
    super(`Cannot apply "${action}" to an obligation in status "${from}".`)
    this.name = 'TransitionError'
  }
}

/** Validates that the action is legal for the current status. Throws TransitionError otherwise. */
export function assertTransition(from: ObligationStatus, action: ObligationAction): TransitionRule {
  const rule = TRANSITIONS[action]
  if (!rule.from.includes(from)) {
    throw new TransitionError(from, action)
  }
  return rule
}

export function canTransition(from: ObligationStatus, action: ObligationAction): boolean {
  const rule = TRANSITIONS[action]
  return rule.from.includes(from)
}

export interface ActorRelation {
  userId: string
  role: UserRole
  isAssignee: boolean
  isReviewer: boolean
  isCreator: boolean
}

/** Whether this actor may perform the action, combining role and relation checks. */
export function mayPerform(action: ObligationAction, actor: ActorRelation): boolean {
  const rule = TRANSITIONS[action]
  if (rule.roles.includes(actor.role)) return true
  if (actor.isAssignee && rule.assigneeAllowed) return true
  if (actor.isReviewer && rule.reviewerAllowed) return true
  if (actor.isCreator && rule.creatorAllowed) return true
  return false
}

/** Statuses that represent work still outstanding. */
export const OPEN_STATUSES: ObligationStatus[] = [
  'draft',
  'open',
  'in_progress',
  'awaiting_evidence',
  'under_review',
  'changes_requested',
  'overdue',
  'escalated',
]

/** Statuses from which evidence can still be uploaded by the assignee. */
export const WORKING_STATUSES: ObligationStatus[] = [
  'open',
  'in_progress',
  'awaiting_evidence',
  'changes_requested',
  'under_review',
  'overdue',
  'escalated',
]

/** Order used for the visual workflow stepper. */
export const WORKFLOW_STEPS: { status: ObligationStatus; label: string }[] = [
  { status: 'open', label: 'Assigned' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'awaiting_evidence', label: 'Awaiting Evidence' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'closed', label: 'Closed' },
]
