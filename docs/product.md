# GovFlow Product

## The problem

Organizations — companies and government bodies especially — run on obligations: an audit
observation that requires documents, a management decision that must be implemented, a quarterly
compliance pack, an internal deadline. These obligations get **forgotten**. Reminders live in
inboxes, responsibility is ambiguous, evidence goes missing, and when something slips there is no
record of who was supposed to do what, by when, and what actually happened.

A generic task manager (Trello, Asana, Jira, Planner) does not solve this. It treats accountability
as a checkbox:

> Submit report — Yusuf — Friday — Done.

GovFlow captures the whole accountability chain:

> Finance Department must submit supporting documents for an audit observation → assigned
> responsible officer → deadline → required evidence (payment voucher, approval, receipt, bank
> statement) → evidence uploaded → reviewer checks → changes requested or accepted → escalation if
> overdue → final closure → permanent history.

## The core loop

**Who owes what → to whom → by when → evidence → review → escalation → closure.**

1. **Create** — an obligation declares *what* must be done, *which department* it belongs to, its
   *source* (audit ref, decision number), *category*, *priority*, *tags* and its *deadline*.
2. **Assign** — a **responsible user** owns it; a **reviewer** will judge the evidence.
3. **Evidence** — required evidence items are defined up front ("Payment voucher", "Signed
   contract copy"). The responsible user uploads files (PDF, Office, CSV, images) into private
   storage.
4. **Review** — the reviewer accepts, rejects or requests changes per file, with a note. Rejections
   send the obligation back to the responsible user with full context.
5. **Close** — only possible when **every required evidence item is accepted**, by the reviewer or
   a manager. No shortcuts, no overrides.
6. **Escalate** — when deadlines slip: reminders at T-2 days, `Overdue` marking, and automatic
   escalation after the obligation's threshold. Managers can escalate manually with a reason and
   resolve escalations when unblocked.
7. **Handover** — responsibility transfers between people through a request/approve flow, recorded
   in history.
8. **History** — every action (created, assigned, deadline changed, evidence reviewed, comment,
   handover, escalation, closure) is an append-only audit event, visible on the obligation and
   org-wide for managers.

## Who uses it

| Role | Their experience |
|---|---|
| **Responsible user** | "My Obligations" shows exactly what they owe, with due-in labels; uploading evidence is one drag-free file picker; reviewer feedback arrives as notifications and comments. |
| **Reviewer** | The Reviews queue lists everything awaiting judgment; each file can be accepted/rejected with a note in seconds. |
| **Manager** | The dashboard answers "what needs my attention" — overdue, due soon, escalated, workload by person; they create, reassign, escalate and close; reports export to CSV. |
| **Admin** | Everything above plus organization settings, departments, users and roles. |

## Design principles

- **Serious, not toy.** The product should feel like infrastructure a government office can rely
  on: dense, clear, calm; status and deadlines always legible; nothing decorative.
- **Evidence is the contract.** An obligation is "done" when evidence is accepted, never when a
  checkbox is ticked.
- **History is immutable.** Accountability requires records that cannot be quietly edited.
- **The frontend is never the security boundary.** Roles are enforced by the API and the database.
- **Boring technology, sharp focus.** No AI, no integrations, no chat — accountability only. The
  architecture leaves room for all of that later without rework.

## Explicit non-goals (V1)

Jira-style issue tracking, generic CRM/ERP/accounting, chat, native mobile, AI features, public
sharing links.
