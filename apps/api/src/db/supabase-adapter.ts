import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AwaitableQuery, DB, DbRow, TableClient } from './types.js'

/**
 * Bridges the narrow `DB` interface to the Supabase client.
 *
 * Every query runs under the caller's JWT, so Supabase Row Level Security is
 * a second, independent enforcement layer behind the API's own checks.
 */
export function createSupabaseDB(client: SupabaseClient): DB {
  const wrap = <T extends DbRow>(builder: unknown): AwaitableQuery<T> =>
    builder as AwaitableQuery<T>

  const tableClient = (table: string): TableClient => ({
    select<T extends DbRow>(columns?: string, options?: { count?: 'exact' | 'head' }) {
      const b = client
        .from(table)
        .select(columns ?? '*', {
          count: options?.count === 'exact' ? 'exact' : undefined,
          head: options?.count === 'head',
        })
      return wrap<T>(b)
    },
    insert<T extends DbRow>(row: DbRow | DbRow[]) {
      return wrap<T>(client.from(table).insert(row as never).select())
    },
    update<T extends DbRow>(patch: DbRow) {
      return wrap<T>(client.from(table).update(patch as never).select())
    },
    delete() {
      return wrap<never>(client.from(table).delete().select())
    },
  })

  return {
    from: (table: string) => tableClient(table),
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: (path: string, expiresIn: number) =>
          client.storage.from(bucket).createSignedUrl(path, expiresIn) as never,
      }),
    },
  }
}

/**
 * Verifies Supabase access tokens with a short in-memory TTL cache to avoid a
 * network round-trip on every request.
 */
export function createSupabaseVerifier(
  url: string,
  anonKey: string,
  ttlMs = 5 * 60 * 1000,
): { getUser(token: string): Promise<{ id: string; email: string | null } | null> } {
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const cache = new Map<string, { user: { id: string; email: string | null }; expires: number }>()

  return {
    async getUser(token: string) {
      const cached = cache.get(token)
      if (cached && cached.expires > Date.now()) return cached.user

      const { data, error } = await authClient.auth.getUser(token)
      if (error || !data.user) return null
      const user = { id: data.user.id, email: data.user.email ?? null }
      cache.set(token, { user, expires: Date.now() + ttlMs })
      return user
    },
  }
}
