import { AUTH_EVENTS, emitAuthEvent } from './authEvents'

const getApiUrl = (url) => `${import.meta.env.VITE_API_URL}${url}`

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', data = null, url = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
    this.url = url
  }
}

const readResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text ? { message: text } : null
}

const emitResponseAuthEvent = (error) => {
  const detail = {
    status: error.status,
    code: error.code,
    message: error.message,
    url: error.url,
  }

  if (error.status === 401) {
    emitAuthEvent(AUTH_EVENTS.unauthorized, detail)
    return
  }

  if (error.status !== 403) return

  if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
    emitAuthEvent(AUTH_EVENTS.passwordChangeRequired, detail)
    return
  }

  emitAuthEvent(AUTH_EVENTS.forbidden, detail)
}

export const apiRequest = async (url, options = {}) => {
  const {
    skipAuthRedirect = false,
    headers,
    ...fetchOptions
  } = options

  const response = await fetch(getApiUrl(url), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    ...fetchOptions,
  })

  const data = await readResponseBody(response)

  if (!response.ok) {
    const error = new ApiError(data?.message || 'Request failed', {
      status: response.status,
      code: data?.code || '',
      data,
      url,
    })

    if (!skipAuthRedirect) emitResponseAuthEvent(error)
    throw error
  }

  return data
}
