import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useObligation } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { Spinner } from '@/components/ui/misc'
import { StatusBadge, PriorityBadge, DueBadge } from '@/components/shared/badges'
import { EvidencePanel } from '@/features/obligation/evidence-panel'
import { CommentsPanel } from '@/features/obligation/comments-panel'
import { ActivityPanel } from '@/features/obligation/activity-panel'
import { ObligationActions } from '@/features/obligation/obligation-actions'
import { formatDate, formatDateTime, hasPermission } from '@govflow/types'
import { WORKFLOW_STEPS } from '@govflow/types'
import { cn } from '@/lib/utils'

function WorkflowStepper({ status }: { status: string }) {
  const order = ['draft', 'open', 'in_progress', 'awaiting_evidence', 'under_review', 'closed']
  const currentIndex = order.indexOf(status)
  const isTerminal = status === 'cancelled'
  const activeIndex = status === 'closed' ? order.length - 1 : currentIndex === -1 ? 1 : currentIndex

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-center" aria-label="Workflow progress">
      {WORKFLOW_STEPS.map((step, i) => {
        const stepIndex = order.indexOf(step.status)
        const reached = !isTerminal && activeIndex >= stepIndex && activeIndex !== -1
        const isCurrent = !isTerminal && activeIndex === stepIndex
        return (
          <li key={step.status} className="flex items-center gap-2 sm:flex-1">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                reached ? 'border-primary bg-primary text-white' : 'border-border bg-card text-muted-foreground',
                isCurrent && 'ring-2 ring-primary/30',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {reached ? '✓' : i + 1}
            </span>
            <span className={cn('text-xs', reached ? 'font-medium' : 'text-muted-foreground')}>{step.label}</span>
            {i < WORKFLOW_STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden />}
          </li>
        )
      })}
      {isTerminal && <li className="text-xs font-medium text-muted-foreground">— Cancelled</li>}
    </ol>
  )
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{children ?? '—'}</p>
    </div>
  )
}

export function ObligationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useObligation(id)
  const { role, profile: user } = useAuth()

  if (isLoading) return <Spinner />
  if (error || !data?.obligation) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center shadow-card">
        <p className="font-medium">Obligation not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may not exist, or you may not have access to it.</p>
        <Link to="/obligations" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to obligations
        </Link>
      </div>
    )
  }

  const obligation = data.obligation
  const isManager = role === 'admin' || role === 'manager'
  const canUpload =
    obligation.assignee_id === user?.id || isManager
  const canReviewFlag = role ? hasPermission(role, 'evidence:review') || obligation.reviewer_id === user?.id : false

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="rounded-lg border bg-card shadow-card">
        <div className="border-b px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{obligation.reference}</p>
              <h1 className="mt-1 text-lg font-semibold leading-snug sm:text-xl">{obligation.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={obligation.status} />
              <PriorityBadge priority={obligation.priority} />
            </div>
          </div>
          <div className="mt-5">
            <WorkflowStepper status={obligation.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-3 lg:grid-cols-6">
          <MetaItem label="Deadline"><DueBadge dueDate={obligation.due_date} closed={obligation.status === 'closed' || obligation.status === 'cancelled'} /></MetaItem>
          <MetaItem label="Responsible">{obligation.assignee?.full_name ?? 'Unassigned'}</MetaItem>
          <MetaItem label="Reviewer">{obligation.reviewer?.full_name ?? 'None'}</MetaItem>
          <MetaItem label="Department">{obligation.department?.name ?? '—'}</MetaItem>
          <MetaItem label="Created">{formatDate(obligation.created_at)}</MetaItem>
          <MetaItem label="Source">{obligation.source_reference ?? '—'}</MetaItem>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end">
        <ObligationActions obligation={obligation} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Description */}
          <section className="rounded-lg border bg-card shadow-card" aria-label="Description">
            <div className="border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Description</h2>
            </div>
            <div className="px-5 py-4">
              {obligation.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{obligation.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description was provided.</p>
              )}
              {obligation.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {obligation.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <EvidencePanel
            obligation={obligation}
            canUpload={canUpload}
            canReview={canReviewFlag}
            isOrgManager={isManager}
          />
          <CommentsPanel obligationId={obligation.id} />
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border bg-card shadow-card" aria-label="Details">
            <div className="border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Details</h2>
            </div>
            <div className="space-y-3.5 px-5 py-4 text-sm">
              <MetaItem label="Category">{obligation.category ?? '—'}</MetaItem>
              <MetaItem label="Escalation policy">
                {obligation.escalation_enabled ? `Automatic after ${obligation.escalate_after_days} day(s) overdue` : 'Disabled'}
              </MetaItem>
              <MetaItem label="Created by">{obligation.creator?.full_name ?? '—'}</MetaItem>
              <MetaItem label="Last updated">{formatDateTime(obligation.updated_at)}</MetaItem>
              {obligation.closed_at && <MetaItem label="Closed">{formatDateTime(obligation.closed_at)}</MetaItem>}
            </div>
          </section>
          <ActivityPanel obligationId={obligation.id} />
        </div>
      </div>
    </div>
  )
}
