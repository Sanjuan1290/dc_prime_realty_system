import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './apiClient'

const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiRequest('/user/me', { skipAuthRedirect: true }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export default useCurrentUser
