// Deep-link refresh for HR without falling back to WEBSITE index.html.
export const onRequest = ({ request, env, next }) => {
  const path = new URL(request.url).pathname
  if (/\.[a-zA-Z0-9]{1,8}$/.test(path)) return next()
  return env.ASSETS.fetch(new URL('/hr/', request.url))
}
