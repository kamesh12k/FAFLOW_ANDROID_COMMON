import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Handle Vite dynamic import failures (caused by new deployments while tab is open)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[FAFLOW] Dynamic import failed (stale chunk after deploy). Reloading...', event)
  const lastReload = sessionStorage.getItem('faflow_chunk_reload_attempted')
  const now = Date.now()
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('faflow_chunk_reload_attempted', now.toString())
    window.location.reload()
  }
})

window.addEventListener('error', (event) => {
  if (
    event?.message?.includes('Failed to fetch dynamically imported module') ||
    event?.message?.includes('Importing a module script failed')
  ) {
    const lastReload = sessionStorage.getItem('faflow_chunk_reload_attempted')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('faflow_chunk_reload_attempted', now.toString())
      window.location.reload()
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
