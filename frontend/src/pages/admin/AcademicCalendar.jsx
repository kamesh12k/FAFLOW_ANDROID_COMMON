import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { academicCalendarApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'

// ─── One UI 9 design tokens ────────────────────────────────────────────────
// Big, soft, tonal. One accent, generous radius, generous space.

const ACCENT = '#1261FF'
const ACCENT_SOFT = '#EAF1FF'
const ACCENT_SOFT_DARK = 'rgba(18,97,255,0.16)'
const R = { pill: 999, xl: 28, lg: 22, md: 16, sm: 12 }

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { value: 'holiday', label: 'Holiday', icon: '🏖️' },
  { value: 'college_leave', label: 'College Leave', icon: '🏫' },
  { value: 'government_holiday', label: 'Govt. Holiday', icon: '🏛️' },
  { value: 'exam_day', label: 'Exam Day', icon: '📝' },
  { value: 'special_event', label: 'Special Event', icon: '⭐' },
  { value: 'department_activity', label: 'Dept. Activity', icon: '🎓' },
  { value: 'non_working', label: 'Non-Working', icon: '🚫' },
]

const LEAVE_TYPE_META = {
  holiday: { bg: '#FEE8E8', text: '#C4281B', solid: '#EF4444', label: 'Holiday' },
  college_leave: { bg: '#FFEEDC', text: '#B4530A', solid: '#F97316', label: 'Leave' },
  government_holiday: { bg: '#FDE6F1', text: '#B32D6E', solid: '#EC4899', label: 'Govt.' },
  exam_day: { bg: '#F0E9FE', text: '#6D28D9', solid: '#8B5CF6', label: 'Exam' },
  special_event: { bg: '#E5EFFF', text: '#1D4ED8', solid: '#3B82F6', label: 'Event' },
  department_activity: { bg: '#DFF9FC', text: '#0E7285', solid: '#06B6D4', label: 'Dept.' },
  non_working: { bg: '#EEF0F2', text: '#4B5563', solid: '#6B7280', label: 'Off' },
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n) { return String(n).padStart(2, '0') }
function isoDate(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

// ─── Squircle icon tile — the One UI signature building block ────────────────

function SquircleIcon({ emoji, size = 40, bg, active, activeRing, fontSize }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: size * 0.32,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontSize || size * 0.5,
      boxShadow: active ? `0 0 0 2.5px ${activeRing || ACCENT}` : 'none',
      transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      transform: active ? 'scale(1.04)' : 'scale(1)',
    }}>
      {emoji}
    </div>
  )
}

// ─── Day-Order Badge ─────────────────────────────────────────────────────────

const DO_COLORS = [
  null,
  { bg: '#E5EFFF', text: '#1D4ED8', solid: '#3B82F6' }, // DO1 – blue
  { bg: '#E4F9EC', text: '#0F7A3D', solid: '#22C55E' }, // DO2 – green
  { bg: '#FFEEDC', text: '#B4530A', solid: '#F97316' }, // DO3 – orange
  { bg: '#F0E9FE', text: '#6D28D9', solid: '#8B5CF6' }, // DO4 – purple
  { bg: '#FFF6DC', text: '#946200', solid: '#F5B301' }, // DO5 – amber
  { bg: '#FDE6EC', text: '#B91355', solid: '#EC4899' }, // DO6 – rose
]

function DayOrderPill({ order, size = 'md' }) {
  if (!order || order < 1 || order > 6) return null
  const c = DO_COLORS[order]
  const isLg = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: isLg ? c.solid : c.bg,
      color: isLg ? '#fff' : c.text,
      borderRadius: R.pill,
      fontSize: isLg ? 14 : 10,
      fontWeight: 700,
      padding: isLg ? '6px 14px' : '2px 7px',
      lineHeight: 1.2,
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      {isLg ? (
        `Day Order ${order}`
      ) : (
        <>
          <span className="hidden sm:inline">DO{order}</span>
          <span className="inline sm:hidden">{order}</span>
        </>
      )}
    </span>
  )
}

// ─── Leave-Type Badge ─────────────────────────────────────────────────────────

function LeaveTypePill({ dayType, size = 'sm' }) {
  const meta = LEAVE_TYPE_META[dayType]
  if (!meta) return null
  const isLg = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isLg ? meta.solid : meta.bg,
      color: isLg ? '#fff' : meta.text,
      borderRadius: R.pill,
      fontSize: isLg ? 13 : 9,
      fontWeight: 700,
      padding: isLg ? '6px 12px' : '2px 7px',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>
      <span className={isLg ? "" : "hidden sm:inline"}>
        {isLg ? LEAVE_TYPES.find(t => t.value === dayType)?.label || meta.label : meta.label}
      </span>
    </span>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ year, month, daysByDate, onDayClick, quickSaving, selectedDates, selectionActive, busyDates }) {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const isWeekend = (cellIndex) => {
    const dayOfWeek = cellIndex % 7
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: (i === 0 || i === 6) ? '#E0304A' : 'var(--text-muted)',
            padding: '4px 0', textTransform: 'uppercase',
          }}>
            <span className="hidden sm:inline">{d}</span>
            <span className="inline sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ aspectRatio: '1', borderRadius: R.md }} />

          const dateStr = isoDate(year, month, d)
          const entry = daysByDate[dateStr]
          const isToday = dateStr === todayStr
          const isLeave = entry && entry.day_type !== 'working'
          const isWorking = entry && entry.day_type === 'working'
          const weekend = isWeekend(i)
          const isSaving = quickSaving === dateStr || busyDates?.has(dateStr)
          const isSelected = selectedDates?.has(dateStr)

          let cellBg = 'var(--surface-2)'
          let ring = 'none'
          let dateColor = weekend ? '#E0304A' : 'var(--text-primary)'

          if (isLeave) {
            const meta = LEAVE_TYPE_META[entry.day_type]
            cellBg = meta?.bg || '#EEF0F2'
          } else if (isWorking) {
            cellBg = '#E4F9EC'
          }

          if (isToday) ring = `0 0 0 2.5px ${ACCENT}`
          if (isSelected) ring = `0 0 0 3px ${ACCENT}`

          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr, entry)}
              title={entry?.label || (isWorking ? `Day Order ${entry.day_order}` : '')}
              style={{
                aspectRatio: '1',
                borderRadius: R.md,
                border: 'none',
                boxShadow: ring,
                background: cellBg,
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                transition: 'transform 0.12s ease, opacity 0.12s ease',
                position: 'relative',
                outline: 'none',
                minHeight: 0,
                opacity: isSaving ? 0.5 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.zIndex = 2 }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1 }}
            >
              {isToday && !isSelected && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 6, height: 6, borderRadius: '50%', background: ACCENT,
                }} />
              )}

              {isSelected && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 18, height: 18, borderRadius: '50%',
                  background: ACCENT, color: '#fff',
                  fontSize: 10, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✓</span>
              )}

              <span style={{
                fontSize: 12, fontWeight: isToday ? 800 : 600,
                color: isToday ? ACCENT : dateColor,
                lineHeight: 1,
              }}>{d}</span>

              <div style={{ width: '100%' }}>
                {isWorking && entry.day_order && (
                  <DayOrderPill order={entry.day_order} />
                )}
                {isLeave && (
                  <LeaveTypePill dayType={entry.day_type} />
                )}
                {!entry && !weekend && (
                  <span className="hidden sm:inline" style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>unset</span>
                )}
              </div>

              {entry?.is_manual_override && (
                <span style={{
                  position: 'absolute', bottom: 3, right: 4,
                  fontSize: 8, color: '#B4530A', fontWeight: 700,
                }}>✎</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function MonthStats({ days }) {
  const counts = useMemo(() => {
    const c = { working: 0, leave: 0 }
    for (const d of days) {
      if (d.day_type === 'working') c.working++
      else c.leave++
    }
    return c
  }, [days])

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <StatChip icon="📅" label="Working days" value={counts.working} bg="#E4F9EC" text="#0F7A3D" iconBg="#C9F2D9" />
      <StatChip icon="🏖️" label="Leave / holiday" value={counts.leave} bg="#FFF6DC" text="#946200" iconBg="#FCE9AE" />
    </div>
  )
}

function StatChip({ icon, label, value, bg, text, iconBg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: bg, borderRadius: R.lg, padding: '8px 16px 8px 8px',
    }}>
      <SquircleIcon emoji={icon} size={32} bg={iconBg} fontSize={15} />
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: text, opacity: 0.75, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Leave Quick-Mark Panel ───────────────────────────────────────────────────
// Tap a type, then tap days on the calendar — a persistent One UI style
// action tray, always visible, big touch targets, tonal selection.

function LeaveQuickPanel({
  panelMode, onPanelModeChange,
  activeLeaveType, onSelect,
  selectedCount, onCommitBatch, onClearBatch, batchSaving,
}) {
  const isBatch = panelMode === 'batch'

  return (
    <div style={{
      background: 'var(--surface-1)', borderRadius: R.xl,
      padding: '18px 18px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Mark leave days
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {isBatch
              ? 'Pick a type, tap several days to select them, then apply all at once.'
              : 'Tap a type, then tap any day to mark it immediately.'}
          </p>
        </div>

        {/* Mode toggle — Instant vs Select multiple */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: R.pill, padding: 3, flexShrink: 0 }}>
          {[{ key: 'instant', label: 'Tap to mark' }, { key: 'batch', label: 'Select multiple' }].map(m => (
            <button
              key={m.key}
              onClick={() => onPanelModeChange(m.key)}
              style={{
                padding: '7px 14px', borderRadius: R.pill, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: panelMode === m.key ? ACCENT : 'transparent',
                color: panelMode === m.key ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.12s ease',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {LEAVE_TYPES.map(t => {
          const meta = LEAVE_TYPE_META[t.value]
          const isActive = activeLeaveType === t.value
          return (
            <button
              key={t.value}
              onClick={() => onSelect(isActive ? null : t.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 16px 7px 7px', borderRadius: R.pill,
                background: isActive ? meta.solid : 'var(--surface-2)',
                border: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                transition: 'all 0.12s ease',
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: 9,
                background: isActive ? 'rgba(255,255,255,0.25)' : meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Instant mode hint */}
      {!isBatch && activeLeaveType && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: R.md,
          background: ACCENT_SOFT, color: ACCENT,
          fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 15 }}>👆</span>
          <span>
            Tap days on the calendar to mark them as{' '}
            <strong>{LEAVE_TYPES.find(t => t.value === activeLeaveType)?.label}</strong>.
            Other days continue their Day Order sequence automatically.
          </span>
        </div>
      )}

      {/* Batch mode: selection summary + apply bar */}
      {isBatch && activeLeaveType && (
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: R.lg,
          background: ACCENT_SOFT,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
            {selectedCount > 0
              ? `${selectedCount} day${selectedCount === 1 ? '' : 's'} selected as ${LEAVE_TYPES.find(t => t.value === activeLeaveType)?.label}`
              : 'Tap days on the calendar to select them — nothing saves until you apply.'}
          </span>
          {selectedCount > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClearBatch}
                disabled={batchSaving}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: R.pill,
                  background: '#fff', color: ACCENT, border: 'none', cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                onClick={onCommitBatch}
                disabled={batchSaving}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: R.pill,
                  background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: batchSaving ? 0.6 : 1,
                }}
              >
                {batchSaving ? 'Applying…' : `Mark ${selectedCount} as leave`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Auto-fill Panel ──────────────────────────────────────────────────────────
// The other half of the workflow: once leave days are marked, one click
// fills every remaining day in the visible month as Working, sequentially,
// so the backend can continue the Day Order sequence correctly.

function AutoFillPanel({ unsetCount, includeWeekends, onIncludeWeekendsChange, running, progress, onRun, monthLabel }) {
  return (
    <div style={{
      background: ACCENT_SOFT, borderRadius: R.xl,
      padding: '18px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <SquircleIcon emoji="⚡" size={44} bg="#D5E4FF" fontSize={20} />
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: ACCENT, margin: 0, letterSpacing: '-0.01em' }}>
            Auto-fill the rest of {monthLabel}
          </p>
          <p style={{ fontSize: 12, color: ACCENT, opacity: 0.85, margin: '2px 0 0' }}>
            {running
              ? `Filling day ${progress?.done ?? 0} of ${progress?.total ?? 0}…`
              : unsetCount > 0
                ? `${unsetCount} day${unsetCount === 1 ? '' : 's'} still unset — mark leave days first, then fill the rest as Working with the correct Day Order.`
                : 'Every day this month already has an entry — nothing left to fill.'}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeWeekends} onChange={e => onIncludeWeekendsChange(e.target.checked)} />
            Also mark Saturdays &amp; Sundays as Working
          </label>
        </div>
      </div>
      <button
        onClick={onRun}
        disabled={running || unsetCount === 0}
        style={{
          padding: '11px 22px', borderRadius: R.pill, border: 'none', fontWeight: 700, fontSize: 13.5,
          background: ACCENT, color: '#fff', cursor: 'pointer', flexShrink: 0,
          opacity: (running || unsetCount === 0) ? 0.5 : 1,
        }}
      >
        {running ? 'Filling…' : `Auto-fill ${unsetCount || ''} day${unsetCount === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}

// ─── Mark Day Modal ──────────────────────────────────────────────────────────

function MarkDayModal({ open, onClose, date, existing, onSaved }) {
  const [dayType, setDayType] = useState(existing?.day_type || 'working')
  const [dayOrder, setDayOrder] = useState(existing?.day_order || '')
  const [label, setLabel] = useState(existing?.label || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDayType(existing?.day_type || 'working')
    setDayOrder(existing?.day_order || '')
    setLabel(existing?.label || '')
    setNotes(existing?.notes || '')
    setError('')
  }, [existing, date])

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.markDay({
        date,
        day_type: dayType,
        day_order: dayType === 'working' && dayOrder ? Number(dayOrder) : null,
        label: label || null,
        notes: notes || null,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await academicCalendarApi.deleteDay(date)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearOverride = async () => {
    setSaving(true)
    try {
      await academicCalendarApi.clearOverride(date)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear override.')
    } finally {
      setSaving(false)
    }
  }

  const parsedDate = date ? new Date(date + 'T00:00:00') : null
  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : date

  const dayTypeOptions = [
    { value: 'working', label: 'Working Day', icon: '📅', hint: 'Auto Day Order' },
    ...LEAVE_TYPES.map(t => ({ value: t.value, label: t.label, icon: t.icon })),
  ]

  return (
    <Modal open={open} onClose={onClose} title={displayDate || ''}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ErrorAlert message={error} />

        {/* Day type selector — squircle tile grid, One UI settings style */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Day type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {dayTypeOptions.map(opt => {
              const meta = opt.value === 'working'
                ? { bg: '#E4F9EC', solid: '#22C55E', text: '#0F7A3D' }
                : LEAVE_TYPE_META[opt.value]
              const isActive = dayType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDayType(opt.value)}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '14px 6px 10px', borderRadius: R.lg, cursor: 'pointer',
                    background: isActive ? meta.bg : 'var(--surface-2)',
                    border: 'none',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {isActive && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 16, height: 16, borderRadius: '50%',
                      background: meta.solid, color: '#fff',
                      fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900,
                    }}>✓</span>
                  )}
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isActive ? meta.text : 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day Order override — only for working days */}
        {dayType === 'working' && (
          <div style={{
            background: '#E4F9EC',
            borderRadius: R.lg, padding: '14px 16px',
          }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0F7A3D', marginBottom: 10 }}>
              Day Order (optional override)
            </label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDayOrder('')}
                style={{
                  padding: '8px 14px', borderRadius: R.pill, fontSize: 12, cursor: 'pointer',
                  background: dayOrder === '' ? '#0F7A3D' : '#fff',
                  color: dayOrder === '' ? '#fff' : '#0F7A3D',
                  border: 'none', fontWeight: 700,
                }}
              >
                Auto (sequence)
              </button>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDayOrder(String(n))}
                  style={{
                    padding: '8px 13px', borderRadius: R.pill, fontSize: 12, cursor: 'pointer',
                    background: dayOrder === String(n) ? DO_COLORS[n].solid : '#fff',
                    color: dayOrder === String(n) ? '#fff' : DO_COLORS[n].text,
                    border: 'none', fontWeight: 800,
                  }}
                >
                  DO {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#3E7150', margin: '10px 0 0' }}>
              {existing?.is_manual_override
                ? 'Manual override active — leave blank to keep current value.'
                : 'Leave on auto to continue the sequence from the previous working day.'}
            </p>
          </div>
        )}

        {/* Label for non-working days */}
        {dayType !== 'working' && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Label <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
            </label>
            <input
              type="text"
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: R.md }}
              className="input"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Annual Sports Day"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Notes <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <textarea rows={2} className="input resize-none" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', borderRadius: R.md }} />
        </div>

        {/* Blocks operations notice */}
        {existing?.blocks_operations && (
          <div style={{
            background: '#FFF6DC',
            borderRadius: R.md, padding: '12px 14px', fontSize: 12, color: '#7A5B00',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 15 }}>⚠️</span>
            <span>This date is excluded from timetable scheduling, substitute assignment, credit/workload calculation, and attendance.</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="btn-secondary"
              style={{ color: '#DC2626', borderRadius: R.pill }}
            >
              Delete
            </button>
          )}
          {existing?.is_manual_override && (
            <button type="button" onClick={handleClearOverride} disabled={saving} className="btn-secondary" style={{ borderRadius: R.pill }}>
              Clear override
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1, borderRadius: R.pill, fontWeight: 700 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Month / Year quick-jump picker ───────────────────────────────────────────
// Tapping the header title opens this — a fast way to reach any month
// without paging through the calendar one click at a time.

function MonthYearPicker({ open, onClose, year, month, onJump }) {
  const [pickYear, setPickYear] = useState(year)

  useEffect(() => { if (open) setPickYear(year) }, [open, year])

  return (
    <Modal open={open} onClose={onClose} title="Jump to month">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <button
            onClick={() => setPickYear(y => y - 1)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-2)', fontSize: 16, cursor: 'pointer' }}
          >←</button>
          <span style={{ fontSize: 20, fontWeight: 800, minWidth: 70, textAlign: 'center' }}>{pickYear}</span>
          <button
            onClick={() => setPickYear(y => y + 1)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-2)', fontSize: 16, cursor: 'pointer' }}
          >→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {MONTH_NAMES.map((m, i) => {
            const isCurrentSelection = pickYear === year && i === month
            return (
              <button
                key={m}
                onClick={() => { onJump(pickYear, i); onClose() }}
                style={{
                  padding: '14px 8px', borderRadius: R.lg, border: 'none', cursor: 'pointer',
                  background: isCurrentSelection ? ACCENT : 'var(--surface-2)',
                  color: isCurrentSelection ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ─── Skip / Reassign Panel ────────────────────────────────────────────────────

function SkipReassignPanel({ onDone }) {
  const [mode, setMode] = useState('assign')
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (mode === 'assign') {
        await academicCalendarApi.assignDayOrder({ date, day_order: Number(value) })
      } else {
        await academicCalendarApi.skipDayOrder({ date, skip_to_day_order: Number(value) })
      }
      setDate('')
      setValue('')
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Operation failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: R.xl, padding: '18px 20px' }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        Reassign or skip a Day Order
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Pin an explicit Day Order for a date, or deliberately jump the rotation (e.g. 3 → skip 4 → 5). Dates after this one auto-resequence.
      </p>
      <ErrorAlert message={error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Action</label>
          <select className="input" style={{ borderRadius: R.md }} value={mode} onChange={e => setMode(e.target.value)}>
            <option value="assign">Reassign Day Order</option>
            <option value="skip">Skip to Day Order</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Date</label>
          <input type="date" required className="input" style={{ borderRadius: R.md }} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {mode === 'assign' ? 'Day Order' : 'Skip to'}
          </label>
          <select required className="input" style={{ borderRadius: R.md }} value={value} onChange={e => setValue(e.target.value)}>
            <option value="">Select…</option>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Day Order {n}</option>)}
          </select>
        </div>
        <button type="button" disabled={saving} className="btn-primary" style={{ borderRadius: R.pill, fontWeight: 700 }} onClick={handleSubmit}>
          {saving ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

// ─── Bulk Holiday Panel ───────────────────────────────────────────────────────

function BulkHolidayPanel({ onDone }) {
  const [form, setForm] = useState({ start_date: '', end_date: '', day_type: 'government_holiday', label: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.bulkMarkDays(form)
      setForm({ start_date: '', end_date: '', day_type: 'government_holiday', label: '' })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to bulk-mark.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: R.xl, padding: '18px 20px' }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        Bulk-mark a date range
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Mark a contiguous block of dates the same way in one go — e.g. a week of Government Holiday.
      </p>
      <ErrorAlert message={error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Start date</label>
          <input type="date" required className="input" style={{ borderRadius: R.md }} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>End date</label>
          <input type="date" required className="input" style={{ borderRadius: R.md }} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Day type</label>
          <select className="input" style={{ borderRadius: R.md }} value={form.day_type} onChange={e => setForm({ ...form, day_type: e.target.value })}>
            {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Label</label>
          <input type="text" className="input" style={{ borderRadius: R.md }} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Diwali Break" />
        </div>
        <button type="button" disabled={saving} className="btn-primary" style={{ borderRadius: R.pill, fontWeight: 700 }} onClick={handleSubmit}>
          {saving ? 'Marking…' : 'Mark range'}
        </button>
      </div>
    </div>
  )
}

// ─── Academic Years Panel ─────────────────────────────────────────────────────

function AcademicYearsPanel({ academicYears, onRefresh }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [semesters, setSemesters] = useState({})
  const [semForm, setSemForm] = useState({})

  useEffect(() => {
    academicYears.forEach(y => {
      academicCalendarApi.listSemesters(y.id).then(r => setSemesters(s => ({ ...s, [y.id]: r.data })))
    })
  }, [academicYears])

  const handleCreateYear = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await academicCalendarApi.createAcademicYear(form)
      setForm({ name: '', start_date: '', end_date: '' })
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create academic year.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateSemester = async (yearId, e) => {
    e.preventDefault()
    const data = semForm[yearId] || {}
    try {
      await academicCalendarApi.createSemester({ academic_year_id: yearId, ...data })
      setSemForm(s => ({ ...s, [yearId]: { name: '', start_date: '', end_date: '' } }))
      academicCalendarApi.listSemesters(yearId).then(r => setSemesters(s => ({ ...s, [yearId]: r.data })))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create semester.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>
      <ErrorAlert message={error} />

      <div style={{ background: 'var(--surface-1)', borderRadius: R.lg, padding: '16px 18px' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
          New academic year
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="text" required placeholder="2026-2027" className="input" style={{ borderRadius: R.md }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" required className="input" style={{ borderRadius: R.md, flex: 1 }} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <input type="date" required className="input" style={{ borderRadius: R.md, flex: 1 }} value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <button type="button" onClick={handleCreateYear} disabled={saving} className="btn-primary" style={{ fontSize: 13, borderRadius: R.pill, fontWeight: 700 }}>
            {saving ? 'Creating…' : 'Create academic year'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {academicYears.map(y => (
          <div key={y.id} style={{ background: 'var(--surface-1)', borderRadius: R.lg, padding: '14px 16px' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>{y.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>{y.start_date} → {y.end_date}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {(semesters[y.id] || []).map(s => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: 'var(--surface-2)', borderRadius: R.sm,
                  padding: '7px 12px', fontSize: 12, color: 'var(--text-primary)',
                }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{s.start_date} → {s.end_date}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="text" required placeholder="Semester name" className="input" style={{ fontSize: 12, flex: '1 1 120px', borderRadius: R.sm }}
                value={semForm[y.id]?.name || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], name: e.target.value } }))} />
              <input type="date" required className="input" style={{ fontSize: 12, flex: '1 1 130px', borderRadius: R.sm }}
                value={semForm[y.id]?.start_date || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], start_date: e.target.value } }))} />
              <input type="date" required className="input" style={{ fontSize: 12, flex: '1 1 130px', borderRadius: R.sm }}
                value={semForm[y.id]?.end_date || ''} onChange={e => setSemForm(s => ({ ...s, [y.id]: { ...s[y.id], end_date: e.target.value } }))} />
              <button type="button" className="btn-secondary" style={{ fontSize: 12, borderRadius: R.pill, fontWeight: 700 }} onClick={(e) => handleCreateSemester(y.id, e)}>
                + Add semester
              </button>
            </div>
          </div>
        ))}
        {academicYears.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No academic years yet.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function CalendarLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E4F9EC', color: '#0F7A3D', borderRadius: R.pill, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
        Working + Day Order
      </span>
      {LEAVE_TYPES.map(t => {
        const meta = LEAVE_TYPE_META[t.value]
        return (
          <span key={t.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: meta.bg, color: meta.text, borderRadius: R.pill, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
            {t.label}
          </span>
        )
      })}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ACCENT_SOFT, color: ACCENT, borderRadius: R.pill, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
        Today
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AcademicCalendar() {
  const today = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState(null)
  const [academicYears, setAcademicYears] = useState([])
  const [yearModalOpen, setYearModalOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [pendingJumpDate, setPendingJumpDate] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [activeLeaveType, setActiveLeaveType] = useState(null)
  const [quickSaving, setQuickSaving] = useState(null)

  // Batch select-then-apply leave marking
  const [panelMode, setPanelMode] = useState('instant') // 'instant' | 'batch'
  const [selectedDates, setSelectedDates] = useState(() => new Set())
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchError, setBatchError] = useState('')

  // One-click auto-fill of remaining days as Working, correct Day Order sequence
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillProgress, setAutoFillProgress] = useState(null)
  const [autoFillError, setAutoFillError] = useState('')

  useEffect(() => {
    const jumpDate = searchParams.get('date')
    if (!jumpDate) return
    const parsed = new Date(jumpDate + 'T00:00:00')
    if (isNaN(parsed.getTime())) return
    setYear(parsed.getFullYear())
    setMonth(parsed.getMonth())
    setPendingJumpDate(jumpDate)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const monthStart = isoDate(year, month, 1)
  const monthEnd = isoDate(year, month, new Date(year, month + 1, 0).getDate())

  const load = () => {
    setLoading(true)
    academicCalendarApi.getRange(monthStart, monthEnd)
      .then(r => setDays(r.data))
      .finally(() => setLoading(false))
  }

  const refreshYears = () => academicCalendarApi.listAcademicYears().then(r => setAcademicYears(r.data))

  useEffect(() => { load() }, [year, month])
  useEffect(() => { refreshYears() }, [])

  const daysByDate = useMemo(() => {
    const map = {}
    for (const d of days) map[d.date] = d
    return map
  }, [days])

  useEffect(() => {
    if (!pendingJumpDate || loading) return
    const jumpMonthKey = pendingJumpDate.slice(0, 7)
    const loadedMonthKey = monthStart.slice(0, 7)
    if (jumpMonthKey !== loadedMonthKey) return
    setModalState({ date: pendingJumpDate, existing: daysByDate[pendingJumpDate] || null })
    setPendingJumpDate(null)
  }, [pendingJumpDate, loading, daysByDate, monthStart])

  const goPrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else { setMonth(m => m - 1) }
  }
  const goNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else { setMonth(m => m + 1) }
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }
  const isOnCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const handleDayClick = async (dateStr, entry) => {
    if (activeLeaveType && panelMode === 'batch') {
      // Batch mode: just toggle selection, nothing saves yet
      setSelectedDates(prev => {
        const next = new Set(prev)
        if (next.has(dateStr)) next.delete(dateStr)
        else next.add(dateStr)
        return next
      })
      return
    }
    if (activeLeaveType) {
      // Instant mode: save immediately, as before
      setQuickSaving(dateStr)
      try {
        await academicCalendarApi.markDay({
          date: dateStr,
          day_type: activeLeaveType,
          day_order: null,
          label: null,
          notes: null,
        })
        load()
      } catch (err) {
        setModalState({ date: dateStr, existing: entry || null })
      } finally {
        setQuickSaving(null)
      }
    } else {
      setModalState({ date: dateStr, existing: entry || null })
    }
  }

  const handlePanelModeChange = (mode) => {
    setPanelMode(mode)
    setSelectedDates(new Set())
    setBatchError('')
  }

  const handleActiveLeaveTypeChange = (type) => {
    setActiveLeaveType(type)
    setSelectedDates(new Set())
    setBatchError('')
  }

  // Commit the batch selection — marks every selected date as the chosen
  // leave type, one call at a time in chronological order.
  const commitBatchSelection = async () => {
    if (selectedDates.size === 0 || !activeLeaveType) return
    setBatchError('')
    setBatchSaving(true)
    const ordered = Array.from(selectedDates).sort()
    try {
      for (const dateStr of ordered) {
        await academicCalendarApi.markDay({
          date: dateStr,
          day_type: activeLeaveType,
          day_order: null,
          label: null,
          notes: null,
        })
      }
      setSelectedDates(new Set())
      load()
    } catch (err) {
      setBatchError(err.response?.data?.detail || 'Failed to save one or more selected days.')
    } finally {
      setBatchSaving(false)
    }
  }

  // Every day this month with no calendar entry yet — the candidates for auto-fill
  const unsetDates = useMemo(() => {
    const out = []
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = isoDate(year, month, d)
      if (daysByDate[dateStr]) continue
      if (!includeWeekends) {
        const weekday = new Date(dateStr + 'T00:00:00').getDay()
        if (weekday === 0 || weekday === 6) continue
      }
      out.push(dateStr)
    }
    return out
  }, [year, month, daysByDate, includeWeekends])

  // The one-click feature: fill every remaining unset day this month as
  // Working, sequentially and in date order, so the backend can continue
  // the Day Order sequence correctly from whatever came before.
  const autoFillRemaining = async () => {
    if (unsetDates.length === 0) return
    setAutoFillError('')
    setAutoFilling(true)
    setAutoFillProgress({ done: 0, total: unsetDates.length })
    try {
      for (let i = 0; i < unsetDates.length; i++) {
        await academicCalendarApi.markDay({
          date: unsetDates[i],
          day_type: 'working',
          day_order: null,
          label: null,
          notes: null,
        })
        setAutoFillProgress({ done: i + 1, total: unsetDates.length })
      }
      load()
    } catch (err) {
      setAutoFillError(err.response?.data?.detail || 'Auto-fill stopped partway through — the days already filled are saved.')
      load()
    } finally {
      setAutoFilling(false)
      setAutoFillProgress(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Academic Calendar
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Tap a leave type below, then tap days — Day Order keeps itself in sync.
          </p>
        </div>
        <button
          onClick={() => setYearModalOpen(true)}
          style={{
            fontSize: 13, whiteSpace: 'nowrap', fontWeight: 700, cursor: 'pointer',
            padding: '10px 18px', borderRadius: R.pill, border: 'none',
            background: 'var(--surface-1)', color: 'var(--text-primary)',
          }}
        >
          Manage academic years
        </button>
      </div>

      {/* ── Leave Quick-Mark Panel ── */}
      <LeaveQuickPanel
        panelMode={panelMode}
        onPanelModeChange={handlePanelModeChange}
        activeLeaveType={activeLeaveType}
        onSelect={handleActiveLeaveTypeChange}
        selectedCount={selectedDates.size}
        onCommitBatch={commitBatchSelection}
        onClearBatch={() => setSelectedDates(new Set())}
        batchSaving={batchSaving}
      />
      {batchError && <ErrorAlert message={batchError} />}

      {/* ── Auto-fill Panel — the one-click "fill everything else" action ── */}
      <AutoFillPanel
        unsetCount={unsetDates.length}
        includeWeekends={includeWeekends}
        onIncludeWeekendsChange={setIncludeWeekends}
        running={autoFilling}
        progress={autoFillProgress}
        onRun={autoFillRemaining}
        monthLabel={`${MONTH_NAMES[month]} ${year}`}
      />
      {autoFillError && <ErrorAlert message={autoFillError} />}

      {/* ── Calendar Card ── */}
      <div style={{
        background: 'var(--surface-2)',
        borderRadius: R.xl, padding: '22px 22px 18px',
      }}>

        {/* Month nav — tap the title to jump anywhere fast */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
          <button onClick={goPrevMonth} style={{
            width: 40, height: 40, borderRadius: '50%', fontSize: 16, lineHeight: 1, cursor: 'pointer',
            background: 'var(--surface-1)', border: 'none', color: 'var(--text-primary)', flexShrink: 0,
          }}>←</button>

          <button
            onClick={() => setPickerOpen(true)}
            style={{
              textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 12px', borderRadius: R.lg,
            }}
          >
            <p style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
              {MONTH_NAMES[month]} <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{year}</span>
            </p>
            <p style={{ fontSize: 11, color: ACCENT, margin: '2px 0 0', fontWeight: 700 }}>Tap to jump ▾</p>
          </button>

          <button onClick={goNextMonth} style={{
            width: 40, height: 40, borderRadius: '50%', fontSize: 16, lineHeight: 1, cursor: 'pointer',
            background: 'var(--surface-1)', border: 'none', color: 'var(--text-primary)', flexShrink: 0,
          }}>→</button>
        </div>

        {!isOnCurrentMonth && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <button
              onClick={goToday}
              style={{
                fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: R.pill,
                background: ACCENT_SOFT, color: ACCENT, border: 'none', cursor: 'pointer',
              }}
            >
              ● Jump to today
            </button>
          </div>
        )}

        {/* Month stats */}
        {!loading && days.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <MonthStats days={days} />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner />
          </div>
        ) : (
          <MonthGrid
            year={year}
            month={month}
            daysByDate={daysByDate}
            onDayClick={handleDayClick}
            quickSaving={quickSaving}
            selectedDates={panelMode === 'batch' ? selectedDates : null}
            selectionActive={panelMode === 'batch' && !!activeLeaveType}
            busyDates={autoFilling ? new Set(unsetDates.slice(0, autoFillProgress?.done ?? 0)) : null}
          />
        )}

        {/* Active mode hint (instant mode only — batch mode has its own summary bar above) */}
        {activeLeaveType && panelMode === 'instant' && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: R.md,
            background: '#FFF6DC',
            fontSize: 12, color: '#7A5B00', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 15 }}>⚡</span>
            <span>
              Quick-mark mode active — tapping any day marks it as{' '}
              <strong>{LEAVE_TYPES.find(t => t.value === activeLeaveType)?.label}</strong>.{' '}
              Working days nearby continue the Day Order sequence automatically.
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <CalendarLegend />
        </div>
      </div>

      {/* ── Advanced Tools ── */}
      <div>
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
            background: 'var(--surface-1)', border: 'none', cursor: 'pointer',
            padding: '10px 16px', borderRadius: R.pill,
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            fontSize: 11,
          }}>▼</span>
          Advanced tools
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
            (skip/reassign Day Order, bulk-mark a range)
          </span>
        </button>
        {advancedOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <SkipReassignPanel onDone={load} />
            <BulkHolidayPanel onDone={load} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <MarkDayModal
        open={!!modalState}
        onClose={() => setModalState(null)}
        date={modalState?.date}
        existing={modalState?.existing}
        onSaved={load}
      />

      <MonthYearPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        year={year}
        month={month}
        onJump={(y, m) => { setYear(y); setMonth(m) }}
      />

      <Modal open={yearModalOpen} onClose={() => setYearModalOpen(false)} title="Academic years and semesters">
        <AcademicYearsPanel academicYears={academicYears} onRefresh={refreshYears} />
      </Modal>
    </div>
  )
}