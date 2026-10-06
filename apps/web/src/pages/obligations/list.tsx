import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Search } from 'lucide-react'
import { useObligations, useMembers, useDepartments } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import { PageHeader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSkeleton, EmptyState } from '@/components/ui/table'
import { StatusBadge, PriorityBadge, DueBadge, EvidenceProgress } from '@/components/shared/badges'
import { OBLIGATION_STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from '@govflow/types'
import { pluralize } from '@/lib/utils'

export function ObligationsPage({ mine = false }: { mine?: boolean }) {
  const { profile: user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')

  const members = useMembers()
  const departments = useDepartments()

  const query = {
    q: searchParams.get('q') ?? undefined,
    status: (searchParams.get('status') as never) ?? undefined,
    department_id: searchParams.get('department_id') ?? undefined,
    assignee_id: mine ? (user?.id ?? undefined) : (searchParams.get('assignee_id') ?? undefined),
    priority: (searchParams.get('priority') as never) ?? undefined,
    overdue: (searchParams.get('overdue') as never) ?? undefined,
    sort: (searchParams.get('sort') as never) ?? undefined,
    dir: (searchParams.get('dir') as never) ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: 20,
  }

  const { data, isLoading, isFetching } = useObligations(query)
  const canCreate = useCanCreate()

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value === undefined || value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const setSort = (value: string) => {
    const next = new URLSearchParams(searchParams)
    const active = searchParams.get('sort') === value
    next.set('sort', value)
    next.set('dir', active && searchParams.get('dir') === 'desc' ? 'asc' : 'desc')
    setSearchParams(next)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / query.pageSize)) : 1
  const hasFilters = [...searchParams.keys()].some((k) => k !== 'page')

  return (
    <>
      <PageHeader
        title={mine ? 'My Obligations' : 'Obligations'}
        description={
          mine
            ? 'Everything you are responsible for or reviewing.'
            : 'Every obligation in the organization, with deadlines, evidence state and ownership.'
        }
        actions={
          canCreate && (
            <Button onClick={() => navigate('/obligations/new')}>
              <Plus className="h-4 w-4" /> New obligation
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
        <form
          className="relative flex-1 sm:min-w-[220px]"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', searchInput)
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-8"
            placeholder="Search title, reference or category…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search obligations"
          />
        </form>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <Select aria-label="Filter by status" value={searchParams.get('status') ?? 'all'} onChange={(e) => setParam('status', e.target.value)} className="sm:w-40">
            <option value="all">All statuses</option>
            <option value="all_open">All open</option>
            {OBLIGATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by department" value={searchParams.get('department_id') ?? 'all'} onChange={(e) => setParam('department_id', e.target.value)} className="sm:w-40">
            <option value="all">All departments</option>
            {(departments.data?.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {!mine && (
            <Select aria-label="Filter by responsible user" value={searchParams.get('assignee_id') ?? 'all'} onChange={(e) => setParam('assignee_id', e.target.value)} className="sm:w-44">
              <option value="all">Everyone</option>
              {(members.data?.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? m.email}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Filter by priority" value={searchParams.get('priority') ?? 'all'} onChange={(e) => setParam('priority', e.target.value)} className="sm:w-36">
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium shadow-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-red-600"
              checked={searchParams.get('overdue') === 'true'}
              onChange={(e) => setParam('overdue', e.target.checked ? 'true' : undefined)}
            />
            Overdue only
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obligation</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={7} />
          </Table>
        ) : (data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={hasFilters ? 'No obligations match your current filters' : 'No obligations yet'}
            description={
              hasFilters
                ? 'Try adjusting or clearing the filters above.'
                : mine
                  ? 'Nothing is assigned to you yet. Obligations assigned to you will appear here.'
                  : 'Create your first obligation to start tracking accountability.'
            }
            action={
              !hasFilters && canCreate ? (
                <Link to="/obligations/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90">
                  Create obligation
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Obligation" value="created_at" searchParams={searchParams} onSort={setSort} />
                  <TableHead>Responsible</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <SortHead label="Deadline" value="deadline" searchParams={searchParams} onSort={setSort} />
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((item) => (
                  <TableRow key={item.id} className="cursor-pointer">
                    <TableCell className="max-w-[320px]">
                      <Link to={`/obligations/${item.id}`} className="block focus-ring rounded-sm">
                        <p className="truncate font-medium hover:text-primary">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.reference}
                          {item.category && ` · ${item.category}`}
                          {item.comment_count > 0 && ` · ${item.comment_count} ${pluralize(item.comment_count, 'comment')}`}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{item.assignee?.full_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{item.department?.name ?? '—'}</TableCell>
                    <TableCell><PriorityBadge priority={item.priority} /></TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="whitespace-nowrap"><DueBadge dueDate={item.due_date} closed={item.status === 'closed' || item.status === 'cancelled'} /></TableCell>
                    <TableCell>
                      <EvidenceProgress required={item.evidence.required} accepted={item.evidence.accepted} submitted={item.evidence.submitted} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <p>
                {isFetching ? 'Loading…' : `${data?.total ?? 0} obligation${(data?.total ?? 0) === 1 ? '' : 's'}`}
                {data && ` — page ${data.page} of ${totalPages}`}
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(data?.page ?? 1) <= 1}
                  onClick={() => setParam('page', String(query.page - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data || data.page >= totalPages}
                  onClick={() => setParam('page', String(query.page + 1))}
                  aria-label="Next page"
                >
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

function SortHead({ label, value, searchParams, onSort }: { label: string; value: string; searchParams: URLSearchParams; onSort: (value: string) => void }) {
  const active = searchParams.get('sort') === value
  const dir = searchParams.get('dir')
  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground focus-ring rounded-sm"
        onClick={() => onSort(value)}
      >
        {label}
        {active && <span aria-hidden>{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </TableHead>
  )
}

function useCanCreate(): boolean {
  const { role } = useAuth()
  return role === 'admin' || role === 'manager'
}
