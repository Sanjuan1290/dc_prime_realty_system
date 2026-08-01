import { requestApi } from './apiClient'

export const useFetch = async (url) => requestApi(url)

export const useFetchPost = async (url, body = {}) =>
  requestApi(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const useFetchPut = async (url, body = {}) =>
  requestApi(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const useFetchPatch = async (url, body = {}) =>
  requestApi(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const useFetchDelete = async (url) =>
  requestApi(url, {
    method: 'DELETE',
  })
