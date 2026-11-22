// Old shared buyer links belong to Realty after the move to /system.
export const onRequest = ({request}) => {
  const url=new URL(request.url)
  url.pathname=`/system${url.pathname}`
  return Response.redirect(url,302)
}
