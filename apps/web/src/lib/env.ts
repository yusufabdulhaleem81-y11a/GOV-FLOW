/** Reads and validates the Vite environment. Missing Supabase config is a
 * first-class state: the app renders a setup guide instead of crashing. */
export interface WebEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  apiUrl: string
}

export function loadWebEnv(): WebEnv | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return {
    supabaseUrl: url,
    supabaseAnonKey: key,
    apiUrl: import.meta.env.VITE_API_URL || '/api/v1',
  }
}
