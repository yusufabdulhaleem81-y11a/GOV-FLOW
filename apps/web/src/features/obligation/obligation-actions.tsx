import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { ObligationStatus } from '@govflow/types'
import { mayPerform, TRANSITIONS } from '@govflow/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select, Textarea } from '@/components/ui/input'
import { useObligationMutations } from '@/hooks/queries'
import { useMembers } from '@/hooks/queries'
import { useAuth } from '@/providers/auth-provider'
import type { ObligationDetail } from '@govflow/types'

interface Props {
  obligation: ObligationDetail
}

/** Workflow actions bar: transition actions, escalate, handover, close, cancel. */
export function ObligationActions({ obligation }: Props) {
  const { profile: user, role } = useAuth()
  const members = useMembers()
  const { transition, close, escalate, requestHandover } = useObligationMutations()

  const [dialog, setDialog] = useState<'close' | 'escalate' | 'handover' | 'cancel' | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [handoverTo, setHandoverTo] = useState('')

  if (!role || !user) return null

  const actor = {
    userId: user.id,
    role,
    isAssignee: obligation.assignee_id === user.id,
    isReviewer: obligation.reviewer_id === user.id,
    isCreator: obligation.created_by === user.id,
  }
  const isManager = role === 'admin' || role === 'manager'
  const status = obligation.status as ObligationStatus

  const available = (['open', 'start_progress', 'submit_for_review', 'request_changes', 'reopen'] as const).filter(
    (action) => mayPerform(action, actor) && TRANSITIONS[action].from.includes(status),
  )

  const canClose = mayPerform('close', actor) && TRANSITIONS.close.from.includes(status)
  const canEscalate = isManager && TRANSITIONS.escalate.from.includes(status)
  const canCancel = (mayPerform('cancel', actor) && TRANSITIONS.cancel.from.includes(status)) ?? false
  const canHandover = (obligation.assignee_id === user.id || isManager) && !['closed', 'cancelled', 'draft'].includes(status)

  const hasAny =
    available.length > 0 || canClose || canEscalate || canCancel || canHandover
  if (!hasAny) return null

  const runTransition = (action: string) => {
    transition.mutate({ id: obligation.id, action })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {available.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={action === 'submit_for_review' ? 'default' : 'outline'}
          loading={transition.isPending}
          onClick={() => runTransition(action)}
        >
          {TRANSITIONS[action].label}
        </Button>
      ))}
      {canHandover && (
        <Button size="sm" variant="outline" onClick={() => setDialog('handover')}>
          Handover
        </Button>
      )}
      {canEscalate && (
        <Button size="sm" variant="outline" onClick={() => setDialog('escalate')}>
          Escalate
        </Button>
      )}
      {canClose && (
        <Button size="sm" variant="success" onClick={() => setDialog('close')}>
          Close obligation
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-50" onClick={() => setDialog('cancel')}>
          Cancel
        </Button>
      )}

      {/* Close dialog */}
      <Dialog
        open={dialog === 'close'}
        onClose={() => setDialog(null)}
        title="Close this obligation?"
        description="Closing is permanent. All required evidence must already be accepted."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Keep open</Button>
            <Button
              variant="success"
              loading={close.isPending}
              onClick={() =>
                close.mutate(
                  { id: obligation.id, note: note.trim() || undefined },
                  { onSuccess: () => setDialog(null) },
                )
              }
            >
              Close obligation
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="close-note">Closing note (optional)</Label>
          <Textarea id="close-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Summarize how this obligation was fulfilled…" />
        </div>
      </Dialog>

      {/* Escalate dialog */}
      <Dialog
        open={dialog === 'escalate'}
        onClose={() => setDialog(null)}
        title="Escalate obligation"
        description="Escalation flags the obligation to leadership and freezes the current workflow status until resolved."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={escalate.isPending}
              disabled={reason.trim().length === 0}
              onClick={() =>
                escalate.mutate(
                  { id: obligation.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      setDialog(null)
                      setReason('')
                    },
                  },
                )
              }
            >
              Escalate
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="escalate-reason">Why is this being escalated? *</Label>
          <Textarea id="escalate-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Deadline passed twice without submission; needs management intervention." />
        </div>
      </Dialog>

      {/* Handover dialog */}
      <Dialog
        open={dialog === 'handover'}
        onClose={() => setDialog(null)}
        title="Request handover"
        description={
          isManager
            ? 'Choosing a new responsible user transfers responsibility immediately and is recorded in the audit history.'
            : 'Your request will need approval from a manager before the handover takes effect.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              loading={requestHandover.isPending}
              disabled={!handoverTo}
              onClick={() =>
                requestHandover.mutate(
                  { id: obligation.id, to_user_id: handoverTo, reason: note.trim() || undefined },
                  {
                    onSuccess: () => {
                      setDialog(null)
                      setHandoverTo('')
                      setNote('')
                    },
                  },
                )
              }
            >
              {isManager ? 'Transfer responsibility' : 'Request handover'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="handover-to">New responsible user</Label>
            <Select id="handover-to" value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)}>
              <option value="">Select a colleague…</option>
              {(members.data?.data ?? [])
                .filter((m) => m.id !== obligation.assignee_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handover-reason">Reason (optional)</Label>
            <Textarea id="handover-reason" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Handing over before annual leave." />
          </div>
        </div>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this obligation?"
        description="Cancelled obligations stay in the record but no longer appear as active work."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Keep obligation</Button>
            <Button
              variant="destructive"
              loading={transition.isPending}
              onClick={() =>
                transition.mutate(
                  { id: obligation.id, action: 'cancel', note: note.trim() || undefined },
                  { onSuccess: () => setDialog(null) },
                )
              }
            >
              Cancel obligation
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-note">Reason</Label>
          <Textarea id="cancel-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this obligation being cancelled?" />
        </div>
      </Dialog>
    </div>
  )
}

export function EmptyComments() {
  return (
    <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground">
      <MessageSquare className="h-4 w-4" /> No comments yet. Start the conversation.
    </div>
  )
}
