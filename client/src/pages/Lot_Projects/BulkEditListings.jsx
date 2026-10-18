import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import BulkEditListingsWorkspace from '../../components/Lot_Projects/ListingComponents/BulkEditListingsModal'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'

// The bulk edit/preview occupies a real workspace route rather than a modal.
const BulkEditListings = () => {
  const { projectSlug } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listingsPath = `/portal/lot-projects/${projectSlug}/listings`
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lot-listings', projectSlug, ''],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings`),
    enabled: Boolean(projectSlug),
  })
  const back = () => navigate(listingsPath)
  if (isLoading) return <StatusAlert type="loading" message="Loading project inventory..." />
  if (isError || !data?.project) return <StatusAlert type="error" message={error?.message || 'Unable to load this project. Return to Listings and try again.'} />
  return <BulkEditListingsWorkspace
    projectSlug={projectSlug}
    project={data.project}
    onClose={back}
    onSaved={async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] }),
        queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] }),
        queryClient.invalidateQueries({ queryKey: ['listing-bulk-history', projectSlug] }),
      ])
      navigate(listingsPath, { state: { bulkResult: result?.message || 'Listing changes saved successfully.' } })
    }}
  />
}
export default BulkEditListings

