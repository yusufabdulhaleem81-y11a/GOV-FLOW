import type { UserRole } from './enums.js'

/**
 * Permission keys enforced by the API. The frontend uses the same matrix only
 * to hide controls it knows the user cannot use — the backend is authoritative.
 */
export const PERMISSIONS = [
  'org:update',
  'org:manage_members',
  'department:manage',
  'obligation:create',
  'obligation:update_any',
  'obligation:escalate',
  'obligation:cancel',
  'obligation:reassign',
  'evidence:review',
  'handover:approve',
  'report:view',
  'audit:view',
  'user:view',
  'escalation:scan',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'org:update',
    'org:manage_members',
    'department:manage',
    'obligation:create',
    'obligation:update_any',
    'obligation:escalate',
    'obligation:cancel',
    'obligation:reassign',
    'evidence:review',
    'handover:approve',
    'report:view',
    'audit:view',
    'user:view',
    'escalation:scan',
  ],
  manager: [
    'department:manage',
    'obligation:create',
    'obligation:update_any',
    'obligation:escalate',
    'obligation:cancel',
    'obligation:reassign',
    'evidence:review',
    'handover:approve',
    'report:view',
    'audit:view',
    'user:view',
    'escalation:scan',
  ],
  reviewer: ['report:view', 'user:view', 'evidence:review'],
  member: ['user:view'],
  viewer: ['report:view'],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}

/**
 * Which obligation sets a role can see in list views:
 * - admin/manager/reviewer/viewer see every obligation in the organization
 * - member sees only obligations where they are assignee, reviewer or creator
 */
export function seesAllObligations(role: UserRole): boolean {
  return role !== 'member'
}

/** Who may comment on an obligation (in addition to org-level read access). */
export function mayComment(role: UserRole): boolean {
  return role !== 'viewer'
}
