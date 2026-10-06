import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, createHarness, futureDate, pastDate, type TestHarness } from '../harness'

let harness: TestHarness
let manager: ReturnType<typeof authed>
let member: ReturnType<typeof authed>
let viewer: ReturnType<typeof authed>
let orgB: ReturnType<typeof authed>

beforeAll(async () => {
  harness = await createHarness()
  manager = authed(harness, harness.users.managerA, harness.orgA)
  member = authed(harness, harness.users.memberA, harness.orgA)
  viewer = authed(harness, harness.users.viewerA, harness.orgA)
  orgB = authed(harness, harness.users.adminB, harness.orgB)
})

afterAll(async () => {
  await harness.app.close()
})

describe('obligation creation', () => {
  it('managers can create obligations with evidence requirements', async () => {
    const res = await manager.post('/api/v1/obligations', {
      title: 'Provide supporting documents for audit observation',
      description: 'Full documentation for the Q2 observation.',
      department_id: 'b0000000-0000-4000-8000-000000000002',
      assignee_id: harness.users.memberA.id,
      reviewer_id: harness.users.reviewerA.id,
      priority: 'high',
      due_date: futureDate(10),
      requirements: [
        { title: 'Payment voucher' },
        { title: 'Approval document' },
        { title: 'Receipt' },
      ],
    })
    expect(res.statusCode).toBe(200)
    const obligation = res.json().obligation
    expect(obligation.status).toBe('open')
    expect(obligation.reference).toMatch(/^GOV-\d{2}-/)
    expect(obligation.requirements).toHaveLength(3)
    expect(obligation.requirements.every((r: { status: string }) => r.status === 'pending')).toBe(true)
  })

  it('members (responsible users) cannot create obligations', async () => {
    const res = await member.post('/api/v1/obligations', {
      title: 'Should not be allowed',
      due_date: futureDate(5),
      requirements: [],
    })
    expect(res.statusCode).toBe(403)
  })

  it('validates required fields', async () => {
    const res = await manager.post('/api/v1/obligations', { title: '', due_date: 'not-a-date', requirements: [] })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('BAD_REQUEST')
  })

  it('rejects assignees from another organization', async () => {
    const res = await manager.post('/api/v1/obligations', {
      title: 'Cross-org assignment',
      assignee_id: harness.users.memberB.id,
      due_date: futureDate(5),
      requirements: [],
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a reviewer identical to the assignee', async () => {
    const res = await manager.post('/api/v1/obligations', {
      title: 'Same person',
      assignee_id: harness.users.memberA.id,
      reviewer_id: harness.users.memberA.id,
      due_date: futureDate(5),
      requirements: [],
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('list scoping & search', () => {
  it('lists obligations for managers', async () => {
    const res = await manager.get('/api/v1/obligations')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.length).toBeGreaterThan(0)
  })

  it('scopes the list for members to obligations they are involved in', async () => {
    const res = await member.get('/api/v1/obligations')
    expect(res.statusCode).toBe(200)
    for (const item of res.json().data) {
      const involved =
        item.assignee?.id === harness.users.memberA.id ||
        item.reviewer?.id === harness.users.memberA.id ||
        false
      expect(involved).toBe(true)
    }
  })

  it('filters by overdue', async () => {
    await manager.post('/api/v1/obligations', {
      title: 'Overdue sentinel',
      due_date: pastDate(4),
      assignee_id: harness.users.memberA.id,
      requirements: [],
    })
    const res = await manager.get('/api/v1/obligations?overdue=true')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.some((o: { title: string }) => o.title === 'Overdue sentinel')).toBe(true)
  })

  it('searches by title and reference', async () => {
    const res = await manager.get('/api/v1/search?q=sentinel')
    expect(res.statusCode).toBe(200)
    expect(res.json().obligations.length).toBeGreaterThan(0)
  })

  it('isolates organizations: org B cannot see org A obligations', async () => {
    const resB = await orgB.get('/api/v1/obligations')
    expect(resB.statusCode).toBe(200)
    expect(resB.json().data).toHaveLength(0)
  })

  it('isolates organizations: org B cannot fetch an org A obligation by id', async () => {
    const res = await manager.get('/api/v1/obligations')
    const id = res.json().data[0].id
    const resB = await orgB.get(`/api/v1/obligations/${id}`)
    expect(resB.statusCode).toBe(404)
  })
})

describe('status transitions', () => {
  let obligationId: string

  beforeAll(async () => {
    const res = await manager.post('/api/v1/obligations', {
      title: 'Transition playground',
      due_date: futureDate(7),
      assignee_id: harness.users.memberA.id,
      reviewer_id: harness.users.reviewerA.id,
      requirements: [{ title: 'Signed report' }],
    })
    obligationId = res.json().obligation.id
  })

  it('member starts progress and submits for review', async () => {
    const res = await member.post(`/api/v1/obligations/${obligationId}/transition`, { action: 'start_progress' })
    expect(res.statusCode).toBe(200)
    expect(res.json().obligation.status).toBe('in_progress')

    const res2 = await member.post(`/api/v1/obligations/${obligationId}/transition`, { action: 'submit_for_review' })
    expect(res2.statusCode).toBe(200)
    expect(res2.json().obligation.status).toBe('under_review')
  })

  it('member cannot close the obligation', async () => {
    const res = await member.post(`/api/v1/obligations/${obligationId}/close`, {})
    expect(res.statusCode).toBe(403)
  })

  it('reviewer cannot close while required evidence is not accepted', async () => {
    const res = await authed(harness, harness.users.reviewerA, harness.orgA).post(
      `/api/v1/obligations/${obligationId}/close`,
      {},
    )
    expect(res.statusCode).toBe(409)
    expect(res.json().error.message).toMatch(/evidence/i)
  })

  it('rejects invalid transitions', async () => {
    const res = await member.post(`/api/v1/obligations/${obligationId}/transition`, { action: 'open' })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('INVALID_TRANSITION')
  })

  it('reviewer requests changes; the obligation goes back to the assignee', async () => {
    const res = await authed(harness, harness.users.reviewerA, harness.orgA).post(
      `/api/v1/obligations/${obligationId}/transition`,
      { action: 'request_changes', note: 'Report needs the summary page.' },
    )
    expect(res.statusCode).toBe(200)
    expect(res.json().obligation.status).toBe('changes_requested')
  })

  it('viewer cannot transition anything', async () => {
    const res = await viewer.post(`/api/v1/obligations/${obligationId}/transition`, { action: 'reopen' })
    expect(res.statusCode).toBe(403)
  })

  it('records audit events for the transitions', async () => {
    const res = await manager.get(`/api/v1/obligations/${obligationId}/audit`)
    expect(res.statusCode).toBe(200)
    const actions = res.json().data.map((e: { action: string }) => e.action)
    expect(actions).toContain('obligation_created')
    expect(actions).toContain('obligation_status_changed')
  })
})

describe('deadline editing', () => {
  it('audits deadline changes', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Deadline audit target',
      due_date: futureDate(3),
      requirements: [],
    })
    const id = created.json().obligation.id
    const res = await manager.patch(`/api/v1/obligations/${id}`, { due_date: futureDate(30) })
    expect(res.statusCode).toBe(200)
    const audit = await manager.get(`/api/v1/obligations/${id}/audit`)
    const actions = audit.json().data.map((e: { action: string }) => e.action)
    expect(actions).toContain('deadline_changed')
  })

  it('members cannot edit obligations they did not create', async () => {
    const created = await manager.post('/api/v1/obligations', {
      title: 'Edit protection',
      due_date: futureDate(3),
      requirements: [],
    })
    const id = created.json().obligation.id
    const res = await member.patch(`/api/v1/obligations/${id}`, { title: 'hacked' })
    // Members can only see obligations they are involved in — unrelated ones are invisible:
    expect(res.statusCode).toBe(404)
  })
})
