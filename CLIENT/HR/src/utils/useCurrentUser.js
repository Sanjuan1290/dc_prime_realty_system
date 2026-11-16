import { useQuery } from '@tanstack/react-query'
import { requestApi } from './apiClient'
const useCurrentUser = ({refetchOnWindowFocus=true}={}) => useQuery({ queryKey:['hr','currentUser'], queryFn:() => requestApi('/auth/me'), retry:false, staleTime:60000, refetchOnWindowFocus })
export default useCurrentUser
