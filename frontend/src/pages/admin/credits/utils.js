// credits/utils.js — Shared helpers for the Credits Dashboard

// --- Category Config ---

export const CATEGORY_CONFIG = {
  substitute_class: {
    label: "Substitution Covered",
    icon: "🔄",
    type: "credit",
    color: "emerald",
    bgClass: "bg-emerald-50 border-emerald-200 text-emerald-800",
    pillClass: "bg-emerald-100 text-emerald-800 border-emerald-200/80 font-bold",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  leave_deduction: {
    label: "Leave Taken",
    icon: "🏖️",
    type: "deduction",
    color: "rose",
    bgClass: "bg-rose-50 border-rose-200 text-rose-800",
    pillClass: "bg-rose-100 text-rose-800 border-rose-200/80 font-bold",
    textClass: "text-rose-700",
    borderClass: "border-rose-200",
    dotClass: "bg-rose-500",
  },
  exam_duty: {
    label: "Exam Duty",
    icon: "📝",
    type: "credit",
    color: "sky",
    bgClass: "bg-sky-50 border-sky-200 text-sky-800",
    pillClass: "bg-sky-100 text-sky-800 border-sky-200/80 font-bold",
    textClass: "text-sky-700",
    borderClass: "border-sky-200",
    dotClass: "bg-sky-500",
  },
  department_duty: {
    label: "Department Duty",
    icon: "🏛️",
    type: "credit",
    color: "indigo",
    bgClass: "bg-indigo-50 border-indigo-200 text-indigo-800",
    pillClass: "bg-indigo-100 text-indigo-800 border-indigo-200/80 font-bold",
    textClass: "text-indigo-700",
    borderClass: "border-indigo-200",
    dotClass: "bg-indigo-500",
  },
  workshop: {
    label: "Workshop / Training",
    icon: "🔧",
    type: "credit",
    color: "amber",
    bgClass: "bg-amber-50 border-amber-200 text-amber-800",
    pillClass: "bg-amber-100 text-amber-800 border-amber-200/80 font-bold",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
    dotClass: "bg-amber-500",
  },
  event_coordination: {
    label: "Event Coordination",
    icon: "🎯",
    type: "credit",
    color: "purple",
    bgClass: "bg-purple-50 border-purple-200 text-purple-800",
    pillClass: "bg-purple-100 text-purple-800 border-purple-200/80 font-bold",
    textClass: "text-purple-700",
    borderClass: "border-purple-200",
    dotClass: "bg-purple-500",
  },
  manual_adjustment: {
    label: "Admin Adjustment",
    icon: "⚙️",
    type: "neutral",
    color: "violet",
    bgClass: "bg-violet-50 border-violet-200 text-violet-800",
    pillClass: "bg-violet-100 text-violet-800 border-violet-200/80 font-bold",
    textClass: "text-violet-700",
    borderClass: "border-violet-200",
    dotClass: "bg-violet-500",
  },
  penalty: {
    label: "Absence Penalty",
    icon: "📉",
    type: "deduction",
    color: "red",
    bgClass: "bg-red-50 border-red-200 text-red-800",
    pillClass: "bg-red-100 text-red-800 border-red-200/80 font-bold",
    textClass: "text-red-700",
    borderClass: "border-red-200",
    dotClass: "bg-red-500",
  },
  correction: {
    label: "Data Correction",
    icon: "↩️",
    type: "neutral",
    color: "slate",
    bgClass: "bg-slate-50 border-slate-200 text-slate-800",
    pillClass: "bg-slate-100 text-slate-700 border-slate-200 font-bold",
    textClass: "text-slate-600",
    borderClass: "border-slate-200",
    dotClass: "bg-slate-400",
  },
  other: {
    label: "General Record",
    icon: "📋",
    type: "neutral",
    color: "gray",
    bgClass: "bg-gray-50 border-gray-200 text-gray-800",
    pillClass: "bg-gray-100 text-gray-700 border-gray-200 font-bold",
    textClass: "text-gray-600",
    borderClass: "border-gray-200",
    dotClass: "bg-gray-400",
  },
}

export function formatTransactionReason(reason, teacherMap = {}) {
  if (!reason) return ''
  return reason.replace(/(?:teacher\s+#?(\d+))/gi, (match, id) => {
    const t = teacherMap[id] || teacherMap[Number(id)]
    return t ? `${t.name}` : match
  })
}

export function getCategoryConfig(categoryOrTx) {
  let category = typeof categoryOrTx === 'string' ? categoryOrTx : categoryOrTx?.category
  const reason = typeof categoryOrTx === 'object' ? (categoryOrTx?.reason || '').toLowerCase() : ''

  if (!category || category === 'other' || category === 'manual_adjustment') {
    if (reason.includes('substitut') || reason.includes('cover')) category = 'substitute_class'
    else if (reason.includes('leave') || reason.includes('absent')) category = 'leave_deduction'
    else if (reason.includes('exam') || reason.includes('invigil')) category = 'exam_duty'
    else if (reason.includes('dept') || reason.includes('department')) category = 'department_duty'
    else if (reason.includes('workshop') || reason.includes('train')) category = 'workshop'
    else if (reason.includes('event') || reason.includes('sympos')) category = 'event_coordination'
    else if (reason.includes('penalty') || reason.includes('deduct')) category = 'penalty'
  }

  if (category === 'penalty' && (reason.includes('leave') || reason.includes('absent'))) {
    category = 'leave_deduction'
  }

  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
}

// --- Date Grouping ---

export function groupTransactionsByDate(transactions) {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = { today: [], yesterday: [], thisWeek: [], earlier: [] }
  for (const tx of transactions) {
    const d = new Date(tx.created_at)
    const dStr = d.toDateString()
    if (dStr === todayStr) groups.today.push(tx)
    else if (dStr === yesterdayStr) groups.yesterday.push(tx)
    else if (d >= weekAgo) groups.thisWeek.push(tx)
    else groups.earlier.push(tx)
  }
  return groups
}

// --- Teacher Status ---

export function getTeacherStatus(balance) {
  if (balance >= 10) return { label: "Excellent",        bgClass: "bg-emerald-100", textClass: "text-emerald-700" }
  if (balance >= 5)  return { label: "Good",             bgClass: "bg-green-100",   textClass: "text-green-700" }
  if (balance >= 1)  return { label: "Average",          bgClass: "bg-blue-100",    textClass: "text-blue-700" }
  if (balance === 0) return { label: "Neutral",          bgClass: "bg-gray-100",    textClass: "text-gray-600" }
  if (balance >= -3) return { label: "Needs Attention",  bgClass: "bg-amber-100",   textClass: "text-amber-700" }
  return                     { label: "Critical",        bgClass: "bg-red-100",     textClass: "text-red-700" }
}

// --- Achievement Badge ---

export function getAchievementBadge(rank, balance, txCount) {
  if (rank === 1)     return { emoji: "🏆", label: "Top Contributor",    color: "bg-amber-100 text-amber-700" }
  if (rank === 2)     return { emoji: "⭐", label: "Star Performer",     color: "bg-yellow-100 text-yellow-700" }
  if (rank === 3)     return { emoji: "🔥", label: "Most Active",        color: "bg-orange-100 text-orange-700" }
  if (txCount >= 15)  return { emoji: "🎯", label: "Reliable Substitute",color: "bg-emerald-100 text-emerald-700" }
  if (balance >= 8)   return { emoji: "💪", label: "Consistent Helper",  color: "bg-blue-100 text-blue-700" }
  if (rank <= 5)      return { emoji: "🥇", label: "Department Leader",  color: "bg-indigo-100 text-indigo-700" }
  return null
}

// --- Relative Time ---

export function formatRelativeTime(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === todayStr) return "Today · " + timeStr
  if (d.toDateString() === yesterdayDate.toDateString()) return "Yesterday · " + timeStr
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return diffDays + " days ago"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

// --- Avatar Helpers ---

const AVATAR_PALETTE = [
  { bg: "bg-violet-100",  text: "text-violet-700" },
  { bg: "bg-sky-100",     text: "text-sky-700" },
  { bg: "bg-amber-100",   text: "text-amber-700" },
  { bg: "bg-rose-100",    text: "text-rose-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-indigo-100",  text: "text-indigo-700" },
  { bg: "bg-pink-100",    text: "text-pink-700" },
  { bg: "bg-teal-100",    text: "text-teal-700" },
]

export function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = str.charCodeAt(i) + ((h << 5) - h); h |= 0 }
  return Math.abs(h)
}

export function initialsOf(name) {
  return (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join("") || "?"
}

export function avatarColors(name) {
  return AVATAR_PALETTE[hashStr(name || "") % AVATAR_PALETTE.length]
}

// --- KPI Computations ---

export function computeKPIs(report, transactions) {
  const today = new Date().toDateString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const totalTeachers = report.length
  const totalCreditsAwarded = transactions.filter(t => t.change > 0).reduce((s, t) => s + t.change, 0)
  const positiveBalances = report.filter(r => r.balance > 0).length
  const negativeBalances = report.filter(r => r.balance < 0).length
  const totalTransactions = transactions.length
  const manualAdjustments = transactions.filter(t => t.category === "manual_adjustment").length
  const todayActivity = transactions.filter(t => new Date(t.created_at).toDateString() === today).length
  const yesterdayActivity = transactions.filter(t => new Date(t.created_at).toDateString() === yesterdayStr).length
  const avgBalance = report.length > 0
    ? Math.round((report.reduce((s, r) => s + r.balance, 0) / report.length) * 10) / 10
    : 0

  return {
    totalTeachers, totalCreditsAwarded, positiveBalances, negativeBalances,
    totalTransactions, manualAdjustments, todayActivity, yesterdayActivity, avgBalance
  }
}

// --- Attention Flags ---

export function computeAttentionFlags(report, transactions) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const txByTeacher = {}
  for (const tx of transactions) {
    if (!txByTeacher[tx.teacher_id]) txByTeacher[tx.teacher_id] = []
    txByTeacher[tx.teacher_id].push(tx)
  }

  const flags = []
  for (const r of report) {
    const teacherTxs = txByTeacher[r.teacher_id] || []
    const reasons = []

    if (r.balance < 0) {
      reasons.push({ type: "negative_balance", text: "Negative balance due to deductions exceeding substitutions." })
    }
    const recentTx = teacherTxs.filter(t => new Date(t.created_at) >= thirtyDaysAgo)
    if (teacherTxs.length > 0 && recentTx.length === 0) {
      reasons.push({ type: "inactive", text: "No substitute activity recorded in the last 30 days." })
    }
    const recentDeductions = teacherTxs.filter(t => t.change < 0 && new Date(t.created_at) >= sevenDaysAgo)
    if (recentDeductions.length >= 3) {
      reasons.push({ type: "multiple_deductions", text: recentDeductions.length + " deductions this week — check for recurring absences." })
    }
    const corrections = teacherTxs.filter(t => t.category === "correction" || t.category === "manual_adjustment")
    if (corrections.length >= 3) {
      reasons.push({ type: "corrections", text: corrections.length + " corrections in history — data may need review." })
    }

    if (reasons.length > 0) {
      flags.push({ ...r, reasons, severity: r.balance < 0 ? "high" : "medium" })
    }
  }
  return flags.sort((a, b) => {
    if (a.severity === "high" && b.severity !== "high") return -1
    if (b.severity === "high" && a.severity !== "high") return 1
    return a.balance - b.balance
  })
}

// --- Credit Breakdown ---

export function computeCreditBreakdown(transactions) {
  const breakdown = {}
  for (const tx of transactions) {
    const catConfig = getCategoryConfig(tx)
    const cat = catConfig.label
    if (!breakdown[cat]) breakdown[cat] = { earned: 0, deducted: 0, count: 0, config: catConfig }
    if (tx.change > 0) breakdown[cat].earned += tx.change
    else breakdown[cat].deducted += Math.abs(tx.change)
    breakdown[cat].count++
  }
  return breakdown
}

// --- CSV Export ---

export function exportToCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v != null ? v : "")
    return s.includes(",") || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
