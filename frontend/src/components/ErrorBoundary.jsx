import React from 'react'

const CHUNK_ERROR_KEY = 'faflow_chunk_reload_attempted'

/**
 * ErrorBoundary — catches unhandled React render errors and shows a recovery UI.
 * Special case: "Failed to fetch dynamically imported module" (stale chunk hash
 * after a deploy) triggers an automatic hard-reload ONCE, then shows the UI if
 * it still fails.
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

  handleReset = () => {
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const { isChunkError } = this.state

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary, #0f172a)',
          color: 'var(--text-primary, #f1f5f9)',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          gap: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem' }}>{isChunkError ? '🔄' : '⚠️'}</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {isChunkError ? 'New version available' : 'Something went wrong'}
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '480px', margin: 0 }}>
            {isChunkError
              ? 'FAFLOW was updated while this tab was open. Please reload to get the latest version.'
              : 'An unexpected error occurred in the application. This has been logged for investigation.'}
          </p>
          {!isChunkError && this.state.error && (
            <details style={{ maxWidth: '640px', width: '100%', textAlign: 'left' }}>
              <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Error Details
              </summary>
              <pre style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.75rem',
                textAlign: 'left',
                overflowX: 'auto',
                color: '#fca5a5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {String(this.state.error)}{'\n\n'}
                {this.state.errorInfo?.componentStack}
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
                background: isChunkError ? 'var(--accent, #6366f1)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: isChunkError ? 'none' : '1px solid rgba(255,255,255,0.2)',
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
                  background: 'var(--accent, #6366f1)',
                  color: '#fff',
                  border: 'none',
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
