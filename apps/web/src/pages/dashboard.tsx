import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlarmClock,
  ClipboardList,
  FileClock,
  FolderCheck,
  ShieldAlert,
  Timer,
  XCircle,
} from 'lucide-react'
import { useDashboard } from '@/hooks/queries'
import { PageHeader, Spinner } from '@/components/ui/misc'
import { StatCard, Panel } from '@/components/shared/stat-card'
import { StatusBadge, DueBadge, PriorityBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { STATUS_LABELS, type ObligationStatus } from '@govflow/types'
import { Link } from 'react-router-dom'

const STATUS_COLORS: Record<ObligationStatus, string> = {
  draft: '#94a3b8',
  open: '#0ea5e9',
  in_progress: '#38bdf8',
  awaiting_evidence: '#f59e0b',
  under_review: '#8b5cf6',
  changes_requested: '#fb923c',
  overdue: '#ef4444',
  escalated: '#b91c1c',
  closed: '#10b981',
  cancelled: '#cbd5e1',
}

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const navigate = useNavigate()

  if (isLoading) return <Spinner />
  if (error) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        description={(error as Error).message}
      />
    )
  }
  if (!data) return null

  const { kpis, charts, attention } = data
  const hasObligations = kpis.total > 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What needs your attention across the organization."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total obligations" value={kpis.total} icon={ClipboardList} onClick={() => navigate('/obligations')} />
        <StatCard label="Open" value={kpis.open} icon={FolderCheck} tone="info" onClick={() => navigate('/obligations?status=all_open')} />
        <StatCard label="Due soon" value={kpis.due_soon} icon={Timer} tone="warning" onClick={() => navigate('/obligations?due_before=later')} />
        <StatCard label="Overdue" value={kpis.overdue} icon={AlarmClock} tone="danger" onClick={() => navigate('/obligations?overdue=true')} />
        <StatCard label="Escalated" value={kpis.escalated} icon={ShieldAlert} tone="danger" onClick={() => navigate('/escalations')} />
        <StatCard label="Closed" value={kpis.closed} icon={XCircle} tone="success" onClick={() => navigate('/obligations?status=closed')} />
      </div>

      {!hasObligations ? (
        <Card className="mt-6">
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No obligations yet"
            description="Create your first obligation to start tracking accountability — assign a responsible user, set a deadline and define the required evidence."
            action={
              <Link
                to="/obligations/new"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
              >
                Create obligation
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Status distribution */}
          <Panel title="Obligations by status" description="Where every obligation currently sits.">
            <div className="p-4">
              {charts.byStatus.length === 0 ? (
                <EmptyState title="Nothing to show yet" />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.byStatus.map((s) => ({ ...s, name: STATUS_LABELS[s.status] }))}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {charts.byStatus.map((s) => (
                          <Cell key={s.status} fill={STATUS_COLORS[s.status]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Panel>

          {/* Created vs closed trend */}
          <Panel title="Created vs closed — last 30 days" description="Throughput of new obligations and completed closures.">
            <div className="p-4">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.trend.map((t) => ({ ...t, date: t.date.slice(5) }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="created" name="Created" stroke="#6366f1" fill="#6366f1" fillOpacity={0.12} strokeWidth={2} />
                    <Area type="monotone" dataKey="closed" name="Closed" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Panel>

          {/* By department */}
          <Panel title="By department" description="Open, overdue and closed obligations per department.">
            <div className="p-4">
              {charts.byDepartment.length === 0 ? (
                <EmptyState title="No departments with obligations yet" />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.byDepartment} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="department" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="open" name="Open" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" />
                      <Bar dataKey="closed" name="Closed" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Panel>

          {/* Workload */}
          <Panel title="Workload by responsible user" description="Active load per person — spot overload early.">
            <div className="p-4">
              {charts.workload.length === 0 ? (
                <EmptyState title="No active assignments" />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.workload} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="user" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="open" name="On track" stackId="w" fill="#6366f1" />
                      <Bar dataKey="overdue" name="Overdue" stackId="w" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Needs attention */}
      <Panel
        title="Needs attention"
        description="Overdue and due-within-2-days obligations, closest deadline first."
        className="mt-6"
      >
        {attention.length === 0 ? (
          <EmptyState
            icon={<FileClock className="h-6 w-6" />}
            title="Nothing overdue or imminent"
            description="When deadlines approach or pass, the affected obligations appear here."
          />
        ) : (
          <ul className="divide-y">
            {attention.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/obligations/${item.id}`}
                  className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.reference} · {item.assignee?.full_name ?? 'Unassigned'} · {item.department?.name ?? 'No department'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                    <DueBadge dueDate={item.due_date} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Evidence summary card (compact) */}
      {charts.evidence.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Evidence pipeline</CardTitle>
            <CardDescription>Required-evidence items by current state.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-4">
            {charts.evidence.map((e) => (
              <div key={e.status} className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-lg font-semibold tabular-nums leading-none">{e.count}</p>
                <p className="mt-1 text-[11px] capitalize text-muted-foreground">{e.status.replaceAll('_', ' ')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
