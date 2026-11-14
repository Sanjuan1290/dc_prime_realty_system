import { useQuery } from '@tanstack/react-query'
import { requestApi } from './apiClient'

const useCurrentUser = ({ redirectOnUnavailable = true, refetchOnWindowFocus = true } = {}) => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => requestApi('/user/me', { redirectOnUnavailable }),
    staleTime: 1000 * 60 * 5,
    retry: false,
    refetchOnWindowFocus,
  })
}

export default useCurrentUser



