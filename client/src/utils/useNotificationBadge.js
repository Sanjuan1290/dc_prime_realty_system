import { useQuery } from '@tanstack/react-query'
import { hasPermission, PERMISSIONS } from '../config/permissions'
import { useFetch } from './useFetch'

const isDocumentAttentionItem = (item = {}) =>
  Number(item.pendingDocuments || 0) > 0 || Number(item.awaitingApprovalDocuments || 0) > 0

const useNotificationBadge = (user) => {
  const enabled = Boolean(user) && !user?.must_change_password && hasPermission(user, PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW)

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
  const paymentSummary = paymentQuery.data?.data?.summary || { total: 0, dueSoon: 0, overdue: 0, totalPaymentDue: 0, totalPenalty: 0 }
  const documentSummary = documentQuery.data?.data?.summary || { totalUnits: 0, pendingDocuments: 0, missingDocuments: 0, rejectedDocuments: 0, awaitingApproval: 0, clientActionDocuments: 0 }
  const paymentCount = paymentNotifications.length
  const documentCount = documentNotifications.filter(isDocumentAttentionItem).length

  return {
    totalCount: paymentCount + documentCount,
    paymentCount,
    documentCount,
    paymentSummary,
    documentSummary,
    isLoading: enabled && (paymentQuery.isLoading || documentQuery.isLoading),
    isFetching: enabled && (paymentQuery.isFetching || documentQuery.isFetching),
    refetch: () => Promise.all([paymentQuery.refetch(), documentQuery.refetch()]),
  }
}

export default useNotificationBadge

