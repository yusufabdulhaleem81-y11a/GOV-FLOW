import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/providers/auth-provider'
import * as api from '@/services/endpoints'
import type { ObligationListQuery, CreateObligationInput, UpdateObligationInput } from '@govflow/types'
import { useToast } from '@/providers/toast-provider'

/** All hooks are org-scoped: they no-op until an organization is active. */
export function useOrgEnabled() {
  const { organization, status } = useAuth()
  return status === 'signed-in' && !!organization
}

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard, enabled: useOrgEnabled() })
}

export function useObligations(query: ObligationListQuery) {
  const enabled = useOrgEnabled()
  return useQuery({
    queryKey: ['obligations', query],
    queryFn: () => api.listObligations(query),
    enabled,
    placeholderData: (prev) => prev,
  })
}

export function useObligation(id: string | undefined) {
  const enabled = useOrgEnabled() && !!id
  return useQuery({
    queryKey: ['obligation', id],
    queryFn: () => api.getObligation(id!),
    enabled,
  })
}

export function useObligationComments(id: string | undefined) {
  const enabled = useOrgEnabled() && !!id
  return useQuery({
    queryKey: ['obligation-comments', id],
    queryFn: () => api.listComments(id!),
    enabled,
  })
}

export function useObligationAudit(id: string | undefined) {
  const enabled = useOrgEnabled() && !!id
  return useQuery({
    queryKey: ['obligation-audit', id],
    queryFn: () => api.listObligationAudit(id!),
    enabled,
  })
}

export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: api.listMembers, enabled: useOrgEnabled() })
}

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: api.listDepartments, enabled: useOrgEnabled() })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: api.listNotifications,
    enabled: useOrgEnabled(),
    refetchInterval: 60_000,
  })
}

export function useEvidenceList(query: { status?: string }) {
  return useQuery({
    queryKey: ['evidence', query],
    queryFn: () => api.listEvidence(query),
    enabled: useOrgEnabled(),
  })
}

export function useEscalations(status?: string) {
  return useQuery({
    queryKey: ['escalations', status],
    queryFn: () => api.listEscalations(status),
    enabled: useOrgEnabled(),
  })
}

export function useHandovers(status?: string) {
  return useQuery({
    queryKey: ['handovers', status],
    queryFn: () => api.listHandovers(status),
    enabled: useOrgEnabled(),
  })
}

export function useAuditLog(page: number, action?: string) {
  return useQuery({
    queryKey: ['audit', page, action],
    queryFn: () => api.listAudit({ page, pageSize: 25, action }),
    enabled: useOrgEnabled(),
    placeholderData: (prev) => prev,
  })
}

export function useReportSummary() {
  return useQuery({ queryKey: ['report-summary'], queryFn: api.getReportSummary, enabled: useOrgEnabled() })
}

export function useInvalidateOrgData() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries()
  }
}

/** Wraps a mutation with toasts + cache invalidation. */
export function useOrgMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  options: { successTitle?: string; invalidate?: boolean } = {},
) {
  const { toast } = useToast()
  const invalidate = useInvalidateOrgData()
  return useMutation<TResult, Error, TInput>({
    mutationFn,
    onSuccess: () => {
      if (options.successTitle) toast({ title: options.successTitle, variant: 'success' })
      if (options.invalidate !== false) invalidate()
    },
    onError: (err) => {
      toast({ title: 'Action failed', description: err.message, variant: 'error' })
    },
  })
}

export function useObligationMutations() {
  const create = useOrgMutation((input: CreateObligationInput) => api.createObligation(input), {
    successTitle: 'Obligation created',
  })
  const update = useOrgMutation(({ id, patch }: { id: string; patch: UpdateObligationInput }) => api.updateObligation(id, patch), {
    successTitle: 'Obligation updated',
  })
  const transition = useOrgMutation(({ id, action, note }: { id: string; action: string; note?: string }) => api.transitionObligation(id, action, note), {
    successTitle: 'Status updated',
  })
  const close = useOrgMutation(({ id, note }: { id: string; note?: string }) => api.closeObligation(id, note), {
    successTitle: 'Obligation closed',
  })
  const comment = useOrgMutation(({ id, content }: { id: string; content: string }) => api.addComment(id, content), {
    successTitle: 'Comment added',
  })
  const escalate = useOrgMutation(({ id, reason }: { id: string; reason: string }) => api.escalateObligation(id, reason), {
    successTitle: 'Obligation escalated',
  })
  const requestHandover = useOrgMutation(({ id, to_user_id, reason }: { id: string; to_user_id: string; reason?: string }) => api.requestHandover(id, to_user_id, reason), {
    successTitle: 'Handover requested',
  })
  return { create, update, transition, close, comment, escalate, requestHandover }
}
