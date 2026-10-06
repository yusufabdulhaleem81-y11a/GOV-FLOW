import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, createHarness, type TestHarness } from '../harness'

let harness: TestHarness

beforeAll(async () => {
  harness = await createHarness()
})

afterAll(async () => {
  await harness.app.close()
})

describe('authentication', () => {
  it('exposes a public health endpoint', async () => {
    const res = await harness.app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, service: 'govflow-api' })
  })

  it('rejects requests without a token', async () => {
    const res = await harness.app.inject({ method: 'GET', url: '/api/v1/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('rejects invalid tokens', async () => {
    const res = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns the profile and memberships for a valid token', async () => {
    const res = await authed(harness, harness.users.adminA, harness.orgA).get('/api/v1/me')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.email).toBe('admin@acme.test')
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0].organization.id).toBe(harness.orgA)
    expect(body.memberships[0].role).toBe('admin')
  })

  it('requires an organization header for org-scoped endpoints', async () => {
    const res = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/obligations',
      headers: { authorization: `Bearer ${harness.users.adminA.token}` },
    })
    expect([400, 401]).toContain(res.statusCode)
  })
})

describe('organization membership & isolation', () => {
  it('rejects the org header for an organization the user does not belong to', async () => {
    // memberA is not a member of org-b
    const res = await authed(harness, harness.users.memberA, harness.orgB).get('/api/v1/users')
    expect(res.statusCode).toBe(404)
  })

  it('allows joining via a valid invite code', async () => {
    const res = await authed(harness, harness.users.memberB, harness.orgB).post('/api/v1/join', { code: 'INVITE-A' })
    expect(res.statusCode).toBe(200)
    expect(res.json().organization.id).toBe(harness.orgA)
  })

  it('rejects an unknown invite code', async () => {
    const res = await authed(harness, harness.users.memberB, harness.orgB).post('/api/v1/join', { code: 'NOPE' })
    expect(res.statusCode).toBe(404)
  })

  it('only admins can change member roles', async () => {
    const asManager = authed(harness, harness.users.managerA, harness.orgA)
    const res = await asManager.patch(`/api/v1/organizations/${harness.orgA}/members/${harness.users.memberA.id}`, {
      role: 'manager',
    })
    expect(res.statusCode).toBe(403)
  })

  it('admins can change member roles', async () => {
    const asAdmin = authed(harness, harness.users.adminA, harness.orgA)
    const res = await asAdmin.patch(`/api/v1/organizations/${harness.orgA}/members/${harness.users.memberA.id}`, {
      role: 'manager',
    })
    expect(res.statusCode).toBe(200)
    // restore
    await asAdmin.patch(`/api/v1/organizations/${harness.orgA}/members/${harness.users.memberA.id}`, { role: 'member' })
  })

  it('prevents demoting the last admin', async () => {
    const asAdmin = authed(harness, harness.users.adminA, harness.orgA)
    const res = await asAdmin.patch(`/api/v1/organizations/${harness.orgA}/members/${harness.users.adminA.id}`, {
      role: 'member',
    })
    expect(res.statusCode).toBe(409)
  })
})
