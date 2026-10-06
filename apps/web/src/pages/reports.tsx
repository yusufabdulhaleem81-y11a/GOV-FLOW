import { Download } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useReportSummary } from '@/hooks/queries'
import { PageHeader, Spinner } from '@/components/ui/misc'
import { Panel } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/badges'
import { downloadCsv } from '@/lib/api'
import { formatDate } from '@govflow/types'
import { useToast } from '@/providers/toast-provider'

const EXPORTS: { type: string; label: string; description: string }[] = [
  { type: 'overdue', label: 'Overdue obligations', description: 'Everything past its deadline, with days overdue.' },
  { type: 'outstanding', label: 'Outstanding obligations', description: 'All obligations not yet closed or cancelled.' },
  { type: 'by_department', label: 'By department', description: 'Totals, open, overdue and closed per department.' },
  { type: 'by_user', label: 'By responsible user', description: 'Workload and completion per person.' },
  { type: 'evidence', label: 'Evidence register', description: 'Every uploaded evidence file with its review state.' },
]

export function ReportsPage() {
  const { data, isLoading } = useReportSummary()
  const { toast } = useToast()

  const exportCsv = (type: string) => {
    downloadCsv('/reports/export', { type }).catch((err: Error) =>
      toast({ title: 'Export failed', description: err.message, variant: 'error' }),
    )
  }

  if (isLoading) return <Spinner />
  if (!data) return null

  return (
    <>
      <PageHeader title="Reports" description={`Generated ${formatDate(data.generatedAt)} — completion rate ${data.totals.completionRate}%.`} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total obligations</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data.totals.obligations}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-600">{data.totals.open}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Closed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{data.totals.closed}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Completion rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data.totals.completionRate}%</p>
        </div>
      </div>

      {/* Closures trend */}
      {data.closuresByMonth.length > 0 && (
        <Panel title="Closure trend" description="Obligations closed per month." className="mt-4">
          <div className="p-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.closuresByMonth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="closed" name="Closed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* By department table */}
        <Panel title="By department">
          {data.byDepartment.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byDepartment.map((d) => (
                  <TableRow key={d.department}>
                    <TableCell className="font-medium">{d.department}</TableCell>
                    <TableCell className="tabular-nums">{d.total}</TableCell>
                    <TableCell className="tabular-nums">{d.open}</TableCell>
                    <TableCell className="tabular-nums text-red-600">{d.overdue}</TableCell>
                    <TableCell className="tabular-nums text-emerald-600">{d.closed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        {/* By user chart */}
        <Panel title="By responsible user">
          {data.byUser.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <div className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byUser} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="user" width={120} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="closed" name="Closed" stackId="u" fill="#10b981" />
                    <Bar dataKey="overdue" name="Overdue" stackId="u" fill="#ef4444" />
                    <Bar dataKey="open" name="Open" stackId="u" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Overdue list */}
      <Panel title="Overdue obligations" description="Sorted by deadline — export available below." className="mt-4">
        {data.overdue.length === 0 ? (
          <EmptyState title="Nothing is overdue" description="A clean slate — every obligation is on schedule." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.overdue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[320px]">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.reference}</p>
                  </TableCell>
                  <TableCell className="text-sm">{item.assignee?.full_name ?? 'Unassigned'}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-sm text-red-600">{formatDate(item.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* CSV exports */}
      <Panel title="CSV exports" description="Download raw data for spreadsheets and further analysis." className="mt-4">
        <ul className="divide-y">
          {EXPORTS.map((exp) => (
            <li key={exp.type} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="text-sm font-medium">{exp.label}</p>
                <p className="text-xs text-muted-foreground">{exp.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportCsv(exp.type)}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
