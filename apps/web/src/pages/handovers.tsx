import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useHandovers, useOrgMutation } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { PageHeader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { decideHandover } from '@/services/endpoints'
import { formatDateTime } from '@govflow/types'

export function HandoversPage() {
  const { role } = useAuth()
  const isManager = role === 'admin' || role === 'manager'
  const { data, isLoading } = useHandovers()
  const decide = useOrgMutation((input: { id: string; decision: 'approve' | 'reject' }) => decideHandover(input.id, input.decision), {
    successTitle: 'Handover decided',
  })
  const handovers = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Handovers"
        description="Responsibility transfers between people — every decision is recorded in the audit history."
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={5} />
          </Table>
        ) : handovers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No handovers yet"
            description="When someone requests to hand an obligation to a colleague, it appears here for approval."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                {isManager && <TableHead className="text-right">Decision</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {handovers.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="max-w-[260px]">
                    <Link to={`/obligations/${h.obligation_id}`} className="block truncate font-medium hover:text-primary focus-ring rounded-sm">
                      {h.obligation_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{h.obligation_reference}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {h.from_user?.full_name ?? '—'} → <span className="font-medium">{h.to_user?.full_name ?? '—'}</span>
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                    <span className="line-clamp-2">{h.reason}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={h.status === 'pending' ? 'warning' : h.status === 'approved' ? 'success' : 'neutral'}>{h.status}</Badge>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      {h.status === 'pending' && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" loading={decide.isPending} onClick={() => decide.mutate({ id: h.id, decision: 'approve' })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" loading={decide.isPending} onClick={() => decide.mutate({ id: h.id, decision: 'reject' })}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
