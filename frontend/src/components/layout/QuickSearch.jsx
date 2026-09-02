import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { teachersApi } from '../../api/services'
import { SearchIcon, CloseIcon, UsersIcon, CalIcon } from '../icons'

export default function QuickSearch({ open, onClose }) {
  const { user, isAdmin, logout } = useAuth()
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      
      {/* Palette Container */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-[slideIn_0.15s_ease-out]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3.5 px-4.5 py-4 border-b border-slate-100 bg-slate-50/20">
          <SearchIcon className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, navigate, or search teachers…"
            className="flex-1 text-sm font-semibold outline-none placeholder:text-slate-400 bg-transparent text-slate-800"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto py-2">
          {/* Jump to Date Option */}
          {isDateLike && (
            <button 
              onClick={goToDate} 
              className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-slate-50 text-left border-b border-slate-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 border border-primary-100/55">
                <CalIcon className="w-4.5 h-4.5" />
              </span>
              <span className="text-xs font-bold text-slate-700">
                Jump to <span className="font-extrabold text-primary-600">{query}</span> on Calendar
              </span>
            </button>
          )}

          {/* Grouped Commands / Navigation */}
          {filteredCommands.length > 0 && (
            <div className="space-y-1">
              <p className="px-5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Commands & Navigation</p>
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => executeCommand(cmd)}
                  className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">⚡</span>
                    <span className="text-xs font-bold text-slate-700">{cmd.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/40 uppercase">
                    {cmd.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Grouped Teachers */}
          {matchingTeachers.length > 0 && (
            <div className="space-y-1 mt-3.5">
              <p className="px-5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Teachers (View Timetable)</p>
              {matchingTeachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => goToTeacherTimetable(t.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 border border-slate-150">
                    <UsersIcon className="w-4 h-4 text-slate-400" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate">{t.department || 'No department'}</p>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Empty States */}
          {q && filteredCommands.length === 0 && matchingTeachers.length === 0 && (
            <p className="px-5 py-8 text-xs font-bold text-slate-400 text-center">No matching commands or teachers found.</p>
          )}
          {!q && filteredCommands.length === 0 && (
            <p className="px-5 py-8 text-xs font-bold text-slate-400 text-center">Type something to begin...</p>
          )}
        </div>

        {/* Footer shortcuts help */}
        <div className="px-4.5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>Press <kbd className="bg-white border px-1 rounded-md">Esc</kbd> to close</span>
          <span>Use search terms to filter results</span>
        </div>
      </div>
    </div>
  )
}
