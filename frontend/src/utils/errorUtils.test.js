import { describe, it, expect } from 'vitest'
import { formatErrorMessage, isPydanticValidationErrorList } from './errorUtils'

describe('errorUtils - formatErrorMessage', () => {
  it('returns fallback string when error is null or undefined and fallback provided', () => {
    expect(formatErrorMessage(null, 'Custom fallback')).toBe('Custom fallback')
    expect(formatErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback')
  })

  it('returns empty string when error is null or undefined without fallback (safe for JSX direct render)', () => {
    expect(formatErrorMessage(null)).toBe('')
    expect(formatErrorMessage(undefined)).toBe('')
    expect(formatErrorMessage('')).toBe('')
  })

  it('returns string unchanged when error is a non-empty string', () => {
    expect(formatErrorMessage('Database connection failed')).toBe('Database connection failed')
  })

  it('formats standard Javascript Error instance', () => {
    const err = new Error('Network timeout')
    expect(formatErrorMessage(err)).toBe('Network timeout')
  })

  it('extracts detail string from Axios error response', () => {
    const axiosError = {
      response: {
        data: {
          detail: 'Unauthorized: insufficient permissions'
        }
      }
    }
    expect(formatErrorMessage(axiosError)).toBe('Unauthorized: insufficient permissions')
  })

  it('extracts message string from Axios error response if detail is missing', () => {
    const axiosError = {
      response: {
        data: {
          message: 'Server encountered a problem'
        }
      }
    }
    expect(formatErrorMessage(axiosError)).toBe('Server encountered a problem')
  })

  it('correctly detects Pydantic validation error lists', () => {
    const validPydanticList = [
      { type: 'missing', loc: ['body', 'date'], msg: 'Field required', input: null }
    ]
    expect(isPydanticValidationErrorList(validPydanticList)).toBe(true)

    expect(isPydanticValidationErrorList([])).toBe(false)
    expect(isPydanticValidationErrorList(['string item'])).toBe(false)
    expect(isPydanticValidationErrorList(null)).toBe(false)
  })

  it('formats FastAPI / Pydantic V2 422 validation error arrays cleanly (prevents React Error #31)', () => {
    const pydanticErrors = [
      {
        type: 'string_type',
        loc: ['body', 'date'],
        msg: 'Input should be a valid string',
        input: 123
      },
      {
        type: 'missing',
        loc: ['body', 'reason'],
        msg: 'Field required',
        input: null
      }
    ]

    // Tested directly as error parameter
    const directResult = formatErrorMessage(pydanticErrors)
    expect(typeof directResult).toBe('string')
    expect(directResult).toContain('date: Input should be a valid string')
    expect(directResult).toContain('reason: Field required')

    // Tested inside Axios response
    const axiosWrapped = {
      response: {
        status: 422,
        data: {
          detail: pydanticErrors
        }
      }
    }
    const wrappedResult = formatErrorMessage(axiosWrapped)
    expect(typeof wrappedResult).toBe('string')
    expect(wrappedResult).toContain('date: Input should be a valid string')
    expect(wrappedResult).toContain('reason: Field required')
  })

  it('handles nested detail objects without crashing', () => {
    const nestedObj = {
      response: {
        data: {
          detail: {
            message: 'Nested validation error detail'
          }
        }
      }
    }
    expect(formatErrorMessage(nestedObj)).toBe('Nested validation error detail')
  })

  it('handles objects with generic error or msg properties', () => {
    expect(formatErrorMessage({ error: 'Auth failed' })).toBe('Auth failed')
    expect(formatErrorMessage({ msg: 'Session expired' })).toBe('Session expired')
  })

  it('safely serializes arbitrary objects without throwing', () => {
    const strangeObject = { code: 500, status: 'FAILED' }
    const result = formatErrorMessage(strangeObject)
    expect(typeof result).toBe('string')
    expect(result).toContain('code')
  })

  it('safely handles circular reference objects without throwing', () => {
    const circular = { name: 'circular' }
    circular.self = circular
    expect(() => formatErrorMessage(circular)).not.toThrow()
    const result = formatErrorMessage(circular)
    expect(typeof result).toBe('string')
  })

  it('sanitizes raw Pydantic attendance_type validation errors into friendly messages', () => {
    const rawPydanticError = [
      {
        type: 'enum',
        loc: ['body', 'attendance_type'],
        msg: "Input should be 'normal', 'registered_substitution' or 'emergency'",
        input: 'NORMAL',
        ctx: { expected: "'normal', 'registered_substitution' or 'emergency'" }
      }
    ]

    const formatted = formatErrorMessage(rawPydanticError)
    expect(formatted).toBe('Invalid attendance session type. Please select a valid session type.')
    expect(formatted).not.toContain('Input should be')

    // Also test direct string message sanitization
    const stringError = "attendance_type: Input should be 'normal', 'registered_substitution' or 'emergency'"
    expect(formatErrorMessage(stringError)).toBe('Invalid attendance session type. Please select a valid session type.')
  })
})

