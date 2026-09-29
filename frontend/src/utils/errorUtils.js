/**
 * errorUtils.js — System-wide Error Formatting Helper
 * 
 * Safely converts any error (string, Error instance, Axios response, 
 * or FastAPI/Pydantic 422 validation array/object) into a human-readable string.
 * Guarantees the output is strictly a string, never an object or array,
 * completely preventing React Error #31 ("Objects are not valid as a React child").
 */

const DEFAULT_FALLBACK = 'An unexpected error occurred. Please try again.'

/**
 * Check if the input resembles a Pydantic / FastAPI validation error list
 */
export function isPydanticValidationErrorList(err) {
  return (
    Array.isArray(err) &&
    err.length > 0 &&
    typeof err[0] === 'object' &&
    err[0] !== null &&
    ('loc' in err[0] || 'msg' in err[0] || 'type' in err[0])
  )
}

/**
 * Format any error into a safe, clean string.
 * @param {any} err - The error object, string, array, or event.
 * @param {string} [fallback] - Default fallback message.
 * @returns {string} - Guaranteed string representation.
 */
export function formatErrorMessage(err, fallback) {
  if (err === null || err === undefined || err === '') {
    return fallback !== undefined ? fallback : ''
  }

  const effectiveFallback = fallback !== undefined ? fallback : DEFAULT_FALLBACK

  // 1. If it's already a string
  if (typeof err === 'string') {
    const trimmed = err.trim()
    if (trimmed.includes('attendance_type') && trimmed.includes('Input should be')) {
      return 'Invalid attendance session type. Please select a valid session type.'
    }
    return trimmed || effectiveFallback
  }


  // 2. If it's an Axios error or has response.data
  if (err?.response?.data) {
    const data = err.response.data
    // FastAPI detail
    if (data.detail !== undefined) {
      return formatErrorMessage(data.detail, effectiveFallback)
    }
    // General message or error field
    if (data.message !== undefined) {
      return formatErrorMessage(data.message, effectiveFallback)
    }
    if (data.error !== undefined) {
      return formatErrorMessage(data.error, effectiveFallback)
    }
    // If response data is itself an array or object
    if (typeof data === 'object') {
      return formatErrorMessage(data, effectiveFallback)
    }
  }

  // 3. If it's an Array (e.g. FastAPI / Pydantic V2 validation error list)
  // Format: [{ type, loc: ["body", "field_name"], msg: "Field required", input: ... }]
  if (Array.isArray(err)) {
    if (err.length === 0) return effectiveFallback
    const messages = err.map((item) => {
      if (typeof item === 'string') {
        if (item.includes('attendance_type') && item.includes('Input should be')) {
          return 'Invalid attendance session type. Please select a valid session type.'
        }
        return item
      }
      if (item && typeof item === 'object') {
        const fieldLoc = Array.isArray(item.loc)
          ? item.loc.filter((part) => part !== 'body' && part !== 'query' && part !== 'path').join('.')
          : ''
        const msg = item.msg || item.message || JSON.stringify(item)
        if (fieldLoc.includes('attendance_type') || (typeof msg === 'string' && msg.includes("'normal', 'registered_substitution'"))) {
          return 'Invalid attendance session type. Please select a valid session type.'
        }
        return fieldLoc ? `${fieldLoc}: ${msg}` : msg
      }
      return String(item)
    }).filter(Boolean)

    return messages.length > 0 ? messages.join('; ') : effectiveFallback
  }


  // 4. If it's an object with detail, message, msg, or error properties
  if (typeof err === 'object') {
    if (err.detail !== undefined) {
      return formatErrorMessage(err.detail, effectiveFallback)
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim()
    }
    if (typeof err.msg === 'string' && err.msg.trim()) {
      return err.msg.trim()
    }
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error.trim()
    }
    // Check if it has any standard status text
    if (err.statusText && typeof err.statusText === 'string') {
      return err.statusText
    }
    try {
      const json = JSON.stringify(err)
      return json === '{}' ? effectiveFallback : json
    } catch {
      return effectiveFallback
    }
  }

  return String(err)
}

export default formatErrorMessage
