import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WebEnv } from './env'

let client: SupabaseClient | null = null

export function getSupabase(env: WebEnv): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
