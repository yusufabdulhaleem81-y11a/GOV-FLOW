import { useState } from 'react'
import { Check, Copy, KeyRound, Link2, Users } from 'lucide-react'
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
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const members = data?.data ?? []
  const isAdmin = role === 'admin'
  const inviteLink = inviteCode
    ? `${window.location.origin}/signup?invite_code=${encodeURIComponent(inviteCode)}`
    : null

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
              <Link2 className="h-4 w-4" /> Generate invite link
            </Button>
          )
        }
      />

      {inviteCode && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Share this link with an officer to join your organization.</p>
              <a
                href={inviteLink ?? undefined}
                className="mt-2 block break-all rounded border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 underline decoration-amber-400 underline-offset-2"
              >
                {inviteLink}
              </a>
              <p className="mt-2 text-xs">Invite code: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{inviteCode}</code></p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!inviteLink) return
                    setCopyMessage(null)
                    void navigator.clipboard.writeText(inviteLink).then(
                      () => setCopyMessage('Invite link copied.'),
                      () => setCopyMessage('Copy failed. Select and copy the link above.'),
                    )
                  }}
                >
                  {copyMessage === 'Invite link copied.' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy invite link
                </Button>
                {copyMessage && <span className="text-xs" role="status">{copyMessage}</span>}
              </div>
            </div>
          </div>
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
