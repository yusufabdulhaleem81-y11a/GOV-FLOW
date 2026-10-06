import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY looks invalid'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY looks invalid'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
})

export type ApiEnv = z.infer<typeof envSchema>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Loads and validates environment variables. Throws a ConfigError with an
 * actionable message when required variables are missing — the server refuses
 * to start with a clear explanation instead of failing later at runtime.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new ConfigError(
      `GovFlow API is not configured correctly.\n\nFix the following environment variables (see .env.example):\n${missing}\n\n` +
        `1. Create a project at https://supabase.com (free tier works).\n` +
        `2. Copy .env.example to .env.local and fill in SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.\n` +
        `3. Run "npm run db:migrate" then "npm run db:seed".\n` +
        `4. Start GovFlow with "npm run dev".`,
    )
  }
  return parsed.data
}
