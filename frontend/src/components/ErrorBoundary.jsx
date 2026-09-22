import React from 'react'

/**
 * ErrorBoundary — catches unhandled React render errors and shows a recovery UI
 * instead of a blank white screen. Wraps the entire app to prevent full crashes.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // In production, send to error tracking service (e.g., Sentry)
    console.error('[FAFLOW] Unhandled render error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
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
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '480px', margin: 0 }}>
            An unexpected error occurred in the application. This has been logged for investigation.
          </p>
          {this.state.error && (
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
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 Reload Page
            </button>
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
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
