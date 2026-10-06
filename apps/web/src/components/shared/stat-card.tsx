import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  onClick,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: 'default' | 'warning' | 'danger' | 'success' | 'info'
  onClick?: () => void
}) {
  const toneClasses = {
    default: 'text-slate-500 bg-slate-100',
    info: 'text-sky-600 bg-sky-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    success: 'text-emerald-600 bg-emerald-50',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex items-center gap-3.5 rounded-lg border bg-card p-4 text-left shadow-card transition-colors w-full',
        onClick && 'hover:border-primary/40 focus-ring',
      )}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </Comp>
  )
}

export function Panel({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border bg-card shadow-card', className)}>
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
