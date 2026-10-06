import { useState } from 'react'
import { KeyRound, Users } from 'lucide-react'
import { useMembers, useOrgMutation } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import * as api from '@/services/endpoints'
import { PageHeader, Avatar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { USER_ROLES, ROLE_LABELS, type UserRole } from '@govflow/types'

export function UsersPage() {
  const { profile: current, organization, role } = useAuth()
  const { data, isLoading } = useMembers()
  const updateRole = useOrgMutation((input: { userId: string; orgId: string; role: string }) => api.updateMemberRole(input.orgId, input.userId, input.role), { successTitle: 'Role updated' })
  const regenerate = useOrgMutation(() => api.regenerateInviteCode(organization!.id), { successTitle: 'New invite code generated' })
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const members = data?.data ?? []
  const isAdmin = role === 'admin'

  return (
    <>
      <PageHeader
        title="Users"
        description="People in your organization and their roles."
        actions={
          isAdmin && (
            <Button
              size="sm"
              variant="outline"
              loading={regenerate.isPending}
              onClick={() =>
                regenerate.mutate(undefined, {
                  onSuccess: (result) => setInviteCode(result.invite_code),
                })
              }
            >
              <KeyRound className="h-4 w-4" /> Regenerate invite code
            </Button>
          )
        }
      />

      {inviteCode && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <KeyRound className="h-4 w-4 shrink-0" />
          <span>
            Invite code: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">{inviteCode}</code> — share it with colleagues so they can join during sign-up.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={4} />
          </Table>
        ) : members.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members found" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.full_name} />
                      <div>
                        <p className="text-sm font-medium">{m.full_name ?? '—'}</p>
                        {m.job_title && <p className="text-xs text-muted-foreground">{m.job_title}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    {isAdmin && m.id !== current?.id ? (
                      <Select
                        className="w-44"
                        value={m.role}
                        aria-label={`Role for ${m.full_name ?? m.email}`}
                        onChange={(e) => updateRole.mutate({ userId: m.id, orgId: organization!.id, role: e.target.value })}
                      >
                        {USER_ROLES.map((r: UserRole) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="text-sm">{ROLE_LABELS[m.role as UserRole] ?? m.role}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
