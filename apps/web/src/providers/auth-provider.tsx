import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Organization, UserRole } from '@govflow/types'
import { hasPermission, type Permission } from '@govflow/types'
import type { WebEnv } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import { configureApi, setActiveOrganization } from '@/lib/api'
import * as endpoints from '@/services/endpoints'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  job_title: string | null
}

interface AuthContextValue {
  supabase: SupabaseClient
  status: 'loading' | 'signed-out' | 'signed-in'
  session: Session | null
  profile: Profile | null
  memberships: { organization: Organization; role: UserRole }[]
  organization: Organization | null
  role: UserRole | null
  setCurrentOrganization: (id: string) => void
  can: (permission: Permission) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { email: string; password: string; full_name: string; invite_code?: string }) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refresh: () => Promise<void>
  joinWithCode: (code: string) => Promise<Organization>
  createOrganization: (name: string, description?: string) => Promise<Organization>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ORG_STORAGE_KEY = 'govflow.organization-id'

export function AuthProvider({ env, children }: { env: WebEnv; children: ReactNode }) {
  const supabase = getSupabase(env)
  const [session, setSession] = useState<Session | null>(null)
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed-out' | 'signed-in'>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<{ organization: Organization; role: UserRole }[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(() => localStorage.getItem(ORG_STORAGE_KEY))

  // Wire the API client to the Supabase session.
  useEffect(() => {
    configureApi({
      baseUrl: env.apiUrl,
      getToken: async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? null
      },
    })
  }, [supabase, env.apiUrl])

  const loadAccount = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentSession = sessionData.session
    setSession(currentSession)
    if (!currentSession) {
      setAuthStatus('signed-out')
      setProfile(null)
      setMemberships([])
      setActiveOrganization(null)
      return
    }
    try {
      const me = await endpoints.getMe()
      setProfile(me.user)
      setMemberships(me.memberships)
      setAuthStatus('signed-in')
      const stored = localStorage.getItem(ORG_STORAGE_KEY)
      const valid = me.memberships.find((m) => m.organization.id === stored) ?? me.memberships[0]
      const activeId = valid?.organization.id ?? null
      setOrganizationId(activeId)
      setActiveOrganization(activeId)
      if (valid) localStorage.setItem(ORG_STORAGE_KEY, valid.organization.id)
    } catch {
      // API unreachable or profile not ready — treat as signed in but empty.
      setAuthStatus('signed-in')
    }
  }, [supabase])

  useEffect(() => {
    void loadAccount()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setAuthStatus('signed-out')
        setProfile(null)
        setMemberships([])
        setActiveOrganization(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
        void loadAccount()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [supabase, loadAccount])

  const setCurrentOrganization = useCallback((id: string) => {
    setOrganizationId(id)
    setActiveOrganization(id)
    localStorage.setItem(ORG_STORAGE_KEY, id)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      await loadAccount()
    },
    [supabase, loadAccount],
  )

  const signUp = useCallback(
    async (input: { email: string; password: string; full_name: string; invite_code?: string }) => {
      const { error, data } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.full_name } },
      })
      if (error) throw new Error(error.message)
      if (!data.session) {
        throw new Error('ACCOUNT_CREATED_CONFIRM_EMAIL')
      }
      if (input.invite_code) {
        await endpoints.joinOrganization(input.invite_code).catch(() => undefined)
      }
      await loadAccount()
    },
    [supabase, loadAccount],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(ORG_STORAGE_KEY)
  }, [supabase])

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw new Error(error.message)
    },
    [supabase],
  )

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    [supabase],
  )

  const joinWithCode = useCallback(
    async (code: string) => {
      const { organization } = await endpoints.joinOrganization(code)
      await loadAccount()
      setCurrentOrganization(organization.id)
      return organization
    },
    [loadAccount, setCurrentOrganization],
  )

  const createOrganization = useCallback(
    async (name: string, description?: string) => {
      const { organization } = await endpoints.createOrganization({ name, description })
      await loadAccount()
      setCurrentOrganization(organization.id)
      return organization
    },
    [loadAccount, setCurrentOrganization],
  )

  const organization = useMemo(
    () => memberships.find((m) => m.organization.id === organizationId)?.organization ?? memberships[0]?.organization ?? null,
    [memberships, organizationId],
  )
  const role = useMemo(
    () => memberships.find((m) => m.organization.id === organizationId)?.role ?? memberships[0]?.role ?? null,
    [memberships, organizationId],
  )

  const can = useCallback((permission: Permission) => (role ? hasPermission(role, permission) : false), [role])

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      status: authStatus,
      session,
      profile,
      memberships,
      organization,
      role,
      setCurrentOrganization,
      can,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      refresh: loadAccount,
      joinWithCode,
      createOrganization,
    }),
    [
      supabase,
      authStatus,
      session,
      profile,
      memberships,
      organization,
      role,
      setCurrentOrganization,
      can,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      loadAccount,
      joinWithCode,
      createOrganization,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
