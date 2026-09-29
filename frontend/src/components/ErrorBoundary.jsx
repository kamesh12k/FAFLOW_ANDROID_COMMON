import React from 'react'

const CHUNK_ERROR_KEY = 'faflow_chunk_reload_attempted'

/**
 * ErrorBoundary — catches unhandled React render errors and shows a recovery UI.
 * Special case: "Failed to fetch dynamically imported module" (stale chunk hash
 * after a deploy) triggers an automatic hard-reload ONCE, then shows the UI if
 * it still fails.
 * 
 * Supports:
 * - `fallback`: Custom fallback component or render function `(error, retry) => ReactNode`
 * - `inline`: Boolean indicating whether to render in-card (for route/widget wrapping)
 * - `title`: Optional custom heading
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false }
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Unable to preload CSS') ||
      error?.name === 'ChunkLoadError'

    return { hasError: true, error, isChunkError }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[FAFLOW] Unhandled render error:', error, errorInfo)

    // Auto-reload once for stale chunk errors (happens after deploys)
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Unable to preload CSS') ||
      error?.name === 'ChunkLoadError'

    if (isChunkError) {
      const alreadyTried = sessionStorage.getItem(CHUNK_ERROR_KEY)
      if (!alreadyTried) {
        sessionStorage.setItem(CHUNK_ERROR_KEY, '1')
        // Hard reload — bypass cache
        window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
        return
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false })
  }

  handleReset = () => {
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleRetry)
          : this.props.fallback
      }

      const { isChunkError, error, errorInfo } = this.state
      const isInline = this.props.inline ?? false
      const title = this.props.title || (isChunkError ? 'New version available' : 'Something went wrong')

      if (isInline) {
        return (
          <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-2xl text-rose-600">
              {isChunkError ? '🔄' : '⚠️'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                {isChunkError
                  ? 'FAFLOW was updated. Please reload the page to load the latest version.'
                  : 'An unexpected rendering error occurred on this screen. You can try reloading or return to the dashboard.'}
              </p>
            </div>

            {!isChunkError && error && (
              <details className="text-left bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <summary className="font-semibold text-slate-600 cursor-pointer select-none">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-rose-50 text-rose-800 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                  {String(error?.message || error)}
                  {'\n\n'}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs rounded-xl border border-slate-200 transition"
              >
                Dashboard
              </button>
            </div>
          </div>
        )
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary, #F8FAFC)',
          color: 'var(--text-primary, #0F172A)',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          gap: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem' }}>{isChunkError ? '🔄' : '⚠️'}</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {title}
          </h1>
          <p style={{ color: '#64748B', maxWidth: '480px', margin: 0, fontSize: '0.9rem' }}>
            {isChunkError
              ? 'FAFLOW was updated while this tab was open. Please reload to get the latest version.'
              : 'An unexpected error occurred in the application. This has been logged for investigation.'}
          </p>
          {!isChunkError && error && (
            <details style={{ maxWidth: '640px', width: '100%', textAlign: 'left' }}>
              <summary style={{ color: '#64748B', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Error Details
              </summary>
              <pre style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.75rem',
                textAlign: 'left',
                overflowX: 'auto',
                color: '#B91C1C',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {String(error?.message || error)}{'\n\n'}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => {
                sessionStorage.removeItem(CHUNK_ERROR_KEY)
                window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
              }}
              style={{
                background: 'var(--primary-600, #2563EB)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 {isChunkError ? 'Reload Now' : 'Reload Page'}
            </button>
            {!isChunkError && (
              <button
                onClick={this.handleReset}
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
