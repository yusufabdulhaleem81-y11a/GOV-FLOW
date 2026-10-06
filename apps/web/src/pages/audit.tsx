import { useState } from 'react'
import { ChevronLeft, ChevronRight, History } from 'lucide-react'
import { useAuditLog } from '@/hooks/queries'
import { PageHeader, Avatar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { formatDateTime } from '@govflow/types'

export function AuditPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const { data, isLoading } = useAuditLog(page, action || undefined)

  const events = data?.data ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHeader
        title="Audit History"
        description="Append-only record of every meaningful action. Entries cannot be edited or removed."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-56" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} aria-label="Filter by action">
          <option value="">All actions</option>
          <option value="obligation_created">Obligation created</option>
          <option value="obligation_updated">Obligation updated</option>
          <option value="obligation_assigned">Obligation assigned</option>
          <option value="obligation_status_changed">Status changed</option>
          <option value="obligation_closed">Obligation closed</option>
          <option value="obligation_cancelled">Obligation cancelled</option>
          <option value="deadline_changed">Deadline changed</option>
          <option value="evidence_uploaded">Evidence uploaded</option>
          <option value="evidence_reviewed">Evidence reviewed</option>
          <option value="comment_added">Comment added</option>
          <option value="handover_approved">Handover approved</option>
          <option value="obligation_escalated">Obligation escalated</option>
          <option value="escalation_resolved">Escalation resolved</option>
        </Select>
        <Input className="w-48" placeholder="Filter by summary…" disabled title="Full-text filtering is available through the API" />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={4} />
          </Table>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="No audit events found"
            description={action ? 'Try a different action filter.' : 'Actions taken across the organization will appear here.'}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar name={event.actor?.full_name ?? 'System'} className="h-6 w-6 text-[10px]" />
                        <span className="text-sm">{event.actor?.full_name ?? 'System'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{event.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.action.replaceAll('_', ' ')}</p>
                    </TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{event.entity_type.replaceAll('_', ' ')}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <p>{data?.total ?? 0} events — page {page} of {totalPages}</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
