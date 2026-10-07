/**
 * In-memory implementation of the API's `DB` interface (PostgREST semantics).
 *
 * Used by the integration test-suite to exercise the real Fastify routes,
 * services and business rules without a live Supabase project.
 */
import type { DB, DbError, DbResult, DbRow, TableClient } from '../src/db/types.js'

type Op = { column: string; op: 'eq' | 'is' | 'in' | 'gt' | 'gte' | 'lt' | 'lte'; value: unknown }

interface WriteSpec {
  kind: 'insert' | 'update' | 'delete'
  payload?: DbRow | DbRow[]
}

class FakeQuery<T extends DbRow> implements PromiseLike<DbResult<T[] | null>> {
  private ops: Op[] = []
  private orExpressions: string[] = []
  private orderSpec: { column: string; ascending: boolean }[] = []
  private rangeSpec: { from: number; to: number } | null = null
  private limitSpec: number | null = null
  countExact = false
  /** Injected by the table client; performs the mutation at await time. */
  writeFn: ((matched: DbRow[]) => DbError | null) | null = null
  insertPayload: DbRow[] | null = null
  insertError: DbError | null = null

  constructor(private readonly getRows: () => DbRow[]) {}

  eq(column: string, value: unknown): this { this.ops.push({ column, op: 'eq', value }); return this }
  is(column: string, value: null): this { this.ops.push({ column, op: 'is', value }); return this }
  in(column: string, values: unknown[]): this { this.ops.push({ column, op: 'in', value: values }); return this }
  gt(column: string, value: unknown): this { this.ops.push({ column, op: 'gt', value }); return this }
  gte(column: string, value: unknown): this { this.ops.push({ column, op: 'gte', value }); return this }
  lt(column: string, value: unknown): this { this.ops.push({ column, op: 'lt', value }); return this }
  lte(column: string, value: unknown): this { this.ops.push({ column, op: 'lte', value }); return this }
  or(expression: string): this { this.orExpressions.push(expression); return this }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orderSpec.push({ column, ascending: options?.ascending ?? true })
    return this
  }
  range(from: number, to: number): this { this.rangeSpec = { from, to }; return this }
  limit(n: number): this { this.limitSpec = n; return this }
  select(): this { return this }

  // ── matching ────────────────────────────────────────────────────────────────
  private matches(row: DbRow): boolean {
    for (const op of this.ops) {
      const cell = row[op.column]
      switch (op.op) {
        case 'eq': if (cell !== op.value) return false; break
        case 'is': if (cell !== op.value) return false; break
        case 'in': if (!(op.value as unknown[]).includes(cell)) return false; break
        case 'gt': if (!((cell as number) > (op.value as number))) return false; break
        case 'gte': if (!((cell as number) >= (op.value as number))) return false; break
        case 'lt': if (!((cell as number) < (op.value as number))) return false; break
        case 'lte': if (!((cell as number) <= (op.value as number))) return false; break
      }
    }
    for (const expr of this.orExpressions) {
      const anyMatch = expr.split(',').some((clause) => {
        const m = clause.trim().match(/^(\w+)\.(eq|ilike)\.([\s\S]+)$/)
        if (!m) return false
        const [, column, op, rawValue] = m as [string, string, string, string]
        const cell = row[column]
        if (op === 'eq') return cell === rawValue
        const pattern = rawValue.replaceAll('\\', '')
        const base = pattern.replace(/^%/, '').replace(/%$/, '')
        return typeof cell === 'string' && cell.toLowerCase().includes(base.toLowerCase())
      })
      if (!anyMatch) return false
    }
    return true
  }

  private select_() {
    const all = this.getRows().filter((row) => this.matches(row))
    let out = [...all]
    for (const spec of [...this.orderSpec].reverse()) {
      out.sort((a, b) => {
        const av = a[spec.column] as string | number | null
        const bv = b[spec.column] as string | number | null
        if (av === bv) return 0
        const cmp = av === null ? -1 : bv === null ? 1 : av < bv ? -1 : 1
        return spec.ascending ? cmp : -cmp
      })
    }
    if (this.rangeSpec) out = out.slice(this.rangeSpec.from, this.rangeSpec.to + 1)
    if (this.limitSpec !== null) out = out.slice(0, this.limitSpec)
    return { all, page: out }
  }

  // ── thenable ────────────────────────────────────────────────────────────────
  then<R1 = DbResult<T[] | null>, R2 = never>(
    onfulfilled?: ((value: DbResult<T[] | null>) => R1 | PromiseLike<R1>) | null | undefined,
    _onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null | undefined,
  ): PromiseLike<R1 | R2> {
    let result: DbResult<T[] | null>
    if (this.insertPayload) {
      // Insert: unique checks ran at build time; commit the rows now.
      const error = this.insertError ?? (this.writeFn ? this.writeFn([]) : null)
      result = {
        data: error ? [] : (this.insertPayload as unknown as T[]),
        error,
        count: error ? null : this.insertPayload.length,
      }
    } else {
      const { all, page } = this.select_()
      if (this.writeFn) {
        const error = this.writeFn(all)
        const affected = error ? [] : all
        result = { data: affected as unknown as T[], error, count: affected.length }
      } else {
        result = { data: page as unknown as T[], error: null, count: this.countExact ? all.length : null }
      }
    }
    if (!onfulfilled) return Promise.resolve(result as unknown as R1 | R2)
    return Promise.resolve(onfulfilled(result)) as PromiseLike<R1 | R2>
  }
}

export class FakeDB implements DB {
  readonly tables = new Map<string, DbRow[]>()
  /** Emulated unique constraints: table -> list of column groups. */
  readonly uniqueConstraints = new Map<string, string[][]>()
  readonly signedUrls: string[] = []
  private idCounter = 1
  private nowFn = () => new Date().toISOString()

  private rows(table: string): DbRow[] {
    let t = this.tables.get(table)
    if (!t) {
      t = []
      this.tables.set(table, t)
    }
    return t
  }

  // ── test helpers ────────────────────────────────────────────────────────────
  seed(table: string, rows: DbRow[]): void {
    for (const row of rows) this.rows(table).push(this.withDefaults(row))
  }

  all<T = DbRow>(table: string): T[] {
    return [...this.rows(table)] as T[]
  }

  private withDefaults(row: DbRow): DbRow {
    return {
      created_at: this.nowFn(),
      updated_at: this.nowFn(),
      ...row,
      id: row.id ?? `00000000-0000-4000-8000-${String(this.idCounter++).padStart(12, '0')}`,
    }
  }

  private uniqueViolation(table: string, row: DbRow): DbError | null {
    for (const columns of this.uniqueConstraints.get(table) ?? []) {
      const conflict = this.rows(table).some((existing) => columns.every((c) => existing[c] === row[c]))
      if (conflict) {
        return { message: `duplicate key value violates unique constraint (${columns.join(',')})`, code: '23505' }
      }
    }
    return null
  }

  // ── DB interface ────────────────────────────────────────────────────────────
  from(table: string) {
    const getRows = () => this.rows(table)

    const buildSelect = (): FakeQuery<DbRow> => new FakeQuery<DbRow>(getRows)

    const buildWrite = (spec: WriteSpec): FakeQuery<DbRow> => {
      const q = new FakeQuery<DbRow>(getRows)
      if (spec.kind === 'insert') {
        const payloadRows = (Array.isArray(spec.payload) ? spec.payload : [spec.payload]).map(
          (r) => this.withDefaults(r as DbRow),
        )
        q.insertPayload = payloadRows
        for (const row of payloadRows) {
          const err = this.uniqueViolation(table, row)
          if (err) {
            q.insertError = err
            break
          }
        }
        q.writeFn = () => {
          if (q.insertError) return q.insertError
          getRows().push(...payloadRows)
          return null
        }
        return q
      }
      if (spec.kind === 'update') {
        q.writeFn = (matched) => {
          for (const row of matched) {
            Object.assign(row, spec.payload as DbRow, { updated_at: this.nowFn() })
          }
          return null
        }
        return q
      }
      // delete
      q.writeFn = (matched) => {
        const ids = new Set(matched.map((r) => r.id))
        const t = getRows()
        const keep = t.filter((r) => !ids.has(r.id))
        t.length = 0
        t.push(...keep)
        return null
      }
      return q
    }

    // The shape mirrors the real TableClient: .select() / .insert() / .update() / .delete()
    const client = {
      select: (_columns?: string, options?: { count?: 'exact' | 'head' }) => {
        const q = buildSelect()
        if (options?.count === 'exact') q.countExact = true
        return q
      },
      insert: (payload: DbRow | DbRow[], _options?: { returning?: boolean }) =>
        buildWrite({ kind: 'insert', payload }),
      update: (payload: DbRow) => buildWrite({ kind: 'update', payload }),
      delete: () => buildWrite({ kind: 'delete' }),
    }
    return client as unknown as TableClient
  }

  storage = {
    from: (_bucket: string) => ({
      createSignedUrl: async (path: string) => {
        const url = `https://fake-storage.test/signed/${path}?token=fake`
        this.signedUrls.push(url)
        return { data: { signedUrl: url }, error: null as DbError | null, count: null }
      },
    }),
  }
}
