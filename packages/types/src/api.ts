import type {
  Comment,
  Department,
  Escalation,
  EvidenceFile,
  EvidenceRequirement,
  Handover,
  Obligation,
  Organization,
  Profile,
} from './entities.js'
import type { ObligationStatus, Priority, UserRole } from './enums.js'

export type { ObligationStatus, Priority, UserRole }

/** Standard API error envelope. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}

// ── Auth / me ─────────────────────────────────────────────────────────────────

export interface MeResponse {
  user: Profile
  memberships: {
    organization: Organization
    role: UserRole
  }[]
}

// ── Obligations ───────────────────────────────────────────────────────────────

export interface EvidenceSummary {
  required: number
  submitted: number
  accepted: number
}

export interface ObligationListItem {
  id: string
  reference: string
  title: string
  status: ObligationStatus
  priority: Priority
  category: string | null
  due_date: string
  tags: string[]
  department: Pick<Department, 'id' | 'name'> | null
  assignee: Pick<Profile, 'id' | 'full_name'> | null
  reviewer: Pick<Profile, 'id' | 'full_name'> | null
  created_at: string
  updated_at: string
  is_overdue: boolean
  comment_count: number
  evidence: EvidenceSummary
}

export interface ObligationDetail extends Obligation {
  files: EvidenceFile[]
  requirements: EvidenceRequirement[]
  comment_count: number
}

export interface ObligationListQuery {
  q?: string
  status?: ObligationStatus | 'all_open'
  department_id?: string
  assignee_id?: string
  reviewer_id?: string
  priority?: Priority
  category?: string
  overdue?: 'true' | 'false'
  due_before?: string
  due_after?: string
  sort?: 'deadline' | 'created_at' | 'updated_at' | 'priority'
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface CreateObligationInput {
  title: string
  description?: string
  department_id?: string | null
  assignee_id?: string | null
  reviewer_id?: string | null
  priority?: Priority
  category?: string
  source_reference?: string
  tags?: string[]
  due_date: string
  escalation_enabled?: boolean
  escalate_after_days?: number
  requirements: { title: string; description?: string }[]
  publish?: boolean
}

export interface UpdateObligationInput {
  title?: string
  description?: string
  department_id?: string | null
  assignee_id?: string | null
  reviewer_id?: string | null
  priority?: Priority
  category?: string
  source_reference?: string
  tags?: string[]
  due_date?: string
  escalation_enabled?: boolean
  escalate_after_days?: number
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface CreateEvidenceInput {
  obligation_id: string
  requirement_id?: string | null
  file_name: string
  storage_path: string
  mime_type: string
  file_size: number
  sha256?: string
}

export interface EvidenceReviewInput {
  decision: 'accepted' | 'rejected' | 'request_changes'
  note?: string
}

// ── Dashboard / reports ───────────────────────────────────────────────────────

export interface DashboardKpis {
  total: number
  open: number
  due_soon: number
  overdue: number
  escalated: number
  awaiting_review: number
  closed: number
}

export interface DashboardResponse {
  kpis: DashboardKpis
  charts: {
    byStatus: { status: ObligationStatus; count: number }[]
    byDepartment: { department: string; open: number; overdue: number; closed: number }[]
    trend: { date: string; created: number; closed: number }[]
    workload: { user: string; open: number; overdue: number }[]
    evidence: { status: string; count: number }[]
  }
  attention: ObligationListItem[]
}

export interface ReportSummary {
  generatedAt: string
  totals: {
    obligations: number
    open: number
    closed: number
    cancelled: number
    completionRate: number
  }
  overdue: ObligationListItem[]
  escalated: Escalation[]
  byDepartment: { department: string; total: number; open: number; closed: number; overdue: number }[]
  byUser: { user: string; total: number; open: number; closed: number; overdue: number }[]
  evidence: { status: string; count: number }[]
  closuresByMonth: { month: string; closed: number }[]
}

export type ReportExportType = 'overdue' | 'outstanding' | 'by_department' | 'by_user' | 'evidence'

// ── Search / audit ────────────────────────────────────────────────────────────

export interface SearchResponse {
  obligations: ObligationListItem[]
}

export interface AuditListQuery {
  action?: string
  entity_id?: string
  actor_id?: string
  page?: number
  pageSize?: number
}

// ── Misc payloads ─────────────────────────────────────────────────────────────

export interface CreateOrganizationInput {
  name: string
  description?: string
}

export interface UpdateMemberRoleInput {
  role: UserRole
}

export interface CreateDepartmentInput {
  name: string
  description?: string
}

export interface CreateCommentInput {
  content: string
}

export interface CreateHandoverInput {
  to_user_id: string
  reason?: string
}

export interface EscalateInput {
  reason: string
}

export interface ResolveEscalationInput {
  note?: string
}

export interface ScanResponse {
  marked_overdue: number
  auto_escalated: number
  deadline_reminders: number
}

export type { Comment, Department, Escalation, EvidenceFile, EvidenceRequirement, Handover, Organization, Profile }
