import { Link } from 'react-router-dom'
import { FileCheck2 } from 'lucide-react'
import { useObligations } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { DueBadge, EvidenceProgress } from '@/components/shared/badges'

/** Evidence review queue: obligations currently in review. */
export function ReviewsPage() {
  const { profile: user, role } = useAuth()
  const isReviewerOnly = role === 'reviewer'
  const { data, isLoading } = useObligations({ status: 'under_review', pageSize: 50, sort: 'deadline', dir: 'asc' })

  const rows = (data?.data ?? []).filter((item) => {
    if (!isReviewerOnly) return true
    return item.reviewer?.id === user?.id
  })

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Submitted evidence waiting for a decision. Accept, reject or request changes from the obligation page."
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={5} />
          </Table>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-6 w-6" />}
            title="Nothing to review right now"
            description="When responsible users submit evidence, the obligations appear here for review."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Evidence accepted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[340px]">
                    <Link to={`/obligations/${item.id}`} className="block truncate font-medium hover:text-primary focus-ring rounded-sm">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.reference}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.assignee?.full_name ?? 'Unassigned'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{item.reviewer?.full_name ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap"><DueBadge dueDate={item.due_date} /></TableCell>
                  <TableCell>
                    <EvidenceProgress required={item.evidence.required} accepted={item.evidence.accepted} submitted={item.evidence.submitted} />
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
