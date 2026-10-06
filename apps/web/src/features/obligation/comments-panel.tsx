import { useState } from 'react'
import { Send } from 'lucide-react'
import type { Comment } from '@govflow/types'
import { formatDateTime } from '@govflow/types'
import { useAuth } from '@/providers/auth-provider'
import { useObligationComments } from '@/hooks/queries'
import { useObligationMutations } from '@/hooks/queries'
import { Avatar, Spinner } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { mayComment } from '@govflow/types'

export function CommentsPanel({ obligationId }: { obligationId: string }) {
  const { data, isLoading } = useObligationComments(obligationId)
  const { comment } = useObligationMutations()
  const { role } = useAuth()
  const [content, setContent] = useState('')

  const canComment = role ? mayComment(role) : false

  return (
    <section className="rounded-lg border bg-card shadow-card" aria-label="Comments">
      <div className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Comments</h2>
        <p className="text-xs text-muted-foreground">Coordination between the responsible user, reviewer and managers.</p>
      </div>
      {isLoading ? (
        <Spinner className="py-8" />
      ) : (
        <ul className="divide-y">
          {(data?.data ?? []).length === 0 && (
            <li className="px-5 py-6 text-center text-xs text-muted-foreground">No comments yet.</li>
          )}
          {(data?.data ?? []).map((c: Comment) => (
            <li key={c.id} className="flex gap-3 px-5 py-3.5">
              <Avatar name={c.author?.full_name ?? undefined} />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold">{c.author?.full_name ?? 'Unknown'}</span>
                  <span className="ml-2 text-muted-foreground">{formatDateTime(c.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form
          className="flex items-end gap-2 border-t px-5 py-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!content.trim()) return
            comment.mutate(
              { id: obligationId, content: content.trim() },
              { onSuccess: () => setContent('') },
            )
          }}
        >
          <Textarea
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            className="min-h-[44px]"
          />
          <Button type="submit" size="icon" aria-label="Post comment" loading={comment.isPending} disabled={!content.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </section>
  )
}
