/**
 * GovFlow demo seed.
 *
 * Creates two organizations (to demonstrate isolation), departments, users,
 * realistic obligations across every status, evidence, comments, a handover,
 * an escalation, notifications and audit events — so the dashboard looks alive
 * immediately after setup.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see .env.example).
 * Usage: npm run db:seed
 *
 * Demo sign-in (after seeding, with email confirmation disabled or via these
 * pre-confirmed accounts):
 *   admin@acme.test    / GovFlow!2026   (Organization Admin)
 *   manager@acme.test  / GovFlow!2026   (Manager)
 *   yusuf@acme.test    / GovFlow!2026   (Responsible User, Finance)
 *   aisha@acme.test    / GovFlow!2026   (Responsible User, Procurement)
 *   reviewer@acme.test / GovFlow!2026   (Reviewer)
 *   viewer@acme.test   / GovFlow!2026   (Viewer)
 *   admin@northwind.test / GovFlow!2026 (second organization, for isolation tests)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(__dirname, '..', '..', file), 'utf8')
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      /* optional */
    }
  }
}
loadEnvFile()

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✗ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (copy .env.example → .env.local and fill them in).',
  )
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'GovFlow!2026'
const DAY = 86_400_000
const now = Date.now()
const dateOnly = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString().slice(0, 10)
const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString()

interface OrgSpec {
  name: string
  slug: string
  description: string
  departments: string[]
}

const acme: OrgSpec = {
  name: 'Acme Operations Ltd',
  slug: 'acme-operations',
  description: 'Demo organization for GovFlow — operations, finance and compliance.',
  departments: ['Finance', 'Internal Audit', 'HR', 'Procurement', 'Operations'],
}
const northwind: OrgSpec = {
  name: 'Northwind Authority',
  slug: 'northwind-authority',
  description: 'Second demo organization used to verify data isolation.',
  departments: ['Licensing', 'Compliance'],
}

async function ensureUser(email: string, fullName: string, jobTitle: string): Promise<string> {
  const { data: existing } = await db.auth.admin.listUsers()
  const found = existing?.users.find((u) => u.email === email)
  if (found) return found.id
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  // handle_new_user trigger creates the profile; enrich it here.
  await db.from('profiles').update({ full_name: fullName, job_title: jobTitle }).eq('id', data.user.id)
  return data.user.id
}

async function createOrg(spec: OrgSpec): Promise<{ id: string; invite_code: string }> {
  const { data: existing } = await db.from('organizations').select('id, invite_code').eq('slug', spec.slug).maybeSingle()
  if (existing) return { id: existing.id, invite_code: existing.invite_code }

  const code = Math.random().toString(36).slice(2, 10).toUpperCase()
  const { data, error } = await db
    .from('organizations')
    .insert({ name: spec.name, slug: spec.slug, description: spec.description, invite_code: code })
    .select('id, invite_code')
    .single()
  if (error) throw new Error(`createOrg(${spec.name}): ${error.message}`)
  return { id: data.id, invite_code: data.invite_code }
}

async function addMember(orgId: string, userId: string, role: string): Promise<void> {
  await db.from('organization_members').upsert(
    { organization_id: orgId, user_id: userId, role },
    { onConflict: 'organization_id,user_id' },
  )
}

async function createDepartments(orgId: string, names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of names) {
    const { data } = await db
      .from('departments')
      .insert({ organization_id: orgId, name })
      .select('id')
      .single()
    if (data) map.set(name, data.id)
  }
  return map
}

interface ObligationSpec {
  reference: string
  title: string
  description: string
  department: string
  assigneeEmail: string
  reviewerEmail: string
  creatorEmail: string
  status: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string
  source_reference: string
  tags: string[]
  dueOffset: number
  createdOffset: number
  closedOffset?: number
  requirements: { title: string; status: string }[]
  comments?: { authorEmail: string; content: string; daysAgo: number }[]
}

const acmeObligations: ObligationSpec[] = [
  {
    reference: 'GOV-26-AUD001',
    title: 'Provide supporting documents for procurement expenditure',
    description:
      'Internal Audit observation 2026-04 requires the Finance Department to submit complete supporting documents for the Q2 procurement expenditure above the threshold.',
    department: 'Finance',
    assigneeEmail: 'yusuf@acme.test',
    reviewerEmail: 'reviewer@acme.test',
    creatorEmail: 'manager@acme.test',
    status: 'under_review',
    priority: 'high',
    category: 'Audit Observation',
    source_reference: 'AUD-2026-04',
    tags: ['audit', 'procurement'],
    dueOffset: 5,
    createdOffset: -12,
    requirements: [
      { title: 'Payment voucher', status: 'accepted' },
      { title: 'Approval document', status: 'accepted' },
      { title: 'Receipt', status: 'submitted' },
      { title: 'Bank statement', status: 'pending' },
    ],
    comments: [
      { authorEmail: 'reviewer@acme.test', content: 'Payment voucher and approval received. Receipt needs the supplier stamp.', daysAgo: 2 },
    ],
  },
  {
    reference: 'GOV-26-MGT002',
    title: 'Submit implementation progress report',
    description: 'Management decision 12/2026 asks Operations to submit the implementation progress report for the new warehouse workflow.',
    department: 'Operations',
    assigneeEmail: 'aisha@acme.test',
    reviewerEmail: 'reviewer@acme.test',
    creatorEmail: 'admin@acme.test',
    status: 'overdue',
    priority: 'critical',
    category: 'Management Decision',
    source_reference: 'MGT-12/2026',
    tags: ['report', 'operations'],
    dueOffset: -6,
    createdOffset: -20,
    requirements: [
      { title: 'Progress report', status: 'pending' },
      { title: 'KPI summary sheet', status: 'pending' },
    ],
  },
  {
    reference: 'GOV-26-CMP003',
    title: 'Submit quarterly compliance documentation',
    description: 'Quarterly compliance pack for the regulator: licences, certificates and the updated risk register.',
    department: 'Internal Audit',
    assigneeEmail: 'manager@acme.test',
    reviewerEmail: 'admin@acme.test',
    creatorEmail: 'admin@acme.test',
    status: 'in_progress',
    priority: 'medium',
    category: 'Compliance',
    source_reference: 'REG-Q3-2026',
    tags: ['compliance', 'quarterly'],
    dueOffset: 14,
    createdOffset: -5,
    requirements: [
      { title: 'Valid licences', status: 'submitted' },
      { title: 'Risk register (signed)', status: 'pending' },
    ],
  },
  {
    reference: 'GOV-26-HRD004',
    title: 'Complete staff training documentation',
    description: 'HR must consolidate the annual mandatory training records and upload the completion certificates.',
    department: 'HR',
    assigneeEmail: 'aisha@acme.test',
    reviewerEmail: 'manager@acme.test',
    creatorEmail: 'admin@acme.test',
    status: 'awaiting_evidence',
    priority: 'low',
    category: 'Internal Obligation',
    source_reference: 'HR-TRN-2026',
    tags: ['training', 'hr'],
    dueOffset: 21,
    createdOffset: -8,
    requirements: [{ title: 'Training completion certificates', status: 'pending' }],
  },
  {
    reference: 'GOV-26-FIN005',
    title: 'Reconcile supplier ledger discrepancies',
    description: 'Finance to reconcile the five flagged supplier ledger discrepancies and upload the corrected ledger.',
    department: 'Finance',
    assigneeEmail: 'yusuf@acme.test',
    reviewerEmail: 'manager@acme.test',
    creatorEmail: 'manager@acme.test',
    status: 'escalated',
    priority: 'critical',
    category: 'Internal Obligation',
    source_reference: 'FIN-REC-118',
    tags: ['finance', 'reconciliation'],
    dueOffset: -9,
    createdOffset: -25,
    requirements: [{ title: 'Corrected ledger export', status: 'rejected' }],
    comments: [
      { authorEmail: 'manager@acme.test', content: 'Escalating — two reminders were already sent without a response.', daysAgo: 3 },
    ],
  },
  {
    reference: 'GOV-26-PRC006',
    title: 'Provide supporting documents for audit observation',
    description: 'Close-out documents for audit observation 2026-02: contracts, delivery notes and the acceptance report.',
    department: 'Procurement',
    assigneeEmail: 'aisha@acme.test',
    reviewerEmail: 'reviewer@acme.test',
    creatorEmail: 'manager@acme.test',
    status: 'closed',
    priority: 'high',
    category: 'Audit Observation',
    source_reference: 'AUD-2026-02',
    tags: ['audit', 'closeout'],
    dueOffset: -15,
    createdOffset: -40,
    closedOffset: -16,
    requirements: [
      { title: 'Signed contract copy', status: 'accepted' },
      { title: 'Delivery notes', status: 'accepted' },
      { title: 'Acceptance report', status: 'accepted' },
    ],
  },
  {
    reference: 'GOV-26-OPS007',
    title: 'Renew warehouse safety certification',
    description: 'Operations to renew the annual warehouse safety certification and upload the updated certificate.',
    department: 'Operations',
    assigneeEmail: 'yusuf@acme.test',
    reviewerEmail: 'manager@acme.test',
    creatorEmail: 'admin@acme.test',
    status: 'open',
    priority: 'medium',
    category: 'Compliance',
    source_reference: 'OPS-SAF-2026',
    tags: ['safety'],
    dueOffset: 2,
    createdOffset: -3,
    requirements: [{ title: 'Updated safety certificate', status: 'pending' }],
  },
]

const northwindObligations: ObligationSpec[] = [
  {
    reference: 'NW-26-LIC001',
    title: 'Renew regional operating licence',
    description: 'Licensing team must renew the regional operating licence before expiry.',
    department: 'Licensing',
    assigneeEmail: 'member@northwind.test',
    reviewerEmail: 'admin@northwind.test',
    creatorEmail: 'admin@northwind.test',
    status: 'open',
    priority: 'high',
    category: 'Compliance',
    source_reference: 'LIC-2026-77',
    tags: ['licence'],
    dueOffset: 10,
    createdOffset: -4,
    requirements: [{ title: 'Renewal application', status: 'pending' }],
  },
]

async function seedObligation(orgId: string, deptMap: Map<string, string>, emails: Map<string, string>, spec: ObligationSpec): Promise<string> {
  const { data, error } = await db
    .from('obligations')
    .insert({
      organization_id: orgId,
      reference: spec.reference,
      title: spec.title,
      description: spec.description,
      department_id: deptMap.get(spec.department) ?? null,
      assignee_id: emails.get(spec.assigneeEmail) ?? null,
      reviewer_id: emails.get(spec.reviewerEmail) ?? null,
      created_by: emails.get(spec.creatorEmail)!,
      status: spec.status,
      priority: spec.priority,
      category: spec.category,
      source_reference: spec.source_reference,
      tags: spec.tags,
      due_date: dateOnly(spec.dueOffset),
      created_at: iso(spec.createdOffset),
      closed_at: spec.closedOffset !== undefined ? iso(spec.closedOffset) : null,
      closed_by: spec.closedOffset !== undefined ? emails.get(spec.reviewerEmail) : null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedObligation(${spec.reference}): ${error.message}`)
  const obligationId = data.id

  if (spec.requirements.length > 0) {
    await db.from('evidence_requirements').insert(
      spec.requirements.map((r, i) => ({
        organization_id: orgId,
        obligation_id: obligationId,
        title: r.title,
        status: r.status,
        sort_order: i,
        created_at: iso(spec.createdOffset),
      })),
    )
  }

  for (const c of spec.comments ?? []) {
    await db.from('comments').insert({
      organization_id: orgId,
      obligation_id: obligationId,
      author_id: emails.get(c.authorEmail)!,
      content: c.content,
      created_at: iso(-c.daysAgo),
    })
  }

  return obligationId
}

async function audit(orgId: string, actorEmail: string | null, action: string, summary: string, entityId: string | null, daysAgo: number): Promise<void> {
  await db.from('audit_events').insert({
    organization_id: orgId,
    actor_id: actorEmail ? emails.get(actorEmail)! : null,
    action,
    entity_type: 'obligation',
    entity_id: entityId,
    summary,
    created_at: iso(-daysAgo),
  })
}

async function notify(orgId: string, userEmail: string, type: string, title: string, body: string, obligationId: string | null, daysAgo: number): Promise<void> {
  await db.from('notifications').insert({
    organization_id: orgId,
    user_id: emails.get(userEmail)!,
    type,
    title,
    body,
    obligation_id: obligationId,
    created_at: iso(-daysAgo),
  })
}

const emails = new Map<string, string>()

async function main() {
  console.log('Seeding GovFlow demo data…')

  // ── Users ──────────────────────────────────────────────────────────────────
  emails.set('admin@acme.test', await ensureUser('admin@acme.test', 'Amelia Stone', 'Executive Director'))
  emails.set('manager@acme.test', await ensureUser('manager@acme.test', 'David Chen', 'Operations Manager'))
  emails.set('yusuf@acme.test', await ensureUser('yusuf@acme.test', 'Yusuf Adan', 'Finance Officer'))
  emails.set('aisha@acme.test', await ensureUser('aisha@acme.test', 'Aisha Bello', 'Procurement Officer'))
  emails.set('reviewer@acme.test', await ensureUser('reviewer@acme.test', 'Lena Ortiz', 'Internal Audit Manager'))
  emails.set('viewer@acme.test', await ensureUser('viewer@acme.test', 'Tom Reed', 'Analyst'))
  emails.set('admin@northwind.test', await ensureUser('admin@northwind.test', 'Nora Fields', 'Registrar'))
  emails.set('member@northwind.test', await ensureUser('member@northwind.test', 'Omar Diah', 'Licensing Officer'))

  // ── Organizations ──────────────────────────────────────────────────────────
  const acmeOrg = await createOrg(acme)
  const northwindOrg = await createOrg(northwind)
  const { data: existingAcme } = await db.from('obligations').select('id').eq('organization_id', acmeOrg.id).limit(1)
  if (existingAcme && existingAcme.length > 0) {
    console.log('Demo data already present — nothing to do.')
    return
  }

  await addMember(acmeOrg.id, emails.get('admin@acme.test')!, 'admin')
  await addMember(acmeOrg.id, emails.get('manager@acme.test')!, 'manager')
  await addMember(acmeOrg.id, emails.get('yusuf@acme.test')!, 'member')
  await addMember(acmeOrg.id, emails.get('aisha@acme.test')!, 'member')
  await addMember(acmeOrg.id, emails.get('reviewer@acme.test')!, 'reviewer')
  await addMember(acmeOrg.id, emails.get('viewer@acme.test')!, 'viewer')
  await addMember(northwindOrg.id, emails.get('admin@northwind.test')!, 'admin')
  await addMember(northwindOrg.id, emails.get('member@northwind.test')!, 'member')

  const acmeDepts = await createDepartments(acmeOrg.id, acme.departments)
  const nwDepts = await createDepartments(northwindOrg.id, northwind.departments)

  // ── Obligations ────────────────────────────────────────────────────────────
  for (const spec of acmeObligations) {
    const id = await seedObligation(acmeOrg.id, acmeDepts, emails, spec)
    await audit(acmeOrg.id, spec.creatorEmail, 'obligation_created', `Created obligation "${spec.title}" (${spec.reference})`, id, -spec.createdOffset)
    if (spec.status !== 'draft' && spec.status !== 'open') {
      await audit(acmeOrg.id, spec.assigneeEmail, 'obligation_status_changed', `Status set to ${spec.status.replaceAll('_', ' ')}`, id, 1)
    }
    if (spec.status === 'escalated') {
      await db.from('escalations').insert({
        organization_id: acmeOrg.id,
        obligation_id: id,
        escalated_by: emails.get('manager@acme.test')!,
        reason: 'Repeated non-response to deadline reminders.',
        status: 'active',
        created_at: iso(-3),
      })
      await audit(acmeOrg.id, 'manager@acme.test', 'obligation_escalated', 'Escalated after repeated non-response', id, 3)
      await notify(acmeOrg.id, spec.assigneeEmail, 'obligation_escalated', 'Obligation escalated: ' + spec.title, 'Repeated non-response to reminders.', id, 3)
    }
    for (const c of spec.comments ?? []) {
      await audit(acmeOrg.id, c.authorEmail, 'comment_added', `Commented on "${spec.title}"`, id, -c.daysAgo)
    }
  }
  for (const spec of northwindObligations) {
    await seedObligation(northwindOrg.id, nwDepts, emails, spec)
  }

  // ── A pending handover for the demo ────────────────────────────────────────
  const hrObligation = await db.from('obligations').select('id').eq('reference', 'GOV-26-HRD004').single()
  await db.from('handovers').insert({
    organization_id: acmeOrg.id,
    obligation_id: hrObligation.data!.id,
    from_user_id: emails.get('aisha@acme.test')!,
    to_user_id: emails.get('yusuf@acme.test')!,
    requested_by: emails.get('aisha@acme.test')!,
    status: 'pending',
    reason: 'Aisha is on leave next week — Yusuf will cover the training documentation.',
    created_at: iso(-1),
  })

  // ── Notifications so the bell looks alive ──────────────────────────────────
  await notify(acmeOrg.id, 'manager@acme.test', 'evidence_submitted', 'Evidence submitted: Provide supporting documents for procurement expenditure', 'Receipt uploaded for GOV-26-AUD001.', null, 1)
  await notify(acmeOrg.id, 'yusuf@acme.test', 'deadline_approaching', 'Deadline approaching', 'Warehouse safety certification is due in 2 days.', null, 0)
  await notify(acmeOrg.id, 'admin@acme.test', 'obligation_overdue', 'Obligation overdue', 'Implementation progress report is 6 days overdue.', null, 1)

  // ── Storage: one placeholder evidence PDF for the under-review obligation ──
  const audObligation = await db.from('obligations').select('id').eq('reference', 'GOV-26-AUD001').single()
  const req = await db.from('evidence_requirements').select('id').eq('obligation_id', audObligation.data!.id).eq('title', 'Payment voucher').single()
  const path = `${acmeOrg.id}/${audObligation.data!.id}/seed-payment-voucher.pdf`
  const placeholder = new TextEncoder().encode(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  )
  const { error: upErr } = await db.storage.from('evidence-files').upload(path, placeholder, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upErr && !upErr.message.includes('exists')) console.warn('storage upload:', upErr.message)
  await db.from('evidence_files').upsert(
    {
      organization_id: acmeOrg.id,
      obligation_id: audObligation.data!.id,
      requirement_id: req.data!.id,
      uploaded_by: emails.get('yusuf@acme.test')!,
      file_name: 'payment-voucher-4471.pdf',
      storage_path: path,
      mime_type: 'application/pdf',
      file_size: placeholder.byteLength,
      status: 'accepted',
      review_note: 'Verified against ledger entry 4471.',
      reviewed_by: emails.get('reviewer@acme.test')!,
      reviewed_at: iso(-2),
      created_at: iso(-3),
    },
    { onConflict: 'storage_path' },
  )
  const req2 = await db.from('evidence_requirements').select('id').eq('obligation_id', audObligation.data!.id).eq('title', 'Approval document').single()
  const path2 = `${acmeOrg.id}/${audObligation.data!.id}/seed-approval-document.pdf`
  const { error: upErr2 } = await db.storage.from('evidence-files').upload(path2, placeholder, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upErr2 && !upErr2.message.includes('exists')) console.warn('storage upload:', upErr2.message)
  await db.from('evidence_files').upsert(
    {
      organization_id: acmeOrg.id,
      obligation_id: audObligation.data!.id,
      requirement_id: req2.data!.id,
      uploaded_by: emails.get('yusuf@acme.test')!,
      file_name: 'approval-lpo-2026-114.pdf',
      storage_path: path2,
      mime_type: 'application/pdf',
      file_size: placeholder.byteLength,
      status: 'accepted',
      reviewed_by: emails.get('reviewer@acme.test')!,
      reviewed_at: iso(-2),
      created_at: iso(-3),
    },
    { onConflict: 'storage_path' },
  )

  console.log('')
  console.log('✔ Seed complete.')
  console.log(`  Acme Operations Ltd  invite code: ${acmeOrg.invite_code}`)
  console.log(`  Northwind Authority  invite code: ${northwindOrg.invite_code}`)
  console.log('')
  console.log(`  Sign in with any of the seeded users, e.g. admin@acme.test / ${PASSWORD}`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
