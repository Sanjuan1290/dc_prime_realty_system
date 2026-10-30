// Cloudflare Pages proxy: individual upstreams, no browser-visible secrets.
const TIMEOUT = 120_000
const knownCookies = {
  hr: new Set(['hr_auth_session', 'hr_attendance_kiosk_session']),
  finance: new Set(['dc_finance_session']),
}
function filteredCookie(header, system) {
  const parts = String(header || '').split(';').map(s => s.trim()).filter(Boolean)
  return parts.filter(part => {
    const name = part.split('=')[0].trim()
    return knownCookies[system]?.has(name) || (system === 'system' && !knownCookies.hr.has(name) && !knownCookies.finance.has(name))
  }).join('; ')
}
function fail(code, message, status = 503) {
  return new Response(JSON.stringify({ code, message }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
export async function proxy({ request, env }, { originVar, prefix, system }) {
  const configured = String(env[originVar] || '').trim()
  let origin
  try {
    origin = new URL(configured)
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid origin')
  } catch {
    return fail('UPSTREAM_NOT_CONFIGURED', 'This application API is not configured.')
  }
  const incoming = new URL(request.url)
  if (!incoming.pathname.startsWith(prefix + '/')) return fail('INVALID_API_PATH', 'Invalid API route.', 404)
  const path = incoming.pathname.slice(prefix.length)
  if (!/^\/api\/v1(?:\/|$)/.test(path)) return fail('INVALID_API_PATH', 'Unsupported API route.', 404)
  const target = new URL(path + incoming.search, origin)
  const headers = new Headers(request.headers)
  headers.delete('host'); headers.delete('content-length'); headers.delete('cookie')
  const cookies = filteredCookie(request.headers.get('cookie'), system)
  if (cookies) headers.set('cookie', cookies)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', 'https')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const upstream = await fetch(target, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual', signal: controller.signal,
    })
    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('content-length')
    responseHeaders.set('cache-control', 'private, no-store')
    if (system === 'hr') {
      // HR server sets Path=/api/v1. Browser must return this cookie on
      // /hr-api/api/v1 requests for login to persist through Pages.
      const setCookie = upstream.headers.get('set-cookie')
      if (setCookie) responseHeaders.set('set-cookie', setCookie.replace(/;\s*Path=\/api\/v1(?=\/|;|$)/gi, '; Path=/hr-api/api/v1'))
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders })
  } catch (error) {
    return fail('SERVER_UNAVAILABLE', error?.name === 'AbortError' ? 'API request timed out.' : 'The API server is unavailable.')
  } finally {
    clearTimeout(timeout)
  }
}
