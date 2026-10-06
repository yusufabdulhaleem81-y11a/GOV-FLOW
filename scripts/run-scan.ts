/**
 * Runs the deadline & escalation sweep outside the app process (for cron).
 * Usage: npm run scan  (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDeadlineScan } from '../apps/api/src/services/escalation.service.js'
import { createSupabaseDB } from '../apps/api/src/db/supabase-adapter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    /* optional */
  }
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const serviceDB = createSupabaseDB(
  createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }),
)

const result = await runDeadlineScan(serviceDB, {
  async send(input) {
    console.info(`📧 [scan email] to=${input.to} subject="${input.subject}"`)
  },
})
console.log(
  `Scan complete — marked overdue: ${result.marked_overdue}, auto-escalated: ${result.auto_escalated}, reminders: ${result.deadline_reminders}`,
)
