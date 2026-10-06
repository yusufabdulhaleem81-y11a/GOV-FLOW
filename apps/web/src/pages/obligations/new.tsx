import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useObligationMutations, useMembers, useDepartments } from '@/hooks/queries'
import { PageHeader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea, FieldError } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PRIORITIES, PRIORITY_LABELS } from '@govflow/types'
import { todayDateOnly } from '@govflow/types'

interface RequirementDraft {
  title: string
  description: string
}

export function NewObligationPage() {
  const navigate = useNavigate()
  const members = useMembers()
  const departments = useDepartments()
  const { create } = useObligationMutations()

  const [form, setForm] = useState({
    title: '',
    description: '',
    department_id: '',
    assignee_id: '',
    reviewer_id: '',
    priority: 'medium',
    category: '',
    source_reference: '',
    tags: '',
    due_date: '',
    escalation_enabled: true,
    escalate_after_days: 3,
  })
  const [requirements, setRequirements] = useState<RequirementDraft[]>([{ title: '', description: '' }])
  const [publish, setPublish] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  const submit = () => {
    const errs: string[] = []
    if (!form.title.trim()) errs.push('Title is required.')
    if (!form.due_date) errs.push('Deadline is required.')
    const cleanedRequirements = requirements
      .map((r) => ({ title: r.title.trim(), description: r.description.trim() || undefined }))
      .filter((r) => r.title.length > 0)
    if (form.reviewer_id && form.reviewer_id === form.assignee_id) {
      errs.push('The reviewer cannot be the same person as the responsible user.')
    }
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    setErrors([])
    create.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        department_id: form.department_id || null,
        assignee_id: form.assignee_id || null,
        reviewer_id: form.reviewer_id || null,
        priority: form.priority as never,
        category: form.category.trim() || undefined,
        source_reference: form.source_reference.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
        due_date: form.due_date,
        escalation_enabled: form.escalation_enabled,
        escalate_after_days: Number(form.escalate_after_days) || 3,
        requirements: cleanedRequirements,
        publish,
      },
      {
        onSuccess: (result) => navigate(`/obligations/${result.obligation.id}`),
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-ring rounded-sm">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader title="New obligation" description="Define who is responsible, by when, and what evidence is required." />

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>What must be done?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Provide supporting documents for audit observation" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Context, expectations, acceptance criteria…" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Select id="department" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">No department</option>
                  {(departments.data?.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Audit Observation" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source_reference">Source / reference</Label>
                <Input id="source_reference" value={form.source_reference} onChange={(e) => setForm({ ...form, source_reference: e.target.value })} placeholder="e.g. AUD-2026-04" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="audit, procurement" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Accountability</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assignee">Responsible user</Label>
              <Select id="assignee" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                <option value="">Unassigned</option>
                {(members.data?.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select id="reviewer" value={form.reviewer_id} onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}>
                <option value="">No reviewer</option>
                {(members.data?.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                ))}
              </Select>
              <p className="text-[11px] text-muted-foreground">Reviews the submitted evidence and approves closure.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Deadline *</Label>
              <Input id="due_date" type="date" min={todayDateOnly()} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Required evidence</CardTitle>
            <p className="text-xs text-muted-foreground">List each document that must be submitted and accepted before closure.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {requirements.map((req, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={req.title}
                    onChange={(e) => setRequirements(requirements.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))}
                    placeholder={`Evidence item ${i + 1} — e.g. Payment voucher`}
                    aria-label={`Evidence item ${i + 1} title`}
                  />
                  <Input
                    value={req.description}
                    onChange={(e) => setRequirements(requirements.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                    placeholder="Optional detail"
                    aria-label={`Evidence item ${i + 1} description`}
                  />
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove evidence item ${i + 1}`} onClick={() => setRequirements(requirements.filter((_, j) => j !== i))} disabled={requirements.length === 1}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRequirements([...requirements, { title: '', description: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Add evidence item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Escalation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={form.escalation_enabled} onChange={(e) => setForm({ ...form, escalation_enabled: e.target.checked })} />
              Automatically escalate when overdue
            </label>
            {form.escalation_enabled && (
              <div className="space-y-1.5 sm:max-w-[220px]">
                <Label htmlFor="escalate_after_days">Days overdue before escalation</Label>
                <Input
                  id="escalate_after_days"
                  type="number"
                  min={1}
                  max={90}
                  value={form.escalate_after_days}
                  onChange={(e) => setForm({ ...form, escalate_after_days: Number(e.target.value) })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publish immediately (uncheck to save as draft)
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/obligations')}>Cancel</Button>
            <Button onClick={submit} loading={create.isPending}>
              {publish ? 'Create obligation' : 'Save draft'}
            </Button>
          </div>
        </div>
        <FieldError>{create.error?.message}</FieldError>
      </div>
    </div>
  )
}
