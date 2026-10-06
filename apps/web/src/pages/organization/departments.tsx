import { useState } from 'react'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDepartments, useOrgMutation } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import * as api from '@/services/endpoints'
import { PageHeader, Spinner } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/table'
import { Card } from '@/components/ui/card'

export function DepartmentsPage() {
  const { role } = useAuth()
  const canManage = role === 'admin' || role === 'manager'
  const { data, isLoading } = useDepartments()
  const [editing, setEditing] = useState<{ id: string | null; name: string; description: string } | null>(null)

  const create = useOrgMutation((input: { name: string; description?: string }) => api.createDepartment(input), { successTitle: 'Department created' })
  const update = useOrgMutation((input: { id: string; name: string; description?: string }) => api.updateDepartment(input.id, { name: input.name, description: input.description }), { successTitle: 'Department updated' })
  const remove = useOrgMutation((id: string) => api.deleteDepartment(id), { successTitle: 'Department deleted' })

  const departments = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organizational units used to group obligations."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setEditing({ id: null, name: '', description: '' })}>
              <Plus className="h-4 w-4" /> New department
            </Button>
          )
        }
      />

      {isLoading ? (
        <Spinner />
      ) : departments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No departments yet"
            description="Create departments such as Finance, Internal Audit or Operations to organize obligations."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <div key={dept.id} className="group flex items-start justify-between rounded-lg border bg-card p-4 shadow-card">
              <div className="min-w-0">
                <p className="truncate font-medium">{dept.name}</p>
                {dept.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{dept.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {dept.obligation_count} active {dept.obligation_count === 1 ? 'obligation' : 'obligations'}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${dept.name}`} onClick={() => setEditing({ id: dept.id, name: dept.name, description: dept.description ?? '' })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${dept.name}`}
                    className="text-destructive hover:bg-red-50"
                    onClick={() => {
                      if (window.confirm(`Delete "${dept.name}"? Departments with obligations cannot be deleted.`)) {
                        remove.mutate(dept.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit department' : 'New department'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              loading={create.isPending || update.isPending}
              disabled={!editing?.name.trim()}
              onClick={() => {
                if (!editing) return
                if (editing.id) {
                  update.mutate(
                    { id: editing.id, name: editing.name.trim(), description: editing.description.trim() || undefined },
                    { onSuccess: () => setEditing(null) },
                  )
                } else {
                  create.mutate(
                    { name: editing.name.trim(), description: editing.description.trim() || undefined },
                    { onSuccess: () => setEditing(null) },
                  )
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name *</Label>
            <Input id="dept-name" value={editing?.name ?? ''} onChange={(e) => setEditing(editing ? { ...editing, name: e.target.value } : null)} placeholder="e.g. Internal Audit" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-desc">Description</Label>
            <Input id="dept-desc" value={editing?.description ?? ''} onChange={(e) => setEditing(editing ? { ...editing, description: e.target.value } : null)} />
          </div>
        </div>
      </Dialog>
    </>
  )
}
