#!/usr/bin/env node
/**
 * Applies SQL migrations from supabase/migrations to the Supabase Postgres
 * database, in filename order, tracking applied files in _govflow_migrations.
 *
 * Requires DATABASE_URL (Supabase → Project Settings → Database → Connection
 * string). Usage: npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations')

function loadEnvFile() {
  // Minimal .env.local / .env loader (dev machines don't always export vars).
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(__dirname, '..', file), 'utf8')
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      /* file is optional */
    }
  }
}

async function main() {
  loadEnvFile()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error(
      '✗ DATABASE_URL is not set.\n\n' +
        'Get it from Supabase → Project Settings → Database → Connection string (URI),\n' +
        'add it to .env.local, then run "npm run db:migrate" again.\n' +
        'See .env.example for details.',
    )
    process.exit(1)
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  })
  await client.connect()

  await client.query(
    `create table if not exists _govflow_migrations (
       filename text primary key,
       applied_at timestamptz not null default now()
     )`,
  )
  const applied = new Set(
    (await client.query('select filename from _govflow_migrations')).rows.map((r) => r.filename),
  )

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• ${file} (already applied)`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into _govflow_migrations (filename) values ($1)', [file])
      await client.query('commit')
      console.log(`✓ applied ${file}`)
      ran += 1
    } catch (err) {
      await client.query('rollback')
      console.error(`✗ failed ${file}: ${err.message}`)
      process.exit(1)
    }
  }

  await client.end()
  console.log(ran === 0 ? 'Database is up to date.' : `Applied ${ran} migration(s).`)
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
