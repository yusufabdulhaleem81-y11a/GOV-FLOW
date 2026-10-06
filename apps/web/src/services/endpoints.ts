import { api } from '@/lib/api'
import type {
  AppNotification,
  AuditEvent,
  Comment,
  CreateEvidenceInput,
  CreateObligationInput,
  DashboardResponse,
  Department,
  Escalation,
  EvidenceFile,
  Handover,
  MeResponse,
  ObligationDetail,
  ObligationListItem,
  ObligationListQuery,
  Paginated,
  ReportSummary,
  ScanResponse,
  SearchResponse,
  UpdateObligationInput,
} from '@govflow/types'

// ── auth / orgs ───────────────────────────────────────────────────────────────
export const getMe = () => api<MeResponse>('/me')
export const joinOrganization = (code: string) =>
  api<{ organization: MeResponse['memberships'][number]['organization'] }>('/join', { method: 'POST', body: { code } })
export const listOrganizations = () => api<{ data: MeResponse['memberships'] }>('/organizations')
export const createOrganization = (input: { name: string; description?: string }) =>
  api<{ organization: MeResponse['memberships'][number]['organization'] }>('/organizations', { method: 'POST', body: input })
export const updateOrganization = (id: string, patch: { name?: string; description?: string | null }) =>
  api<{ organization: MeResponse['memberships'][number]['organization'] }>(`/organizations/${id}`, { method: 'PATCH', body: patch })
export const regenerateInviteCode = (id: string) =>
  api<{ invite_code: string }>(`/organizations/${id}/invite-code`, { method: 'POST' })

export interface OrgMember {
  id: string
  role: string
  full_name: string | null
  email: string | null
  job_title: string | null
}
export const listMembers = () => api<{ data: OrgMember[] }>('/users')
export const updateMemberRole = (orgId: string, userId: string, role: string) =>
  api<{ ok: boolean }>(`/organizations/${orgId}/members/${userId}`, { method: 'PATCH', body: { role } })

// ── departments ───────────────────────────────────────────────────────────────
export interface DepartmentWithCount extends Department {
  obligation_count: number
}
export const listDepartments = () => api<{ data: DepartmentWithCount[] }>('/departments')
export const createDepartment = (input: { name: string; description?: string }) =>
  api<{ department: Department }>('/departments', { method: 'POST', body: input })
export const updateDepartment = (id: string, patch: { name?: string; description?: string }) =>
  api<{ department: Department }>(`/departments/${id}`, { method: 'PATCH', body: patch })
export const deleteDepartment = (id: string) => api<{ ok: boolean }>(`/departments/${id}`, { method: 'DELETE' })

// ── obligations ───────────────────────────────────────────────────────────────
export const listObligations = (query: ObligationListQuery) =>
  api<Paginated<ObligationListItem>>('/obligations', { query: query as Record<string, string | number | boolean | undefined> })
export const getObligation = (id: string) => api<{ obligation: ObligationDetail }>(`/obligations/${id}`)
export const createObligation = (input: CreateObligationInput) =>
  api<{ obligation: ObligationDetail }>('/obligations', { method: 'POST', body: input })
export const updateObligation = (id: string, patch: UpdateObligationInput) =>
  api<{ obligation: ObligationDetail }>(`/obligations/${id}`, { method: 'PATCH', body: patch })
export const transitionObligation = (id: string, action: string, note?: string) =>
  api<{ obligation: ObligationDetail }>(`/obligations/${id}/transition`, { method: 'POST', body: { action, note } })
export const closeObligation = (id: string, note?: string) =>
  api<{ obligation: ObligationDetail }>(`/obligations/${id}/close`, { method: 'POST', body: { note } })
export const listComments = (id: string) => api<{ data: Comment[] }>(`/obligations/${id}/comments`)
export const addComment = (id: string, content: string) =>
  api<{ comment: Comment }>(`/obligations/${id}/comments`, { method: 'POST', body: { content } })
export const listObligationAudit = (id: string) =>
  api<{ data: AuditEvent[]; total: number }>(`/obligations/${id}/audit`)

// ── evidence ──────────────────────────────────────────────────────────────────
export interface EvidenceWithRefs extends EvidenceFile {
  obligation_reference: string
  obligation_title: string
}
export const listEvidence = (query: { status?: string; obligation_id?: string }) =>
  api<{ data: EvidenceWithRefs[] }>('/evidence', { query })
export const registerEvidence = (input: CreateEvidenceInput) =>
  api<{ evidence: EvidenceFile }>('/evidence', { method: 'POST', body: input })
export const reviewEvidence = (id: string, decision: string, note?: string) =>
  api<{ evidence: EvidenceFile }>(`/evidence/${id}/review`, { method: 'POST', body: { decision, note } })
export const createSignedUrl = (path: string) =>
  api<{ signed_url: string }>('/evidence/signed-url', { method: 'POST', body: { path } })

// ── handovers & escalations ───────────────────────────────────────────────────
export interface HandoverWithRefs extends Handover {
  obligation_reference?: string
  obligation_title?: string
}
export const listHandovers = (status?: string) =>
  api<{ data: HandoverWithRefs[] }>('/handovers', { query: { status } })
export const requestHandover = (obligationId: string, to_user_id: string, reason?: string) =>
  api<{ handover: Handover }>('/handovers', { method: 'POST', body: { obligation_id: obligationId, to_user_id, reason } })
export const decideHandover = (id: string, decision: 'approve' | 'reject', note?: string) =>
  api<{ handover: Handover }>(`/handovers/${id}/${decision}`, { method: 'POST', body: { note } })

export interface EscalationWithRefs extends Escalation {
  obligation_reference?: string
  obligation_title?: string
}
export const listEscalations = (status?: string) => api<{ data: EscalationWithRefs[] }>('/escalations', { query: { status } })
export const escalateObligation = (obligationId: string, reason: string) =>
  api<{ escalation: Escalation }>(`/escalations/obligations/${obligationId}`, { method: 'POST', body: { reason } })
export const resolveEscalation = (id: string, note?: string) =>
  api<{ escalation: Escalation }>(`/escalations/${id}/resolve`, { method: 'POST', body: { note } })
export const runScan = () => api<ScanResponse>('/escalations/scan', { method: 'POST', body: {} })

// ── dashboard / reports / audit / search / notifications ─────────────────────
export const getDashboard = () => api<DashboardResponse>('/dashboard')
export const getReportSummary = () => api<ReportSummary>('/reports/summary')
export const listAudit = (query: { page?: number; pageSize?: number; action?: string }) =>
  api<{ data: AuditEvent[]; page: number; pageSize: number; total: number }>('/audit', { query })
export const search = (q: string) => api<SearchResponse>('/search', { query: { q } })
export const listNotifications = () =>
  api<{ data: AppNotification[]; unread: number }>('/notifications')
export const markNotificationRead = (id: string) => api<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' })
export const markAllNotificationsRead = () => api<{ ok: boolean }>('/notifications/read-all', { method: 'POST' })
