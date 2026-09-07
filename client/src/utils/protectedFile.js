import { requestApiBlob } from './apiClient'

export const getProtectedContentPath = (value = {}) => {
  if (typeof value === 'string') {
    const path = String(value || '').trim()
    return path.endsWith('/access-url') ? path.replace(/\/access-url$/, '/content') : path
  }

  const explicit = String(value?.contentPath || value?.content_path || '').trim()
  if (explicit) return explicit
  const accessPath = String(value?.accessPath || value?.access_path || '').trim()
  return accessPath.endsWith('/access-url') ? accessPath.replace(/\/access-url$/, '/content') : accessPath
}

export const fetchProtectedObjectUrl = async (value, options = {}) => {
  const contentPath = getProtectedContentPath(value)
  if (!contentPath) throw new Error('This protected file does not have a secure content route.')
  const result = await requestApiBlob(contentPath, options)
  if (!result?.blob) throw new Error('The server did not return protected file content.')
  return URL.createObjectURL(result.blob)
}

export const revokeProtectedObjectUrl = (url) => {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

export const openProtectedObjectUrl = (url, { revokeAfterMs = 60_000 } = {}) => {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => revokeProtectedObjectUrl(url), revokeAfterMs)
  return opened
}
