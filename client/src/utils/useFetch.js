import { requestApi } from './apiClient'

export const useFetch = async (url, options = {}) => requestApi(url, options)

export const useFetchPost = async (url, body = {}, options = {}) => requestApi(url, {
  ...options,
  method: 'POST',
  body: JSON.stringify(body),
})

export const useFetchPut = async (url, body = {}, options = {}) => requestApi(url, {
  ...options,
  method: 'PUT',
  body: JSON.stringify(body),
})

export const useFetchPatch = async (url, body = {}, options = {}) => requestApi(url, {
  ...options,
  method: 'PATCH',
  body: JSON.stringify(body),
})

export const useFetchDelete = async (url, options = {}) => requestApi(url, {
  ...options,
  method: 'DELETE',
})

export { isDoubleCheckCancelled, getDoubleCheckNotice } from './doubleCheck'
