import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-white">G</div>
          <span className="text-lg font-semibold tracking-tight text-white">GovFlow</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold leading-snug text-white">
            Who owes what, to whom, by when — with evidence, review and closure.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground">
            GovFlow keeps organizational obligations from being forgotten: clear owners, deadlines, required evidence,
            structured review, escalation when things slip, and a permanent audit history.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-sidebar-foreground">
            {['Assign & track', 'Evidence review', 'Escalate & close'].map((item) => (
              <div key={item} className="rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/60">© 2026 GovFlow — accountability platform</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">G</div>
            <span className="text-base font-semibold">GovFlow</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { signIn, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'signed-in') return <Navigate to={location.state?.from ?? '/dashboard'} replace />

  return (
    <AuthShell>
      <h2 className="text-xl font-semibold">Sign in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your credentials to continue.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          void signIn(email, password)
            .then(() => navigate((location.state?.from as string) ?? '/dashboard'))
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false))
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.com" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  )
}
