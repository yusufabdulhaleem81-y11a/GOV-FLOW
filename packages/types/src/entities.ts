import type {
  AuditAction,
  EscalationStatus,
  EvidenceStatus,
  HandoverStatus,
  NotificationType,
  ObligationStatus,
  Priority,
  UserRole,
} from './enums.js'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  invite_code: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  job_title: string | null
  created_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  created_at: string
  /** Embedded via FK select */
  profile?: Profile | null
  organization?: Organization | null
}

export interface Department {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface EvidenceRequirement {
  id: string
  organization_id: string
  obligation_id: string
  title: string
  description: string | null
  status: EvidenceStatus
  sort_order: number
  created_at: string
  updated_at: string
  /** Latest file submitted against this requirement */
  files?: EvidenceFile[]
}

export interface EvidenceFile {
  id: string
  organization_id: string
  obligation_id: string
  requirement_id: string | null
  uploaded_by: string
  file_name: string
  storage_path: string
  mime_type: string
  file_size: number
  sha256: string | null
  status: Exclude<EvidenceStatus, 'pending'>
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  /** Embedded profiles */
  uploader?: Profile | null
  reviewer?: Profile | null
}

export interface Obligation {
  id: string
  organization_id: string
  reference: string
  title: string
  description: string | null
  department_id: string | null
  assignee_id: string | null
  reviewer_id: string | null
  created_by: string
  status: ObligationStatus
  priority: Priority
  category: string | null
  source_reference: string | null
  tags: string[]
  due_date: string
  escalation_enabled: boolean
  escalate_after_days: number
  previous_status: ObligationStatus | null
  closed_at: string | null
  closed_by: string | null
  created_at: string
  updated_at: string
  /** Embedded relations */
  department?: Department | null
  assignee?: Profile | null
  reviewer?: Profile | null
  creator?: Profile | null
  requirements?: EvidenceRequirement[]
  files?: EvidenceFile[]
}

export interface Comment {
  id: string
  organization_id: string
  obligation_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile | null
}

export interface Handover {
  id: string
  organization_id: string
  obligation_id: string
  from_user_id: string
  to_user_id: string
  requested_by: string
  status: HandoverStatus
  reason: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  obligation?: Obligation | null
  from_user?: Profile | null
  to_user?: Profile | null
  requester?: Profile | null
  decider?: Profile | null
}

export interface Escalation {
  id: string
  organization_id: string
  obligation_id: string
  escalated_by: string | null
  reason: string | null
  status: EscalationStatus
  resolved_by: string | null
  resolved_at: string | null
  resolved_to_status: ObligationStatus | null
  created_at: string
  obligation?: Obligation | null
  escalator?: Profile | null
}

export interface AppNotification {
  id: string
  organization_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  obligation_id: string | null
  data: Record<string, unknown>
  read_at: string | null
  emailed_at: string | null
  created_at: string
}

export interface AuditEvent {
  id: string
  organization_id: string
  actor_id: string | null
  action: AuditAction
  entity_type: string
  entity_id: string | null
  summary: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: Profile | null
}
