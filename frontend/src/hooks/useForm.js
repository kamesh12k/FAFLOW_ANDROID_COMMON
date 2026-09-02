import { useState, useCallback } from 'react'

export function useForm(initialValues = {}, validate) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setValues(prev => ({ ...prev, [name]: val }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }, [errors])

  const setValue = useCallback((name, val) => {
    setValues(prev => ({ ...prev, [name]: val }))
  }, [])

  const resetForm = useCallback((newValues = initialValues) => {
    setValues(newValues)
    setErrors({})
  }, [initialValues])

  const isValid = useCallback(() => {
    if (!validate) return true
    const validationErrors = validate(values)
    setErrors(validationErrors || {})
    return !validationErrors || Object.keys(validationErrors).length === 0
  }, [validate, values])

  return {
    values,
    errors,
    handleChange,
    setValue,
    resetForm,
    isValid,
    setValues,
    setErrors,
  }
}
