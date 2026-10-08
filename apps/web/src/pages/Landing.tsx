import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  ClipboardPlus,
  FileCheck2,
  History,
  Landmark,
  ListChecks,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react'
import type { MouseEvent } from 'react'
import type { ObligationStatus } from '@govflow/types'
import { STATUS_LABELS } from '@govflow/types'
import { StatusBadge } from '@/components/shared/badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/shared/theme-toggle'

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

const whyGovFlow = [
  {
    title: 'Evidence is the contract',
    description: 'An obligation is complete when its evidence is accepted—not when someone ticks a checkbox. Review decisions stay attached to the work.',
    icon: FileCheck2,
  },
  {
    title: 'History is immutable',
    description: 'Every meaningful action is recorded in an append-only audit trail, preserving who did what and when.',
    icon: History,
  },
  {
    title: 'Nothing slips',
    description: 'Reminders start before deadlines. Overdue work is marked and can be escalated so managers can act.',
    icon: TriangleAlert,
  },
]

const audiences = [
  {
    title: 'Companies',
    description: 'Keep operational decisions and control work accountable.',
    examples: ['Audit observations', 'Management decisions', 'Compliance packs'],
    icon: Building2,
  },
  {
    title: 'Government bodies',
    description: 'Track formal obligations across ministries and agencies.',
    examples: ['Ministry directives', 'Agency commitments', 'Formal escalations'],
    icon: Landmark,
  },
  {
    title: 'NGOs',
    description: 'Connect donor-funded activities to verifiable outcomes.',
    examples: ['Donor activities', 'Reporting deadlines', 'Evidence-based closure'],
    icon: ListChecks,
  },
]

const faqs = [
  {
    question: 'How is GovFlow different from Trello or Asana?',
    answer: 'Generic tools track checkboxes; GovFlow tracks the full accountability chain: responsible user, deadline, required evidence, reviewer judgment, escalation, and permanent history.',
  },
  {
    question: 'Can an obligation be closed without evidence?',
    answer: 'No. Closure requires every required evidence item to be accepted by a reviewer. There is no override.',
  },
  {
    question: 'What happens when a deadline is missed?',
    answer: 'The system marks it overdue, reminds the responsible user, and escalates to management after the obligation’s threshold. Managers can also escalate manually.',
  },
  {
    question: 'Who can see our organization’s data?',
    answer: 'Only your organization’s members. Data is isolated per organization at both the API and database layers.',
  },
  {
    question: 'How do people join?',
    answer: 'An admin shares the organization invite code; staff sign up and join with it. Roles include Responsible User, Reviewer, Manager, Viewer, and Admin.',
  },
  {
    question: 'Does GovFlow use AI?',
    answer: 'Not in the core workflow. GovFlow is deliberately focused on accountability, with no chat or AI summaries in the decision path.',
  },
]

function handleAnchorClick(event: MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute('href')
  if (!href?.startsWith('#')) return
  const target = document.getElementById(href.slice(1))
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
  window.history.replaceState(null, '', href)
}

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
  const whyReveal = useReveal<HTMLElement>()
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90 focus-ring">Sign in</Link>
          </div>
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

      <section id="loop" ref={loopReveal.ref} className={`reveal border-b bg-slate-50 ${loopReveal.visible ? 'is-visible' : ''}`}>
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

      <section id="why" ref={whyReveal.ref} className={`reveal border-b bg-white ${whyReveal.visible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <RevealItem>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Why GovFlow</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Accountability built on verifiable work.</h2>
          </RevealItem>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {whyGovFlow.map(({ title, description, icon: Icon }, index) => (
              <RevealItem key={title} index={index + 1}>
                <Card className="h-full shadow-none">
                  <CardContent className="pt-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/5 text-primary"><Icon className="h-4 w-4" /></span>
                    <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </div>
        </div>
      </section>

      <section id="who" className="border-b bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Who it’s for</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Built for organizations where accountability is not optional.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {audiences.map(({ title, description, examples, icon: Icon }) => (
              <Card key={title} className="h-full bg-white shadow-none">
                <CardContent className="pt-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/5 text-primary"><Icon className="h-4 w-4" /></span>
                  <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p>
                  <ul className="mt-4 space-y-2 border-t pt-4">
                    {examples.map((example) => (
                      <li key={example} className="flex items-center gap-2 text-xs text-slate-700">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
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

      <section id="faq" className="border-b bg-slate-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex items-center gap-3">
            <CircleHelp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">FAQ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Straight answers about accountability.</h2>
            </div>
          </div>
          <div className="mt-8 divide-y rounded-lg border bg-white px-5">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {question}
                  <span className="text-lg font-normal text-primary transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">{answer}</p>
              </details>
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

      <footer id="contact" className="border-t border-slate-700 bg-sidebar text-slate-300">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link to="/" className="inline-flex items-center gap-2.5 rounded-sm text-white focus-ring" aria-label="GovFlow home">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-sm font-bold">G</span>
                <span className="text-base font-semibold tracking-tight">GovFlow</span>
              </Link>
              <p className="mt-4 max-w-xs text-xs leading-6 text-slate-300">Accountability and obligation management — who owes what → to whom → by when → evidence → review → escalation → closure.</p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">Product</h2>
              <ul className="mt-4 space-y-3 text-xs">
                <li><a href="#why" onClick={handleAnchorClick} className="transition-colors hover:text-white">Why GovFlow</a></li>
                <li><a href="#loop" onClick={handleAnchorClick} className="transition-colors hover:text-white">How it works</a></li>
                <li><a href="#who" onClick={handleAnchorClick} className="transition-colors hover:text-white">Who it’s for</a></li>
                <li><a href="#faq" onClick={handleAnchorClick} className="transition-colors hover:text-white">FAQ</a></li>
                <li><Link to="/login" className="transition-colors hover:text-white">Sign in</Link></li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">Contact us</h2>
              <ul className="mt-4 space-y-3 text-xs">
                <li><a href="tel:08143751471" className="transition-colors hover:text-white">0814 375 1471</a></li>
                <li><a href="mailto:hello@govflow.app" className="transition-colors hover:text-white">hello@govflow.app</a></li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">Follow us</h2>
              <div className="mt-4 flex items-center gap-3">
                <a href="https://x.com/govflow" aria-label="GovFlow on X" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.4L5.58 22H2.45l7.25-8.29L1.8 2h6.4l4.43 6.75L18.9 2Zm-1.1 18h1.73L7.27 3.89H5.41L17.8 20Z" /></svg>
                </a>
                <a href="https://instagram.com/govflow" aria-label="GovFlow on Instagram" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" /></svg>
                </a>
                <a href="https://linkedin.com/company/govflow" aria-label="GovFlow on LinkedIn" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.45H4.98V9h2.95v9.45ZM6.45 7.71a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12 10.74H15.5v-4.6c0-1.1-.02-2.52-1.54-2.52-1.54 0-1.78 1.2-1.78 2.44v4.68H9.23V9h2.83v1.29h.04c.39-.74 1.36-1.52 2.8-1.52 3 0 3.55 1.97 3.55 4.53v5.15Z" /></svg>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-slate-700 pt-5 text-[11px] text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} GovFlow. All rights reserved.</span>
            <span>Built for organizations that take accountability seriously.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
