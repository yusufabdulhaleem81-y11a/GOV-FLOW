import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseDB } from '../../src/db/supabase-adapter.js'

function makeClient() {
  const queryBuilder = { select: vi.fn() }
  const tableBuilder = { insert: vi.fn(() => queryBuilder) }
  const client = { from: vi.fn(() => tableBuilder) } as unknown as SupabaseClient
  return { db: createSupabaseDB(client), queryBuilder, tableBuilder }
}

describe('Supabase DB adapter inserts', () => {
  it('does not request returned rows when returning is disabled', () => {
    const { db, queryBuilder, tableBuilder } = makeClient()

    db.from('organizations').insert({ id: 'org-id' }, { returning: false })

    expect(tableBuilder.insert).toHaveBeenCalledWith({ id: 'org-id' })
    expect(queryBuilder.select).not.toHaveBeenCalled()
  })

  it('returns inserted rows by default', () => {
    const { db, queryBuilder, tableBuilder } = makeClient()

    db.from('organizations').insert({ id: 'org-id' })

    expect(tableBuilder.insert).toHaveBeenCalledWith({ id: 'org-id' })
    expect(queryBuilder.select).toHaveBeenCalledOnce()
  })
})
