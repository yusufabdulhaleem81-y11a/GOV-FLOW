import { ShieldCheck } from 'lucide-react'

/** Rendered when the web app has no Supabase configuration (VITE_* env vars). */
export function SetupRequiredPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-7 shadow-card">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">GovFlow needs to be connected to Supabase</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The environment variables <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> are not set. GovFlow does not
          ship with fake data — it needs a real Supabase project (the free tier works).
        </p>
        <ol className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">1</span>
            <span>
              Create a project at <span className="font-medium">supabase.com</span> and open{' '}
              <span className="font-medium">Project Settings → API</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">2</span>
            <span>
              Copy <code className="rounded bg-muted px-1 text-xs">apps/web/.env.example</code> to{' '}
              <code className="rounded bg-muted px-1 text-xs">apps/web/.env.local</code> and paste the Project URL and anon key.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">3</span>
            <span>
              Configure the API keys in the root <code className="rounded bg-muted px-1 text-xs">.env.local</code>, then run{' '}
              <code className="rounded bg-muted px-1 text-xs">npm run db:migrate</code> and{' '}
              <code className="rounded bg-muted px-1 text-xs">npm run db:seed</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">4</span>
            <span>
              Run <code className="rounded bg-muted px-1 text-xs">npm run dev</code> and open this page again.
            </span>
          </li>
        </ol>
        <p className="mt-5 text-xs text-muted-foreground">
          Full instructions live in the README, including how to enable email sign-in and storage.
        </p>
      </div>
    </div>
  )
}
