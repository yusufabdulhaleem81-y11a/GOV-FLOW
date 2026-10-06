# GovFlow API

Base URL: `/api/v1` · JSON everywhere · Auth: `Authorization: Bearer <supabase-access-token>` ·
Org context: `X-Organization-Id: <organization-id>` (required for org-scoped endpoints).

Error envelope:

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have permission…", "details": null } }
```

Common codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409 —
invalid workflow transitions and close-rule violations), `BAD_REQUEST` (400 validation).

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Public |

## Auth & onboarding

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | Current profile + organization memberships |
| POST | `/join` | Body `{ code }` — join an organization via invite code |

Sign-up / sign-in / password reset happen directly against Supabase Auth from the web app.

## Organizations & members

| Method | Path | Roles |
|---|---|---|
| GET | `/organizations` | Any member (lists own memberships) |
| POST | `/organizations` | Any authenticated user (becomes admin) |
| GET | `/organizations/:id` | Member |
| PATCH | `/organizations/:id` | Admin |
| GET | `/organizations/:id/members` | Member |
| PATCH | `/organizations/:id/members/:userId` | Admin — body `{ role }` |
| DELETE | `/organizations/:id/members/:userId` | Admin (cannot remove the last admin) |
| POST | `/organizations/:id/invite-code` | Admin — regenerates, returns `{ invite_code }` |

## Users & departments

| Method | Path | Roles |
|---|---|---|
| GET | `/users` | Any member (assignment pickers, directory) |
| GET | `/departments` | Any member |
| POST | `/departments` | Admin, Manager |
| PATCH | `/departments/:id` | Admin, Manager |
| DELETE | `/departments/:id` | Admin (blocked while obligations reference it) |

## Obligations

| Method | Path | Notes |
|---|---|---|
| GET | `/obligations` | Filters: `q, status (enum|all_open), department_id, assignee_id, reviewer_id, priority, category, overdue=true, due_before, due_after, sort (deadline|created_at|updated_at|priority), dir, page, pageSize`. Members see only obligations they are involved in. |
| POST | `/obligations` | Admin, Manager. Body per `CreateObligationInput` incl. `requirements[]` and `publish` (default true; false → draft) |
| GET | `/obligations/:id` | Detail with requirements, files and profiles |
| PATCH | `/obligations/:id` | Creator, Admin, Manager. Deadline changes are audited |
| POST | `/obligations/:id/transition` | Body `{ action, note? }` where action ∈ `open, start_progress, submit_for_review, request_changes, reopen, cancel`. Validated by the shared state machine |
| POST | `/obligations/:id/close` | Reviewer/Admin/Manager; **409 unless every required evidence item is accepted** |
| GET | `/obligations/:id/comments` | Anyone who can see the obligation |
| POST | `/obligations/:id/comments` | Members+ (not viewers) |
| GET | `/obligations/:id/audit` | Audit events for this obligation |

## Evidence

Files are uploaded by the browser **directly to private storage**
(`evidence-files/{orgId}/{obligationId}/{uuid}.ext`) using the Supabase JS client; the API then
registers metadata. Download uses short-lived signed URLs.

| Method | Path | Notes |
|---|---|---|
| GET | `/evidence` | Org-wide register; filters `status`, `obligation_id` |
| POST | `/evidence` | Register an uploaded file: `{ obligation_id, requirement_id?, file_name, storage_path, mime_type, file_size, sha256? }`. Assignee or Manager; path must be inside the org prefix; allowed MIME: pdf, doc/docx, xls/xlsx, csv, jpg, png; max 25 MB |
| POST | `/evidence/:id/review` | Assigned reviewer / Manager / Admin — `{ decision: accepted|rejected|request_changes, note? }`. Rejections move the obligation to `changes_requested` |
| POST | `/evidence/signed-url` | `{ path }` → `{ signed_url }` (10-minute expiry) |

## Handovers

| Method | Path | Notes |
|---|---|---|
| GET | `/handovers` | `?status=pending` |
| POST | `/handovers` | Assignee or Manager — body `{ obligation_id, to_user_id, reason? }` |
| POST | `/handovers/:id/approve` | Manager/Admin → transfers responsibility, audits |
| POST | `/handovers/:id/reject` | Manager/Admin |

## Escalations

| Method | Path | Notes |
|---|---|---|
| GET | `/escalations` | `?status=active` |
| POST | `/escalations/obligations/:obligationId` | Manager/Admin — `{ reason }`; stores previous status |
| POST | `/escalations/:id/resolve` | Manager/Admin — restores the previous status |
| POST | `/escalations/scan` | Admin — runs the deadline sweep now (`marked_overdue`, `auto_escalated`, `deadline_reminders`) |

## Dashboard, reports, audit, search, notifications

| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard` | Any member — KPIs, charts, attention list |
| GET | `/reports/summary` | Admin, Manager, Reviewer, Viewer |
| GET | `/reports/export?type=overdue|outstanding|by_department|by_user|evidence` | CSV download |
| GET | `/audit` | Admin, Manager — filters `action, entity_id, actor_id, page, pageSize` |
| GET | `/search?q=` | Any member — obligations by title/reference/category |
| GET | `/notifications` | Own notifications + unread count |
| POST | `/notifications/:id/read`, `/notifications/read-all` | Owner |
