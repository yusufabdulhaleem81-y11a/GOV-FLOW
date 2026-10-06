/** GovFlow user roles within an organization. Ordered from most to least privileged. */
export const USER_ROLES = ['admin', 'manager', 'reviewer', 'member', 'viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Organization Admin',
  manager: 'Manager',
  reviewer: 'Reviewer',
  member: 'Responsible User',
  viewer: 'Viewer',
}

/** Full obligation lifecycle. */
export const OBLIGATION_STATUSES = [
  'draft',
  'open',
  'in_progress',
  'awaiting_evidence',
  'under_review',
  'changes_requested',
  'overdue',
  'escalated',
  'closed',
  'cancelled',
] as const
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number]

export const STATUS_LABELS: Record<ObligationStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_evidence: 'Awaiting Evidence',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  overdue: 'Overdue',
  escalated: 'Escalated',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

/** Status of a required-evidence item and of uploaded evidence files. */
export const EVIDENCE_STATUSES = [
  'pending',
  'submitted',
  'under_review',
  'accepted',
  'rejected',
] as const
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export const HANDOVER_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number]

export const ESCALATION_STATUSES = ['active', 'resolved'] as const
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'obligation_assigned',
  'deadline_approaching',
  'obligation_overdue',
  'evidence_submitted',
  'evidence_accepted',
  'evidence_rejected',
  'changes_requested',
  'obligation_escalated',
  'handover_requested',
  'handover_approved',
  'handover_rejected',
  'comment_added',
  'obligation_closed',
  'obligation_cancelled',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  obligation_assigned: 'Obligation assigned',
  deadline_approaching: 'Deadline approaching',
  obligation_overdue: 'Obligation overdue',
  evidence_submitted: 'Evidence submitted',
  evidence_accepted: 'Evidence accepted',
  evidence_rejected: 'Evidence rejected',
  changes_requested: 'Changes requested',
  obligation_escalated: 'Obligation escalated',
  handover_requested: 'Handover requested',
  handover_approved: 'Handover approved',
  handover_rejected: 'Handover rejected',
  comment_added: 'New comment',
  obligation_closed: 'Obligation closed',
  obligation_cancelled: 'Obligation cancelled',
}

/** Explicit workflow actions a user can request on an obligation. */
export const OBLIGATION_ACTIONS = [
  'open',
  'start_progress',
  'submit_for_review',
  'request_changes',
  'reopen',
  'close',
  'escalate',
  'cancel',
  'mark_overdue',
] as const
export type ObligationAction = (typeof OBLIGATION_ACTIONS)[number]

/** Audit event actions (append-only history). */
export const AUDIT_ACTIONS = [
  'organization_created',
  'organization_updated',
  'member_joined',
  'member_role_changed',
  'member_removed',
  'invite_code_regenerated',
  'department_created',
  'department_updated',
  'department_deleted',
  'obligation_created',
  'obligation_updated',
  'obligation_assigned',
  'obligation_status_changed',
  'obligation_closed',
  'obligation_cancelled',
  'deadline_changed',
  'evidence_uploaded',
  'evidence_reviewed',
  'comment_added',
  'handover_requested',
  'handover_approved',
  'handover_rejected',
  'obligation_escalated',
  'escalation_resolved',
  'obligation_marked_overdue',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
