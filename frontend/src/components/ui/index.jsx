import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDownIcon, SearchIcon, CloseIcon, CheckCircleIcon, AlertTriangleIcon } from '../icons'

// 1. Spinner Loader
export function Spinner({ size = 'md', className = '' }) {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <div className={`${s} animate-spin rounded-full border-2 border-slate-200 border-t-primary-600 ${className}`} />
  )
}

// 2. Status Badge
export function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200/60',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rejected: 'bg-red-50 text-red-700 border-red-200/60',
    cancelled: 'bg-slate-50 text-slate-600 border-slate-200/60',
  }
  const cls = styles[status] || 'bg-gray-50 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// 3. Day Type Badge
const DAY_TYPE_STYLES = {
  working: 'bg-green-50 text-green-700 border-green-200/60',
  holiday: 'bg-rose-50 text-rose-700 border-rose-200/60',
  college_leave: 'bg-orange-50 text-orange-700 border-orange-200/60',
  government_holiday: 'bg-rose-50 text-rose-700 border-rose-200/60',
  exam_day: 'bg-purple-50 text-purple-700 border-purple-200/60',
  special_event: 'bg-blue-50 text-blue-700 border-blue-200/60',
  department_activity: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
  non_working: 'bg-slate-50 text-slate-600 border-slate-200/60',
}

const DAY_TYPE_LABELS = {
  working: 'Working',
  holiday: 'Holiday',
  college_leave: 'College Leave',
  government_holiday: 'Govt Holiday',
  exam_day: 'Exam Day',
  special_event: 'Special Event',
  department_activity: 'Dept Activity',
  non_working: 'Non-Working',
}

export function DayTypeBadge({ dayType, small = false }) {
  const cls = DAY_TYPE_STYLES[dayType] || 'bg-slate-50 text-slate-700 border-slate-200'
  const label = DAY_TYPE_LABELS[dayType] || dayType
  return (
    <span className={`inline-flex items-center rounded-full font-semibold border ${cls} ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
      {label}
    </span>
  )
}

// 4. Assignment Type Badge
const ASSIGNMENT_TYPE_STYLES = {
  auto_assigned: 'bg-purple-50 text-purple-700 border-purple-200/60',
  faculty_recommended: 'bg-blue-50 text-blue-700 border-blue-200/60',
  admin_assigned: 'bg-slate-50 text-slate-600 border-slate-200/60',
  auto_swapped: 'bg-purple-50 text-purple-700 border-purple-200/60',
  overridden: 'bg-amber-50 text-amber-700 border-amber-200/60',
  emergency: 'bg-red-50 text-red-700 border-red-200/60',
  teacher_assigned: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
}

const ASSIGNMENT_TYPE_LABELS = {
  auto_assigned: 'Auto Assigned',
  faculty_recommended: 'Recommended',
  admin_assigned: 'Admin Assigned',
  auto_swapped: 'Auto Swapped',
  overridden: 'Overridden',
  emergency: 'Emergency',
  teacher_assigned: 'Teacher Assigned',
}

export function AssignmentTypeBadge({ type, small = false }) {
  const cls = ASSIGNMENT_TYPE_STYLES[type] || 'bg-slate-50 text-slate-600 border-slate-200'
  const label = ASSIGNMENT_TYPE_LABELS[type] || type
  return (
    <span className={`inline-flex items-center rounded-full font-semibold border ${cls} ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
      {label}
    </span>
  )
}

export { DAY_TYPE_LABELS, DAY_TYPE_STYLES }

// 5. Credit Chip
export function CreditChip({ value }) {
  const num = typeof value === 'number' && !isNaN(value) ? value : (Number(value) || 0)
  const isPos = num > 0
  return (
    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${isPos ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60' : num < 0 ? 'text-rose-700 bg-rose-50 border-rose-200/60' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
      {isPos ? `+${num}` : num}
    </span>
  )
}

// 6. Empty State
export function EmptyState({ title = 'No data found', message = 'There are no items to display.', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-white ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-550 mt-1 max-w-sm font-medium">{message}</p>
    </div>
  )
}

// 7. Error Alert
export function ErrorAlert({ message }) {
  if (!message) return null
  let displayMessage = message
  if (Array.isArray(message)) {
    displayMessage = message.map(x => (typeof x === 'object' && x?.msg) ? x.msg : JSON.stringify(x)).join(', ')
  } else if (typeof message === 'object') {
    displayMessage = message.detail || message.message || JSON.stringify(message)
    if (Array.isArray(displayMessage)) {
      displayMessage = displayMessage.map(x => (typeof x === 'object' && x?.msg) ? x.msg : JSON.stringify(x)).join(', ')
    }
  }
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-200/60 p-4 text-sm text-rose-700 flex items-start gap-3">
      <AlertTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-bold text-rose-800">Error Encountered</h4>
        <p className="mt-1 text-xs font-semibold leading-relaxed">{String(displayMessage)}</p>
      </div>
    </div>
  )
}

// 8. Stat Card
export function StatCard({ label, value, sub, accent, className = '' }) {
  const colors = {
    indigo: 'from-blue-500/10 via-indigo-500/5 to-transparent border-indigo-100 text-indigo-700',
    green:  'from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-100 text-emerald-700',
    yellow: 'from-amber-500/10 via-yellow-500/5 to-transparent border-amber-100 text-amber-700',
    red:    'from-rose-500/10 via-red-500/5 to-transparent border-rose-100 text-rose-700',
    blue:   'from-sky-500/10 via-blue-500/5 to-transparent border-sky-100 text-sky-700',
  }
  const colorCls = colors[accent] || 'from-slate-500/10 via-slate-500/5 to-transparent border-slate-200/80 text-slate-800'
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-6 bg-gradient-to-br ${colorCls} shadow-[0_4px_12px_-2px_rgba(0,0,0,0.01)] transition-all hover:-translate-y-0.5 hover:shadow-md ${className}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-450 mt-1.5 font-medium">{sub}</p>}
    </div>
  )
}

// 9. Button Component
export function Button({ children, variant = 'primary', size = 'md', loading = false, disabled = false, className = '', ...props }) {
  const baseStyle = 'inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all duration-150 active:scale-[0.98]'
  
  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm border border-primary-700/10 disabled:bg-primary-400',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-250/20 disabled:bg-slate-50 disabled:text-slate-400',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] disabled:text-slate-400 disabled:border-slate-150',
    danger: 'bg-rose-650 hover:bg-rose-700 text-white shadow-sm border border-rose-700/10 disabled:bg-rose-400',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  }

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}

// 10. Card Container
export function Card({ children, className = '', title, headerAction }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-slate-50/20 gap-3">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
          {headerAction}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

// 11. Input Field
export function Input({ label, error, helperText, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide">{label}</label>}
      <input
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors outline-none placeholder:text-slate-400 bg-white ${
          error ? 'border-rose-350 hover:border-rose-450 focus:border-rose-500' : 'border-slate-200 hover:border-slate-300 focus:border-primary-500'
        }`}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-450 font-medium">{helperText}</p>}
    </div>
  )
}

// 12. Textarea Field
export function Textarea({ label, error, helperText, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide">{label}</label>}
      <textarea
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors outline-none placeholder:text-slate-400 bg-white ${
          error ? 'border-rose-350 hover:border-rose-450 focus:border-rose-500' : 'border-slate-200 hover:border-slate-300 focus:border-primary-500'
        }`}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-450 font-medium">{helperText}</p>}
    </div>
  )
}

// 13. Select Dropdown
export function Select({ label, options = [], error, helperText, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <select
          className={`w-full appearance-none rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors outline-none bg-white ${
            error ? 'border-rose-350 hover:border-rose-450 focus:border-rose-500' : 'border-slate-200 hover:border-slate-300 focus:border-primary-500'
          }`}
          {...props}
        >
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-450">
          <ChevronDownIcon className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-450 font-medium">{helperText}</p>}
    </div>
  )
}

// 14. Multi-Select Dropdown
export function MultiSelect({ label, options = [], selected = [], onChange, placeholder = 'Select options...', className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const toggleSelect = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const selectedLabels = useMemo(() => {
    return options.filter(opt => selected.includes(opt.value)).map(opt => opt.label)
  }, [options, selected])

  return (
    <div className={`space-y-1.5 relative ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide">{label}</label>}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[42px] cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 flex flex-wrap items-center gap-1.5 bg-white hover:border-slate-300 focus-within:border-primary-500"
      >
        {selected.length === 0 ? (
          <span className="text-sm text-slate-400 font-medium">{placeholder}</span>
        ) : (
          selectedLabels.map((lbl, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/50">
              {lbl}
            </span>
          ))
        )}
        <div className="ml-auto pointer-events-none text-slate-450">
          <ChevronDownIcon className="w-4 h-4" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 divide-y divide-slate-50">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => toggleSelect(opt.value)}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700"
            >
              <input 
                type="checkbox" 
                checked={selected.includes(opt.value)} 
                onChange={() => {}} 
                className="rounded border-slate-200 text-primary-600 focus:ring-primary-500"
              />
              {opt.label}
            </div>
          ))}
          {options.length === 0 && (
            <p className="px-4 py-2.5 text-xs text-slate-400 font-medium text-center">No options available</p>
          )}
        </div>
      )}
    </div>
  )
}

// 15. Date Picker Input
export function DatePicker({ label, ...props }) {
  return (
    <Input
      label={label}
      type="date"
      {...props}
    />
  )
}

// 16. Modal Dialog Wrapper
export function Modal({ open, isOpen, onClose, title, children, size = 'md' }) {
  const isModalOpen = open !== undefined ? open : isOpen
  if (!isModalOpen) return null

  const maxWidth = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity" onClick={onClose} />
      <div className={`relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90dvh] sm:max-h-[85vh] flex flex-col p-4 sm:p-6 z-10 transition-all border border-slate-100`}>
        {/* Drag handle indicator on mobile */}
        <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />
        <div className="flex items-center justify-between mb-4 sm:mb-5 flex-shrink-0">
          <h3 className="text-base font-bold text-slate-800 tracking-tight pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-lg transition-colors shrink-0 -mr-1"
            aria-label="Close dialog"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// 17. Reusable Data Grid Table
export function Table({ 
  columns = [], 
  data = [], 
  searchPlaceholder = 'Search records...', 
  bulkActions = [],
  onRowClick
}) {
  const [query, setQuery] = useState('')
  const [sortConfig, setSortConfig] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [visibleColumns, setVisibleColumns] = useState(columns.map(c => c.key))
  const [colMenuOpen, setColMenuOpen] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // Handle Sort
  const requestSort = (key) => {
    let direction = 'ascending'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

  // Filter & Search
  const filteredData = useMemo(() => {
    let items = [...data]
    if (query) {
      const q = query.toLowerCase()
      items = items.filter(row => 
        columns.some(col => {
          const val = row[col.key]
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q)
        })
      )
    }
    if (sortConfig) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1
        return 0
      })
    }
    return items
  }, [data, query, sortConfig, columns])

  // Pagination Slice
  const totalPages = Math.ceil(filteredData.length / perPage)
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredData.slice(start, start + perPage)
  }, [filteredData, page, perPage])

  // Row selection helpers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(paginatedData.map(r => r.id))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(r => r !== id))
    } else {
      setSelectedRows([...selectedRows, id])
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = columns.map(c => c.label).join(',')
    const rows = filteredData.map(row => 
      columns.map(c => `"${String(row[c.key] || '').replace(/"/g, '""')}"`).join(',')
    )
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "report.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/50 p-3 sm:p-4 rounded-2xl border border-slate-100">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder={searchPlaceholder}
            className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary-500 placeholder:text-slate-400 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* CSV Export */}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="text-xs">
            Export
          </Button>

          {/* Columns Visibility dropdown */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setColMenuOpen(!colMenuOpen)} className="text-xs">
              Columns
            </Button>
            {colMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-lg p-2.5 space-y-1">
                {columns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => {
                        if (visibleColumns.includes(col.key)) {
                          setVisibleColumns(visibleColumns.filter(c => c !== col.key))
                        } else {
                          setVisibleColumns([...visibleColumns, col.key])
                        }
                      }}
                      className="rounded border-slate-250 text-primary-600 focus:ring-primary-500"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Action Menu */}
      {selectedRows.length > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 px-5 py-3.5 rounded-xl border border-primary-100">
          <p className="text-xs font-bold text-primary-700">{selectedRows.length} rows selected</p>
          <div className="flex gap-2">
            {bulkActions.map((action, idx) => (
              <Button key={idx} variant="outline" size="sm" onClick={() => action.onClick(selectedRows)} className="text-[11px] py-1 bg-white hover:bg-slate-50 border-primary-200 text-primary-700">
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Table Data view */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.01)] overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0">
            <tr className="text-slate-450 text-[10px] font-bold uppercase tracking-wider">
              {bulkActions.length > 0 && (
                <th className="px-5 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={paginatedData.length > 0 && selectedRows.length === paginatedData.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-250 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.filter(col => visibleColumns.includes(col.key)).map(col => (
                <th 
                  key={col.key} 
                  onClick={() => col.sortable && requestSort(col.key)}
                  className={`px-5 py-3.5 font-bold ${col.sortable ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && sortConfig?.key === col.key && (
                      <span className="text-[10px]">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((row) => (
              <tr 
                key={row.id} 
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-slate-50/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {bulkActions.length > 0 && (
                  <td className="px-5 py-4 w-10" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.id)}
                      onChange={() => handleSelectRow(row.id)}
                      className="rounded border-slate-250 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                )}
                {columns.filter(col => visibleColumns.includes(col.key)).map(col => (
                  <td key={col.key} className="px-5 py-4 text-xs font-semibold text-slate-700">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)} className="px-5 py-12 text-center">
                  <EmptyState title="No records found" message="Try refining your search or add new data." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <p className="text-xs text-slate-450 font-semibold">
            <span className="font-bold text-slate-700">{(page-1)*perPage+1}</span>–<span className="font-bold text-slate-700">{Math.min(page*perPage, filteredData.length)}</span> of <span className="font-bold text-slate-700">{filteredData.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="py-1 px-3"
            >
              ← Prev
            </Button>
            {/* On mobile: show current/total. On desktop: show page buttons (up to 7) */}
            <span className="sm:hidden text-xs font-bold text-slate-600 px-1">
              {page} / {totalPages}
            </span>
            <div className="hidden sm:flex items-center gap-1">
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                // Smart page number display
                let pageNum
                if (totalPages <= 7) {
                  pageNum = i + 1
                } else if (page <= 4) {
                  pageNum = i + 1
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i
                } else {
                  pageNum = page - 3 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      page === pageNum 
                        ? 'bg-primary-600 border-primary-600 text-white' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="py-1 px-3"
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// 18. Skeleton Loaders
export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
  )
}

export function SkeletonTable() {
  return (
    <div className="space-y-4 w-full">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

// 19. Breadcrumbs
export function Breadcrumbs({ links = [] }) {
  return (
    <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
      {links.map((link, idx) => (
        <span key={idx} className="flex items-center gap-2">
          {idx > 0 && <span>/</span>}
          {link.to ? (
            <Link to={link.to} className="hover:text-slate-750 transition-colors">
              {link.label}
            </Link>
          ) : (
            <span className="text-slate-800">{link.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// 20. Tabs Navigation
export function Tabs({ tabs = [], activeTab, onChange }) {
  return (
    <div
      className="border-b border-slate-100 flex gap-4 sm:gap-6"
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`pb-3 text-xs font-bold transition-all relative border-b-2 -mb-px shrink-0 flex items-center gap-1.5 min-h-[44px] ${
            activeTab === tab.id
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// 21. Timeline Node Components
export function Timeline({ items = [] }) {
  return (
    <div className="relative border-l-2 border-slate-100 pl-6 space-y-7 ml-3.5 py-1">
      {items.map((item, i) => (
        <div key={i} className="relative">
          <span className="absolute -left-[32px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-primary-600 ring-4 ring-primary-50" />
          <div>
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
              <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.date}</span>
            </div>
            {item.description && <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// 22. General Badge
export function Badge({ children, variant = 'neutral' }) {
  const styles = {
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
    primary: 'bg-primary-50 text-primary-750 border-primary-150',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-150',
    warning: 'bg-amber-50 text-amber-700 border-amber-150',
    danger:  'bg-rose-50 text-rose-700 border-rose-150',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${styles[variant]}`}>
      {children}
    </span>
  )
}

// 23. ConfirmDialog Modal
export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmText = 'Confirm', confirmVariant = 'danger', loading = false, onConfirm, onClose }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {message && <p className="text-sm text-slate-600 font-medium leading-relaxed">{message}</p>}
        <div className="flex gap-2 pt-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={confirmVariant} size="sm" loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 24. PageHeader
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 font-medium mt-1">{description}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
