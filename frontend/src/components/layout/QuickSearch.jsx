import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { teachersApi } from '../../api/services'
import { SearchIcon, CloseIcon, UsersIcon, CalIcon, ChevronRightIcon } from '../icons'

export default function QuickSearch({ open, onClose }) {
  const { isAdmin, logout } = useAuth()
  const { changeTheme } = useTheme() || {}
  const [query, setQuery] = useState('')
  const [teachers, setTeachers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open && !loaded && isAdmin) {
      teachersApi.list().then(r => { setTeachers(r.data); setLoaded(true) }).catch(() => {})
    }
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, loaded, isAdmin])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(q) || /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(q)

  // Filter commands
  const COMMANDS = [
    { category: 'Navigation', label: 'Go to Dashboard', to: isAdmin ? '/admin/dashboard' : '/teacher/dashboard' },
    { category: 'Navigation', label: 'Go to System Setup & Readiness Guide', to: '/admin/setup', adminOnly: true },
    { category: 'Navigation', label: 'Go to Calendar & Day Order', to: '/admin/academic-calendar', adminOnly: true },
    { category: 'Navigation', label: 'Go to Timetable Control', to: '/admin/timetable', adminOnly: true },
    { category: 'Navigation', label: 'Go to Leave Requests Center', to: '/admin/leaves', adminOnly: true },
    { category: 'Navigation', label: 'Go to System Settings', to: '/admin/settings', adminOnly: true },
    { category: 'Navigation', label: 'Go to My Timetable', to: '/teacher/timetable', teacherOnly: true },
    { category: 'Navigation', label: 'Go to Apply for Leave', to: '/teacher/leave/apply', teacherOnly: true },
    { category: 'Navigation', label: 'Go to Leave History', to: '/teacher/leaves', teacherOnly: true },
    { category: 'Navigation', label: 'Go to Substitution Preferences', to: '/teacher/preferences', teacherOnly: true },
    { category: 'Actions', label: 'Sign Out & End Session', action: () => { logout(); navigate('/login') } },
  ]

  const filteredCommands = COMMANDS.filter(cmd => {
    if (cmd.adminOnly && !isAdmin) return false
    if (cmd.teacherOnly && isAdmin) return false
    if (!q) return true
    return cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
  })

  // Filter teachers
  const matchingTeachers = q && isAdmin
    ? teachers.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : []

  const goToTeacherTimetable = (teacherId) => {
    onClose()
    navigate(`/admin/timetable?teacher=${teacherId}`)
  }

  const goToDate = () => {
    onClose()
    navigate(`/admin/academic-calendar?date=${q}`)
  }

  const executeCommand = (cmd) => {
    onClose()
    if (cmd.to) {
      navigate(cmd.to)
    } else if (cmd.action) {
      cmd.action()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      
      {/* Palette Container */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, navigate, or search teachers…"
            className="flex-1 text-sm font-medium outline-none placeholder:text-slate-400 bg-transparent text-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            aria-label="Close search"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto py-2 divide-y divide-slate-100/50 dark:divide-slate-800/50">
          {/* Jump to Date Option */}
          {isDateLike && (
            <button 
              type="button"
              onClick={goToDate} 
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-200/50 dark:border-primary-800/50">
                <CalIcon className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Jump to <span className="font-bold text-primary-600 dark:text-primary-400">{query}</span> on Calendar
              </span>
            </button>
          )}

          {/* Grouped Commands / Navigation */}
          {filteredCommands.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Commands & Navigation</p>
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => executeCommand(cmd)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors shrink-0" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">{cmd.label}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 uppercase shrink-0">
                    {cmd.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Grouped Teachers */}
          {matchingTeachers.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Teachers (View Timetable)</p>
              {matchingTeachers.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => goToTeacherTimetable(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors group"
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                    <UsersIcon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">{t.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase truncate">{t.department || 'No department'}</p>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Empty States */}
          {q && filteredCommands.length === 0 && matchingTeachers.length === 0 && (
            <p className="px-4 py-8 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">No matching commands or teachers found.</p>
          )}
          {!q && filteredCommands.length === 0 && (
            <p className="px-4 py-8 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">Type something to begin...</p>
          )}
        </div>

        {/* Footer shortcuts help */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Press <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd> to close</span>
          <span>Use search terms to filter results</span>
        </div>
      </div>
    </div>
  )
}
