import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { AuthShell } from './login'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <AuthShell>
      <h2 className="text-xl font-semibold">Reset your password</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      {sent ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          If an account exists for {email}, a reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            void resetPassword(email)
              .then(() => setSent(true))
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false))
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
