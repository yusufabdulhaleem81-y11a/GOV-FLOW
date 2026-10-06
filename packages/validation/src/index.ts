import { z } from 'zod'
import { EVIDENCE_STATUSES, OBLIGATION_STATUSES, PRIORITIES, USER_ROLES } from '@govflow/types'

const trimmed = (max: number) => z.string().trim().max(max)
const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

export const uuidSchema = z.string().uuid('Must be a valid identifier')

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date (YYYY-MM-DD)')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date')

// ── Auth / onboarding ─────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  full_name: requiredText(120, 'Full name'),
  invite_code: z.string().trim().max(16).optional(),
})

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const joinOrganizationSchema = z.object({
  code: requiredText(16, 'Invite code'),
})

export const updateProfileSchema = z.object({
  full_name: requiredText(120, 'Full name').optional(),
  job_title: trimmed(120).optional(),
})

// ── Organizations & members ───────────────────────────────────────────────────

export const createOrganizationSchema = z.object({
  name: requiredText(120, 'Organization name'),
  description: trimmed(500).optional(),
})

export const updateOrganizationSchema = z.object({
  name: requiredText(120, 'Organization name').optional(),
  description: trimmed(500).nullable().optional(),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(USER_ROLES),
})

// ── Departments ───────────────────────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: requiredText(120, 'Department name'),
  description: trimmed(500).optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial()

// ── Obligations ───────────────────────────────────────────────────────────────

export const evidenceRequirementInputSchema = z.object({
  title: requiredText(200, 'Evidence title'),
  description: trimmed(500).optional(),
})

const obligationCore = z.object({
  title: requiredText(200, 'Title'),
  description: trimmed(5000).optional(),
  department_id: uuidSchema.nullable().optional(),
  assignee_id: uuidSchema.nullable().optional(),
  reviewer_id: uuidSchema.nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: trimmed(80).optional(),
  source_reference: trimmed(120).optional(),
  tags: z.array(trimmed(40)).max(10).optional(),
  due_date: dateOnlySchema,
  escalation_enabled: z.boolean().optional(),
  escalate_after_days: z.number().int().min(0).max(90).optional(),
  requirements: z.array(evidenceRequirementInputSchema).max(20),
  publish: z.boolean().optional(),
})

function checkAssigneeReviewer(
  v: { reviewer_id?: string | null; assignee_id?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (v.reviewer_id && v.assignee_id && v.reviewer_id === v.assignee_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewer_id'],
      message: 'The reviewer cannot be the same person as the responsible user',
    })
  }
}

export const createObligationSchema = obligationCore.superRefine(checkAssigneeReviewer)

export const updateObligationSchema = obligationCore
  .omit({ requirements: true, publish: true })
  .extend({ due_date: dateOnlySchema.optional() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')
  .superRefine(checkAssigneeReviewer)

export const transitionSchema = z.object({
  action: z.enum([
    'open',
    'start_progress',
    'submit_for_review',
    'request_changes',
    'reopen',
    'cancel',
  ]),
  note: trimmed(500).optional(),
})

export const closeObligationSchema = z.object({
  note: trimmed(500).optional(),
})

export const escalateSchema = z.object({
  reason: requiredText(500, 'Reason'),
})

export const obligationListQuerySchema = z.object({
  q: trimmed(120).optional(),
  status: z.union([z.enum(OBLIGATION_STATUSES), z.literal('all_open')]).optional(),
  department_id: uuidSchema.optional(),
  assignee_id: uuidSchema.optional(),
  reviewer_id: uuidSchema.optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: trimmed(80).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  sort: z.enum(['deadline', 'created_at', 'updated_at', 'priority']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

// ── Evidence ──────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
] as const

export const MAX_FILE_SIZE = 25 * 1024 * 1024

export const createEvidenceSchema = z.object({
  obligation_id: uuidSchema,
  requirement_id: uuidSchema.nullable().optional(),
  file_name: requiredText(255, 'File name'),
  storage_path: requiredText(512, 'Storage path'),
  mime_type: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'Unsupported file type. Allowed: PDF, DOC/DOCX, XLS/XLSX, CSV, JPG, PNG' }),
  }),
  file_size: z
    .number()
    .int()
    .min(1, 'File is empty')
    .max(MAX_FILE_SIZE, 'File exceeds the 25 MB limit'),
  sha256: z.string().trim().max(64).optional(),
})

export const evidenceReviewSchema = z.object({
  decision: z.enum(['accepted', 'rejected', 'request_changes']),
  note: trimmed(1000).optional(),
})

export const signedUrlSchema = z.object({
  path: requiredText(512, 'Storage path'),
})

// ── Comments / handover / escalation ──────────────────────────────────────────

export const createCommentSchema = z.object({
  content: requiredText(4000, 'Comment'),
})

export const createHandoverSchema = z.object({
  obligation_id: uuidSchema,
  to_user_id: uuidSchema,
  reason: trimmed(500).optional(),
})

export const handoverDecisionSchema = z.object({
  note: trimmed(500).optional(),
})

export const resolveEscalationSchema = z.object({
  note: trimmed(500).optional(),
})

export const scanSchema = z.object({
  dry_run: z.boolean().optional(),
})

// ── Pagination helpers ────────────────────────────────────────────────────────

export const auditListQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  entity_id: uuidSchema.optional(),
  actor_id: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export const evidenceStatusSchema = z.enum(EVIDENCE_STATUSES)
