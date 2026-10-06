import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useCurrentUser from '../../utils/useCurrentUser'
import { ReviewDetails } from './ReviewCenter'

const REVIEW_CENTER_ROLES = new Set([
  'super_admin',
  'system_admin',
  'auditor',
  'marketing_head',
  'sales_head',
  'accounting_head',
  'operations_head',
])

const ReviewDetailsPage = () => {
  const { reviewId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}

  if (actor.role && !REVIEW_CENTER_ROLES.has(actor.role)) {
    return <Navigate to={`/portal/${actor.role}`} replace />
  }

  const backToQueue = () => navigate(`/portal/${actor.role || 'super_admin'}/review-center`)
  const refreshWorkflow = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workflow-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['workflow-reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['workflow-protected-changes'] }),
      queryClient.invalidateQueries({ queryKey: ['workflow-notifications'] }),
    ])
  }

  return (
    <ReviewDetails
      reviewId={Number(reviewId)}
      onClose={backToQueue}
      onChanged={refreshWorkflow}
    />
  )
}

export default ReviewDetailsPage
