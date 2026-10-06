/**
 * Narrow data-access interface used by all services.
 *
 * Services never import Supabase directly — they depend on this interface.
 * Two implementations exist:
 *  - `SupabaseDB` (production, backed by @supabase/supabase-js)
 *  - an in-memory fake used by the integration test-suite
 *
 * All queries resolve to `{ data, error, count }` (PostgREST semantics) and
 * always return ARRAYS — use the `rows()`/`first()`/`one()` helpers to unpack.
 */

export interface DbError {
  message: string
  code?: string
  details?: unknown
  hint?: unknown
}

export interface DbResult<T> {
  data: T
  error: DbError | null
  count: number | null
}

export type DbRow = Record<string, unknown>

/** Filter/order/pagination builder shared by select/insert/update/delete.
 * Methods return `this` so chaining preserves the awaitable type. */
export interface Query {
  eq(column: string, value: unknown): this
  is(column: string, value: null): this
  in(column: string, values: unknown[]): this
  gt(column: string, value: unknown): this
  gte(column: string, value: unknown): this
  lt(column: string, value: unknown): this
  lte(column: string, value: unknown): this
  /** PostgREST `or` expression, e.g. "title.ilike.%foo%,reference.eq.GOV-1" */
  or(expression: string): this
  order(column: string, options?: { ascending?: boolean }): this
  range(from: number, to: number): this
  limit(n: number): this
  /** Present for Supabase call-shape familiarity; writes always return rows. */
  select(): this
}

/** A query that can be awaited; resolves to rows. */
export type AwaitableQuery<T extends DbRow = DbRow> = Query & PromiseLike<DbResult<T[] | null>>

export interface TableClient {
  select<T extends DbRow = DbRow>(
    columns?: string,
    options?: { count?: 'exact' | 'head' },
  ): AwaitableQuery<T>
  insert<T extends DbRow = DbRow>(row: DbRow | DbRow[]): AwaitableQuery<T>
  update<T extends DbRow = DbRow>(patch: DbRow): AwaitableQuery<T>
  delete(): AwaitableQuery<never>
}

export interface StorageBucketClient {
  createSignedUrl(path: string, expiresIn: number): PromiseLike<DbResult<{ signedUrl: string }>>
}

export interface StorageClient {
  from(bucket: string): StorageBucketClient
}

export interface DB {
  from(table: string): TableClient
  storage: StorageClient
}

export interface AuthUser {
  id: string
  email: string | null
}

/** Verifies a bearer token and returns the user, or null when invalid. */
export interface AuthVerifier {
  getUser(token: string): Promise<AuthUser | null>
}

export class UnpackedError extends Error {}

/** Await a query and return exactly one row, or throw. */
export async function one<T extends DbRow>(query: PromiseLike<DbResult<T[] | null>>): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(`Database error: ${error.message}`)
  const rowsOut = data ?? []
  if (rowsOut.length === 0) throw new UnpackedError('Row not found')
  return rowsOut[0] as T
}

/** Await a query and return the first row or null. */
export async function first<T extends DbRow>(
  query: PromiseLike<DbResult<T[] | null>>,
): Promise<T | null> {
  const { data, error } = await query
  if (error) throw new Error(`Database error: ${error.message}`)
  return (data ?? [])[0] ?? null
}

/** Await a query and return all rows (never null). */
export async function rows<T extends DbRow>(
  query: PromiseLike<DbResult<T[] | null>>,
): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`Database error: ${error.message}`)
  return data ?? []
}

/** Await a mutating query; throws on error, returns affected rows. */
export async function mutation<T extends DbRow>(
  query: PromiseLike<DbResult<T[] | null>>,
): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`Database error: ${error.message}`)
  return data ?? []
}
