import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPlus,
  FileCheck2,
  History,
  Landmark,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react'
import type { ObligationStatus } from '@govflow/types'
import { STATUS_LABELS } from '@govflow/types'
import { StatusBadge } from '@/components/shared/badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const obligationStages: ObligationStatus[] = [
  'draft',
  'open',
  'in_progress',
  'awaiting_evidence',
  'under_review',
  'changes_requested',
  'under_review',
  'closed',
]

const coreSteps = [
  { title: 'Create', description: 'Define the obligation and what completion means.', icon: ClipboardPlus },
  { title: 'Assign', description: 'Name the responsible officer and reviewer.', icon: UserRound },
  { title: 'Deadline', description: 'Set a due date and a clear priority.', icon: CalendarDays },
  { title: 'Evidence', description: 'Specify what must be submitted.', icon: FileCheck2 },
  { title: 'Review', description: 'Accept evidence or request changes.', icon: ClipboardCheck },
  { title: 'Close', description: 'Close only when requirements are met.', icon: CheckCircle2 },
  { title: 'Escalate', description: 'Bring overdue obligations to attention.', icon: TriangleAlert },
  { title: 'Handover', description: 'Transfer ownership with a recorded decision.', icon: ArrowLeftRight },
]

const roles = [
  { title: 'Responsible user', description: 'Owns the obligation, delivers the work, and submits evidence.', icon: UserRound },
  { title: 'Reviewer', description: 'Checks submitted evidence and accepts it or requests changes.', icon: FileCheck2 },
  { title: 'Manager', description: 'Monitors overdue work, escalations, and team accountability.', icon: Users },
  { title: 'Admin', description: 'Sets up the organization, people, and operating structure.', icon: Landmark },
]

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

function RevealItem({ children, index = 0, className = '' }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <div
      data-reveal-item
      className={className}
      style={{ '--reveal-delay': `${index * 80}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

function HeroObligationCard() {
  const [stageIndex, setStageIndex] = useState(0)
  const [showEscalation, setShowEscalation] = useState(false)
  const status = obligationStages[stageIndex] ?? 'draft'
  const nextStatus = obligationStages[(stageIndex + 1) % obligationStages.length] ?? 'draft'

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let interval = 0
    let escalationTimeout = 0
    const startCycle = () => {
      if (motionPreference.matches || interval) return
      interval = window.setInterval(() => {
        setStageIndex((current) => {
          const next = (current + 1) % obligationStages.length
          if (next === 5) {
            setShowEscalation(true)
            window.clearTimeout(escalationTimeout)
            escalationTimeout = window.setTimeout(() => setShowEscalation(false), 1100)
          }
          return next
        })
      }, 2800)
    }
    const stopCycle = () => {
      window.clearInterval(interval)
      interval = 0
      window.clearTimeout(escalationTimeout)
      setShowEscalation(false)
    }
    const updateMotionPreference = () => {
      if (motionPreference.matches) stopCycle()
      else startCycle()
    }
    startCycle()
    motionPreference.addEventListener('change', updateMotionPreference)

    return () => {
      motionPreference.removeEventListener('change', updateMotionPreference)
      stopCycle()
    }
  }, [])

  const evidenceState = (item: number) => {
    if (stageIndex >= 7) return 'Accepted'
    if (stageIndex === 5 && item === 0) return 'Requested changes'
    if (stageIndex >= 3) return item === 0 ? 'Under review' : 'Submitted'
    return 'Required'
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      <Card className="relative overflow-hidden border-slate-200 bg-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.42)]">
        <div className="flex items-center justify-between border-b bg-slate-50/80 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Obligation lifecycle</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(stageIndex + 1).padStart(2, '0')} / 08
          </span>
        </div>
        <CardHeader className="relative pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] text-muted-foreground">OBL-2026-0148</p>
              <CardTitle className="mt-2 text-base leading-snug">Submit quarterly procurement review</CardTitle>
            </div>
            <StatusBadge status={status} className="mt-0.5" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Finance · Yusuf Adewale · Due 24 Oct 2026</p>
          <div
            className={`pointer-events-none absolute right-5 top-[4.2rem] transition-all duration-300 ${
              showEscalation ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
            aria-hidden={!showEscalation}
          >
            <StatusBadge status="escalated" className="shadow-sm" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-slate-50/70 p-3">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold">Required evidence</span>
              <span className="font-mono text-[10px] text-muted-foreground">{stageIndex >= 7 ? '2 / 2 accepted' : '2 items'}</span>
            </div>
            {[0, 1].map((item) => {
              const state = evidenceState(item)
              const accepted = state === 'Accepted'
              const requested = state === 'Requested changes'
              return (
                <div key={item} className="flex min-h-9 items-center justify-between gap-2 border-t py-2 first:border-0 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 text-xs text-slate-700">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${accepted ? 'bg-emerald-100 text-emerald-700' : requested ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                      {accepted ? <Check className="h-3 w-3" /> : requested ? <ArrowRight className="h-3 w-3" /> : null}
                    </span>
                    {item === 0 ? 'Quarterly review report' : 'Supporting transaction sample'}
                  </span>
                  <span className={`shrink-0 text-[10px] font-medium transition-colors duration-500 ${accepted ? 'text-emerald-700' : requested ? 'text-amber-700' : 'text-muted-foreground'}`}>
                    {state}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
            <span>Next: {stageIndex === 7 ? 'Audit record' : STATUS_LABELS[nextStatus]}</span>
            <span className="flex items-center gap-1"><History className="h-3 w-3" /> Audit trail on</span>
          </div>
        </CardContent>
        <div className="h-1 bg-slate-100" aria-label="Demonstration progress">
          <div
            className="h-full bg-primary transition-[width] duration-[2800ms] ease-linear"
            style={{ width: `${((stageIndex + 1) / obligationStages.length) * 100}%` }}
          />
        </div>
      </Card>
      <p className="mt-3 text-center text-[11px] text-slate-500">A controlled workflow, from assignment through accepted evidence.</p>
    </div>
  )
}

export function LandingPage() {
  const problemReveal = useReveal<HTMLElement>()
  const loopReveal = useReveal<HTMLElement>()
  const rolesReveal = useReveal<HTMLElement>()
  const closingReveal = useReveal<HTMLElement>()

  return (
    <main className="landing-page min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="border-b bg-white/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 rounded-sm focus-ring" aria-label="GovFlow home">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar text-sm font-bold text-white">G</span>
            <span className="text-base font-semibold tracking-tight">GovFlow</span>
          </Link>
          <Link to="/login" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90 focus-ring">Sign in</Link>
        </div>
      </nav>

      <section className="relative border-b bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-5 border-slate-300 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-600">
              Accountability infrastructure
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.45rem]">
              Who owes what <span className="text-primary">→</span> to whom <span className="text-primary">→</span> by when <span className="text-primary">→</span> evidence <span className="text-primary">→</span> closure
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Evidence-based accountability for organizations. Assign clear ownership, verify what was delivered, and preserve an immutable record of every decision.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90 focus-ring">Sign in <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/signup" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-white px-6 text-sm font-medium shadow-card transition-colors hover:bg-muted focus-ring">Create an organization</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Evidence required to close</span>
              <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5 text-emerald-700" /> Append-only audit history</span>
            </div>
          </div>
          <HeroObligationCard />
        </div>
      </section>

      <section ref={problemReveal.ref} className={`reveal border-b bg-white ${problemReveal.visible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <RevealItem>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">The problem</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">A task marked “done” is not proof it was done.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A name and a deadline can start the work. They cannot establish what was delivered, who accepted it, or why it was closed.</p>
          </RevealItem>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <RevealItem index={1}>
              <Card className="h-full border-slate-200 bg-slate-50 text-slate-500 shadow-none">
                <CardHeader className="pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Generic task tracking</p>
                  <CardTitle className="mt-2 text-base text-slate-500">Submit report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs">
                    <span>Yusuf</span><span>Friday</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-slate-500"><Check className="h-3 w-3" /> Done</span>
                  </div>
                  <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400">No evidence record · No reviewer decision · No closure trail</p>
                </CardContent>
              </Card>
            </RevealItem>
            <RevealItem index={2}>
              <Card className="h-full border-primary/20 bg-white">
                <CardHeader className="pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">GovFlow accountability record</p>
                  <CardTitle className="mt-2 text-base">Every handoff is explicit and traceable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-[11px] font-medium text-slate-700">
                    {['Department', 'Responsible officer', 'Deadline', 'Required evidence', 'Review', 'Closure'].map((item, index) => (
                      <span key={item} className="flex items-center gap-2">
                        <span className="rounded border bg-slate-50 px-2 py-1.5">{item}</span>
                        {index < 5 && <ArrowRight className="h-3 w-3 text-primary" />}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Evidence acceptance and an audit event are part of completion.</p>
                </CardContent>
              </Card>
            </RevealItem>
          </div>
        </div>
      </section>

      <section ref={loopReveal.ref} className={`reveal border-b bg-slate-50 ${loopReveal.visible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <RevealItem>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">The core loop</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">A workflow with controls at every step.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Ownership, evidence, review, and escalation work together—not as disconnected checkboxes, but as one accountable record.</p>
          </RevealItem>
          <ol className="core-flow mt-10">
            {coreSteps.map(({ title, description, icon: Icon }, index) => (
              <li
                key={title}
                data-reveal-item
                className="core-flow-item relative h-full rounded-lg border bg-white p-4 shadow-card"
                style={{ '--reveal-delay': `${(index + 1) * 80}ms` } as CSSProperties}
              >
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-primary/15 bg-primary/5 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p>
              </li>
            ))}
          </ol>
          <RevealItem index={9}>
            <div className="mt-6 flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
              <History className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">History is the spine.</span> Each meaningful action is recorded, from assignment and evidence review to handover, escalation, and closure.</p>
            </div>
          </RevealItem>
        </div>
      </section>

      <section ref={rolesReveal.ref} className={`reveal border-b bg-white ${rolesReveal.visible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <RevealItem>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Clear roles</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">The right responsibility for each person.</h2>
          </RevealItem>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map(({ title, description, icon: Icon }, index) => (
              <RevealItem key={title} index={index + 1}>
                <Card className="h-full shadow-none transition-shadow hover:shadow-card">
                  <CardContent className="pt-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></span>
                    <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </div>
        </div>
      </section>

      <section ref={closingReveal.ref} className={`reveal bg-sidebar text-white ${closingReveal.visible ? 'is-visible' : ''}`}>
        <RevealItem className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Evidence before closure</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Nothing closes until the evidence is accepted.</h2>
          </div>
          <Link to="/login" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-medium text-slate-900 shadow-card transition-colors hover:bg-slate-100 focus-ring">Sign in <ArrowRight className="h-4 w-4" /></Link>
        </RevealItem>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-semibold text-slate-700">GovFlow</span>
          <span>Accountability, supported by evidence and a durable record.</span>
        </div>
      </footer>
    </main>
  )
}
