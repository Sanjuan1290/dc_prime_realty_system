import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "./apiFetch"


const useCurrentUser = () => {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => apiFetch('/user/me'),
        staleTime: 1000 * 60 * 60 * 24,
        retry: false
    })
}

export default useCurrentUser