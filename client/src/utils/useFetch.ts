


export const useFetch = async (url: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL + url}`, {
        credentials: 'include'
    })
    
    const data = await res.json()

    if(!res.ok) {
        throw new Error(data.message || 'Request Failed')
    }

    return data
}


export const useFetchPost = async (url: string, body: {}) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL + url}` , {
        method: 'POST',
        credentials: 'include',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })

    const data = await res.json()

    if(!res.ok) {
        throw new Error(data.message || 'Request Failed')
    }

    return data
}