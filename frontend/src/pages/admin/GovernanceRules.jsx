/**
 * GovernanceRules.jsx — Business Rules & Period Config Control Plane
 *
 * Provides a full-featured admin UI for:
 * - Viewing and editing all configurable business rules (grouped by category)
 * - Live validation preview before committing a change
 * - Immutable audit history with rollback capability
 * - Period schedule management (drag-edit times, add/remove periods)
 * - Security gates clearly marked (biometric/GPS thresholds)
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { governanceApi } from '../../api/governanceApi'
import { getApiErrorMessage } from '../../api/client'

/* ─── Inline SVG Icons ─────────────────────────────────────────────────── */
function RulesIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg> }
function ClockIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function HistoryIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg> }
function ShieldIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z"/></svg> }
function EditIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function ResetIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg> }
function RollbackIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg> }
function CheckIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg> }
function XIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function SearchIcon(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }

/* ─── Category metadata ─────────────────────────────────────────────────── */
const CATEGORY_META = {
  class_suggestion:    { label: 'Class Suggestions',         color: '#6366f1' },
  student_attendance:  { label: 'Student Attendance',        color: '#0ea5e9' },
  biometrics:          { label: 'Biometrics & Security',     color: '#ef4444' },
  geofencing:          { label: 'Geofencing',                color: '#f59e0b' },
  leave:               { label: 'Leave Management',          color: '#8b5cf6' },
  substitution:        { label: 'Substitutions',             color: '#10b981' },
  credits:             { label: 'Credit System',             color: '#f97316' },
  risk:                { label: 'Risk & Intelligence',       color: '#ec4899' },
  limits:              { label: 'System Limits',             color: '#64748b' },
}

const SEVERITY_META = {
  low:      { label: 'Low',      bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  normal:   { label: 'Normal',   bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  high:     { label: 'High',     bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  critical: { label: 'Critical', bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
}

/* ─── Shared styles ─────────────────────────────────────────────────────── */
const S = {
  page:   { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' },
  h1:     { fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9', margin: 0 },
  sub:    { color: '#94a3b8', fontSize: '0.82rem', marginTop: 2 },

  tabs:   { display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.5rem', overflowX: 'auto' },
  tab:    (active) => ({
    padding: '0.55rem 1rem', fontSize: '0.83rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#818cf8' : '#64748b',
    borderBottom: active ? '2px solid #818cf8' : '2px solid transparent',
    transition: 'all 0.18s', whiteSpace: 'nowrap',
  }),

  searchBar: { position: 'relative', marginBottom: '1rem' },
  searchInput: {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#f1f5f9', padding: '0.5rem 0.75rem 0.5rem 2.2rem',
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  },
  searchIcon: { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b', width: 14 },

  categorySection: { marginBottom: '1.5rem' },
  categoryHeader: (color) => ({
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem',
    padding: '0.5rem 0.75rem', borderRadius: 8,
    background: `linear-gradient(90deg, ${color}22, transparent)`,
    borderLeft: `3px solid ${color}`,
  }),
  categoryLabel: { fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' },

  card: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.5rem',
    transition: 'border-color 0.15s',
  },
  cardModified: { borderColor: 'rgba(129,140,248,0.35)', background: 'rgba(129,140,248,0.04)' },
  cardSecurity: { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' },

  ruleRow:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  ruleInfo:  { flex: 1, minWidth: 220 },
  ruleName:  { fontWeight: 600, fontSize: '0.88rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 },
  ruleDesc:  { fontSize: '0.78rem', color: '#64748b', marginTop: 2 },
  ruleMeta:  { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge:     (bg, text) => ({
    padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
    background: bg, color: text,
  }),

  ruleValue: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  valueDisplay: {
    padding: '0.3rem 0.7rem', borderRadius: 6, background: 'rgba(255,255,255,0.07)',
    fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', minWidth: 60, textAlign: 'center',
    fontFamily: 'monospace',
  },
  unitLabel: { color: '#64748b', fontSize: '0.75rem' },

  btnIcon: (color='#64748b') => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6,
    color, transition: 'background 0.15s, color 0.15s',
  }),

  // Modal styles
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  modal: {
    background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
    padding: '1.5rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  },
  modalTitle: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' },
  label: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#f1f5f9', padding: '0.55rem 0.75rem', fontSize: '0.87rem',
    outline: 'none', boxSizing: 'border-box', marginBottom: '0.85rem',
  },
  textarea: {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#f1f5f9', padding: '0.55rem 0.75rem', fontSize: '0.87rem',
    outline: 'none', boxSizing: 'border-box', marginBottom: '0.85rem', resize: 'vertical', minHeight: 72,
    fontFamily: 'inherit',
  },
  btnRow: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnSecondary: {
    padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600,
  },
  btnPrimary: {
    padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
    cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700,
  },
  btnDanger: {
    padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
    cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700,
  },

  preview: (valid) => ({
    borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '0.85rem',
    fontSize: '0.8rem',
    background: valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
    border: `1px solid ${valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    color: valid ? '#34d399' : '#f87171',
  }),

  // History table
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { textAlign: 'left', padding: '0.45rem 0.6rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  td: { padding: '0.45rem 0.6rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tdMono: { fontFamily: 'monospace', padding: '0.45rem 0.6rem', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.04)' },

  // Period editor
  periodGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 },
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
    // Auto-validate after 400ms of no typing
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      governanceApi.validateRule(rule.key, value)
        .then(r => setPreview(r.data))
        .catch(() => setPreview(null))
    }, 400)
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
            <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{rule.description}</div>
          </div>
          <button onClick={onClose} style={S.btnIcon('#64748b')}><XIcon style={{ width: 16 }} /></button>
        </div>

        {rule.security_critical && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.85rem', color: '#f87171', fontSize: '0.78rem', display: 'flex', gap: 6, alignItems: 'center' }}>
            <ShieldIcon style={{ width: 14, flexShrink: 0 }} />
            <span><strong>Security-critical rule.</strong> Affects biometric or location verification. Changes take effect immediately.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <span style={S.badge('rgba(99,102,241,0.15)', '#818cf8')}>type: {rule.data_type}</span>
          {rule.unit && <span style={S.badge('rgba(255,255,255,0.06)', '#94a3b8')}>unit: {rule.unit}</span>}
          {rule.minimum != null && <span style={S.badge('rgba(255,255,255,0.06)', '#94a3b8')}>min: {rule.minimum}</span>}
          {rule.maximum != null && <span style={S.badge('rgba(255,255,255,0.06)', '#94a3b8')}>max: {rule.maximum}</span>}
          <span style={S.badge('rgba(255,255,255,0.06)', '#64748b')}>default: {rule.default_value}</span>
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

        <label style={S.label}>Reason for change (required)</label>
        <textarea
          style={S.textarea}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe why this change is being made..."
        />

        {error && <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: 8 }}>{error}</div>}

        <div style={S.btnRow}>
          <button style={S.btnSecondary} onClick={handleReset} disabled={saving} title="Reset to factory default">
            <ResetIcon style={{ width: 13, marginRight: 4 }} />Default
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
      <div style={{ ...S.modal, maxWidth: 420 }}>
        <div style={S.modalTitle}>Roll Back: {entry.rule_key}</div>
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
          This will restore the rule to <strong style={{ color: '#f1f5f9' }}>{entry.old_value ?? '[initial value]'}</strong> (before version {entry.version}).
        </div>
        <label style={S.label}>Reason</label>
        <input style={S.input} value={reason} onChange={e => setReason(e.target.value)} />
        {error && <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: 8 }}>{error}</div>}
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
      <div style={{ ...S.modal, maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={S.modalTitle}>Period Schedule</div>
          <button onClick={onClose} style={S.btnIcon('#64748b')}><XIcon style={{ width: 16 }} /></button>
        </div>
        <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1rem' }}>
          Edit institutional period start/end times. Changes take effect immediately across all services.
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0' }}>Loading periods…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px', gap: 8, marginBottom: 4 }}>
              {['#', 'Name', 'Start', 'End', 'Enabled'].map(h => (
                <div key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {periods.map((p, i) => (
              <div key={p.period_number} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#818cf8', fontFamily: 'monospace', fontSize: '0.88rem' }}>P{p.period_number}</div>
                <input
                  style={{ ...S.input, marginBottom: 0 }}
                  value={p.name}
                  onChange={e => update(i, 'name', e.target.value)}
                />
                <input
                  style={{ ...S.input, marginBottom: 0, fontFamily: 'monospace' }}
                  value={p.start_time}
                  onChange={e => update(i, 'start_time', e.target.value)}
                  placeholder="HH:MM"
                />
                <input
                  style={{ ...S.input, marginBottom: 0, fontFamily: 'monospace' }}
                  value={p.end_time}
                  onChange={e => update(i, 'end_time', e.target.value)}
                  placeholder="HH:MM"
                />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={p.is_enabled} onChange={e => update(i, 'is_enabled', e.target.checked)} />
                </div>
              </div>
            ))}
          </>
        )}
        {error && <div style={{ color: '#f87171', fontSize: '0.78rem', margin: '0.5rem 0' }}>{error}</div>}
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

  if (loading) return <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0' }}>Loading rules…</div>
  if (error) return <div style={{ color: '#f87171', padding: '1rem' }}>{error}</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ ...S.searchBar, flex: 1, minWidth: 200, marginBottom: 0 }}>
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
          style={{ ...S.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <ClockIcon style={{ width: 14 }} /> Period Schedule
        </button>
      </div>

      {Object.entries(grouped).map(([cat, catRules]) => {
        const meta = CATEGORY_META[cat] || { label: cat, color: '#64748b' }
        return (
          <div key={cat} style={S.categorySection}>
            <div style={S.categoryHeader(meta.color)}>
              <span style={{ ...S.categoryLabel, color: meta.color }}>{meta.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}>{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
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
                        {isSecurity && <ShieldIcon style={{ width: 13, color: '#ef4444', flexShrink: 0 }} />}
                        {rule.display_name}
                        {isModified && <span style={{ fontSize: '0.65rem', background: 'rgba(129,140,248,0.2)', color: '#818cf8', padding: '0.1rem 0.35rem', borderRadius: 3, fontWeight: 600 }}>MODIFIED</span>}
                      </div>
                      <div style={S.ruleDesc}>{rule.description}</div>
                      <div style={S.ruleMeta}>
                        <span style={S.badge(sevMeta.bg, sevMeta.text)}>{sevMeta.label}</span>
                        <span style={S.badge('rgba(255,255,255,0.05)', '#64748b')}>{rule.data_type}</span>
                        {rule.unit && <span style={{ ...S.unitLabel }}>({rule.unit})</span>}
                        {rule.affected_modules?.slice(0, 2).map(m => (
                          <span key={m} style={S.badge('rgba(255,255,255,0.04)', '#475569')}>{m}</span>
                        ))}
                        <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '0.7rem' }}>v{rule.version}</span>
                      </div>
                    </div>

                    <div style={S.ruleValue}>
                      <div>
                        <div style={S.valueDisplay}>{rule.value}</div>
                        {isModified && (
                          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
                            default: {rule.default_value}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          style={S.btnIcon('#818cf8')}
                          onClick={() => setEditRule(rule)}
                          title="Edit rule"
                        >
                          <EditIcon style={{ width: 15 }} />
                        </button>
                        <button
                          style={S.btnIcon('#64748b')}
                          onClick={() => onHistoryOpen(rule.key)}
                          title="View history"
                        >
                          <HistoryIcon style={{ width: 15 }} />
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
          onSaved={() => { setShowPeriods(false) }}
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
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ ...S.searchBar, flex: 1, minWidth: 200, marginBottom: 0 }}>
          <SearchIcon style={{ ...S.searchIcon }} />
          <input
            style={S.searchInput}
            placeholder="Filter by rule key…"
            value={filterKey}
            onChange={e => setFilterKey(e.target.value)}
          />
        </div>
        {filterKey && (
          <button style={S.btnSecondary} onClick={() => setFilterKey('')}>Clear filter</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>Loading history…</div>
      ) : error ? (
        <div style={{ color: '#f87171' }}>{error}</div>
      ) : history.length === 0 ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No history entries found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Rule', 'v', 'Before', 'After', 'By', 'Reason', 'Date', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(e => (
                <tr key={e.id} style={{ ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.75rem', color: '#818cf8' }}>{e.rule_key}</td>
                  <td style={S.td}>{e.version}</td>
                  <td style={{ ...S.tdMono, color: '#94a3b8' }}>{e.old_value ?? '—'}</td>
                  <td style={{ ...S.tdMono, color: '#34d399' }}>{e.new_value}</td>
                  <td style={S.td}>{e.changed_by_name || 'System'}</td>
                  <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.reason}>{e.reason}</td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#64748b' }}>
                    {new Date(e.changed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={S.td}>
                    {e.old_value != null && (
                      <button
                        style={{ ...S.btnIcon('#f59e0b'), display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', padding: '3px 7px' }}
                        onClick={() => setRollbackEntry(e)}
                        title="Roll back to this value"
                      >
                        <RollbackIcon style={{ width: 12 }} /> Revert
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
            <RulesIcon style={{ width: 20, display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#818cf8' }} />
            Business Rules & Configuration
          </h1>
          <div style={S.sub}>
            Centralized control plane for all platform thresholds, timings, limits, and period schedules.
            All changes are version-controlled with full audit history.
          </div>
        </div>
      </div>

      <div style={S.tabs}>
        {[
          { id: 'rules', label: 'Rules', icon: <RulesIcon style={{ width: 13 }} /> },
          { id: 'history', label: 'Audit History', icon: <HistoryIcon style={{ width: 13 }} /> },
        ].map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'rules' && <RulesTab onHistoryOpen={openHistory} />}
      {tab === 'history' && <HistoryTab filterKey={historyKey} setFilterKey={setHistoryKey} />}
    </div>
  )
}
