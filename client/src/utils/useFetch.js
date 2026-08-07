import { requestApi } from './apiClient'

const prepareBody = (body = {}, options = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { body, options }
  const { __reviewConfirmed = false, ...cleanBody } = body
  return {
    body: cleanBody,
    options: __reviewConfirmed ? { ...options, skipReview: true } : options,
  }
}

export const useFetch = async (url, options = {}) => requestApi(url, options)

export const useFetchPost = async (url, body = {}, options = {}) => {
  const prepared = prepareBody(body, options)
  return requestApi(url, {
    ...prepared.options,
    method: 'POST',
    body: JSON.stringify(prepared.body),
  })
}

export const useFetchPut = async (url, body = {}, options = {}) => {
  const prepared = prepareBody(body, options)
  return requestApi(url, {
    ...prepared.options,
    method: 'PUT',
    body: JSON.stringify(prepared.body),
  })
}

export const useFetchPatch = async (url, body = {}, options = {}) => {
  const prepared = prepareBody(body, options)
  return requestApi(url, {
    ...prepared.options,
    method: 'PATCH',
    body: JSON.stringify(prepared.body),
  })
}

export const useFetchDelete = async (url, options = {}) =>
  requestApi(url, {
    ...options,
    method: 'DELETE',
  })
