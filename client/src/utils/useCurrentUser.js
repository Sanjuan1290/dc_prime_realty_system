import { useQuery } from '@tanstack/react-query'
import { requestApi } from './apiClient'

const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => requestApi('/user/me'),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export default useCurrentUser

