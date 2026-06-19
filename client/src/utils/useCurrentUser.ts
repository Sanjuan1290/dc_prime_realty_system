import { useQuery } from "@tanstack/react-query"
import { useFetch } from "./useFetch"


const useCurrentUser = () => {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => useFetch('/user/me'),
        staleTime: 1000 * 60 * 60 * 24,
        retry: false
    })
}

export default useCurrentUser