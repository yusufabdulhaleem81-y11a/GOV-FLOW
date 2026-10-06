import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, PRIORITY_LABELS, computeDue, type ObligationStatus, type Priority } from '@govflow/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, CalendarClock } from 'lucide-react'

const STATUS_VARIANTS: Record<ObligationStatus, 'info' | 'warning' | 'destructive' | 'success' | 'violet' | 'neutral' | 'default'> = {
  draft: 'neutral',
  open: 'info',
  in_progress: 'info',
  awaiting_evidence: 'warning',
  under_review: 'violet',
  changes_requested: 'warning',
  overdue: 'destructive',
  escalated: 'destructive',
  closed: 'success',
  cancelled: 'neutral',
}

export function StatusBadge({ status, className }: { status: ObligationStatus; className?: string }) {
  const variant = STATUS_VARIANTS[status]
  return (
    <Badge variant={variant} className={cn('whitespace-nowrap', className)}>
      {status === 'escalated' && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const PRIORITY_VARIANTS: Record<Priority, 'neutral' | 'info' | 'warning' | 'destructive'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'destructive',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANTS[priority]}>{PRIORITY_LABELS[priority]}</Badge>
}

export function DueBadge({ dueDate, closed }: { dueDate: string; closed?: boolean }) {
  const due = computeDue(dueDate)
  if (closed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {due.label}
      </span>
    )
  }
  const variant =
    due.bucket === 'overdue' ? 'destructive' : due.bucket === 'today' || due.bucket === 'tomorrow' ? 'warning' : 'neutral'
  return (
    <Badge variant={variant} className={cn('whitespace-nowrap', due.bucket === 'later' && 'border-transparent bg-transparent px-0 text-muted-foreground')}>
      <CalendarClock className="h-3 w-3" aria-hidden />
      {due.label}
    </Badge>
  )
}

export function EvidenceProgress({ required, accepted, submitted }: { required: number; accepted: number; submitted: number }) {
  if (required === 0) return <span className="text-xs text-muted-foreground">—</span>
  const color = accepted === required ? 'bg-emerald-500' : accepted + submitted > 0 ? 'bg-violet-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-2" title={`${accepted}/${required} accepted`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${(accepted / required) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {accepted}/{required}
      </span>
    </div>
  )
}
