# GovFlow

**Accountability and obligation management — who owes what → to whom → by when → evidence → review → escalation → closure.**

GovFlow is not a generic task manager. It is a serious accountability platform for organizations
(companies, government bodies, NGOs) that must ensure important obligations are never forgotten:

- a **responsible user** is accountable for each obligation,
- **required evidence** is defined up front and must be submitted and **accepted by a reviewer**,
- **deadlines** are tracked and communicated ("Due in 3 days", "2 days overdue"),
- obligations that slip are **escalated** to management — automatically or manually,
- **handovers** transfer responsibility with full traceability,
- every meaningful action lands in an **append-only audit history**,
- nothing can be closed without satisfying the workflow rules.

---

## Architecture

GovFlow is a modular monolith: one repository, two apps, three shared packages, one database.

```
apps/web    → React + TypeScript + Vite + Tailwind (shadcn-style components) + React Query + Recharts
apps/api    → Fastify + TypeScript — authorization, workflow rules, evidence rules, notifications
packages/   → @govflow/types (domain model, status machine, permissions)
              @govflow/validation (Zod schemas shared by API and web)
supabase/   → SQL migrations (schema + Row Level Security) and the demo seed script
```

Key decisions:

- **Supabase** provides PostgreSQL, Auth and Storage (free tier is sufficient for a pilot).
- The API forwards the **user's JWT** to Supabase, so **Row Level Security** is an independent
  second enforcement layer behind the API's own checks. Never trust the frontend.
- Evidence files live in a **private storage bucket** (`evidence-files`, path
  `{orgId}/{obligationId}/{uuid}.ext`); downloads go through short-lived **signed URLs**.
- The notification system is a clean abstraction (`NotificationService → EmailSender`), with a
  console provider for development and Resend for real email. SMS/WhatsApp providers can be added
  later without touching the core.
- No AI anywhere in the core workflow. GovFlow works perfectly without AI.

See [docs/architecture.md](docs/architecture.md) for details and [docs/api.md](docs/api.md) for the API reference.

---

## Prerequisites

- **Node.js 20+** and npm 10+
- A **Supabase project** (free tier works): https://supabase.com

---

## Setup

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Configure the environment
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
```

Fill in the values (Supabase Dashboard → Project Settings → API / Database):

| Variable | Where it is used | What it is |
|---|---|---|
| `SUPABASE_URL` | API + seed + web | Project URL |
| `SUPABASE_ANON_KEY` | API + web | Public anon key (protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | API (server only) | Service role key — **never expose to the browser** |
| `DATABASE_URL` | `npm run db:migrate` | Postgres connection string (Session pooler) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | web | Same Supabase URL + anon key |
| `RESEND_API_KEY` (optional) | API email | Real emails; without it, emails log to the API console |

### 3. Create the database schema

```bash
npm run db:migrate
```

Applies `supabase/migrations/*.sql` in order (tables, indexes, triggers, **Row Level Security
policies**, the private storage bucket, and storage policies).

### 4. Seed demo data (optional but recommended)

```bash
npm run db:seed
```

Creates two organizations (**Acme Operations Ltd** and **Northwind Authority** — the second one is
there to verify organization isolation), departments, users, realistic obligations across every
status, evidence, comments, a pending handover, an escalation, notifications and audit events.

Demo sign-in (password `GovFlow!2026` for all):

| Email | Role |
|---|---|
| `admin@acme.test` | Organization Admin |
| `manager@acme.test` | Manager |
| `yusuf@acme.test` | Responsible User (Finance) |
| `aisha@acme.test` | Responsible User (Procurement) |
| `reviewer@acme.test` | Reviewer |
| `viewer@acme.test` | Viewer |
| `admin@northwind.test` | Admin of the second organization |

> In Supabase → Authentication → Providers → Email, disable "Confirm email" for local development,
> or use the pre-confirmed seeded accounts above.

### 5. Run it

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/v1/health

Without configuration the apps degrade gracefully: the web shows a setup guide, the API exits with
an actionable error message. GovFlow never fakes the database.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web in watch mode |
| `npm run build` | Production builds (API bundles with esbuild, web with Vite) |
| `npm run typecheck` | TypeScript strict mode across all workspaces |
| `npm run lint` | ESLint (flat config) |
| `npm test` | API test suite (business rules + API integration tests) |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Seed demo data |
| `npm run scan` | Run the deadline/escalation sweep (for cron) |

Scheduling the sweep: run `npm run scan` from cron (e.g. hourly). It marks overdue obligations,
sends deadline reminders (deduplicated) and auto-escalates according to each obligation's policy.
Admins can also trigger it from the Escalations page.

---

## The workflow in one page

```
CREATE → ASSIGN → DEADLINE → WORK → EVIDENCE → REVIEW → ACCEPT / CHANGES REQUESTED
       → ESCALATE IF OVERDUE → CLOSE → AUDIT HISTORY
```

Status lifecycle (enforced by a shared state machine, see `packages/types`):

```
Draft → Open → In Progress → Awaiting Evidence → Under Review → Closed
                  ↑                ↑                  ↓
                  └── Changes Requested ←──────────────┘
Overdue and Escalated are overlay states entered automatically or by managers;
Escalated restores the previous status when resolved.
Cancelled is possible from any active status (admins/managers/creator).
```

Closing rules: only the assigned **reviewer**, a **manager** or an **admin** can close, and only
when **every required evidence item is accepted** (or none were required). There is no override.

---

## Roles

| Role | Can |
|---|---|
| **Organization Admin** | Everything in the org: settings, users, roles, departments, obligations, reports, audit |
| **Manager** | Create/assign/review/escalate/close obligations, approve handovers, run scans, reports, audit |
| **Reviewer** | Review submitted evidence, request changes, participate in closure |
| **Responsible User** | See own obligations, update progress, upload evidence, comment, request handover |
| **Viewer** | Read-only access to organizational information |

Permissions are enforced by the API and the database (RLS). The frontend only hides controls it
knows are unavailable — hiding buttons is never the security boundary.

---

## Testing

`npm test` runs the API suite: the **status machine**, **permission matrix**, **close rules**,
**escalation policy**, plus full **HTTP integration tests** against the real Fastify app with an
in-memory PostgREST-faithful store — including **organization isolation** (org A cannot read or
write org B data), auth failures, validation errors, the complete evidence → review → close flow,
handovers, escalations, the deadline scan and CSV exports.

---

## Project layout

```
govflow/
├── apps/
│   ├── api/          Fastify API (modules, services, core rules, db adapter)
│   └── web/          React SPA (pages, features, components/ui, providers)
├── packages/
│   ├── types/        Shared domain model, status machine, permissions, due labels
│   └── validation/   Zod schemas for every request payload
├── supabase/
│   ├── migrations/   0001 schema, 0002 RLS + storage policies
│   └── seed/         Demo data script
├── scripts/          Migration runner, deadline-scan cron entry
└── docs/             architecture.md, api.md, product.md
```

---

## Security notes

- Backend authorization on every route; organization id always comes from verified membership.
- RLS on every table (see `supabase/migrations/0002_rls.sql`); `audit_events` and `comments` have
  **no update/delete policies** — history is immutable.
- Private storage + signed URLs; upload paths are validated against the caller's organization.
- Zod validation on every request; consistent error envelope; rate limiting and secure headers.
- Secrets only via environment variables; `.env*` files are git-ignored.

## Future (architected, not built)

WhatsApp/SMS providers (NotificationService), AI-assisted extraction/summaries (never a source of
truth), external integrations, a mobile client (the API is the contract). See docs/architecture.md.
