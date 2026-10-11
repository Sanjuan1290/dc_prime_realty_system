import { useQuery } from '@tanstack/react-query'
import { hasPermission, PERMISSIONS } from '../config/permissions'
import { useFetch } from './useFetch'

const REVIEW_CENTER_ROLES = new Set(['super_admin','system_admin','auditor','marketing_head','sales_head','accounting_head','operations_head','marketing_staff','sales_staff','accounting_staff','operations_staff'])

const useWorkflowBadge = (user) => {
  const enabled = Boolean(user) && !user?.must_change_password && REVIEW_CENTER_ROLES.has(user?.role) && hasPermission(user, PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW)
  const query = useQuery({
    // Use the exact same role-scoped Needs My Action queue as the Review Center.
    // Fetch only one record; the server provides the full count in pagination.total.
    // Keep the workflow-reviews prefix so action mutations invalidate this count.
    queryKey: ['workflow-reviews', 'sidebar-count', user?.id || 0, user?.role || ''],
    queryFn: () => useFetch('/workflow/reviews?scope=queue&limit=1&page=1'),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  return {
    badgeCount: Math.max(0, Number(query.data?.pagination?.total || 0)),
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export default useWorkflowBadge


