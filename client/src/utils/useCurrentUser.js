import { useQuery } from "@tanstack/react-query"

const useCurrentUser = () => {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL + '/user/me'}`, {
                credentials: 'include'
            })
        
            const data = await res.json()

            if(!res.ok) {
                throw new Error(data.message || 'Request Failed')
            }

            return data
        },
        staleTime: 1000 * 60 * 60 * 24,
        retry: false
    })
}

export default useCurrentUser


