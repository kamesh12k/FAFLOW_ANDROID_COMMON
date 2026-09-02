export const DAY_ORDERS = [1, 2, 3, 4, 5, 6]
export const PERIODS = [1, 2, 3, 4, 5]

export const DAY_SHORT = { 1: 'DO1', 2: 'DO2', 3: 'DO3', 4: 'DO4', 5: 'DO5', 6: 'DO6' }
export const DAY_FULL = { 1: 'Day Order 1', 2: 'Day Order 2', 3: 'Day Order 3', 4: 'Day Order 4', 5: 'Day Order 5', 6: 'Day Order 6' }
export const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
}

export const SUBJECT_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
]

const colorMap = {}
let colorIdx = 0

export function getColor(classId) {
  if (classId === null || classId === undefined) {
    return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' }
  }
  if (!colorMap[classId]) colorMap[classId] = SUBJECT_COLORS[colorIdx++ % SUBJECT_COLORS.length]
  return colorMap[classId]
}

export function abbrev(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

export function initials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}
