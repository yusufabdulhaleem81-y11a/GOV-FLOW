import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { AuthShell } from './login'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { signUpSchema } from '@govflow/validation'

export function SignupPage() {
  const { signUp, status } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    invite_code: searchParams.get('invite_code')?.toUpperCase() ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'signed-in') return <Navigate to="/dashboard" replace />

  return (
    <AuthShell>
      <h2 className="text-xl font-semibold">Create your account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start tracking accountability in minutes. Have an invite code? Add it below to join your organization.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const parsed = signUpSchema.safeParse({
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            invite_code: form.invite_code || undefined,
          })
          if (!parsed.success) {
            const errs: Record<string, string> = {}
            for (const issue of parsed.error.issues) errs[issue.path[0] as string] ??= issue.message
            setFieldErrors(errs)
            return
          }
          setFieldErrors({})
          setBusy(true)
          void signUp(parsed.data)
            .then(() => navigate('/dashboard'))
            .catch((err: Error) => {
              if (err.message === 'ACCOUNT_CREATED_CONFIRM_EMAIL') {
                setError('Account created. Check your inbox to confirm your email address, then sign in.')
              } else {
                setError(err.message)
              }
            })
            .finally(() => setBusy(false))
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Amelia Stone" />
          <FieldError>{fieldErrors.full_name}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FieldError>{fieldErrors.email}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
          <FieldError>{fieldErrors.password}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite_code">Invite code (optional)</Label>
          <Input
            id="invite_code"
            value={form.invite_code}
            onChange={(e) => setForm({ ...form, invite_code: e.target.value.toUpperCase() })}
            placeholder="From your organization admin"
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
