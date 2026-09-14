import { useQuery } from '@tanstack/react-query'
import { isFullAccessAdministrator } from '../config/permissions'
import { useFetch } from './useFetch'

const isDocumentAttentionItem = (item = {}) =>
  Number(item.pendingRequiredDocuments || 0) > 0 || Number(item.awaitingApprovalDocuments || 0) > 0

const useNotificationBadge = (user) => {
  const enabled = Boolean(user) && !user?.must_change_password && isFullAccessAdministrator(user)

  const paymentQuery = useQuery({
    queryKey: ['system-payment-notifications', 'all', ''],
    queryFn: () => useFetch('/notifications/payment-dues?category=all'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const documentQuery = useQuery({
    queryKey: ['system-document-notifications', 'all', ''],
    queryFn: () => useFetch('/notifications/documents?category=all'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const paymentNotifications = paymentQuery.data?.data?.notifications || []
  const documentNotifications = documentQuery.data?.data?.notifications || []
  const paymentCount = paymentNotifications.length
  const documentCount = documentNotifications.filter(isDocumentAttentionItem).length

  return {
    totalCount: paymentCount + documentCount,
    paymentCount,
    documentCount,
    isLoading: enabled && (paymentQuery.isLoading || documentQuery.isLoading),
    isFetching: enabled && (paymentQuery.isFetching || documentQuery.isFetching),
  }
}

export default useNotificationBadge
