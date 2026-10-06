import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useEscalations, useOrgMutation } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { PageHeader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Textarea } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { resolveEscalation, runScan } from '@/services/endpoints'
import { formatDateTime } from '@govflow/types'

export function EscalationsPage() {
  const { role } = useAuth()
  const isManager = role === 'admin' || role === 'manager'
  const { data, isLoading } = useEscalations('active')
  const [resolving, setResolving] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const resolve = useOrgMutation((input: { id: string; note?: string }) => resolveEscalation(input.id, input.note), {
    successTitle: 'Escalation resolved',
  })
  const scan = useOrgMutation(() => runScan(), { successTitle: 'Deadline scan complete' })
  const escalations = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Escalations"
        description="Obligations that required management attention — resolved once the workflow recovers."
        actions={
          isManager && (
            <Button variant="outline" size="sm" loading={scan.isPending} onClick={() => scan.mutate(undefined)} title="Check deadlines, mark overdue items and apply automatic escalation">
              Run deadline scan
            </Button>
          )
        }
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={5} />
          </Table>
        ) : escalations.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6" />}
            title="No active escalations"
            description="Escalations appear here when obligations slip past their escalation threshold or a manager escalates them manually."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Escalated by</TableHead>
                <TableHead>When</TableHead>
                <TableHead>State</TableHead>
                {isManager && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalations.map((esc) => (
                <TableRow key={esc.id}>
                  <TableCell className="max-w-[300px]">
                    <Link to={`/obligations/${esc.obligation_id}`} className="block truncate font-medium hover:text-primary focus-ring rounded-sm">
                      {esc.obligation_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{esc.obligation_reference}</p>
                  </TableCell>
                  <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                    <span className="line-clamp-2">{esc.reason}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{esc.escalator?.full_name ?? 'System (policy)'}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(esc.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={esc.status === 'active' ? 'destructive' : 'success'}>{esc.status}</Badge>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      {esc.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => setResolving(esc.id)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title="Resolve escalation"
        description="The obligation returns to its previous workflow status."
        footer={
          <>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
            <Button
              loading={resolve.isPending}
              onClick={() => {
                if (!resolving) return
                resolve.mutate(
                  { id: resolving, note: note.trim() || undefined },
                  {
                    onSuccess: () => {
                      setResolving(null)
                      setNote('')
                    },
                  },
                )
              }}
            >
              Resolve
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="resolve-note">Resolution note (optional)</Label>
          <Textarea id="resolve-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this unblocked?" />
        </div>
      </Dialog>
    </>
  )
}
