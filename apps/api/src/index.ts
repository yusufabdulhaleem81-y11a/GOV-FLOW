import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './config/env.js'
import { createSupabaseDB, createSupabaseVerifier } from './db/supabase-adapter.js'
import { createEmailSender } from './services/email.js'
import { buildApp } from './app.js'

async function main(): Promise<void> {
  let env
  try {
    env = loadEnv()
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }

  // User-scoped clients: every request carries the caller's JWT so RLS applies.
  const dbForToken = (token: string) =>
    createSupabaseDB(
      createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    )

  const serviceDB = createSupabaseDB(
    createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  )

  const app = await buildApp({
    env,
    dbForToken,
    serviceDB,
    verifier: createSupabaseVerifier(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    email: createEmailSender(env),
  })

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.info(`✔ GovFlow API listening on http://localhost:${env.PORT}/api/v1/health`)
  } catch (err) {
    console.error('Failed to start the GovFlow API:', err)
    process.exit(1)
  }
}

void main()
