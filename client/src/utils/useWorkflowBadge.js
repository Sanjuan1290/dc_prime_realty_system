import { useQuery } from '@tanstack/react-query'
import { hasPermission, PERMISSIONS } from '../config/permissions'
import { useFetch } from './useFetch'

const REVIEW_CENTER_ROLES = new Set(['super_admin','system_admin','auditor','marketing_head','sales_head','accounting_head','operations_head'])

const useWorkflowBadge = (user) => {
  const enabled = Boolean(user) && !user?.must_change_password && REVIEW_CENTER_ROLES.has(user?.role) && hasPermission(user, PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW)
  const query = useQuery({
    // Same account-aware key as the Review Center summary.
    queryKey: ['workflow-summary', user?.id || 0, user?.role || ''],
    queryFn: () => useFetch('/workflow/summary'),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  return {
    ...(query.data?.data || {}),
    badgeCount: Number(query.data?.data?.badgeCount || 0),
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export default useWorkflowBadge


