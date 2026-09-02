import { Modal } from '../../../components/ui'
import { getCategoryConfig, avatarColors, initialsOf, formatTransactionReason } from './utils'

function parseDetails(reasonText, category) {
  const details = {
    classText: null,
    dayOrder: null,
    period: null,
    subject: null,
  }
  if (!reasonText) return details

  const doMatch = reasonText.match(/Day Order\s+(\d+)/i) || reasonText.match(/DO\s*(\d+)/i)
  if (doMatch) details.dayOrder = `Day Order ${doMatch[1]}`

  const pMatch = reasonText.match(/period\s+(\d+)/i) || reasonText.match(/P\s*(\d+)/i)
  if (pMatch) details.period = `Period ${pMatch[1]}`

  const classMatch = reasonText.match(/in\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i) ||
                     reasonText.match(/for\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i)
  if (classMatch && !classMatch[1].toLowerCase().includes('teacher') && !classMatch[1].toLowerCase().includes('leave')) {
    details.classText = classMatch[1].trim()
  }

  const subjectMatch = reasonText.match(/subject\s+([\w\s\-\d]+)/i) || reasonText.match(/for\s+([\w\s\-\d]+)\s+class/i)
  if (subjectMatch) details.subject = subjectMatch[1].trim()

  return details
}

export default function TransactionModal({ tx, teacher, teacherMap = {}, open, onClose }) {
  if (!tx) return null

  const cat = getCategoryConfig(tx)
  const formattedReason = formatTransactionReason(tx.reason, teacherMap)
  const details = parseDetails(formattedReason, tx.category)
  const teacherName = teacher?.name || teacherMap[tx.teacher_id]?.name || `Teacher #${tx.teacher_id}`
  const teacherDept = teacher?.department || teacherMap[tx.teacher_id]?.department || 'Faculty'
  const c = avatarColors(teacherName)
  const txDate = new Date(tx.created_at)

  const isPositive = tx.change > 0

  return (
    <Modal open={open} onClose={onClose} title={`Transaction Record #TX-${tx.id}`}>
      <div className="space-y-4">
        {/* Header summary banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isPositive ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${cat.bgClass}`}>
              {cat.icon}
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cat.pillClass}`}>
                {cat.label}
              </span>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {tx.change > 0 ? `+${tx.change}` : tx.change} Credit{Math.abs(tx.change) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block font-bold">RECORD REF</span>
            <span className="text-xs font-mono font-bold text-slate-700">#TX-{tx.id}</span>
          </div>
        </div>

        {/* Teacher detail row */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${c.bg} ${c.text}`}>
            {initialsOf(teacherName)}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">{teacherName}</p>
            <p className="text-[11px] text-slate-500">{teacherDept}</p>
          </div>
        </div>

        {/* Structured context grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timestamp</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              {txDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at{' '}
              {txDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class / Batch</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              {details.classText || 'General Duty'}
            </span>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Day Order & Period</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              {[details.dayOrder, details.period].filter(Boolean).join(' • ') || 'Standard Slot'}
            </span>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject / Reference</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              {details.subject || (tx.related_leave_id ? `Leave #${tx.related_leave_id}` : 'Direct Posting')}
            </span>
          </div>
        </div>

        {/* Reason narrative */}
        {tx.reason && (
          <div className="p-3 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Audit Reason / Narrative
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {formattedReason}
            </p>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full btn-secondary text-xs py-2"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
