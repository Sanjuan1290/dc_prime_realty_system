import { Component } from 'react'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ListingProfileTab]', error, info)
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <FiAlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-950">This tab could not be displayed</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              The rest of the listing profile is still available. Retry this tab after the issue is corrected.
            </p>
            {import.meta.env.DEV ? (
              <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Retry Tab
            </button>
          </div>
        </div>
      </section>
    )
  }
}

export default TabErrorBoundary
