/**
 * Shared test harness: builds the real Fastify app wired to a FakeDB, seeds
 * two organizations (to prove isolation) and issues auth tokens.
 */
import { buildApp } from '../src/app.js'
import type { AppDeps } from '../src/app-context.js'
import { FakeDB } from './fake-supabase.js'
import type { ApiEnv } from '../src/config/env.js'
import type { AuthUser } from '../src/db/types.js'

export const env: ApiEnv = {
  NODE_ENV: 'test',
  PORT: 0,
  WEB_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_ANON_KEY: 'fake-anon-key-for-tests-000000000000',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key-for-tests-00000000000',
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
}

export interface TestUser {
  id: string
  email: string
  token: string
  full_name: string
}

export interface TestUsers {
  adminA: TestUser
  managerA: TestUser
  memberA: TestUser
  memberA2: TestUser
  reviewerA: TestUser
  viewerA: TestUser
  adminB: TestUser
  memberB: TestUser
}

export interface TestHarness {
  db: FakeDB
  app: Awaited<ReturnType<typeof buildApp>>
  users: TestUsers
  orgA: string
  orgB: string
}

export async function createHarness(): Promise<TestHarness> {
  const db = new FakeDB()
  db.uniqueConstraints.set('organizations', [['slug'], ['invite_code']])
  db.uniqueConstraints.set('organization_members', [['organization_id', 'user_id']])
  db.uniqueConstraints.set('obligations', [['organization_id', 'reference']])
  db.uniqueConstraints.set('evidence_files', [['storage_path']])
  db.uniqueConstraints.set('departments', [['organization_id', 'name']])

  const mkUser = (id: string, email: string, full_name: string): TestUser => ({ id, email, token: `tok-${id}`, full_name })

  const users: TestUsers = {
    adminA: mkUser('10000000-0000-4000-8000-000000000001', 'admin@acme.test', 'Amelia Stone'),
    managerA: mkUser('10000000-0000-4000-8000-000000000002', 'manager@acme.test', 'David Chen'),
    memberA: mkUser('10000000-0000-4000-8000-000000000003', 'yusuf@acme.test', 'Yusuf Adan'),
    memberA2: mkUser('10000000-0000-4000-8000-000000000004', 'aisha@acme.test', 'Aisha Bello'),
    reviewerA: mkUser('10000000-0000-4000-8000-000000000005', 'reviewer@acme.test', 'Lena Ortiz'),
    viewerA: mkUser('10000000-0000-4000-8000-000000000006', 'viewer@acme.test', 'Tom Reed'),
    adminB: mkUser('10000000-0000-4000-8000-000000000007', 'admin@northwind.test', 'Nora Fields'),
    memberB: mkUser('10000000-0000-4000-8000-000000000008', 'omar@northwind.test', 'Omar Diah'),
  }

  for (const u of Object.values(users) as TestUser[]) {
    db.seed('profiles', [{ id: u.id, email: u.email, full_name: u.full_name, job_title: null }])
  }

  db.seed('organizations', [
    {
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Acme Operations Ltd',
      slug: 'acme-operations',
      description: 'Demo org A',
      invite_code: 'INVITE-A',
    },
    {
      id: 'a0000000-0000-4000-8000-000000000002',
      name: 'Northwind Authority',
      slug: 'northwind-authority',
      description: 'Demo org B',
      invite_code: 'INVITE-B',
    },
  ])

  db.seed('organization_members', [
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.adminA.id, role: 'admin' },
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.managerA.id, role: 'manager' },
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.memberA.id, role: 'member' },
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.memberA2.id, role: 'member' },
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.reviewerA.id, role: 'reviewer' },
    { organization_id: 'a0000000-0000-4000-8000-000000000001', user_id: users.viewerA.id, role: 'viewer' },
    { organization_id: 'a0000000-0000-4000-8000-000000000002', user_id: users.adminB.id, role: 'admin' },
    { organization_id: 'a0000000-0000-4000-8000-000000000002', user_id: users.memberB.id, role: 'member' },
  ])

  db.seed('departments', [
    { id: 'b0000000-0000-4000-8000-000000000001', organization_id: 'a0000000-0000-4000-8000-000000000001', name: 'Finance', description: null },
    { id: 'b0000000-0000-4000-8000-000000000002', organization_id: 'a0000000-0000-4000-8000-000000000001', name: 'Internal Audit', description: null },
  ])

  const verifier = {
    async getUser(token: string): Promise<AuthUser | null> {
      const user = Object.values(users).find((u) => u.token === token)
      return user ? { id: user.id, email: user.email } : null
    },
  }

  const sentEmails: { to: string; subject: string }[] = []
  const email = {
    async send(input: { to: string; subject: string; text: string }) {
      sentEmails.push({ to: input.to, subject: input.subject })
    },
  }

  const deps: AppDeps = {
    env,
    dbForToken: (token: string) => {
      void token
      return db as never // user-scoped client in tests shares the fake store
    },
    serviceDB: db as never,
    verifier,
    email,
    now: () => new Date(),
  }

  const app = await buildApp(deps)
  return { db, app, users, orgA: 'a0000000-0000-4000-8000-000000000001', orgB: 'a0000000-0000-4000-8000-000000000002' }
}

export function authed(harness: TestHarness, user: TestUser, orgId: string) {
  const headers = { authorization: `Bearer ${user.token}`, 'x-organization-id': orgId }
  return {
    get: (url: string) => harness.app.inject({ method: 'GET', url, headers }),
    post: (url: string, body?: Record<string, unknown>) =>
      harness.app.inject({ method: 'POST', url, headers, payload: body as never }),
    patch: (url: string, body?: Record<string, unknown>) =>
      harness.app.inject({ method: 'PATCH', url, headers, payload: body as never }),
    delete: (url: string) => harness.app.inject({ method: 'DELETE', url, headers }),
  }
}

export const futureDate = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
export const pastDate = (days: number): string => futureDate(-days)
