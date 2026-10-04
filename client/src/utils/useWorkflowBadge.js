import { useQuery } from '@tanstack/react-query'
import { hasPermission, PERMISSIONS } from '../config/permissions'
import { useFetch } from './useFetch'

const useWorkflowBadge = (user) => {
  const enabled = Boolean(user) && !user?.must_change_password && hasPermission(user, PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW)
  const query = useQuery({
    queryKey: ['workflow-summary'],
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
