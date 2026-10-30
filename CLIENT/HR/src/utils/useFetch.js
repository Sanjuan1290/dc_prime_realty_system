import { requestApi, requestApiBlob } from './apiClient'
export const useFetch = (url, options = {}) => requestApi(url, options)
export const useFetchBlob = (url, options = {}) => requestApiBlob(url, options)
export const useFetchPost = (url, body = {}, options = {}) => requestApi(url, {...options, method:'POST', body:JSON.stringify(body)})
export const useFetchPut = (url, body = {}, options = {}) => requestApi(url, {...options, method:'PUT', body:JSON.stringify(body)})
export const useFetchPatch = (url, body = {}, options = {}) => requestApi(url, {...options, method:'PATCH', body:JSON.stringify(body)})
export const useFetchDelete = (url, options = {}) => requestApi(url, {...options, method:'DELETE'})
export { isDoubleCheckCancelled, getDoubleCheckNotice } from './doubleCheck'
