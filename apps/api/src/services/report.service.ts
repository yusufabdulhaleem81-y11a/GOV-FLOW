import type {
  DashboardResponse,
  ObligationStatus,
  ReportSummary,
  ScanResponse,
} from '@govflow/types'
import { OPEN_STATUSES, STATUS_LABELS, computeDue, todayDateOnly } from '@govflow/types'
import type { DB, DbRow } from '../db/types.js'
import { rows } from '../db/types.js'
import { toCsv, type CsvColumn } from '../lib/csv.js'
import { toListItems, type ServiceContext } from './obligation.service.js'
import { runDeadlineScan } from './escalation.service.js'

type OblRow = {
  id: string
  reference: string
  title: string
  status: ObligationStatus
  priority: string
  due_date: string
  category: string | null
  department_id: string | null
  assignee_id: string | null
  created_at: string
  closed_at: string | null
}

async function loadOrgObligations(db: DB, organizationId: string): Promise<OblRow[]> {
  const data = await rows<DbRow>(
    db.from('obligations').select('*').eq('organization_id', organizationId),
  )
  return data as unknown as OblRow[]
}

export async function getDashboard(ctx: ServiceContext): Promise<DashboardResponse> {
  const now = ctx.now?.() ?? new Date()
  const all = await loadOrgObligations(ctx.db, ctx.organizationId)

  const openRows = all.filter((o) => OPEN_STATUSES.includes(o.status))
  const dueSoon = openRows.filter((o) => {
    const b = computeDue(o.due_date, now).bucket
    return b === 'today' || b === 'tomorrow' || b === 'soon'
  }).length
  const overdue = openRows.filter((o) => computeDue(o.due_date, now).bucket === 'overdue').length

  const byStatus = new Map<ObligationStatus, number>()
  for (const o of all) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1)

  const deptIds = [...new Set(all.map((o) => o.department_id).filter((v): v is string => !!v))]
  const departments = deptIds.length
    ? await rows<DbRow>(ctx.db.from('departments').select('id, name').in('id', deptIds))
    : []
  const deptName = new Map(departments.map((d) => [d.id as string, d.name as string]))

  const byDepartment = new Map<string, { open: number; overdue: number; closed: number }>()
  for (const o of all) {
    const name = o.department_id ? (deptName.get(o.department_id) ?? 'Unassigned') : 'Unassigned'
    const agg = byDepartment.get(name) ?? { open: 0, overdue: 0, closed: 0 }
    if (o.status === 'closed') agg.closed += 1
    else if (OPEN_STATUSES.includes(o.status) && computeDue(o.due_date, now).bucket === 'overdue') agg.overdue += 1
    else if (OPEN_STATUSES.includes(o.status)) agg.open += 1
    byDepartment.set(name, agg)
  }

  const assigneeIds = [...new Set(all.map((o) => o.assignee_id).filter((v): v is string => !!v))]
  const profiles = assigneeIds.length
    ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', assigneeIds))
    : []
  const userName = new Map(profiles.map((p) => [p.id as string, (p.full_name as string) ?? 'Unassigned']))

  const workload = new Map<string, { open: number; overdue: number }>()
  for (const o of openRows) {
    const name = o.assignee_id ? (userName.get(o.assignee_id) ?? 'Unassigned') : 'Unassigned'
    const agg = workload.get(name) ?? { open: 0, overdue: 0 }
    if (computeDue(o.due_date, now).bucket === 'overdue') agg.overdue += 1
    else agg.open += 1
    workload.set(name, agg)
  }

  // 30-day created vs closed trend
  const trend: { date: string; created: number; closed: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = todayDateOnly(d)
    trend.push({ date: key, created: 0, closed: 0 })
  }
  const trendIndex = new Map(trend.map((t) => [t.date, t]))
  const bump = (key: string | undefined | null, field: 'created' | 'closed') => {
    const bucket = key ? trendIndex.get(key) : undefined
    if (bucket) bucket[field] += 1
  }
  for (const o of all) {
    bump((o.created_at as string).slice(0, 10), 'created')
    bump(o.closed_at?.slice(0, 10), 'closed')
  }

  const reqs = await rows<DbRow>(
    ctx.db.from('evidence_requirements').select('status').eq('organization_id', ctx.organizationId),
  )
  const evidenceCounts = new Map<string, number>()
  for (const r of reqs) {
    const key = r.status as string
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1)
  }

  const attentionRows = openRows
    .filter((o) => computeDue(o.due_date, now).bucket === 'overdue' || computeDue(o.due_date, now).bucket === 'today' || computeDue(o.due_date, now).bucket === 'tomorrow')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)
  const attention = await toListItems(ctx.db, attentionRows as unknown as DbRow[])

  return {
    kpis: {
      total: all.length,
      open: openRows.length,
      due_soon: dueSoon,
      overdue,
      escalated: all.filter((o) => o.status === 'escalated').length,
      awaiting_review: all.filter((o) => o.status === 'under_review').length,
      closed: all.filter((o) => o.status === 'closed').length,
    },
    charts: {
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      byDepartment: [...byDepartment.entries()].map(([department, v]) => ({ department, ...v })),
      trend,
      workload: [...workload.entries()].map(([user, v]) => ({ user, ...v })),
      evidence: [...evidenceCounts.entries()].map(([status, count]) => ({ status, count })),
    },
    attention,
  }
}

export async function getReportSummary(ctx: ServiceContext): Promise<ReportSummary> {
  const now = ctx.now?.() ?? new Date()
  const all = await loadOrgObligations(ctx.db, ctx.organizationId)
  const listItems = await toListItems(ctx.db, all as unknown as DbRow[])

  const closed = all.filter((o) => o.status === 'closed')
  const cancelled = all.filter((o) => o.status === 'cancelled')
  const open = all.filter((o) => OPEN_STATUSES.includes(o.status))

  const closuresByMonth = new Map<string, number>()
  for (const o of closed) {
    if (!o.closed_at) continue
    const month = o.closed_at.slice(0, 7)
    closuresByMonth.set(month, (closuresByMonth.get(month) ?? 0) + 1)
  }

  const escalations = await rows<DbRow>(
    ctx.db
      .from('escalations')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  )

  const byDepartment = new Map<string, { total: number; open: number; closed: number; overdue: number }>()
  const byUser = new Map<string, { total: number; open: number; closed: number; overdue: number }>()

  for (const item of listItems) {
    const dKey = item.department?.name ?? 'Unassigned'
    const d = byDepartment.get(dKey) ?? { total: 0, open: 0, closed: 0, overdue: 0 }
    d.total += 1
    if (item.status === 'closed') d.closed += 1
    else if (item.is_overdue) d.overdue += 1
    else d.open += 1
    byDepartment.set(dKey, d)

    const uKey = item.assignee?.full_name ?? 'Unassigned'
    const u = byUser.get(uKey) ?? { total: 0, open: 0, closed: 0, overdue: 0 }
    u.total += 1
    if (item.status === 'closed') u.closed += 1
    else if (item.is_overdue) u.overdue += 1
    else u.open += 1
    byUser.set(uKey, u)
  }

  const reqs = await rows<DbRow>(
    ctx.db.from('evidence_requirements').select('status').eq('organization_id', ctx.organizationId),
  )
  const evidenceCounts = new Map<string, number>()
  for (const r of reqs) evidenceCounts.set(r.status as string, (evidenceCounts.get(r.status as string) ?? 0) + 1)

  return {
    generatedAt: now.toISOString(),
    totals: {
      obligations: all.length,
      open: open.length,
      closed: closed.length,
      cancelled: cancelled.length,
      completionRate: all.length === 0 ? 0 : Math.round((closed.length / all.length) * 100),
    },
    overdue: listItems.filter((i) => i.is_overdue),
    escalated: escalations as unknown as ReportSummary['escalated'],
    byDepartment: [...byDepartment.entries()].map(([department, v]) => ({ department, ...v })),
    byUser: [...byUser.entries()].map(([user, v]) => ({ user, ...v })),
    evidence: [...evidenceCounts.entries()].map(([status, count]) => ({ status, count })),
    closuresByMonth: [...closuresByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, closed]) => ({ month, closed })),
  }
}

// ── CSV exports ───────────────────────────────────────────────────────────────

const overdueColumns: CsvColumn<OblRow & { departmentName: string; assigneeName: string; daysOverdue: number }>[] = [
  { header: 'Reference', value: (r) => r.reference },
  { header: 'Title', value: (r) => r.title },
  { header: 'Department', value: (r) => r.departmentName },
  { header: 'Responsible', value: (r) => r.assigneeName },
  { header: 'Priority', value: (r) => r.priority },
  { header: 'Status', value: (r) => STATUS_LABELS[r.status] },
  { header: 'Deadline', value: (r) => r.due_date },
  { header: 'Days overdue', value: (r) => r.daysOverdue },
]

export async function exportReportCsv(
  ctx: ServiceContext,
  type: 'overdue' | 'outstanding' | 'by_department' | 'by_user' | 'evidence',
): Promise<{ csv: string; filename: string }> {
  const now = ctx.now?.() ?? new Date()

  if (type === 'by_department' || type === 'by_user') {
    const summary = await getReportSummary(ctx)
    const rowsData: { department?: string; user?: string; total: number; open: number; overdue: number; closed: number }[] =
      type === 'by_department' ? summary.byDepartment : summary.byUser
    const columns: CsvColumn<{ department?: string; user?: string; total: number; open: number; overdue: number; closed: number }>[] = [
      { header: type === 'by_department' ? 'Department' : 'Responsible user', value: (r) => r.department ?? r.user ?? '' },
      { header: 'Total', value: (r) => r.total },
      { header: 'Open', value: (r) => r.open },
      { header: 'Overdue', value: (r) => r.overdue },
      { header: 'Closed', value: (r) => r.closed },
    ]
    return {
      csv: toCsv(columns, rowsData),
      filename: `govflow-${type}-${todayDateOnly(now)}.csv`,
    }
  }

  if (type === 'evidence') {
    const files = await rows<DbRow>(
      ctx.db.from('evidence_files').select('*').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false }),
    )
    const obIds = [...new Set(files.map((f) => f.obligation_id as string))]
    const obligations = obIds.length
      ? await rows<DbRow>(ctx.db.from('obligations').select('id, reference, title').in('id', obIds))
      : []
    const obById = new Map(obligations.map((o) => [o.id as string, o]))
    const uploaderIds = [...new Set(files.map((f) => f.uploaded_by as string))]
    const profiles = uploaderIds.length
      ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', uploaderIds))
      : []
    const profileById = new Map(profiles.map((p) => [p.id as string, p]))

    const data = files.map((f) => ({
      reference: (obById.get(f.obligation_id as string)?.reference as string) ?? '',
      obligation: (obById.get(f.obligation_id as string)?.title as string) ?? '',
      file: f.file_name as string,
      status: f.status as string,
      uploaded_by: (profileById.get(f.uploaded_by as string)?.full_name as string) ?? '',
      uploaded_at: f.created_at as string,
      size_bytes: f.file_size as number,
    }))
    const columns: CsvColumn<(typeof data)[number]>[] = [
      { header: 'Reference', value: (r) => r.reference },
      { header: 'Obligation', value: (r) => r.obligation },
      { header: 'File', value: (r) => r.file },
      { header: 'Status', value: (r) => r.status },
      { header: 'Uploaded by', value: (r) => r.uploaded_by },
      { header: 'Uploaded at', value: (r) => r.uploaded_at },
      { header: 'Size (bytes)', value: (r) => r.size_bytes },
    ]
    return { csv: toCsv(columns, data), filename: `govflow-evidence-${todayDateOnly(now)}.csv` }
  }

  // overdue / outstanding
  const all = await loadOrgObligations(ctx.db, ctx.organizationId)
  const filtered = all.filter((o) => {
    if (type === 'overdue') return OPEN_STATUSES.includes(o.status) && computeDue(o.due_date, now).bucket === 'overdue'
    return OPEN_STATUSES.includes(o.status)
  })
  const deptIds = [...new Set(filtered.map((o) => o.department_id).filter((v): v is string => !!v))]
  const departments = deptIds.length
    ? await rows<DbRow>(ctx.db.from('departments').select('id, name').in('id', deptIds))
    : []
  const deptName = new Map(departments.map((d) => [d.id as string, d.name as string]))
  const assigneeIds = [...new Set(filtered.map((o) => o.assignee_id).filter((v): v is string => !!v))]
  const profiles = assigneeIds.length
    ? await rows<DbRow>(ctx.db.from('profiles').select('id, full_name').in('id', assigneeIds))
    : []
  const userName = new Map(profiles.map((p) => [p.id as string, (p.full_name as string) ?? '']))

  const data = filtered.map((o) => ({
    ...o,
    departmentName: o.department_id ? (deptName.get(o.department_id) ?? '') : '',
    assigneeName: o.assignee_id ? (userName.get(o.assignee_id) ?? '') : '',
    daysOverdue: Math.max(0, -computeDue(o.due_date, now).days),
  }))
  return {
    csv: toCsv(overdueColumns, data),
    filename: `govflow-${type}-${todayDateOnly(now)}.csv`,
  }
}

export { runDeadlineScan }
export type { ScanResponse }
