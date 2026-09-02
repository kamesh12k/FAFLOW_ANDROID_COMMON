import { useMemo, useState } from 'react'
import { academicCalendarApi } from '../../api/services'
import { ErrorAlert, EmptyState, DayTypeBadge, CreditChip } from '../../components/ui'

// ─── One UI 9 tokens (shared feel with the calendar screen) ───────────────────
const ACCENT = '#1261FF'
const ACCENT_SOFT = '#EAF1FF'
const R = { pill: 999, xl: 28, lg: 22, md: 16, sm: 12 }

function pad(n) { return String(n).padStart(2, '0') }
function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// Quick date-range presets — the fastest path to a common report,
// no manual date picking required.
function presetRanges() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 6)
  const thirtyAgo = new Date(today); thirtyAgo.setDate(today.getDate() - 29)
  return [
    { label: 'Last 7 days', start: isoOf(sevenAgo), end: isoOf(today) },
    { label: 'Last 30 days', start: isoOf(thirtyAgo), end: isoOf(today) },
    { label: 'This month', start: isoOf(startOfMonth), end: isoOf(today) },
  ]
}

// ─── Date range picker — rounded card, floating quick presets ────────────────

function DateRangePicker({ start, end, onStart, onEnd, onRun, loading }) {
  const presets = presetRanges()
  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: R.xl, padding: '18px 20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => { onStart(p.start); onEnd(p.end) }}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: R.pill,
              background: (start === p.start && end === p.end) ? ACCENT : 'var(--surface-2)',
              color: (start === p.start && end === p.end) ? '#fff' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', transition: 'all 0.12s ease',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Start date</label>
          <input type="date" className="input" style={{ borderRadius: R.md }} value={start} onChange={e => onStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">End date</label>
          <input type="date" className="input" style={{ borderRadius: R.md }} value={end} onChange={e => onEnd(e.target.value)} />
        </div>
        <button
          onClick={onRun}
          disabled={loading || !start || !end}
          style={{
            padding: '10px 22px', borderRadius: R.pill, border: 'none', fontWeight: 700, fontSize: 13.5,
            background: ACCENT, color: '#fff', cursor: 'pointer', opacity: (loading || !start || !end) ? 0.4 : 1,
          }}
        >
          {loading ? 'Running…' : 'Run report'}
        </button>
      </div>
    </div>
  )
}

// ─── Shared rounded table shell ────────────────────────────────────────────────

function ReportTable({ headers, children, empty }) {
  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: R.xl, overflow: 'hidden' }}>
      {empty ? <EmptyState message={empty} /> : (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm" style={{ minWidth: '450px' }}>
            <thead>
              <tr>{headers.map(h => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}</tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const rowStyle = { transition: 'background 0.1s ease' }
const cellStyle = { padding: '13px 20px' }

// ─── Working Days Report ───────────────────────────────────────────────────────

function WorkingDaysReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.workingDayReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    if (!rows) return null
    const working = rows.filter(r => r.is_working).length
    return { total: rows.length, working, nonWorking: rows.length - working }
  }, [rows])

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />

      {summary && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryChip icon="📆" value={summary.total} label="Days in range" bg="#EAF1FF" text={ACCENT} iconBg="#D5E4FF" />
          <SummaryChip icon="📅" value={summary.working} label="Working" bg="#E4F9EC" text="#0F7A3D" iconBg="#C9F2D9" />
          <SummaryChip icon="🏖️" value={summary.nonWorking} label="Non-working" bg="#EEF0F2" text="#4B5563" iconBg="#E1E4E8" />
        </div>
      )}

      {rows && (
        <ReportTable headers={['Date', 'Day Order', 'Working?']} empty={rows.length === 0 ? 'No calendar entries in this range.' : null}>
          {rows.map(r => (
            <tr key={r.date} style={rowStyle}>
              <td style={{ ...cellStyle, color: 'var(--text-primary)', fontWeight: 600 }}>{r.date}</td>
              <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{r.day_order ?? '—'}</td>
              <td style={cellStyle}>
                {r.is_working
                  ? <span style={{ background: '#E4F9EC', color: '#0F7A3D', borderRadius: R.pill, fontSize: 11, fontWeight: 700, padding: '4px 10px' }}>Working</span>
                  : <span style={{ background: '#EEF0F2', color: '#6B7280', borderRadius: R.pill, fontSize: 11, fontWeight: 700, padding: '4px 10px' }}>Non-working</span>}
              </td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  )
}

// ─── Holidays Report ────────────────────────────────────────────────────────────

function HolidaysReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.holidayReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    if (!rows) return null
    if (!filter.trim()) return rows
    const q = filter.toLowerCase()
    return rows.filter(r => (r.label || '').toLowerCase().includes(q) || (r.day_type || '').toLowerCase().includes(q))
  }, [rows, filter])

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />

      {rows && rows.length > 0 && (
        <input
          type="text"
          placeholder="Filter by label or type…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="input"
          style={{ borderRadius: R.pill, width: '100%', maxWidth: 320 }}
        />
      )}

      {filteredRows && (
        <ReportTable headers={['Date', 'Type', 'Label']} empty={filteredRows.length === 0 ? 'No holidays/non-working days match.' : null}>
          {filteredRows.map(r => (
            <tr key={r.date} style={rowStyle}>
              <td style={{ ...cellStyle, color: 'var(--text-primary)', fontWeight: 600 }}>{r.date}</td>
              <td style={cellStyle}><DayTypeBadge dayType={r.day_type} /></td>
              <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{r.label || '—'}</td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  )
}

// ─── Day Order Report ───────────────────────────────────────────────────────────

const DO_SOLID = ['', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#F5B301', '#EC4899']

function DayOrderReport() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.dayOrderReport(start, end)
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <DateRangePicker start={start} end={end} onStart={setStart} onEnd={setEnd} onRun={run} loading={loading} />
      <ErrorAlert message={error} />
      {rows && (
        <ReportTable headers={['Day Order', 'Occurrences', 'Dates']} empty={rows.length === 0 ? 'No Day Order occurrences in this range.' : null}>
          {rows.map(r => (
            <tr key={r.day_order} style={rowStyle}>
              <td style={cellStyle}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--text-primary)',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: DO_SOLID[r.day_order] || '#94A3B8' }} />
                  Day Order {r.day_order}
                </span>
              </td>
              <td style={{ ...cellStyle, color: 'var(--text-secondary)', fontWeight: 700 }}>{r.occurrences}</td>
              <td style={{ ...cellStyle, color: 'var(--text-muted)', fontSize: 12 }}>{r.dates.join(', ')}</td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  )
}

// ─── Faculty Workload Report ────────────────────────────────────────────────────

function SummaryChip({ icon, value, label, bg, text, iconBg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, borderRadius: R.lg, padding: '8px 16px 8px 8px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: text, opacity: 0.75, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

function FacultyWorkloadReport() {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortDesc, setSortDesc] = useState(true)

  const run = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await academicCalendarApi.facultyWorkloadReport()
      setRows(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  const displayRows = useMemo(() => {
    if (!rows) return null
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => r.name.toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => sortDesc ? b.total_periods - a.total_periods : a.total_periods - b.total_periods)
  }, [rows, search, sortDesc])

  const summary = useMemo(() => {
    if (!rows || rows.length === 0) return null
    const total = rows.reduce((s, r) => s + r.total_periods, 0)
    return { teachers: rows.length, total, avg: Math.round(total / rows.length) }
  }, [rows])

  return (
    <div className="space-y-4">
      <div style={{ background: 'var(--surface-1)', borderRadius: R.xl, padding: '18px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 480 }}>
          Total periods taught per teacher, counting only actual working-day occurrences — holidays and non-working days are excluded automatically.
        </p>
        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: '10px 22px', borderRadius: R.pill, border: 'none', fontWeight: 700, fontSize: 13.5,
            background: ACCENT, color: '#fff', cursor: 'pointer', opacity: loading ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {loading ? 'Running…' : 'Run report'}
        </button>
      </div>
      <ErrorAlert message={error} />

      {summary && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryChip icon="🧑‍🏫" value={summary.teachers} label="Teachers" bg="#EAF1FF" text={ACCENT} iconBg="#D5E4FF" />
          <SummaryChip icon="📊" value={summary.total} label="Total periods" bg="#F0E9FE" text="#6D28D9" iconBg="#E1D3FC" />
          <SummaryChip icon="⚖️" value={summary.avg} label="Avg. per teacher" bg="#FFF6DC" text="#946200" iconBg="#FCE9AE" />
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search teacher or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
            style={{ borderRadius: R.pill, flex: '1 1 240px', maxWidth: 320 }}
          />
          <button
            onClick={() => setSortDesc(s => !s)}
            style={{
              fontSize: 12, fontWeight: 700, padding: '9px 16px', borderRadius: R.pill,
              background: 'var(--surface-2)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
            }}
          >
            Sort: {sortDesc ? 'Highest first ↓' : 'Lowest first ↑'}
          </button>
        </div>
      )}

      {displayRows && (
        <ReportTable headers={['Teacher', 'Department', 'Total Periods (excl. holidays)', 'Credit Balance']} empty={displayRows.length === 0 ? 'No teachers found.' : null}>
          {displayRows.map(r => (
            <tr key={r.teacher_id} style={rowStyle}>
              <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</td>
              <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{r.department || '—'}</td>
              <td style={{ ...cellStyle, color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>{r.total_periods}</td>
              <td style={cellStyle}><CreditChip value={r.credit_balance} /></td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  )
}

// ─── Tabs — sliding pill segmented control ─────────────────────────────────────

const TABS = [
  { key: 'working', label: 'Working Days', icon: '📅', Component: WorkingDaysReport },
  { key: 'holidays', label: 'Holidays', icon: '🏖️', Component: HolidaysReport },
  { key: 'day-orders', label: 'Day Orders', icon: '🔁', Component: DayOrderReport },
  { key: 'workload', label: 'Faculty Workload', icon: '🧑‍🏫', Component: FacultyWorkloadReport },
]

export default function AcademicCalendarReports() {
  const [active, setActive] = useState('working')
  const ActiveComponent = TABS.find(t => t.key === active)?.Component || WorkingDaysReport

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Calendar Reports
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Working day, holiday, Day Order, and workload reports — all holiday-aware
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 5,
        borderRadius: R.pill, width: 'fit-content', maxWidth: '100%', overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                padding: '9px 18px', borderRadius: R.pill, border: 'none', cursor: 'pointer',
                background: isActive ? ACCENT : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 13,
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      <ActiveComponent />
    </div>
  )
}