const DEFAULT_RENDER_ORIGIN = 'https://dc-prime-realty-api.onrender.com'
const PROXY_TIMEOUT_MS = 80_000

const normalizeOrigin = (value) =>
  String(value || DEFAULT_RENDER_ORIGIN).trim().replace(/\/+$/, '')

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })

export const onRequest = async ({ request, env }) => {
  const incomingUrl = new URL(request.url)
  const renderOrigin = normalizeOrigin(env.RENDER_API_ORIGIN)
  const targetUrl = `${renderOrigin}${incomingUrl.pathname}${incomingUrl.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.set('x-forwarded-host', incomingUrl.host)
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : request.body,
      redirect: 'manual',
      signal: controller.signal,
    })

    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('content-length')
    responseHeaders.set('Cache-Control', 'no-store')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const timedOut = error?.name === 'AbortError'

    return jsonResponse(
      {
        code: 'SERVER_UNAVAILABLE',
        message: timedOut
          ? 'The server is taking longer than expected to wake up.'
          : 'The server is temporarily unavailable.',
      },
      503
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

