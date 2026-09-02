import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop component that resets the scroll position to the top
 * on every route / navigation change.
 * Handles both the browser window / document and any custom scrollable
 * containers such as <main> in AppShell.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    // 1. Reset standard browser window / body scroll
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) {
      document.documentElement.scrollTop = 0
    }
    if (document.body) {
      document.body.scrollTop = 0
    }

    // 2. Reset custom scrollable container (such as AppShell's <main> element)
    const mainElements = document.querySelectorAll('main, [data-scroll-container]')
    mainElements.forEach((el) => {
      el.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      el.scrollTop = 0
    })
  }, [pathname, search])

  return null
}
