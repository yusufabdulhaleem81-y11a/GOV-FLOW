/**
 * Deadline awareness — shared by API and UI so "Due in 3 days" is always
 * computed the same way on both sides.
 */

export type DueBucket = 'none' | 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'closed'

export interface DueInfo {
  bucket: DueBucket
  /** Negative = days overdue, positive = days remaining, 0 = today */
  days: number
  label: string
}

/** Parse a YYYY-MM-DD date string as a local date (no timezone drift). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function todayDateOnly(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function computeDue(dueDate: string | null | undefined, now: Date = new Date()): DueInfo {
  if (!dueDate) return { bucket: 'none', days: 0, label: 'No deadline' }
  const due = parseDateOnly(dueDate)
  const today = parseDateOnly(todayDateOnly(now))
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) {
    const abs = Math.abs(days)
    return {
      bucket: 'overdue',
      days,
      label: abs === 1 ? '1 day overdue' : `${abs} days overdue`,
    }
  }
  if (days === 0) return { bucket: 'today', days, label: 'Due today' }
  if (days === 1) return { bucket: 'tomorrow', days, label: 'Due tomorrow' }
  if (days <= 7) return { bucket: 'soon', days, label: `Due in ${days} days` }
  return { bucket: 'later', days, label: `Due in ${days} days` }
}

export function isOverdue(dueDate: string | null | undefined, now: Date = new Date()): boolean {
  return computeDue(dueDate, now).bucket === 'overdue'
}

export function isDueSoon(dueDate: string | null | undefined, now: Date = new Date()): boolean {
  const b = computeDue(dueDate, now).bucket
  return b === 'today' || b === 'tomorrow' || b === 'soon'
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.length <= 10 ? parseDateOnly(value) : new Date(value)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
