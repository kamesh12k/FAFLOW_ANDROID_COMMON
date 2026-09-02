import { useEffect, useState, useCallback } from 'react'
import { creditsApi, teachersApi, adminApi } from '../../../api/services'
import { Spinner, Modal, ErrorAlert } from '../../../components/ui'
import { useAuth } from '../../../context/AuthContext'
import { generateCreditPdfReport } from './pdfReportGenerator'
import { PrinterIcon, DownloadIcon } from '../../../components/icons'

import AttentionBanner from './AttentionBanner'
import BalanceTable from './BalanceTable'
import ActivityTimeline from './ActivityTimeline'
import CreditHistoryDrawer from './CreditHistoryDrawer'
import ExportBar from './ExportBar'

const CATEGORY_OPTIONS = [
  { value: 'substitute_class',  label: 'Substitute Class' },
  { value: 'exam_duty',         label: 'Exam Duty' },
  { value: 'department_duty',   label: 'Department Duty' },
  { value: 'workshop',          label: 'Workshop' },
  { value: 'event_coordination',label: 'Event Coordination' },
  { value: 'manual_adjustment', label: 'Manual Adjustment' },
  { value: 'penalty',           label: 'Penalty / Deduction' },
  { value: 'correction',        label: 'Correction / Undo' },
  { value: 'other',             label: 'Other' },
]

function RefreshIcon({ className = 'w-4 h-4', spinning }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={`${className} ${spinning ? 'animate-spin' : ''}`}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
    </svg>
  )
}

export default function AdminCredits() {
  const { user } = useAuth()
  const [report, setReport] = useState([])
  const [transactions, setTransactions] = useState([])
  const [allTeachers, setAllTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfToast, setPdfToast] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Single adjustment modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ teacher_id: '', change: '', reason: '', category: 'manual_adjustment' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Drawer state (credit history & balance explanation)
  const [drawerTeacher, setDrawerTeacher] = useState(null)

  const loadData = useCallback((silent = false) => {
    if (silent) setRefreshing(true)
    return Promise.all([
      creditsApi.report(),
      creditsApi.allTransactions(),
      teachersApi.list(),
    ])
      .then(([r, t, teachers]) => {
        setReport(r.data || [])
        setTransactions(t.data || [])
        setAllTeachers(teachers.data || [])
        setLastUpdated(new Date())
      })
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openAdjustModal = (teacher = null) => {
    const tid = teacher ? (teacher.teacher_id ?? teacher.id ?? '') : ''
    setForm({
      teacher_id: String(tid),
      change: '',
      reason: '',
      category: 'manual_adjustment',
    })
    setError('')
    setModalOpen(true)
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await creditsApi.adjust({
        teacher_id: Number(form.teacher_id),
        change: Number(form.change),
        reason: form.reason,
        category: form.category,
      })
      setModalOpen(false)
      setForm({ teacher_id: '', change: '', reason: '', category: 'manual_adjustment' })
      loadData(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to adjust credits.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to permanently clear all credit transactions and reset all teacher credit balances? This action cannot be undone.")) {
      return
    }
    setRefreshing(true)
    try {
      await adminApi.clearCreditsHistory()
      loadData(true)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to clear credits history.')
    } finally {
      setRefreshing(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    setPdfToast(null)
    try {
      const res = await generateCreditPdfReport({
        report,
        transactions,
        allTeachers,
        filterScope: {},
        currentUser: user || {},
      })
      if (!res.success && res.reason === 'NO_DATA') {
        setPdfToast({
          type: 'error',
          message: 'No credit data available. There are no credit records matching the current report.',
        })
      } else {
        setPdfToast({
          type: 'success',
          message: `Official credit report "${res.fileName}" generated successfully.`,
        })
      }
    } catch (err) {
      console.error('PDF report error:', err)
      setPdfToast({
        type: 'error',
        message: 'Failed to generate PDF report. Please try again.',
      })
    } finally {
      setGeneratingPdf(false)
      setTimeout(() => setPdfToast(null), 6000)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500">Loading Faculty Credit System…</p>
      </div>
    )
  }

  const totalCredits = report.reduce((acc, curr) => acc + (curr.balance || 0), 0)

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto pb-10">
      {/* ── Custom Print Stylesheet ── */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, .no-print, button {
            display: none !important;
          }
          .print-header {
            display: block !important;
          }
          .card, .bg-white {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* ── Print-Only Document Header ── */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              INSTITUTIONAL FACULTY CREDITS & AUDIT STATEMENT
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Comprehensive Master Ledger, Faculty Balances & Substitution History
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-slate-900 block text-sm">Total Faculty Pool</span>
            <span className="text-2xl font-extrabold font-mono text-slate-900">
              {totalCredits >= 0 ? `+${totalCredits}` : totalCredits} Credits
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Generated By</span>
            <span className="font-bold text-slate-900">{user?.name || 'Administrator'} (Admin)</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Total Teachers / Records</span>
            <span className="font-bold text-slate-900">{report.length} Teachers ({transactions.length} Total Tx)</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Statement Date</span>
            <span className="font-bold text-slate-900">{new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Compact Operational Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Faculty Credits
            </h1>
            {lastUpdated && (
              <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                Synced {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Department credit balance management, workload distribution, and audit verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshIcon className="w-3.5 h-3.5" spinning={refreshing} />
            Sync Data
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
            title="Print or Save Statement to PDF"
          >
            <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
            Print to PDF
          </button>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={generatingPdf || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Generate official institution PDF credit report"
          >
            {generatingPdf ? (
              <svg className="w-3.5 h-3.5 animate-spin text-primary-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {generatingPdf ? 'Generating PDF…' : 'Generate PDF'}
          </button>
          <button
            type="button"
            onClick={() => openAdjustModal()}
            className="btn-primary text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <span>+</span> Adjust Credits
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={refreshing}
            className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition disabled:opacity-40 cursor-pointer"
            title="Reset credit history"
          >
            Reset History
          </button>
        </div>
      </div>

      {/* ── Toast Notification Banner ── */}
      {pdfToast && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-2xs ${
          pdfToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{pdfToast.message}</span>
          <button
            type="button"
            onClick={() => setPdfToast(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 1. WHAT NEEDS MY ATTENTION? (Operational Banner) ── */}
      <AttentionBanner
        report={report}
        transactions={transactions}
        onReviewTeacher={(t) => setDrawerTeacher(t)}
      />

      {/* ── 2. PRIMARY WORK AREA: FACULTY CREDIT OVERVIEW (Sortable Table) ── */}
      <BalanceTable
        report={report}
        transactions={transactions}
        onViewHistory={(t) => setDrawerTeacher(t)}
        onAdjust={openAdjustModal}
      />

      {/* ── 3. RECENT CREDIT ACTIVITY & TRANSACTION AUDIT STREAM ── */}
      <ActivityTimeline
        transactions={transactions}
        report={report}
        allTeachers={allTeachers}
      />

      {/* ── 4. REPORTING & MASTER EXPORTS ── */}
      <ExportBar
        report={report}
        transactions={transactions}
        allTeachers={allTeachers}
      />

      {/* ── 5. TEACHER DETAIL DRAWER (Explainable Balance & Actions) ── */}
      {drawerTeacher && (
        <CreditHistoryDrawer
          teacher={drawerTeacher}
          transactions={transactions}
          allTeachers={allTeachers}
          onClose={() => setDrawerTeacher(null)}
          onAdjust={(t) => { setDrawerTeacher(null); openAdjustModal(t) }}
        />
      )}

      {/* ── 6. SINGLE ADJUSTMENT MODAL (Deliberate Admin Action) ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Manual Credit Adjustment">
        <form onSubmit={handleAdjust} className="space-y-4">
          <ErrorAlert message={error} />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Member</label>
            <select
              required
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition cursor-pointer"
              value={form.teacher_id}
              onChange={e => setForm({ ...form, teacher_id: e.target.value })}
            >
              <option value="">Select teacher…</option>
              {[...allTeachers]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(t => {
                  const creditEntry = report.find(r => r.teacher_id === t.id)
                  const balance = creditEntry ? creditEntry.balance : null
                  const balanceStr = balance !== null
                    ? ` — Balance: ${balance >= 0 ? '+' : ''}${balance}`
                    : ' — No credits yet'
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.department || 'Faculty'}){balanceStr}
                    </option>
                  )
                })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Credit Category</label>
            <select
              required
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition cursor-pointer"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Value</label>
            <input
              type="number"
              required
              placeholder="e.g. 1 to award, -1 to deduct"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
              value={form.change}
              onChange={e => setForm({ ...form, change: e.target.value })}
            />
            <p className="text-[11px] text-slate-500 mt-1">Positive number to add credits, negative number to deduct.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Adjustment</label>
            <textarea
              required
              placeholder="e.g. Exam invigilation duty cover..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition h-20 resize-none"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary flex-1 text-xs py-2 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 text-xs py-2 cursor-pointer"
            >
              {saving ? 'Applying…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
