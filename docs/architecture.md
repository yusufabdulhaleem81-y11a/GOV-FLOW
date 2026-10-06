# GovFlow Architecture

## Overview

GovFlow is a **modular monolith**: a single deployable API, a single SPA, one PostgreSQL database.
No microservices, no message broker, no Redis. The stack is boring on purpose — the interesting
part is the workflow logic, which is centralized, tested and shared.

```
                ┌──────────────────────────────────────────┐
                │                apps/web                  │
                │  React 18 · Vite · Tailwind · React Query │
                └───────────────┬──────────────────────────┘
                                │ REST (JSON) + Bearer token
                ┌───────────────▼──────────────────────────┐
                │                apps/api                  │
                │  Fastify 5 · TypeScript strict            │
                │  ┌────────────────────────────────────┐  │
                │  │ modules/    routes (thin)          │  │
                │  │ services/   workflow orchestration │  │
                │  │ core/       pure business rules    │  │
                │  │ db/         DB interface + adapter │  │
                │  └────────────────────────────────────┘  │
                └───────────────┬──────────────────────────┘
                                │ Supabase JS (user JWT / service role)
                ┌───────────────▼──────────────────────────┐
                │                Supabase                  │
                │  PostgreSQL (RLS) · Auth · Storage        │
                └──────────────────────────────────────────┘
```

## Layers

### 1. Route modules (`apps/api/src/modules/`)

Thin HTTP adapters: validate input with the shared Zod schemas, resolve the organization context,
call a service, map errors. No business logic lives here.

### 2. Services (`apps/api/src/services/`)

Own the workflows: `ObligationService`, `EvidenceService`, `HandoverService`,
`EscalationService`, `AuditService`, `NotificationService`, `ReportService`.
Every mutation records audit events and notifies affected users.

### 3. Core rules (`apps/api/src/core/` + `packages/types/`)

Pure, dependency-free functions — the heart of the product:

- `packages/types/src/status-machine.ts` — the obligation lifecycle: which action is legal from
  which status, and who (role/assignee/reviewer/creator) may perform it. Shared with the web app so
  UI and API agree by construction.
- `packages/types/src/permissions.ts` — the role → permission matrix.
- `packages/types/src/due.ts` — deadline bucketing ("Due in 3 days", "2 days overdue") shared
  verbatim by API and UI.
- `apps/api/src/core/rules.ts` — closure readiness (all required evidence accepted) and
  reference generation.
- `apps/api/src/core/escalation-policy.ts` — the deadline sweep decision function
  (remind / mark overdue / auto-escalate).

These are the most heavily tested parts of the codebase.

### 4. Data access (`apps/api/src/db/`)

Services depend on a **narrow `DB` interface** (PostgREST-style query chains that always resolve to
`{ data, error, count }`). Two implementations:

- `supabase-adapter.ts` — wraps `@supabase/supabase-js`. Requests carry the **caller's JWT**, so
  RLS applies to every query the API makes. The service-role client is used only where the system
  itself acts (notifications to other users, the deadline sweep).
- `test/fake-supabase.ts` — an in-memory implementation with emulated unique constraints, used by
  the integration test-suite to run the real Fastify app end-to-end without a live database.

This keeps business logic testable without infrastructure and makes the persistence choice
explicit rather than ambient.

## Multi-tenancy

Every table carries `organization_id`. Isolation is enforced twice:

1. **API layer** — the organization id comes exclusively from the `X-Organization-Id` header,
   validated against the caller's membership (`requireOrg`). Every query is scoped to it.
   Member-role users are additionally restricted to obligations where they are assignee,
   reviewer or creator.
2. **Database layer** — Row Level Security on every table via the
   `is_org_member(org, roles)` SECURITY DEFINER helper
   (`supabase/migrations/0002_rls.sql`). `audit_events` and `comments` deliberately have **no
   update/delete policies**: history is append-only.

Storage follows the same rule: object paths start with `{organization_id}/`, storage policies parse
the folder name and check membership; the API re-validates the prefix before signing URLs.

## Authentication

Supabase Auth (email/password). The SPA holds the session; the API verifies the access token with
a short-TTL cache and derives the caller from it. Password reset uses Supabase's hosted flow.
There is no custom password handling anywhere.

## Notifications

```
Service code → notifyUsers(serviceDB, email, input)
                 ├─ inserts rows into notifications (in-app, per user)
                 └─ fire-and-forget email via EmailSender
                       ├─ ConsoleEmailSender (development)
                       └─ ResendEmailSender (RESEND_API_KEY set)
```

Email failures never break the main flow. Adding SMS/WhatsApp later means implementing
`EmailSender`-shaped providers — no core changes.

## Deadline sweep

`EscalationService.runDeadlineScan` is pure-decision-driven (`decideScanActions`):
reminders for deadlines within 2 days, `overdue` marking past deadlines, automatic escalation once
an obligation's `escalate_after_days` threshold is exceeded. It runs with the service client so it
can sweep all organizations; `npm run scan` (cron) or an admin from the UI triggers it.

## Error model

One envelope everywhere: `{ error: { code, message, details? } }`. `AppError` carries an HTTP
status; unknown failures log server-side and return a sanitized 500 in production.

## What is deliberately NOT here (yet)

- WhatsApp/SMS providers, AI extraction/summaries (must never be a source of truth), external
  integrations, a native mobile app. The seams for all of these exist: the provider interface,
  the shared API contract (`@govflow/types` + `@govflow/validation`), and the REST API itself.
