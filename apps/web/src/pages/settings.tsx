import { useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useOrgMutation } from '@/hooks/queries'
import { updateOrganization } from '@/services/endpoints'
import { PageHeader, Tabs } from '@/components/ui/misc'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ROLE_LABELS, NOTIFICATION_LABELS, NOTIFICATION_TYPES } from '@govflow/types'

export function SettingsPage() {
  const { profile, role, organization, memberships, updatePassword, joinWithCode, refresh } = useAuth()
  const [tab, setTab] = useState('organization')
  const [name, setName] = useState(organization?.name ?? '')
  const [description, setDescription] = useState(organization?.description ?? '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const saveOrg = useOrgMutation((input: { name: string; description: string | null }) => updateOrganization(organization!.id, input), {
    successTitle: 'Organization updated',
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <Tabs
        className="mb-5"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'organization', label: 'Organization' },
          { id: 'profile', label: 'My profile' },
          { id: 'notifications', label: 'Notifications' },
        ]}
      />

      {tab === 'organization' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Organization profile</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Name</Label>
                <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={role !== 'admin'} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-desc">Description</Label>
                <Input id="org-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={role !== 'admin'} />
              </div>
              {role === 'admin' && (
                <Button
                  size="sm"
                  loading={saveOrg.isPending}
                  onClick={() => saveOrg.mutate({ name: name.trim(), description: description.trim() || null })}
                >
                  Save changes
                </Button>
              )}
              {role !== 'admin' && <p className="text-xs text-muted-foreground">Only organization admins can change these settings.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Join another organization</CardTitle></CardHeader>
            <CardContent>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setJoinError(null)
                  void joinWithCode(code.trim())
                    .then(() => {
                      setCode('')
                      void refresh()
                    })
                    .catch((err: Error) => setJoinError(err.message))
                }}
              >
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Invite code" />
                <Button type="submit" variant="outline">Join</Button>
              </form>
              {joinError && <p className="mt-2 text-xs text-destructive">{joinError}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Your organizations: {memberships.map((m) => `${m.organization.name} (${ROLE_LABELS[m.role]})`).join(', ')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'profile' && (
        <Card>
          <CardHeader><CardTitle>My profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={profile?.full_name ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile?.email ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Change password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
              />
            </div>
            <Button
              size="sm"
              disabled={password.length < 8}
              onClick={() =>
                void updatePassword(password).then(
                  () => {
                    setPasswordMessage('Password updated.')
                    setPassword('')
                  },
                  (err: Error) => setPasswordMessage(err.message),
                )
              }
            >
              Update password
            </Button>
            {passwordMessage && <p className="text-xs text-muted-foreground">{passwordMessage}</p>}
          </CardContent>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification events</CardTitle>
            <p className="text-xs text-muted-foreground">
              GovFlow notifies you in-app for these events. Email delivery depends on the server's email configuration.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {NOTIFICATION_TYPES.map((type) => (
                <li key={type} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  {NOTIFICATION_LABELS[type]}
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Enabled</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
