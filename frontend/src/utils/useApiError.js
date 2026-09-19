/**
 * useApiError — Converts raw API errors into user-friendly messages.
 * Usage:
 *   const { humanize } = useApiError()
 *   catch (err) { setError(humanize(err)) }
 */

const STATUS_MESSAGES = {
  400: 'The request could not be processed. Please check your input.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.",
  404: 'The requested information was not found.',
  409: 'This action conflicts with existing data. Please refresh and try again.',
  422: 'Some of the information you entered is invalid. Please review and correct it.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again in a moment.',
  502: 'The server is temporarily unavailable. Please try again shortly.',
  503: 'The service is currently unavailable. Please try again later.',
}

/**
 * Extract a human-readable message from an API error.
 * @param {any} err - The caught error (axios/fetch response or plain Error)
 * @param {string} [fallback] - Custom fallback message if none can be extracted
 * @returns {string}
 */
export function humanizeApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback

  // Axios-style error
  if (err.response) {
    const { status, data } = err.response
    // Try to use the server's detail message first
    const serverMsg = data?.detail || data?.message
    if (typeof serverMsg === 'string' && serverMsg.length > 0 && serverMsg.length < 200) {
      // Don't expose raw stack traces or internal identifiers
      const lower = serverMsg.toLowerCase()
      if (lower.includes('internal server error') || lower.includes('traceback') || lower.includes('sqlalchemy')) {
        return STATUS_MESSAGES[500]
      }
      return serverMsg
    }
    if (Array.isArray(serverMsg)) {
      return serverMsg.map(m => (typeof m === 'object' ? m.msg || JSON.stringify(m) : m)).join(', ')
    }
    return STATUS_MESSAGES[status] || fallback
  }

  // Network error (no response received)
  if (err.code === 'NETWORK_ERROR' || err.message?.toLowerCase().includes('network')) {
    return 'Network error. Please check your connection and try again.'
  }

  // Plain error message
  if (err.message && typeof err.message === 'string') {
    const lower = err.message.toLowerCase()
    if (lower.includes('timeout')) return 'The request timed out. Please try again.'
    if (lower.includes('network')) return 'Network error. Please check your connection.'
    // Don't expose raw JS stack traces
    if (lower.length < 150 && !lower.includes('at ') && !lower.includes('undefined')) {
      return err.message
    }
  }

  return fallback
}

/**
 * React hook version — returns a memoized humanize function.
 */
export function useApiError() {
  return { humanize: humanizeApiError }
}
