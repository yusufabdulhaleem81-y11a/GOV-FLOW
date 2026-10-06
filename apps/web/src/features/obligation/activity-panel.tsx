import { History } from 'lucide-react'
import { useObligationAudit } from '@/hooks/queries'
import { Avatar, Spinner } from '@/components/ui/misc'
import { EmptyState } from '@/components/ui/table'
import { formatDateTime } from '@govflow/types'

export function ActivityPanel({ obligationId }: { obligationId: string }) {
  const { data, isLoading } = useObligationAudit(obligationId)
  const events = data?.data ?? []

  return (
    <section className="rounded-lg border bg-card shadow-card" aria-label="Audit history">
      <div className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Activity & audit history</h2>
        <p className="text-xs text-muted-foreground">Immutable record of everything that happened to this obligation.</p>
      </div>
      {isLoading ? (
        <Spinner className="py-8" />
      ) : events.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="No history yet" className="py-8" />
      ) : (
        <ol className="relative space-y-0 px-5 py-4">
          {events.map((event, i) => (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Timeline line */}
              {i < events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />}
              <Avatar name={event.actor?.full_name ?? 'System'} className="z-10 h-6 w-6 text-[10px]" />
              <div className="min-w-0">
                <p className="text-sm leading-snug">{event.summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.actor?.full_name ?? 'System'} · {formatDateTime(event.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
