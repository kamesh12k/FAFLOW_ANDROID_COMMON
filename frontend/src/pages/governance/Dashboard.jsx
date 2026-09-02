
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { governanceApi } from "../../api/services"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../components/ui/Toast"
import {
  GridIcon, UsersIcon, DocIcon, SwapIcon,
  CheckCircleIcon, AlertTriangleIcon, CloseIcon,
  RefreshIcon, ShieldIcon, SparklesIcon,
  ChevronUpIcon, ClockIcon, BellIcon, MenuIcon, CalIcon
} from "../../components/icons"

/* ─ LiveClock ─────────────────────────────────────────── */
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="text-center">
      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
        {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </p>
      <p className="text-2xl font-black text-white tracking-tight">
        {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
      </p>
    </div>
  )
}

/* ─ StatusDot ────────────────────────────────────────── */
function StatusDot({ ok }) {
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
}

/* ─ KpiCard ──────────────────────────────────────────── */
function KpiCard({ label, value, color = "indigo", icon: Icon, onClick, urgent }) {
  const C = {
    red:    "bg-red-50 border-red-200 text-red-600",
    amber:  "bg-amber-50 border-amber-200 text-amber-600",
    emerald:"bg-emerald-50 border-emerald-200 text-emerald-600",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-600",
  }[color] || "bg-slate-50 border-slate-200 text-slate-700"
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border ${C} ${urgent ? "ring-2 ring-red-300" : ""} active:scale-95 transition-transform touch-manipulation`}>
      {Icon && <Icon className="w-5 h-5 mb-2 opacity-70" />}
      <p className="text-3xl font-black leading-none">{value ?? "–"}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide mt-1.5 opacity-80">{label}</p>
    </button>
  )
}

/* ─ Emergency Override Modal ─────────────────────────── */
function EmergencyOverrideModal({ open, onClose, onConfirm, submitting }) {
  const [actionType, setActionType] = useState("override_substitution")
  const [targetId, setTargetId] = useState("")
  const [reason, setReason] = useState("")
  const ACTIONS = [
    { value: "override_substitution",  label: "Override Substitution" },
    { value: "override_5pm_cutoff",    label: "Override 5 PM Cutoff" },
    { value: "override_weekly_cap",    label: "Override Weekly Cap" },
    { value: "force_assignment",       label: "Force Assignment" },
    { value: "emergency_cancellation", label: "Emergency Cancellation" },
    { value: "general_emergency",      label: "General Emergency" },
  ]
  useEffect(() => { if (!open) { setReason(""); setTargetId("") } }, [open])
  if (!open) return null
  const ok = reason.trim().length >= 5 && !submitting
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-white" />
            <span className="font-black text-white uppercase tracking-wide text-sm">Governance Override</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white active:bg-red-700"><CloseIcon className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 leading-relaxed">You are about to bypass a normal system rule. This action is permanently audited.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Override Type</label>
            <select value={actionType} onChange={e => setActionType(e.target.value)} className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-400">
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Target ID <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
            <input type="number" value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="Leave / Substitution ID" className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Mandatory reason (min 5 characters)..." className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
            <p className={`text-[10px] mt-0.5 font-medium ${reason.trim().length >= 5 ? "text-emerald-600" : "text-slate-400"}`}>{reason.trim().length}/5 min chars</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 active:bg-slate-100 touch-manipulation">Cancel</button>
            <button onClick={() => onConfirm({ action_type: actionType, target_id: targetId ? Number(targetId) : null, reason: reason.trim() })} disabled={!ok} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black uppercase disabled:opacity-40 active:bg-red-700 touch-manipulation shadow-lg">
              {submitting ? "Executing..." : "Confirm Override"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─ Assign Substitute & Combine Class Modal ──────────────────────────── */
function AssignModal({ item, candidates, loading, onClose, onConfirm, submitting }) {
  const [mode, setMode] = useState("substitute") // "substitute" | "combine"
  const [selectedId, setSelectedId] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [reason, setReason] = useState("")
  const [capOverride, setCapOverride] = useState(false)
  const [cutoffOverride, setCutoffOverride] = useState(false)

  useEffect(() => {
    if (item) {
      setReason(`Governance allocation for ${item.class_name} P${item.period_number}`)
    }
  }, [item])

  const handleSelectCombineClass = (pc) => {
    setSelectedId(pc.teacher_id)
    setSelectedClassId(pc.class_id)
    setReason(`Combined ${item.class_name} with ${pc.class_name} under ${pc.teacher_name}`)
  }

  const handleSelectSubstitute = (c) => {
    setSelectedId(c.teacher_id)
    setSelectedClassId(null)
    setReason(`Governance substitute assignment: ${c.teacher_name || c.name} for ${item.class_name}`)
  }

  if (!item) return null
  const ok = selectedId && reason.trim() && !submitting

  const parallelClasses = candidates?.parallel_classes || []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg mx-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-black text-white text-sm uppercase">Cover Class · P{item.period_number}</p>
            <p className="text-indigo-200 text-[11px] font-medium">{item.class_name} · {item.subject || "Class"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500 text-white active:bg-indigo-700">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Substitute vs Combine Class */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5 flex-shrink-0">
          <button
            onClick={() => { setMode("substitute"); setSelectedClassId(null); setSelectedId(null) }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
              mode === "substitute"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            👤 Individual Substitute
          </button>
          <button
            onClick={() => { setMode("combine"); setSelectedClassId(null); setSelectedId(null) }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
              mode === "combine"
                ? "bg-white text-purple-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            👥 Combine Class ({parallelClasses.length})
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Target Absent Class Header */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Absent Faculty</p>
            <p className="font-black text-slate-800 text-sm">{item.absent_teacher}</p>
            <p className="text-xs text-slate-500">{item.class_name} · Period {item.period_number}</p>
          </div>

          {/* MODE 1: INDIVIDUAL SUBSTITUTE */}
          {mode === "substitute" && (
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Select Free Substitute Faculty</p>
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : candidates?.candidates?.length ? (
                <div className="space-y-2">
                  {candidates.candidates.map(c => (
                    <button
                      key={c.teacher_id}
                      onClick={() => handleSelectSubstitute(c)}
                      className={`w-full text-left p-3 rounded-xl border touch-manipulation active:scale-95 transition ${
                        selectedId === c.teacher_id && !selectedClassId
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{c.teacher_name || c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.department_name || c.department}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg flex-shrink-0 ${
                          c.score >= 80 ? "bg-emerald-100 text-emerald-700" : c.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        }`}>
                          {c.score}pts
                        </span>
                      </div>
                      {c.leave_recovery > 0 && (
                        <p className="text-[10px] text-indigo-600 font-bold mt-1">Leave recovery +{c.leave_recovery}pts</p>
                      )}
                      {c.reasons?.length > 0 && (
                        <p className="text-[10px] text-slate-500 mt-1">{c.reasons[0]}</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No free faculty available for this period.</p>
              )}
            </div>
          )}

          {/* MODE 2: COMBINE CLASS */}
          {mode === "combine" && (
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Select Parallel Active Class to Merge With</p>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Merge {item.class_name} with another section running in Period {item.period_number} under their active faculty.
              </p>
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : parallelClasses.length ? (
                <div className="space-y-2">
                  {parallelClasses.map(pc => (
                    <button
                      key={pc.slot_id}
                      onClick={() => handleSelectCombineClass(pc)}
                      className={`w-full text-left p-3 rounded-xl border touch-manipulation active:scale-95 transition ${
                        selectedClassId === pc.class_id
                          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-300"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 text-sm truncate">{pc.class_name}</span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">Faculty: <span className="font-bold">{pc.teacher_name}</span></p>
                          <p className="text-[10px] text-slate-400">{pc.subject_name || pc.subject_code || 'Subject'} {pc.room_number ? `· Room ${pc.room_number}` : ''}</p>
                        </div>
                        <span className="text-xs font-black text-purple-600 bg-purple-100 px-2 py-1 rounded-lg flex-shrink-0">Merge →</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500">No parallel active classes found in Period {item.period_number}.</p>
                </div>
              )}
            </div>
          )}

          {/* Audit Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Audit Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Override Checkboxes */}
          <div className="space-y-2">
            {[
              ["cap", "Override weekly substitution cap", capOverride, setCapOverride],
              ["5pm", "Override 5 PM cutoff restriction", cutoffOverride, setCutoffOverride]
            ].map(([k, lbl, v, s]) => (
              <label key={k} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer touch-manipulation">
                <input type="checkbox" checked={v} onChange={e => s(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <span className="text-xs font-medium text-slate-600">{lbl}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 active:bg-slate-100 touch-manipulation">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({
              leave_id: item.leave_id,
              substitute_teacher_id: selectedId,
              is_combined: mode === "combine",
              combined_with_class_id: selectedClassId,
              reason: reason.trim(),
              override_weekly_cap: capOverride,
              override_5pm_cutoff: cutoffOverride
            })}
            disabled={!ok}
            className={`flex-1 py-3 rounded-xl text-white text-sm font-black disabled:opacity-40 touch-manipulation transition ${
              mode === "combine"
                ? "bg-purple-600 active:bg-purple-700"
                : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {submitting ? "Processing..." : mode === "combine" ? "👥 Confirm Combine" : "Assign Substitute"}
          </button>
        </div>
      </div>
    </div>
  )
}


/* ─ More Drawer ──────────────────────────────────────── */
function MoreDrawer({ open, onClose, onNavigate, onLogout }) {
  const ITEMS = [
    { label: "Feed Timetable",  Icon: CalIcon,   to: "/governance/timetable" },
    { label: "Campus Calendar", Icon: CalIcon,   to: "/admin/academic-calendar" },
    { label: "Timetables",      Icon: CalIcon,   to: "/admin/class-timetable" },
    { label: "Live Substitutions", Icon: SwapIcon, to: "/admin/today-substitutions" },
    { label: "Leave Oversight", Icon: DocIcon,   to: "/admin/leaves" },
    { label: "Faculty Directory", Icon: UsersIcon, to: "/admin/teachers" },
    { label: "Departments",     Icon: GridIcon,  to: "/admin/departments" },
    { label: "Audit Log",       Icon: ClockIcon, tab: "audit" },
    { label: "Alerts & Health", Icon: BellIcon,  tab: "alerts" },
    { label: "Emergency Override", Icon: ShieldIcon, override: true },
  ]
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
        <div className="px-5 py-2 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Governance Navigation</p>
          <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">Close</button>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3 overflow-y-auto">
          {ITEMS.map((item, idx) => {
            const Icon = item.Icon
            return (
              <button
                key={idx}
                onClick={() => {
                  onNavigate(item)
                  onClose()
                }}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 active:bg-slate-100 hover:border-indigo-200 touch-manipulation transition-colors"
              >
                <Icon className="w-6 h-6 text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{item.label}</span>
              </button>
            )
          })}
        </div>
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex-shrink-0">
          <button onClick={onLogout} className="w-full py-3 rounded-xl border border-red-200 text-red-600 bg-white text-sm font-bold active:bg-red-50 touch-manipulation shadow-xs">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─ Tab: Home ────────────────────────────────────────── */
function HomeTab({ data, refreshing, onOpenAssign, onOpenOverride, onSwitchTab }) {
  const { critical_status, college_snapshot, needs_cover_items = [], system_health = {} } = data || {}
  const needsCover = critical_status?.needs_cover_count ?? 0
  const onLeave    = college_snapshot?.on_leave ?? 0
  const available  = college_snapshot?.available ?? 0
  const overrides  = critical_status?.overrides_today ?? 0
  const hasCritical = needsCover > 0
  return (
    <div className="space-y-5 pb-24">
      {/* Hero */}
      <div className={`rounded-2xl p-5 border ${hasCritical ? "bg-red-600 border-red-700" : "bg-slate-900 border-slate-800"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasCritical ? "bg-white animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Command Center</span>
          </div>
          {refreshing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        </div>
        <LiveClock />
        {hasCritical
          ? <div className="mt-4 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2"><AlertTriangleIcon className="w-4 h-4 text-white flex-shrink-0" /><p className="text-xs font-bold text-white">{needsCover} {needsCover === 1 ? "class needs" : "classes need"} cover right now</p></div>
          : <div className="mt-4 flex items-center gap-2 bg-emerald-500/20 rounded-xl px-3 py-2"><CheckCircleIcon className="w-4 h-4 text-emerald-300 flex-shrink-0" /><p className="text-xs font-bold text-emerald-200">All clear — no urgent issues</p></div>
        }
      </div>
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Need Cover"     value={needsCover} color={needsCover > 0 ? "red" : "emerald"} icon={AlertTriangleIcon} urgent={needsCover > 0} onClick={() => onSwitchTab("subs")} />
        <KpiCard label="On Leave"       value={onLeave}    color="amber"   icon={DocIcon}    onClick={() => onSwitchTab("alerts")} />
        <KpiCard label="Available"      value={available}  color="emerald" icon={UsersIcon}  onClick={() => onSwitchTab("alerts")} />
        <KpiCard label="Overrides Today" value={overrides} color="indigo"  icon={ShieldIcon} onClick={onOpenOverride} />
      </div>
      {/* Needs cover top-3 */}
      {needs_cover_items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Needs Cover Now</p>
            {needs_cover_items.length > 3 && <button onClick={() => onSwitchTab("subs")} className="text-[11px] font-bold text-indigo-600 touch-manipulation">View all {needs_cover_items.length} →</button>}
          </div>
          <div className="space-y-2">
            {needs_cover_items.slice(0, 3).map((item, i) => (
              <div key={i} className="bg-white border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-800 truncate">P{item.period_number} · {item.class_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.absent_teacher} · {item.subject || "—"}</p>
                </div>
                <button onClick={() => onOpenAssign(item)} className="flex-shrink-0 px-3 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-xl active:bg-indigo-700 touch-manipulation">Cover / Combine</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Quick Actions */}
      <div>
        <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="space-y-2">
          {/* Feed Timetable — featured prominently */}
          <button onClick={() => onNavigate({ to: "/governance/timetable" })} className="w-full text-left p-3.5 rounded-xl border bg-indigo-600 border-indigo-700 text-white active:bg-indigo-700 touch-manipulation">
            <div className="flex items-center gap-2">
              <CalIcon className="w-4 h-4" />
              <div>
                <p className="font-black text-sm uppercase tracking-wide">Feed Timetable</p>
                <p className="text-[11px] text-indigo-200 mt-0.5">Quickly fill class schedules — class-first view</p>
              </div>
            </div>
          </button>
          {[
            { label: "View Needs Cover",     desc: "Classes awaiting substitution", tab: "subs",   cls: "bg-red-50 border-red-200 text-red-700" },
            { label: "Faculty Availability", desc: "Check who is available today",  tab: "alerts", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { label: "Today's Leave",        desc: "View active leave requests",    tab: "alerts", cls: "bg-amber-50 border-amber-200 text-amber-700" },
          ].map(({ label, desc, tab, cls }) => (
            <button key={label} onClick={() => onSwitchTab(tab)} className={`w-full text-left p-3.5 rounded-xl border ${cls} active:opacity-70 touch-manipulation`}>
              <p className="font-bold text-sm">{label}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{desc}</p>
            </button>
          ))}
          <button onClick={onOpenOverride} className="w-full text-left p-3.5 rounded-xl border bg-red-600 border-red-700 text-white active:bg-red-700 touch-manipulation">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4" />
              <div>
                <p className="font-black text-sm uppercase tracking-wide">Emergency Override</p>
                <p className="text-[11px] text-red-200 mt-0.5">Bypass system rules with mandatory audit</p>
              </div>
            </div>
          </button>
        </div>
      </div>
      {/* System health */}
      <div>
        <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">System Status</p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {Object.entries(system_health).length > 0
            ? Object.entries(system_health).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-slate-700 capitalize">{k.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-1.5"><StatusDot ok={v?.status === "operational" || v === "operational"} /><span className="text-[11px] text-slate-500 capitalize">{v?.status || "Operational"}</span></div>
                </div>
              ))
            : [["API", true], ["Database", true], ["Auth", true], ["Engine", true]].map(([k]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{k}</span>
                  <div className="flex items-center gap-1.5"><StatusDot ok /><span className="text-[11px] text-slate-500">Operational</span></div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

/* ─ Tab: Alerts ──────────────────────────────────────── */
function AlertsTab({ data }) {
  const { college_snapshot, extended_leaves = [], departments_health = [] } = data || {}
  return (
    <div className="space-y-5 pb-24">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Available", value: college_snapshot?.available ?? 0, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { label: "On Leave",  value: college_snapshot?.on_leave ?? 0,  cls: "text-amber-600 bg-amber-50 border-amber-200" },
          { label: "Pending",   value: college_snapshot?.pending_leave ?? 0, cls: "text-indigo-600 bg-indigo-50 border-indigo-200" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`p-3 rounded-xl border text-center ${cls}`}>
            <p className="text-2xl font-black">{value ?? "–"}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {extended_leaves.length > 0 && (
        <div>
          <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Extended Leaves (3+ Days)</p>
          <div className="space-y-2">
            {extended_leaves.map((l, i) => (
              <div key={i} className="bg-white border border-amber-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-bold text-slate-800 text-sm">{l.teacher_name}</p><p className="text-[11px] text-slate-500">{l.department}</p></div>
                  <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg flex-shrink-0">{l.days_count}d</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{l.from_date} to {l.to_date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {departments_health.length > 0 && (
        <div>
          <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Department Health</p>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {departments_health.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div><p className="text-sm font-bold text-slate-800">{d.department_name}</p><p className="text-[11px] text-slate-400">{d.available_count}/{d.total_faculty} available</p></div>
                <StatusDot ok={!d.attention_required} />
              </div>
            ))}
          </div>
        </div>
      )}
      {!extended_leaves.length && !departments_health.length && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <CheckCircleIcon className="w-10 h-10 mb-3 text-emerald-400" />
          <p className="text-sm font-bold">No critical alerts</p>
          <p className="text-xs mt-1">All departments operating normally</p>
        </div>
      )}
    </div>
  )
}

/* ─ Tab: Subs ────────────────────────────────────────── */
function SubsTab({ data, onOpenAssign }) {
  const { needs_cover_items = [], substitution_engine } = data || {}
  const stats = substitution_engine?.stats || {}
  return (
    <div className="space-y-5 pb-24">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Assigned",   value: stats.assigned_today ?? 0,   cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { label: "Pending",    value: stats.pending_today ?? 0,    cls: "text-amber-600 bg-amber-50 border-amber-200" },
          { label: "Overridden", value: stats.overridden_today ?? 0, cls: "text-indigo-600 bg-indigo-50 border-indigo-200" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`p-3 rounded-xl border text-center ${cls}`}>
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {needs_cover_items.length > 0 ? (
        <div>
          <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Needs Cover — {needs_cover_items.length}</p>
          <div className="space-y-2">
            {needs_cover_items.map((item, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div><p className="font-black text-slate-800">P{item.period_number} · {item.class_name}</p><p className="text-xs text-slate-500 mt-0.5">{item.subject || "—"}</p></div>
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg flex-shrink-0">Needs Cover</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Absent Faculty</p>
                <p className="text-sm font-bold text-slate-700 mb-3">{item.absent_teacher}</p>
                <button onClick={() => onOpenAssign(item)} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl active:bg-indigo-700 touch-manipulation">Assign Substitute or Combine Class</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <CheckCircleIcon className="w-10 h-10 mb-3 text-emerald-400" />
          <p className="text-sm font-bold">No substitutions needed</p>
          <p className="text-xs mt-1">All classes are covered</p>
        </div>
      )}
    </div>
  )
}

/* ─ Tab: Audit ───────────────────────────────────────── */
function AuditTab({ data }) {
  const activity = data?.recent_activity || []
  if (!activity.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400 pb-24">
      <ClockIcon className="w-10 h-10 mb-3" />
      <p className="text-sm font-bold">No recent activity</p>
    </div>
  )
  return (
    <div className="space-y-3 pb-24">
      <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Recent Audit Activity</p>
      {activity.map((e, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="font-bold text-slate-800 text-sm capitalize">{e.action?.replace(/_/g, " ") || "Action"}</p>
              <p className="text-[11px] text-indigo-600 font-medium">{e.entity_type} #{e.entity_id}</p>
            </div>
            <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">{e.timestamp || e.created_at || "—"}</span>
          </div>
          {e.actor_name && <p className="text-[11px] text-slate-500">By <span className="font-bold">{e.actor_name}</span></p>}
          {e.description && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{e.description}</p>}
        </div>
      ))}
    </div>
  )
}

/* ─ Main ─────────────────────────────────────────────── */
const TABS = [
  { id: "home",   label: "Home",   Icon: GridIcon },
  { id: "alerts", label: "Alerts", Icon: AlertTriangleIcon },
  { id: "subs",   label: "Subs",   Icon: SwapIcon },
  { id: "more",   label: "More",   Icon: MenuIcon },
]

export default function GovernanceDashboard() {
  const { logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [networkError, setNetworkError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [activeTab, setActiveTab] = useState("home")
  const [moreOpen, setMoreOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)
  const [assignItem, setAssignItem] = useState(null)
  const [candidatesData, setCandidatesData] = useState(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  const loadOverview = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true)
      setNetworkError(false)
      const res = await governanceApi.getOverview()
      setData(res.data)
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }))
    } catch {
      if (!silent) setNetworkError(true); else toast.error("Refresh failed.")
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    loadOverview()
    const t = setInterval(() => loadOverview(true), 45000)
    return () => clearInterval(t)
  }, [loadOverview])

  const handleOpenAssign = async (item) => {
    setAssignItem(item); setCandidatesData(null)
    try { setCandidatesLoading(true); const r = await governanceApi.getCandidates(item.leave_id); setCandidatesData(r.data) }
    catch { toast.error("Failed to load candidates.") }
    finally { setCandidatesLoading(false) }
  }

  const handleConfirmAssign = async (payload) => {
    try { setAssignSubmitting(true); const r = await governanceApi.assignSubstitute(payload); toast.success(r.data.message || "Assigned."); setAssignItem(null); loadOverview(true) }
    catch (e) { toast.error(e.response?.data?.detail || "Assignment failed.") }
    finally { setAssignSubmitting(false) }
  }

  const handleConfirmOverride = async (payload) => {
    if (!payload.reason || payload.reason.length < 5) { toast.warning("Reason must be at least 5 characters."); return }
    try { setOverrideSubmitting(true); const r = await governanceApi.emergencyOverride(payload); toast.success(r.data.message || "Override executed."); setOverrideOpen(false); loadOverview(true) }
    catch (e) { toast.error(e.response?.data?.detail || "Override failed.") }
    finally { setOverrideSubmitting(false) }
  }

  const handleMoreNav = (item) => {
    if (item.to) {
      navigate(item.to)
    } else if (item.tab) {
      setActiveTab(item.tab)
    } else if (item.override) {
      setOverrideOpen(true)
    }
  }

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 gap-4">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Command Center</p>
    </div>
  )

  if (networkError && !data) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-6 gap-5">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangleIcon className="w-7 h-7 text-red-600" /></div>
      <div className="text-center"><p className="font-black text-slate-800 text-lg">Unable to Connect</p><p className="text-sm text-slate-500 mt-1">Unable to connect to the server.</p></div>
      <button onClick={() => loadOverview()} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl active:bg-indigo-700 touch-manipulation">Retry</button>
    </div>
  )

  const needsCoverCount = data?.critical_status?.needs_cover_count ?? 0
  const hasAlerts = needsCoverCount > 0 || (data?.extended_leaves?.length ?? 0) > 0

  return (
    <>
      <div className="flex flex-col min-h-screen bg-slate-50">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-900 flex items-center justify-between px-4 py-3 shadow-md">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-white text-sm tracking-tight">GOVERNANCE</span>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && <span className="text-[10px] text-slate-500 hidden sm:inline">Updated {lastUpdated}</span>}
            <button onClick={() => loadOverview(true)} disabled={refreshing} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 active:bg-slate-700 touch-manipulation">
              <RefreshIcon className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button onClick={() => setOverrideOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 rounded-xl text-white text-[11px] font-black uppercase tracking-wide active:bg-red-700 touch-manipulation">
              <ShieldIcon className="w-3.5 h-3.5" />Override
            </button>
            <button onClick={() => setActiveTab("alerts")} className="relative w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 active:bg-slate-700 touch-manipulation">
              <BellIcon className="w-4 h-4" />
              {hasAlerts && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{needsCoverCount > 9 ? "9+" : needsCoverCount || "!"}</span>}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-4">
          {activeTab === "home"   && <HomeTab   data={data} refreshing={refreshing} onOpenAssign={handleOpenAssign} onOpenOverride={() => setOverrideOpen(true)} onSwitchTab={setActiveTab} />}
          {activeTab === "alerts" && <AlertsTab data={data} />}
          {activeTab === "subs"   && <SubsTab   data={data} onOpenAssign={handleOpenAssign} />}
          {activeTab === "audit"  && <AuditTab  data={data} />}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            const badge = id === "alerts" && hasAlerts
            return (
              <button key={id} onClick={() => id === "more" ? setMoreOpen(true) : setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 touch-manipulation ${active ? "text-indigo-600" : "text-slate-400 active:text-slate-600"}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge && <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{needsCoverCount > 9 ? "9+" : needsCoverCount || "!"}</span>}
                </div>
                <span className={`text-[10px] font-bold ${active ? "text-indigo-600" : "text-slate-400"}`}>{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <EmergencyOverrideModal open={overrideOpen} onClose={() => setOverrideOpen(false)} onConfirm={handleConfirmOverride} submitting={overrideSubmitting} />
      <AssignModal item={assignItem} candidates={candidatesData} loading={candidatesLoading} onClose={() => setAssignItem(null)} onConfirm={handleConfirmAssign} submitting={assignSubmitting} />
      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} onNavigate={handleMoreNav} onLogout={() => { logout(); navigate("/login") }} />
    </>
  )
}
