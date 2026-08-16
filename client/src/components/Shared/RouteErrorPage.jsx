import { FiAlertTriangle, FiArrowLeft, FiRefreshCw } from 'react-icons/fi'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

const RouteErrorPage = () => {
  const error = useRouteError()
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || 'Request Error'}`
    : 'This page could not be displayed'
  const message = isRouteErrorResponse(error)
    ? error.data?.message || error.data || 'The requested page could not be loaded.'
    : error?.message || 'An unexpected application error occurred.'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
      <section className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white p-7 shadow-xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <FiAlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">{String(message)}</p>

        {import.meta.env.DEV && !isRouteErrorResponse(error) ? (
          <pre className="mt-5 max-h-52 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
            {String(error?.stack || error)}
          </pre>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            <FiArrowLeft /> Go Back
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"
          >
            <FiRefreshCw /> Reload Page
          </button>
        </div>
      </section>
    </main>
  )
}

export default RouteErrorPage
