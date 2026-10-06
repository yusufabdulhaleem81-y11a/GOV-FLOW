import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { AuthShell } from './login'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <AuthShell>
      <h2 className="text-xl font-semibold">Choose a new password</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter a new password for your account.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
          }
          setBusy(true)
          setError(null)
          void updatePassword(password)
            .then(() => navigate('/dashboard'))
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false))
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
