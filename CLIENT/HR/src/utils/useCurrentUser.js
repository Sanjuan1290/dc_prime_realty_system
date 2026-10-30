import { useQuery } from '@tanstack/react-query'
import { requestApi } from './apiClient'
const useCurrentUser = () => useQuery({ queryKey:['hr','currentUser'], queryFn:() => requestApi('/auth/me'), retry:false, staleTime:60000 })
export default useCurrentUser
