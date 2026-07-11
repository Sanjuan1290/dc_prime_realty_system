import { apiRequest } from './apiClient'

export const useFetch = async (url, options = {}) => {
  return apiRequest(url, options)
}

export const useFetchPost = async (url, body = {}, options = {}) => {
  return apiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const useFetchPut = async (url, body = {}, options = {}) => {
  return apiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export const useFetchPatch = async (url, body = {}, options = {}) => {
  return apiRequest(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export const useFetchDelete = async (url, options = {}) => {
  return apiRequest(url, {
    ...options,
    method: 'DELETE',
  })
}
