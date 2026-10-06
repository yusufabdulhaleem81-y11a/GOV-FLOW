import { useRef, useState } from 'react'
import { Download, FileText, Paperclip, Upload } from 'lucide-react'
import type { EvidenceFile, EvidenceRequirement, ObligationDetail } from '@govflow/types'
import { EVIDENCE_STATUS_LABELS, formatDateTime, formatFileSize, type EvidenceStatus } from '@govflow/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/table'
import { reviewEvidence, createSignedUrl, registerEvidence } from '@/services/endpoints'
import { useInvalidateOrgData, useOrgMutation } from '@/hooks/queries'
import { useToast } from '@/providers/toast-provider'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/lib/utils'

const STATUS_VARIANT: Record<EvidenceStatus, 'neutral' | 'info' | 'violet' | 'success' | 'destructive'> = {
  pending: 'neutral',
  submitted: 'info',
  under_review: 'violet',
  accepted: 'success',
  rejected: 'destructive',
}

function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{EVIDENCE_STATUS_LABELS[status]}</Badge>
}

interface Props {
  obligation: ObligationDetail
  canUpload: boolean
  canReview: boolean
  isOrgManager: boolean
}

export function EvidencePanel({ obligation, canUpload, canReview, isOrgManager }: Props) {
  const requirements = obligation.requirements ?? []
  const files = obligation.files ?? []

  return (
    <section className="rounded-lg border bg-card shadow-card" aria-label="Evidence">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Evidence</h2>
          <p className="text-xs text-muted-foreground">
            {requirements.length === 0
              ? 'No required evidence items were defined for this obligation.'
              : `${(obligation.requirements ?? []).filter((r) => r.status === 'accepted').length} of ${requirements.length} required items accepted.`}
          </p>
        </div>
        {canUpload && <UploadEvidenceButton obligationId={obligation.id} requirements={requirements} />}
      </div>

      {requirements.length > 0 && (
        <div className="border-b px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required evidence</h3>
          <ul className="space-y-2">
            {requirements.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <RequirementDot status={req.status as EvidenceStatus} />
                  <span className="truncate text-sm">{req.title}</span>
                </div>
                <EvidenceStatusBadge status={req.status as EvidenceStatus} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded files</h3>
        {files.length === 0 ? (
          <EmptyState
            icon={<Paperclip className="h-5 w-5" />}
            title="No evidence has been submitted yet."
            description={canUpload ? 'Upload the required documents when they are ready.' : 'Files uploaded by the responsible user will appear here.'}
            className="py-8"
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {files.map((file) => (
              <EvidenceFileRow key={file.id} file={file} canReview={canReview} isOrgManager={isOrgManager} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function RequirementDot({ status }: { status: EvidenceStatus }) {
  const color =
    status === 'accepted' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-red-500' : status === 'pending' ? 'bg-slate-300' : 'bg-amber-400'
  return <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color)} aria-hidden />
}

function EvidenceFileRow({ file, canReview, isOrgManager }: { file: EvidenceFile; canReview: boolean; isOrgManager: boolean }) {
  const [reviewOpen, setReviewOpen] = useState(false)
  const [decision, setDecision] = useState<'accepted' | 'rejected' | 'request_changes'>('accepted')
  const [note, setNote] = useState('')
  const invalidate = useInvalidateOrgData()
  const review = useOrgMutation((input: { id: string; decision: string; note?: string }) => reviewEvidence(input.id, input.decision, input.note), {
    successTitle: 'Review saved',
  })

  const download = async () => {
    const { signed_url: url } = await createSignedUrl(file.storage_path)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <li className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file_size)} · {file.uploader?.full_name ?? 'Unknown'} · {formatDateTime(file.created_at)}
            {file.review_note && ` — "${file.review_note}"`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <EvidenceStatusBadge status={file.status as EvidenceStatus} />
        <Button variant="ghost" size="sm" onClick={() => void download()}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
        {(canReview || isOrgManager) && file.status !== 'accepted' && (
          <>
            <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}>
              Review
            </Button>
            <Dialog
              open={reviewOpen}
              onClose={() => setReviewOpen(false)}
              title={`Review "${file.file_name}"`}
              description="Accept the file, reject it, or send it back with change requests."
              footer={
                <>
                  <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
                  <Button
                    loading={review.isPending}
                    onClick={() => {
                      review.mutate(
                        { id: file.id, decision, note: note.trim() || undefined },
                        {
                          onSuccess: () => {
                            setReviewOpen(false)
                            setNote('')
                            invalidate()
                          },
                        },
                      )
                    }}
                  >
                    Save decision
                  </Button>
                </>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['accepted', 'Accept', 'bg-emerald-600'],
                      ['request_changes', 'Request changes', 'bg-amber-500'],
                      ['rejected', 'Reject', 'bg-red-600'],
                    ] as const
                  ).map(([value, label, activeColor]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDecision(value)}
                      className={cn(
                        'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                        decision === value ? cn(activeColor, 'text-white border-transparent') : 'bg-card hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="review-note">Note to the responsible user</Label>
                  <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the decision…" />
                </div>
              </div>
            </Dialog>
          </>
        )}
      </div>
    </li>
  )
}

function UploadEvidenceButton({ obligationId, requirements }: { obligationId: string; requirements: EvidenceRequirement[] }) {
  const { supabase } = useAuth()
  const { toast } = useToast()
  const invalidate = useInvalidateOrgData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Session expired — sign in again.')

      const orgId = getActiveOrgId()
      if (!orgId) throw new Error('No active organization')

      const pathParts = file.name.split('.')
      const ext = pathParts.length > 1 ? pathParts.pop() : undefined
      const safeName = (pathParts.join('.') || 'file').replaceAll(/[^a-zA-Z0-9_-]/g, '_')
      const path = `${orgId}/${obligationId}/${crypto.randomUUID()}-${safeName}${ext ? `.${ext}` : ''}`
      const { error } = await supabase.storage.from('evidence-files').upload(path, file, { upsert: false })
      if (error) throw new Error(error.message)

      await registerEvidence({
        obligation_id: obligationId,
        requirement_id: requirements.length === 1 ? requirements[0]?.id ?? null : null,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
      })
      invalidate()
      toast({ title: 'Evidence uploaded', description: file.name, variant: 'success' })
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />
      <Button size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> Upload evidence
      </Button>
    </>
  )
}

function getActiveOrgId(): string | null {
  // The API client tracks the active org; read it from the configured module state.
  return getOrgIdFromStorage()
}

function getOrgIdFromStorage(): string | null {
  return window.localStorage.getItem('govflow.organization-id')
}
