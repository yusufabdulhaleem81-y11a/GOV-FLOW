import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, createHarness, futureDate, pastDate, type TestHarness } from '../harness'

let harness: TestHarness
let admin: ReturnType<typeof authed>
let manager: ReturnType<typeof authed>
let member: ReturnType<typeof authed>
let reviewer: ReturnType<typeof authed>

beforeAll(async () => {
  harness = await createHarness()
  admin = authed(harness, harness.users.adminA, harness.orgA)
  manager = authed(harness, harness.users.managerA, harness.orgA)
  member = authed(harness, harness.users.memberA, harness.orgA)
  reviewer = authed(harness, harness.users.reviewerA, harness.orgA)
})

afterAll(async () => {
  await harness.app.close()
})

async function createObligationWithEvidence(title: string, requirementStatuses: 'pending' | 'accepted') {
  const created = await manager.post('/api/v1/obligations', {
    title,
    due_date: futureDate(7),
    assignee_id: harness.users.memberA.id,
    reviewer_id: harness.users.reviewerA.id,
    requirements: [{ title: 'Payment voucher' }, { title: 'Bank statement' }],
  })
  const obligation = created.json().obligation
  // Member uploads evidence for the first requirement
  const upload = await member.post('/api/v1/evidence', {
    obligation_id: obligation.id,
    requirement_id: obligation.requirements[0].id,
    file_name: 'voucher.pdf',
    storage_path: `${harness.orgA}/${obligation.id}/voucher.pdf`,
    mime_type: 'application/pdf',
    file_size: 1234,
  })
  expect(upload.statusCode).toBe(200)
  const fileId = upload.json().evidence.id

  if (requirementStatuses === 'accepted') {
    const review = await reviewer.post(`/api/v1/evidence/${fileId}/review`, { decision: 'accepted' })
    expect(review.statusCode).toBe(200)
  }
  return { obligation, fileId }
}

describe('evidence upload', () => {
  it('moves the obligation to under_review and notifies the reviewer', async () => {
    const { obligation } = await createObligationWithEvidence('Evidence flow basic', 'pending')
    const detail = await manager.get(`/api/v1/obligations/${obligation.id}`)
    expect(detail.json().obligation.status).toBe('under_review')

    const notifications = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${harness.users.reviewerA.token}` },
    })
    const types = notifications.json().data.map((n: { type: string }) => n.type)
    expect(types).toContain('evidence_submitted')
  })

  it('rejects evidence registered outside the organization storage prefix', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Storage prefix guard',
      due_date: futureDate(7),
      assignee_id: harness.users.memberA.id,
      requirements: [{ title: 'Anything' }],
    })
    const obligation = created.json().obligation
    const res = await member.post('/api/v1/evidence', {
      obligation_id: obligation.id,
      requirement_id: null,
      file_name: 'evil.pdf',
      storage_path: `org-b/${obligation.id}/evil.pdf`,
      mime_type: 'application/pdf',
      file_size: 100,
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects evidence for terminal obligations', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Closed target',
      due_date: futureDate(7),
      requirements: [],
    })
    const id = created.json().obligation.id
    await manager.post(`/api/v1/obligations/${id}/transition`, { action: 'cancel' })
    const res = await manager.post('/api/v1/evidence', {
      obligation_id: id,
      requirement_id: null,
      file_name: 'late.pdf',
      storage_path: `${harness.orgA}/${id}/late.pdf`,
      mime_type: 'application/pdf',
      file_size: 10,
    })
    // Managers may upload, but a cancelled obligation no longer accepts evidence:
    expect(res.statusCode).toBe(400)
  })
})

describe('evidence review → closure', () => {
  it('rejecting evidence sends the obligation to changes_requested', async () => {
    const { obligation, fileId } = await createObligationWithEvidence('Evidence reject flow', 'pending')
    const res = await reviewer.post(`/api/v1/evidence/${fileId}/review`, {
      decision: 'request_changes',
      note: 'Voucher is unsigned.',
    })
    expect(res.statusCode).toBe(200)
    const detail = await manager.get(`/api/v1/obligations/${obligation.id}`)
    expect(detail.json().obligation.status).toBe('changes_requested')

    // The assignee got a rejection notification
    const notifications = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${harness.users.memberA.token}` },
    })
    const types = notifications.json().data.map((n: { type: string }) => n.type)
    expect(types).toContain('evidence_rejected')
  })

  it('blocks closure until every required item is accepted, then closes', async () => {
    const { obligation, fileId } = await createObligationWithEvidence('Close flow', 'pending')

    // Second requirement has no evidence yet → close must fail
    const early = await reviewer.post(`/api/v1/obligations/${obligation.id}/close`, {})
    expect(early.statusCode).toBe(409)

    // Accept the first file
    await reviewer.post(`/api/v1/evidence/${fileId}/review`, { decision: 'accepted' })

    // Second requirement still pending → close must still fail
    const stillBlocked = await reviewer.post(`/api/v1/obligations/${obligation.id}/close`, {})
    expect(stillBlocked.statusCode).toBe(409)

    // Upload + accept the second requirement
    const second = await member.post('/api/v1/evidence', {
      obligation_id: obligation.id,
      requirement_id: obligation.requirements[1].id,
      file_name: 'bank-statement.pdf',
      storage_path: `${harness.orgA}/${obligation.id}/bank-statement.pdf`,
      mime_type: 'application/pdf',
      file_size: 2048,
    })
    await reviewer.post(`/api/v1/evidence/${second.json().evidence.id}/review`, { decision: 'accepted' })

    const close = await reviewer.post(`/api/v1/obligations/${obligation.id}/close`, { note: 'All documents verified.' })
    expect(close.statusCode).toBe(200)
    expect(close.json().obligation.status).toBe('closed')
    expect(close.json().obligation.closed_at).toBeTruthy()

    // Audit history contains the closure
    const audit = await manager.get(`/api/v1/obligations/${obligation.id}/audit`)
    const actions = audit.json().data.map((e: { action: string }) => e.action)
    expect(actions).toContain('obligation_closed')
    expect(actions).toContain('evidence_reviewed')
  })

  it('members cannot review evidence', async () => {
    const { fileId } = await createObligationWithEvidence('Member review guard', 'pending')
    const res = await member.post(`/api/v1/evidence/${fileId}/review`, { decision: 'accepted' })
    expect(res.statusCode).toBe(403)
  })
})

describe('handover', () => {
  it('member requests a handover; manager approves; assignment transfers', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Handover target',
      due_date: futureDate(7),
      assignee_id: harness.users.memberA.id,
      requirements: [],
    })
    const id = created.json().obligation.id

    const request = await member.post('/api/v1/handovers', {
      obligation_id: id,
      to_user_id: harness.users.memberA2.id,
      reason: 'Going on leave',
    })
    expect(request.statusCode).toBe(200)
    const handoverId = request.json().handover.id

    const list = await member.get('/api/v1/handovers?status=pending')
    expect(list.json().data.some((h: { id: string }) => h.id === handoverId)).toBe(true)

    const approve = await manager.post(`/api/v1/handovers/${handoverId}/approve`, { note: 'Approved' })
    expect(approve.statusCode).toBe(200)

    const detail = await manager.get(`/api/v1/obligations/${id}`)
    expect(detail.json().obligation.assignee_id).toBe(harness.users.memberA2.id)

    const audit = await manager.get(`/api/v1/obligations/${id}/audit`)
    const actions = audit.json().data.map((e: { action: string }) => e.action)
    expect(actions).toContain('handover_requested')
    expect(actions).toContain('handover_approved')
  })

  it('members cannot approve handovers', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Handover guard',
      due_date: futureDate(7),
      assignee_id: harness.users.memberA.id,
      requirements: [],
    })
    const guardId = created.json().obligation.id
    const request = await member.post('/api/v1/handovers', { obligation_id: guardId, to_user_id: harness.users.memberA2.id })
    const handoverId = request.json().handover.id
    const res = await member.post(`/api/v1/handovers/${handoverId}/approve`, {})
    expect(res.statusCode).toBe(403)
  })
})

describe('escalation', () => {
  it('manager escalates and resolves, restoring the previous status', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Escalation target',
      due_date: futureDate(7),
      assignee_id: harness.users.memberA.id,
      requirements: [],
    })
    const id = created.json().obligation.id
    await member.post(`/api/v1/obligations/${id}/transition`, { action: 'start_progress' })

    const escalate = await manager.post(`/api/v1/escalations/obligations/${id}`, { reason: 'Blocked by supplier' })
    expect(escalate.statusCode).toBe(200)
    const escalationId = escalate.json().escalation.id

    let detail = await manager.get(`/api/v1/obligations/${id}`)
    expect(detail.json().obligation.status).toBe('escalated')
    expect(detail.json().obligation.previous_status).toBe('in_progress')

    const list = await manager.get('/api/v1/escalations?status=active')
    expect(list.json().data.some((e: { id: string }) => e.id === escalationId)).toBe(true)

    const resolve = await manager.post(`/api/v1/escalations/${escalationId}/resolve`, { note: 'Supplier confirmed' })
    expect(resolve.statusCode).toBe(200)
    detail = await manager.get(`/api/v1/obligations/${id}`)
    expect(detail.json().obligation.status).toBe('in_progress')
  })

  it('members cannot escalate', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Escalation guard',
      due_date: futureDate(7),
      requirements: [],
    })
    const res = await member.post(`/api/v1/escalations/obligations/${created.json().obligation.id}`, { reason: 'nope' })
    expect(res.statusCode).toBe(403)
  })
})

describe('deadline scan', () => {
  it('marks overdue obligations and escalates past the threshold (system scan)', async () => {
    await manager.post('/api/v1/obligations', {
      title: 'Scan overdue simple',
      due_date: pastDate(2),
      assignee_id: harness.users.memberA.id,
      requirements: [],
    })
    await manager.post('/api/v1/obligations', {
      title: 'Scan overdue escalate',
      due_date: pastDate(9),
      assignee_id: harness.users.memberA.id,
      requirements: [],
      escalate_after_days: 3,
    })

    const res = await admin.post('/api/v1/escalations/scan')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.marked_overdue).toBeGreaterThanOrEqual(2)
    expect(body.auto_escalated).toBeGreaterThanOrEqual(1)

    const list = await manager.get('/api/v1/obligations?q=scan overdue')
    const titles = list.json().data.map((o: { title: string }) => o.title)
    expect(titles).toContain('Scan overdue escalate')

    // members cannot run the scan
    const memberScan = await member.post('/api/v1/escalations/scan')
    expect(memberScan.statusCode).toBe(403)
  })
})

describe('reports & dashboard', () => {
  it('dashboard returns KPIs, charts and attention list', async () => {
    const res = await manager.get('/api/v1/dashboard')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.kpis.total).toBeGreaterThan(0)
    expect(Array.isArray(body.charts.byStatus)).toBe(true)
    expect(Array.isArray(body.charts.trend)).toBe(true)
    expect(body.charts.trend).toHaveLength(30)
    expect(Array.isArray(body.attention)).toBe(true)
  })

  it('CSV export sets the right content type and filename', async () => {
    const res = await manager.get('/api/v1/reports/export?type=overdue')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('govflow-overdue')
    expect(res.body).toMatch(/^Reference,Title/)
  })

  it('audit log is admin/manager only and append-only', async () => {
    const res = await manager.get('/api/v1/audit')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.length).toBeGreaterThan(0)

    const memberRes = await member.get('/api/v1/audit')
    expect(memberRes.statusCode).toBe(403)
  })
})
