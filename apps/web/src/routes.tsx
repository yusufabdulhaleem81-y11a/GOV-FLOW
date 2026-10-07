import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { useAuth } from '@/providers/auth-provider'
import { Spinner } from '@/components/ui/misc'
import { LoginPage } from '@/pages/auth/login'
import { SignupPage } from '@/pages/auth/signup'
import { ForgotPasswordPage } from '@/pages/auth/forgot-password'
import { ResetPasswordPage } from '@/pages/auth/reset-password'
import { DashboardPage } from '@/pages/dashboard'
import { ObligationsPage } from '@/pages/obligations/list'
import { NewObligationPage } from '@/pages/obligations/new'
import { ObligationDetailPage } from '@/pages/obligations/detail'
import { ReviewsPage } from '@/pages/reviews'
import { EvidencePage } from '@/pages/evidence'
import { EscalationsPage } from '@/pages/escalations'
import { HandoversPage } from '@/pages/handovers'
import { DepartmentsPage } from '@/pages/organization/departments'
import { UsersPage } from '@/pages/organization/users'
import { ReportsPage } from '@/pages/reports'
import { AuditPage } from '@/pages/audit'
import { SettingsPage } from '@/pages/settings'
import { NotFoundPage } from '@/pages/not-found'
import { LandingPage } from '@/pages/Landing'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (status === 'signed-out') return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

function RequireOrganization({ children }: { children: JSX.Element }) {
  const { organization, memberships, status } = useAuth()
  if (status !== 'signed-in') return <Navigate to="/login" replace />
  if (!organization) {
    return <NoOrganization membershipsCount={memberships.length} />
  }
  return children
}

function HomeRoute() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (status === 'signed-in') return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

function NoOrganization({ membershipsCount }: { membershipsCount: number }) {
  const { createOrganization } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-card">
        <h1 className="text-lg font-semibold">Set up your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membershipsCount > 0
            ? 'Select an organization to continue.'
            : 'Create your first organization, or join one using an invite code from the sidebar.'}
        </p>
        {membershipsCount === 0 && (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              setBusy(true)
              void createOrganization(name.trim())
                .catch((err: Error) => setError(err.message))
                .finally(() => setBusy(false))
            }}
          >
            <input
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              placeholder="Organization name (e.g. Acme Operations Ltd)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="h-9 w-full rounded-md bg-primary text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create organization'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<RequireOrganization><DashboardPage /></RequireOrganization>} />
        <Route path="/obligations" element={<RequireOrganization><ObligationsPage /></RequireOrganization>} />
        <Route path="/obligations/new" element={<RequireOrganization><NewObligationPage /></RequireOrganization>} />
        <Route path="/obligations/:id" element={<RequireOrganization><ObligationDetailPage /></RequireOrganization>} />
        <Route path="/my-obligations" element={<RequireOrganization><ObligationsPage mine /></RequireOrganization>} />
        <Route path="/reviews" element={<RequireOrganization><ReviewsPage /></RequireOrganization>} />
        <Route path="/evidence" element={<RequireOrganization><EvidencePage /></RequireOrganization>} />
        <Route path="/escalations" element={<RequireOrganization><EscalationsPage /></RequireOrganization>} />
        <Route path="/handovers" element={<RequireOrganization><HandoversPage /></RequireOrganization>} />
        <Route path="/departments" element={<RequireOrganization><DepartmentsPage /></RequireOrganization>} />
        <Route path="/users" element={<RequireOrganization><UsersPage /></RequireOrganization>} />
        <Route path="/reports" element={<RequireOrganization><ReportsPage /></RequireOrganization>} />
        <Route path="/audit" element={<RequireOrganization><AuditPage /></RequireOrganization>} />
        <Route path="/settings" element={<RequireOrganization><SettingsPage /></RequireOrganization>} />
      </Route>

      <Route path="/" element={<HomeRoute />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
