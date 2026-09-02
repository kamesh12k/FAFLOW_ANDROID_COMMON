import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BRAND_CONFIG } from '../../../config/branding'
import { getTeacherStatus, getCategoryConfig, formatRelativeTime, formatTransactionReason } from './utils'

/**
 * Sanitizes a string for use in filenames across Windows, macOS, and Linux.
 */
function sanitizeFilename(str) {
  return (str || 'General')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50)
}

/**
 * Parses context details (Class, Day Order, Period) from transaction reason text.
 */
function parseTxContext(reasonText) {
  if (!reasonText) return '—'
  const details = []

  const classMatch = reasonText.match(/in\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i) ||
                     reasonText.match(/for\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i)
  if (classMatch && !classMatch[1].toLowerCase().includes('teacher') && !classMatch[1].toLowerCase().includes('leave')) {
    details.push(`Class: ${classMatch[1].trim()}`)
  }

  const doMatch = reasonText.match(/Day Order\s+(\d+)/i) || reasonText.match(/DO\s*(\d+)/i)
  if (doMatch) details.push(`DO: ${doMatch[1]}`)

  const pMatch = reasonText.match(/period\s+(\d+)/i) || reasonText.match(/P\s*(\d+)/i)
  if (pMatch) details.push(`P: ${pMatch[1]}`)

  return details.length > 0 ? details.join(' | ') : reasonText
}

/**
 * Generates an institution-grade, print-ready A4 PDF report from the existing HOD credit data.
 *
 * @param {Object} options
 * @param {Array} options.report - Faculty credit report balance items
 * @param {Array} options.transactions - List of credit transactions
 * @param {Array} options.allTeachers - Full list of faculty/teachers
 * @param {Object} options.filterScope - Active filter state { search, selectedDept, filter, teacherId }
 * @param {Object} options.currentUser - Authenticated user info
 * @param {Object} [options.institutionConfig] - Branding & academic metadata
 */
export async function generateCreditPdfReport({
  report = [],
  transactions = [],
  allTeachers = [],
  filterScope = {},
  currentUser = {},
  institutionConfig = {},
}) {
  // 1. Resolve and apply current filter scope
  const { search = '', selectedDept = '', filter = 'all', teacherId = null } = filterScope

  const teacherMap = {}
  for (const t of allTeachers) {
    teacherMap[t.id] = t
  }
  for (const r of report) {
    if (!teacherMap[r.teacher_id]) {
      teacherMap[r.teacher_id] = { id: r.teacher_id, name: r.name, department: r.department }
    }
  }

  // Filter faculty balances according to scope
  let scopedFaculty = [...report]

  if (teacherId) {
    scopedFaculty = scopedFaculty.filter(r => r.teacher_id === Number(teacherId))
  } else {
    if (selectedDept) {
      scopedFaculty = scopedFaculty.filter(r => r.department === selectedDept)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      scopedFaculty = scopedFaculty.filter(r =>
        r.name.toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q)
      )
    }
    if (filter === 'positive') {
      scopedFaculty = scopedFaculty.filter(r => r.balance > 0)
    } else if (filter === 'negative') {
      scopedFaculty = scopedFaculty.filter(r => r.balance < 0)
    } else if (filter === 'flagged') {
      scopedFaculty = scopedFaculty.filter(r => {
        const s = getTeacherStatus(r.balance)
        return s.label === 'Critical' || s.label === 'Needs Attention'
      })
    }
  }

  // Filter transactions according to scoped faculty
  const scopedTeacherIds = new Set(scopedFaculty.map(f => f.teacher_id))
  let scopedTransactions = transactions.filter(tx => scopedTeacherIds.has(tx.teacher_id))

  // If no records found, return empty indicator
  if (scopedFaculty.length === 0 && scopedTransactions.length === 0) {
    return { success: false, reason: 'NO_DATA' }
  }

  // 2. Compute accurate statistics directly from scoped records
  const totalFacultyCount = scopedFaculty.length
  let totalCreditsEarned = 0
  let totalCreditsDeducted = 0
  let totalSubstitutions = 0
  let totalAdjustments = 0

  const facultyStatsMap = {}
  for (const f of scopedFaculty) {
    facultyStatsMap[f.teacher_id] = {
      earned: 0,
      deducted: 0,
      substitutions: 0,
      adjustments: 0,
      txCount: 0,
    }
  }

  for (const tx of scopedTransactions) {
    const change = Number(tx.change) || 0
    const cat = (tx.category || '').toLowerCase()
    const stat = facultyStatsMap[tx.teacher_id]

    if (change > 0) {
      totalCreditsEarned += change
      if (stat) stat.earned += change
    } else {
      totalCreditsDeducted += Math.abs(change)
      if (stat) stat.deducted += Math.abs(change)
    }

    if (cat.includes('substitute')) {
      totalSubstitutions += 1
      if (stat) stat.substitutions += 1
    } else if (cat.includes('manual') || cat.includes('adjust') || cat.includes('penalty') || cat.includes('correction')) {
      totalAdjustments += 1
      if (stat) stat.adjustments += 1
    }

    if (stat) stat.txCount += 1
  }

  const netCirculation = totalCreditsEarned - totalCreditsDeducted

  // Reporting period calculation
  let reportingPeriod = 'All Time'
  if (scopedTransactions.length > 0) {
    const dates = scopedTransactions.map(tx => new Date(tx.created_at).getTime()).filter(Boolean)
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates))
      const maxDate = new Date(Math.max(...dates))
      const fmt = d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      reportingPeriod = `${fmt(minDate)} – ${fmt(maxDate)}`
    }
  }

  // Academic metadata
  const appName = institutionConfig.appName || BRAND_CONFIG.appName || 'FAFLOW'
  const companyName = institutionConfig.companyName || BRAND_CONFIG.companyName || 'GOVERNENCE'
  const departmentLabel = teacherId
    ? `${scopedFaculty[0]?.name || 'Faculty'} (${scopedFaculty[0]?.department || 'General'})`
    : selectedDept
    ? selectedDept
    : currentUser.department || 'All Departments (Campus Overview)'

  const currentYear = new Date().getFullYear()
  const academicYear = institutionConfig.academicYear || `${currentYear}–${currentYear + 1}`
  const semester = institutionConfig.semester || (new Date().getMonth() >= 5 && new Date().getMonth() <= 10 ? 'Semester I (Odd)' : 'Semester II (Even)')
  const generatedDateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const generatedByName = currentUser.name || 'Department Administrator'
  const generatedByRole = (currentUser.role || 'HOD').toUpperCase().replace('_', ' ')

  // 3. Initialize jsPDF (A4 Portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentWidth = pageWidth - marginX * 2

  // Color Palette (Enterprise Navy & Slate)
  const colors = {
    primaryDark: [30, 41, 59],      // slate-800
    primaryNavy: [15, 23, 42],      // slate-900
    primaryAccent: [79, 70, 229],   // indigo-600
    subtleBg: [248, 250, 252],      // slate-50
    border: [226, 232, 240],        // slate-200
    textMuted: [100, 116, 139],     // slate-500
    textDark: [15, 23, 42],         // slate-900
    emeraldText: [5, 150, 105],     // emerald-600
    roseText: [225, 29, 72],        // rose-600
  }

  // ── Header Banner ──
  doc.setFillColor(...colors.primaryNavy)
  doc.roundedRect(marginX, 12, contentWidth, 34, 3, 3, 'F')

  // Top Accent bar
  doc.setFillColor(...colors.primaryAccent)
  doc.rect(marginX, 12, contentWidth, 2, 'F')

  // Header Typography
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(appName.toUpperCase(), marginX + 6, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(199, 210, 254) // indigo-200
  doc.text('OFFICIAL INSTITUTIONAL FACULTY CREDIT AUDIT REPORT', marginX + 6, 27)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(`DEPARTMENT: ${departmentLabel.toUpperCase()}`, marginX + 6, 34)

  // Header Right Metadata
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(226, 232, 240)
  const rightX = marginX + contentWidth - 6
  doc.text(`Academic Year: ${academicYear}`, rightX, 22, { align: 'right' })
  doc.text(`Semester: ${semester}`, rightX, 27, { align: 'right' })
  doc.text(`Reporting Period: ${reportingPeriod}`, rightX, 32, { align: 'right' })
  doc.text(`Generated: ${generatedDateStr}`, rightX, 37, { align: 'right' })

  // ── Metadata & Scope Strip ──
  let curY = 50
  doc.setFillColor(...colors.subtleBg)
  doc.setDrawColor(...colors.border)
  doc.roundedRect(marginX, curY, contentWidth, 12, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...colors.textDark)
  doc.text('SCOPE & AUDIT METADATA:', marginX + 4, curY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...colors.textMuted)
  const filterDesc = [
    `Target: ${departmentLabel}`,
    `Filter: ${filter.toUpperCase()}`,
    search ? `Search: "${search}"` : null,
    `Auditor: ${generatedByName} (${generatedByRole})`,
  ].filter(Boolean).join('  |  ')

  doc.text(filterDesc, marginX + 4, curY + 9.5)

  // ── Executive Summary KPI Cards ──
  curY = 66
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...colors.primaryDark)
  doc.text('EXECUTIVE CREDIT SUMMARY', marginX, curY)

  curY += 3
  const cardGap = 3
  const cardCount = 4
  const cardWidth = (contentWidth - (cardCount - 1) * cardGap) / cardCount
  const cardHeight = 16

  const kpis = [
    { label: 'TOTAL FACULTY', val: String(totalFacultyCount), sub: 'Evaluated', col: colors.primaryDark },
    { label: 'CREDITS EARNED', val: `+${totalCreditsEarned}`, sub: `${totalSubstitutions} Substitutions`, col: colors.emeraldText },
    { label: 'DEDUCTIONS', val: `-${totalCreditsDeducted}`, sub: `${totalAdjustments} Adjustments`, col: colors.roseText },
    { label: 'NET CIRCULATION', val: `${netCirculation >= 0 ? '+' : ''}${netCirculation}`, sub: 'Active Balance', col: colors.primaryAccent },
  ]

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (cardWidth + cardGap)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...colors.border)
    doc.roundedRect(kpiX, curY, cardWidth, cardHeight, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...colors.textMuted)
    doc.text(kpi.label, kpiX + 3, curY + 4.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...kpi.col)
    doc.text(kpi.val, kpiX + 3, curY + 10.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...colors.textMuted)
    doc.text(kpi.sub, kpiX + 3, curY + 14)
  })

  curY += cardHeight + 6

  // ── Table 1: Faculty Credit Balance Overview ──
  const sortedFaculty = [...scopedFaculty].sort((a, b) => b.balance - a.balance)
  const facultyTableBody = sortedFaculty.map((f, idx) => {
    const stats = facultyStatsMap[f.teacher_id] || { earned: 0, deducted: 0, substitutions: 0, txCount: 0 }
    const status = getTeacherStatus(f.balance)
    return [
      `#${idx + 1}`,
      f.name,
      f.department || 'General Faculty',
      String(stats.txCount),
      `+${stats.earned}`,
      stats.deducted > 0 ? `-${stats.deducted}` : '0',
      String(stats.substitutions),
      `${f.balance >= 0 ? '+' : ''}${f.balance}`,
      status.label,
    ]
  })

  autoTable(doc, {
    startY: curY,
    head: [['#', 'FACULTY MEMBER', 'DEPARTMENT', 'EVENTS', 'EARNED', 'DEDUCTED', 'SUBS', 'NET BALANCE', 'HEALTH STATUS']],
    body: facultyTableBody,
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    headStyles: {
      fillColor: colors.primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'center', textColor: colors.emeraldText, fontStyle: 'bold' },
      5: { cellWidth: 16, halign: 'center', textColor: colors.roseText, fontStyle: 'bold' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: colors.textDark,
      lineColor: colors.border,
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    didDrawPage: (data) => {
      // Header repeated automatically by jspdf-autotable
    },
  })

  // ── Table 2: Substitution Breakdown Table ──
  const subsFaculty = sortedFaculty
    .map(f => {
      const stats = facultyStatsMap[f.teacher_id] || { substitutions: 0, earned: 0 }
      return { ...f, ...stats }
    })
    .filter(f => f.substitutions > 0)
    .sort((a, b) => b.substitutions - a.substitutions)

  if (subsFaculty.length > 0) {
    let subsY = doc.lastAutoTable.finalY + 8
    if (subsY > pageHeight - 40) {
      doc.addPage()
      subsY = 18
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...colors.primaryDark)
    doc.text('SUBSTITUTION WORKLOAD SUMMARY', marginX, subsY)

    const subsBody = subsFaculty.map((f, idx) => [
      `#${idx + 1}`,
      f.name,
      f.department || 'General Faculty',
      String(f.substitutions),
      `+${f.earned}`,
      'Confirmed & Credited',
    ])

    autoTable(doc, {
      startY: subsY + 2,
      head: [['#', 'FACULTY MEMBER', 'DEPARTMENT', 'SUBSTITUTIONS COMPLETED', 'CREDITS AWARDED', 'RECONCILIATION STATUS']],
      body: subsBody,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      headStyles: {
        fillColor: colors.primaryDark,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 50, fontStyle: 'bold' },
        2: { cellWidth: 40 },
        3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'center', textColor: colors.emeraldText, fontStyle: 'bold' },
        5: { cellWidth: 26, halign: 'center' },
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: colors.textDark,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    })
  }

  // ── Table 3: Detailed Transaction Audit Ledger ──
  const sortedTransactions = [...scopedTransactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  
  if (sortedTransactions.length > 0) {
    let txY = doc.lastAutoTable.finalY + 8
    if (txY > pageHeight - 40) {
      doc.addPage()
      txY = 18
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...colors.primaryDark)
    doc.text('CREDIT TRANSACTION AUDIT LEDGER', marginX, txY)

    const txBody = sortedTransactions.map(tx => {
      const teacherObj = teacherMap[tx.teacher_id] || {}
      const cat = getCategoryConfig(tx)
      const dateStr = new Date(tx.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      const changeStr = tx.change > 0 ? `+${tx.change}` : String(tx.change)
      const formattedReason = formatTransactionReason(tx.reason, teacherMap)
      const contextStr = parseTxContext(formattedReason)

      return [
        `#TX-${tx.id}`,
        dateStr,
        teacherObj.name || `Teacher #${tx.teacher_id}`,
        cat.label,
        contextStr,
        changeStr,
        tx.related_leave_id ? `Leave #${tx.related_leave_id}` : 'Direct',
      ]
    })

    autoTable(doc, {
      startY: txY + 2,
      head: [['REF ID', 'DATE & TIME', 'FACULTY', 'ACTIVITY CATEGORY', 'DETAILS / CONTEXT', 'CHANGE', 'STATUS / REF']],
      body: txBody,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      headStyles: {
        fillColor: colors.primaryDark,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.8,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 36, fontStyle: 'bold' },
        3: { cellWidth: 26 },
        4: { cellWidth: 46 },
        5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 18, halign: 'center' },
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.6,
        textColor: colors.textDark,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    })
  }

  // ── Final Totals Summary Block ──
  let finalY = doc.lastAutoTable.finalY + 6
  if (finalY > pageHeight - 32) {
    doc.addPage()
    finalY = 18
  }

  doc.setFillColor(...colors.subtleBg)
  doc.setDrawColor(...colors.border)
  doc.roundedRect(marginX, finalY, contentWidth, 16, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...colors.primaryNavy)
  doc.text('FINAL RECONCILIATION SUMMARY', marginX + 4, finalY + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...colors.textDark)
  doc.text(`Total Credits Issued: +${totalCreditsEarned}   |   Total Deductions: -${totalCreditsDeducted}   |   Net Circulation: ${netCirculation >= 0 ? '+' : ''}${netCirculation}`, marginX + 4, finalY + 10.5)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(...colors.textMuted)
  doc.text('This is an official system-generated audit record. All transactions have been computed from verified ledger entries.', marginX + 4, finalY + 14)

  // ── Global Multi-Page Header & Footer Pass ──
  const totalPages = doc.internal.getNumberOfPages()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Footer divider line
    doc.setDrawColor(...colors.border)
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10)

    // Footer Text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...colors.textMuted)
    doc.text(
      `${appName} Academic Management System  •  Faculty Credit Audit Report  •  ${departmentLabel}`,
      marginX,
      pageHeight - 6
    )

    // Page Number
    doc.setFont('helvetica', 'bold')
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 6, { align: 'right' })
  }

  // 4. Save PDF with dynamic filename
  const dateSlug = new Date().toISOString().slice(0, 10)
  const deptSlug = sanitizeFilename(departmentLabel)
  const fileName = `HOD_Credit_Report_${deptSlug}_${dateSlug}.pdf`

  doc.save(fileName)

  return { success: true, fileName, recordCount: scopedFaculty.length }
}
