/**
 * Master Governance Business Rules & Period Timetable Control Center
 * =================================================================
 * High-contrast, production-grade administrative UI for reviewing, modifying,
 * auditing, and rolling back centralized platform constants and period timings.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import governanceApi from '../../api/governanceApi'

/* ─── Category metadata & iconography ───────────────────────────────────── */
const CATEGORY_META = {
  class_suggestion:    { label: 'Class Suggestions',     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  student_attendance:  { label: 'Student Attendance',   color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  biometrics:          { label: 'Biometrics & Security', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  geofencing:          { label: 'Geofencing & Location', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  leave:               { label: 'Leave & Absences',      color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  substitution:        { label: 'Substitution Engine',   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  credits:             { label: 'Faculty Credits',       color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  risk:                { label: 'Risk & Absenteeism',    color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' },
  limits:              { label: 'System Limits',         color: '#334155', bg: '#f8fafc', border: '#cbd5e1' },
}

const SEVERITY_META = {
  low:      { label: 'Low',      bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  normal:   { label: 'Normal',   bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  high:     { label: 'High',     bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
  critical: { label: 'Critical', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}

/* ─── Shared High-Contrast Light Theme Styles ───────────────────────────── */
const S = {
  page:   { padding: '1.5rem', maxWidth: 1120, margin: '0 auto', color: '#090d16' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' },
  h1:     { fontSize: '1.55rem', fontWeight: 900, color: '#090d16', margin: 0, letterSpacing: '-0.02em' },
  sub:    { color: '#1e293b', fontSize: '0.9rem', marginTop: 4, lineHeight: '1.45', fontWeight: 500 },

  tabs:   { display: 'flex', gap: 6, borderBottom: '2px solid #cbd5e1', marginBottom: '1.5rem', overflowX: 'auto' },
  tab:    (active) => ({
    padding: '0.65rem 1.15rem', fontSize: '0.875rem', fontWeight: 800,
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#4338ca' : '#334155',
    borderBottom: active ? '3px solid #4338ca' : '3px solid transparent',
    marginBottom: '-2px',
    transition: 'all 0.18s', whiteSpace: 'nowrap',
  }),

  searchBar: { position: 'relative', marginBottom: '1.25rem' },
  searchInput: {
    width: '100%', background: '#ffffff', border: '2px solid #94a3b8',
    borderRadius: 10, color: '#090d16', padding: '0.7rem 0.85rem 0.7rem 2.4rem',
    fontSize: '0.9rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#334155', width: 18 },

  categorySection: { marginBottom: '2rem' },
  categoryHeader: (meta) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '0.85rem',
    padding: '0.75rem 1.1rem', borderRadius: 8,
    background: meta.bg || '#f1f5f9',
    border: `2px solid ${meta.border || '#cbd5e1'}`,
    borderLeft: `6px solid ${meta.color || '#4338ca'}`,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  }),
  categoryLabel: { fontWeight: 900, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.06em' },
  categoryCount: { fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' },

  card: {
    background: '#ffffff', border: '1.5px solid #94a3b8',
    borderRadius: 12, padding: '1.15rem 1.35rem', marginBottom: '0.85rem',
    boxShadow: '0 2px 5px rgba(15, 23, 42, 0.07)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  cardModified: { borderColor: '#6366f1', background: '#faf5ff' },
  cardSecurity: { borderColor: '#ef4444', background: '#fff1f2' },

  ruleRow:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  ruleInfo:  { flex: 1, minWidth: 240 },
  ruleName:  { fontWeight: 900, fontSize: '1.02rem', color: '#090d16', display: 'flex', alignItems: 'center', gap: 8 },
  ruleDesc:  { fontSize: '0.88rem', color: '#1e293b', marginTop: 5, lineHeight: '1.5', fontWeight: 500 },
  ruleMeta:  { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  badge:     (bg, text, border = '#94a3b8') => ({
    padding: '0.25rem 0.65rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 800,
    background: bg, color: text, border: `1.5px solid ${border}`,
  }),

  ruleValue: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  valueDisplay: {
    padding: '0.5rem 1rem', borderRadius: 8, background: '#f1f5f9',
    fontSize: '1.15rem', fontWeight: 900, color: '#090d16', minWidth: 76, textAlign: 'center',
    fontFamily: 'monospace', border: '2px solid #64748b',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
  },
  unitLabel: { color: '#1e293b', fontSize: '0.82rem', fontWeight: 800 },

  btnIcon: (color = '#1e293b') => ({
    background: '#ffffff', border: '1.5px solid #64748b', cursor: 'pointer', padding: '7px 9px', borderRadius: 8,
    color, transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  }),

  // Modal styles
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: 16,
    padding: '1.75rem', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
  },
  modalTitle: { fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' },
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 },
  input: {
    width: '100%', background: '#ffffff', border: '1.5px solid #cbd5e1',
    borderRadius: 8, color: '#0f172a', padding: '0.65rem 0.85rem', fontSize: '0.92rem', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box', marginBottom: '0.95rem',
  },
  textarea: {
    width: '100%', background: '#ffffff', border: '1.5px solid #cbd5e1',
    borderRadius: 8, color: '#0f172a', padding: '0.65rem 0.85rem', fontSize: '0.92rem', fontWeight: 500,
    outline: 'none', boxSizing: 'border-box', marginBottom: '0.95rem', resize: 'vertical', minHeight: 75,
    fontFamily: 'inherit',
  },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  btnSecondary: {
    padding: '0.6rem 1.15rem', borderRadius: 8, border: '1.5px solid #cbd5e1',
    background: '#ffffff', color: '#1e293b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
  },
  btnPrimary: {
    padding: '0.6rem 1.3rem', borderRadius: 8, border: 'none',
    background: '#4f46e5', color: '#ffffff',
    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
    boxShadow: '0 1px 3px rgba(79, 70, 229, 0.3)',
  },
  btnDanger: {
    padding: '0.6rem 1.3rem', borderRadius: 8, border: 'none',
    background: '#dc2626', color: '#ffffff',
    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700,
  },

  preview: (valid) => ({
    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
    fontSize: '0.85rem', fontWeight: 700,
    background: valid ? '#ecfdf5' : '#fef2f2',
    border: `1.5px solid ${valid ? '#6ee7b7' : '#fca5a5'}`,
    color: valid ? '#065f46' : '#991b1b',
  }),

  // History table
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', background: '#ffffff' },
  th: { textAlign: 'left', padding: '0.65rem 0.85rem', color: '#0f172a', fontWeight: 800, background: '#f8fafc', borderBottom: '2px solid #cbd5e1' },
  td: { padding: '0.65rem 0.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', fontWeight: 500 },
  tdMono: { fontFamily: 'monospace', padding: '0.65rem 0.85rem', color: '#0f172a', fontWeight: 700, borderBottom: '1px solid #e2e8f0' },
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */
function RulesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v18M3 9l9-6 9 6M3 15l9 6 9-6" />
    </svg>
  )
}

function HistoryIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" />
    </svg>
  )
}

function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function EditIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function ResetIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function RollbackIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function getApiErrorMessage(err, fallback = 'Operation failed') {
  return err.response?.data?.detail || err.message || fallback
}

/* ─── Edit Rule Modal ───────────────────────────────────────────────────── */
function EditRuleModal({ rule, onClose, onSaved }) {
  const [value, setValue] = useState(rule.value)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const previewTimer = useRef(null)

  useEffect(() => {
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      governanceApi.validateRule(rule.key, value)
        .then(r => setPreview(r.data))
        .catch(() => setPreview(null))
    }, 350)
    return () => clearTimeout(previewTimer.current)
  }, [value, rule.key])

  async function handleSave() {
    if (!reason.trim() || reason.trim().length < 5) { setError('Reason must be at least 5 characters.'); return }
    setSaving(true); setError('')
    try {
      await governanceApi.updateRule(rule.key, value, reason)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save rule'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!reason.trim() || reason.trim().length < 5) { setError('Reason required to reset.'); return }
    setSaving(true); setError('')
    try {
      await governanceApi.resetRule(rule.key, reason)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to reset rule'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={S.modalTitle}>{rule.display_name}</div>
            <div style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 500 }}>{rule.description}</div>
          </div>
          <button onClick={onClose} style={S.btnIcon('#475569')}><XIcon style={{ width: 16 }} /></button>
        </div>

        {rule.security_critical && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.82rem', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
            <ShieldIcon style={{ width: 16, flexShrink: 0, color: '#dc2626' }} />
            <span><strong>Security-critical rule.</strong> Affects biometric or location verification. Changes take effect immediately.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={S.badge('#e0e7ff', '#3730a3', '#c7d2fe')}>type: {rule.data_type}</span>
          {rule.unit && <span style={S.badge('#f1f5f9', '#334155')}>unit: {rule.unit}</span>}
          {rule.minimum != null && <span style={S.badge('#f1f5f9', '#334155')}>min: {rule.minimum}</span>}
          {rule.maximum != null && <span style={S.badge('#f1f5f9', '#334155')}>max: {rule.maximum}</span>}
          <span style={S.badge('#f8fafc', '#475569')}>default: {rule.default_value}</span>
        </div>

        <label style={S.label}>New Value</label>
        <input
          style={S.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={`Current: ${rule.value}`}
        />

        {preview && (
          <div style={S.preview(preview.valid)}>
            {preview.valid
              ? `✓ Valid — will change from ${preview.current_value} → ${preview.new_value}`
              : `✗ ${preview.error}`}
          </div>
        )}

        <label style={S.label}>Reason for change (required, min 5 chars)</label>
        <textarea
          style={S.textarea}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe why this operational threshold is being adjusted..."
        />

        {error && <div style={{ color: '#dc2626', fontSize: '0.83rem', fontWeight: 700, marginBottom: 10 }}>{error}</div>}

        <div style={S.btnRow}>
          <button style={S.btnSecondary} onClick={handleReset} disabled={saving} title="Reset to factory default">
            <ResetIcon style={{ width: 14, marginRight: 5 }} />Reset Default
          </button>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={S.btnPrimary} onClick={handleSave} disabled={saving || (preview && !preview.valid)}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Rollback Modal ────────────────────────────────────────────────────── */
function RollbackModal({ entry, onClose, onDone }) {
  const [reason, setReason] = useState(`Rollback to version ${entry.version}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleRollback() {
    setSaving(true); setError('')
    try {
      await governanceApi.rollback(entry.id, reason)
      onDone()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 460 }}>
        <div style={S.modalTitle}>Roll Back: {entry.rule_key}</div>
        <div style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
          This will restore the rule to <strong style={{ color: '#0f172a' }}>{entry.old_value ?? '[initial default]'}</strong> (before version {entry.version}).
        </div>
        <label style={S.label}>Justification Reason</label>
        <input style={S.input} value={reason} onChange={e => setReason(e.target.value)} />
        {error && <div style={{ color: '#dc2626', fontSize: '0.83rem', fontWeight: 700, marginBottom: 10 }}>{error}</div>}
        <div style={S.btnRow}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={S.btnDanger} onClick={handleRollback} disabled={saving}>{saving ? 'Rolling back…' : 'Confirm Rollback'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Period Editor ─────────────────────────────────────────────────────── */
function PeriodEditor({ onClose, onSaved }) {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    governanceApi.getPeriods()
      .then(r => { setPeriods(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load periods'); setLoading(false) })
  }, [])

  function update(idx, field, val) {
    setPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      await governanceApi.updatePeriods(periods)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 660 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={S.modalTitle}>Institutional Period Schedule</div>
          <button onClick={onClose} style={S.btnIcon('#475569')}><XIcon style={{ width: 16 }} /></button>
        </div>
        <div style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 500 }}>
          Edit period start and end times. Updated timings take effect immediately across all services and mobile devices.
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '2rem 0', fontWeight: 600 }}>Loading periods…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 90px 80px', gap: 10, marginBottom: 8, padding: '0 4px' }}>
              {['Slot', 'Period Label', 'Start', 'End', 'Enabled'].map(h => (
                <div key={h} style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {periods.map((p, i) => (
              <div key={p.period_number} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 90px 80px', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 800, color: '#4f46e5', fontFamily: 'monospace', fontSize: '0.95rem' }}>P{p.period_number}</div>
                <input
                  style={{ ...S.input, marginBottom: 0 }}
                  value={p.name}
                  onChange={e => update(i, 'name', e.target.value)}
                />
                <input
                  style={{ ...S.input, marginBottom: 0, fontFamily: 'monospace', textAlign: 'center' }}
                  value={p.start_time}
                  onChange={e => update(i, 'start_time', e.target.value)}
                  placeholder="HH:MM"
                />
                <input
                  style={{ ...S.input, marginBottom: 0, fontFamily: 'monospace', textAlign: 'center' }}
                  value={p.end_time}
                  onChange={e => update(i, 'end_time', e.target.value)}
                  placeholder="HH:MM"
                />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={p.is_enabled}
                    onChange={e => update(i, 'is_enabled', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#4f46e5', cursor: 'pointer' }}
                  />
                </div>
              </div>
            ))}
          </>
        )}
        {error && <div style={{ color: '#dc2626', fontSize: '0.83rem', fontWeight: 700, margin: '0.75rem 0' }}>{error}</div>}
        <div style={S.btnRow}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={S.btnPrimary} onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Rules Tab ─────────────────────────────────────────────────────────── */
function RulesTab({ onHistoryOpen }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editRule, setEditRule] = useState(null)
  const [showPeriods, setShowPeriods] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    governanceApi.listRules()
      .then(r => { setRules(r.data); setLoading(false) })
      .catch(e => { setError(getApiErrorMessage(e)); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? rules.filter(r =>
        r.key.includes(search) ||
        r.display_name.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.category.includes(search)
      )
    : rules

  // Group by category
  const grouped = {}
  for (const r of filtered) {
    if (!grouped[r.category]) grouped[r.category] = []
    grouped[r.category].push(r)
  }

  if (loading) return <div style={{ textAlign: 'center', color: '#475569', padding: '3rem 0', fontWeight: 700 }}>Loading rules…</div>
  if (error) return <div style={{ color: '#dc2626', padding: '1rem', fontWeight: 700 }}>{error}</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ ...S.searchBar, flex: 1, minWidth: 240, marginBottom: 0 }}>
          <SearchIcon style={{ ...S.searchIcon }} />
          <input
            style={S.searchInput}
            placeholder="Search rules by name, key, or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowPeriods(true)}
          style={{ ...S.btnPrimary, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          <ClockIcon style={{ width: 16 }} /> Edit Period Schedule
        </button>
      </div>

      {Object.entries(grouped).map(([cat, catRules]) => {
        const meta = CATEGORY_META[cat] || { label: cat, color: '#4f46e5', bg: '#f8fafc', border: '#e2e8f0' }
        return (
          <div key={cat} style={S.categorySection}>
            <div style={S.categoryHeader(meta)}>
              <span style={{ ...S.categoryLabel, color: meta.color }}>{meta.label}</span>
              <span style={S.categoryCount}>{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
            </div>
            {catRules.map(rule => {
              const sevMeta = SEVERITY_META[rule.severity] || SEVERITY_META.normal
              const isModified = rule.is_modified
              const isSecurity = rule.security_critical
              return (
                <div
                  key={rule.key}
                  style={{
                    ...S.card,
                    ...(isSecurity ? S.cardSecurity : {}),
                    ...(isModified && !isSecurity ? S.cardModified : {}),
                  }}
                >
                  <div style={S.ruleRow}>
                    <div style={S.ruleInfo}>
                      <div style={S.ruleName}>
                        {isSecurity && <ShieldIcon style={{ width: 16, color: '#dc2626', flexShrink: 0 }} />}
                        {rule.display_name}
                        {isModified && (
                          <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                            MODIFIED
                          </span>
                        )}
                      </div>
                      <div style={S.ruleDesc}>{rule.description}</div>
                      <div style={S.ruleMeta}>
                        <span style={S.badge(sevMeta.bg, sevMeta.text, sevMeta.border)}>{sevMeta.label}</span>
                        <span style={S.badge('#f8fafc', '#334155')}>{rule.data_type}</span>
                        {rule.unit && <span style={S.unitLabel}>({rule.unit})</span>}
                        {rule.affected_modules?.slice(0, 3).map(m => (
                          <span key={m} style={S.badge('#f0fdf4', '#166534', '#bbf7d0')}>{m}</span>
                        ))}
                        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>v{rule.version}</span>
                      </div>
                    </div>

                    <div style={S.ruleValue}>
                      <div>
                        <div style={S.valueDisplay}>{rule.value}</div>
                        {isModified && (
                          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#475569', marginTop: 3, fontWeight: 600 }}>
                            default: {rule.default_value}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          style={S.btnIcon('#4f46e5')}
                          onClick={() => setEditRule(rule)}
                          title="Edit rule value"
                        >
                          <EditIcon style={{ width: 16 }} />
                        </button>
                        <button
                          style={S.btnIcon('#475569')}
                          onClick={() => onHistoryOpen(rule.key)}
                          title="View audit history"
                        >
                          <HistoryIcon style={{ width: 16 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {editRule && (
        <EditRuleModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={() => { setEditRule(null); load() }}
        />
      )}
      {showPeriods && (
        <PeriodEditor
          onClose={() => setShowPeriods(false)}
          onSaved={() => { setShowPeriods(false); load() }}
        />
      )}
    </>
  )
}

/* ─── History Tab ───────────────────────────────────────────────────────── */
function HistoryTab({ filterKey, setFilterKey }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [rollbackEntry, setRollbackEntry] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    governanceApi.getHistory({ key: filterKey || undefined, limit: 100 })
      .then(r => { setHistory(r.data); setLoading(false) })
      .catch(e => { setError(getApiErrorMessage(e)); setLoading(false) })
  }, [filterKey])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ ...S.searchBar, flex: 1, minWidth: 240, marginBottom: 0 }}>
          <SearchIcon style={{ ...S.searchIcon }} />
          <input
            style={S.searchInput}
            placeholder="Filter audit history by rule key…"
            value={filterKey}
            onChange={e => setFilterKey(e.target.value)}
          />
        </div>
        {filterKey && (
          <button style={S.btnSecondary} onClick={() => setFilterKey('')}>Clear filter</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: '2.5rem 0', fontWeight: 700 }}>Loading history…</div>
      ) : error ? (
        <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div>
      ) : history.length === 0 ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: '2.5rem 0', fontWeight: 600 }}>No history entries found.</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1.5px solid #cbd5e1', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Rule Key', 'Ver', 'Previous', 'New Value', 'Changed By', 'Reason', 'Timestamp', 'Action'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 800, color: '#4f46e5' }}>{e.rule_key}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>v{e.version}</td>
                  <td style={{ ...S.tdMono, color: '#64748b' }}>{e.old_value ?? '—'}</td>
                  <td style={{ ...S.tdMono, color: '#047857', fontWeight: 800 }}>{e.new_value}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{e.changed_by_name || 'System'}</td>
                  <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.reason}>{e.reason}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8rem' }}>
                    {new Date(e.changed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={S.td}>
                    {e.old_value != null && (
                      <button
                        style={{ ...S.btnIcon('#b45309'), display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 700, padding: '4px 8px' }}
                        onClick={() => setRollbackEntry(e)}
                        title="Roll back to this value"
                      >
                        <RollbackIcon style={{ width: 13 }} /> Revert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rollbackEntry && (
        <RollbackModal
          entry={rollbackEntry}
          onClose={() => setRollbackEntry(null)}
          onDone={() => { setRollbackEntry(null); load() }}
        />
      )}
    </>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function GovernanceRules() {
  const [tab, setTab] = useState('rules')
  const [historyKey, setHistoryKey] = useState('')

  function openHistory(key) {
    setHistoryKey(key)
    setTab('history')
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>
            <RulesIcon style={{ width: 22, display: 'inline', verticalAlign: 'middle', marginRight: 10, color: '#4f46e5' }} />
            Business Rules & Institutional Configuration
          </h1>
          <div style={S.sub}>
            Centralized governance control plane for platform thresholds, teaching period timetables, suggestion windows, and security gates.
          </div>
        </div>
      </div>

      <div style={S.tabs}>
        {[
          { id: 'rules', label: 'Business Rules', icon: <RulesIcon style={{ width: 15 }} /> },
          { id: 'history', label: 'Audit History & Rollbacks', icon: <HistoryIcon style={{ width: 15 }} /> },
        ].map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'rules' && <RulesTab onHistoryOpen={openHistory} />}
      {tab === 'history' && <HistoryTab filterKey={historyKey} setFilterKey={setHistoryKey} />}
    </div>
  )
}
