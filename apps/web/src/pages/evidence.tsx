import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck2 } from 'lucide-react'
import { useEvidenceList } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { PageHeader, Tabs } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EVIDENCE_STATUS_LABELS, formatDateTime, formatFileSize, type EvidenceStatus } from '@govflow/types'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
]

const VARIANT: Record<EvidenceStatus, 'neutral' | 'info' | 'success' | 'destructive' | 'violet'> = {
  pending: 'neutral',
  submitted: 'info',
  under_review: 'violet',
  accepted: 'success',
  rejected: 'destructive',
}

export function EvidencePage() {
  const [tab, setTab] = useState('all')
  const { role } = useAuth()
  const { data, isLoading } = useEvidenceList(tab === 'all' ? {} : { status: tab })
  const files = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Evidence"
        description={
          role === 'member'
            ? 'Files you and your colleagues have uploaded against required evidence.'
            : 'All evidence files across the organization, with review state.'
        }
        actions={<Tabs tabs={TABS} active={tab} onChange={setTab} />}
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Obligation</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={5} />
          </Table>
        ) : files.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-6 w-6" />}
            title="No evidence files yet"
            description="Evidence uploaded from obligation pages appears here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Obligation</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="max-w-[260px]">
                    <p className="truncate font-medium">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <Link to={`/obligations/${file.obligation_id}`} className="block truncate text-sm hover:text-primary focus-ring rounded-sm">
                      {file.obligation_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{file.obligation_reference}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{file.uploader?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANT[file.status as EvidenceStatus]}>{EVIDENCE_STATUS_LABELS[file.status as EvidenceStatus]}</Badge>
                    {file.review_note && <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground" title={file.review_note}>{file.review_note}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(file.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
