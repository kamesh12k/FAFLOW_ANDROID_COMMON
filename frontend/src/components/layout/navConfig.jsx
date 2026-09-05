import {
  GridIcon, UsersIcon, CalIcon, BookIcon, DoorIcon, DocIcon, ChartIcon,
  PlusIcon, SwapIcon,
} from '../icons'

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:'100%',height:'100%'}}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function TrashNavIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:'100%',height:'100%'}}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function GeofenceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:'100%',height:'100%'}}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
    </svg>
  )
}

function BiometricIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{width:'100%',height:'100%'}}>
      <path d="M9 3a3 3 0 0 1 6 0" />
      <path d="M6 9a6 6 0 0 1 12 0" />
      <path d="M12 9v6" />
      <path d="M9 15a3 3 0 0 0 6 0" />
      <path d="M7 19a5 5 0 0 0 10 0" />
      <path d="M12 19v2" />
    </svg>
  )
}

export const ADMIN_NAV = [
  {
    section: null,
    items: [
      { to: '/admin/dashboard', label: 'Home', icon: <GridIcon />, end: true },
    ],
  },
  {
    section: 'Calendar & Timetable',
    items: [
      { to: '/admin/academic-calendar', label: 'Calendar & Day Order', icon: <CalIcon /> },
      { to: '/admin/timetable', label: 'Timetable', icon: <CalIcon /> },
      { to: '/admin/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
      { to: '/admin/timetable/approvals', label: 'Timetable Approvals', icon: <DocIcon /> },
      { to: '/admin/class-directory', label: 'Class Faculty Directory', icon: <UsersIcon /> },
      { to: '/admin/resource-availability', label: 'Room Availability', icon: <ChartIcon /> },
    ],
  },
  {
    section: 'Leave & Credits',
    items: [
      { to: '/admin/leaves', label: 'Leave Requests', icon: <DocIcon /> },
      { to: '/admin/leave-entry', label: 'Admin Leave Entry', icon: <PlusIcon /> },
      { to: '/admin/today-substitutions', label: "Today's Substitutions", icon: <DocIcon /> },
      { to: '/admin/credits', label: 'Credits', icon: <ChartIcon /> },
    ],
  },
  {
    section: 'Setup',
    items: [
      { to: '/admin/setup', label: 'Setup Guide', icon: <DocIcon /> },
      { to: '/admin/teachers', label: 'Teachers', icon: <UsersIcon /> },
      { to: '/admin/subjects', label: 'Subjects', icon: <BookIcon /> },
      { to: '/admin/classes', label: 'Classes', icon: <UsersIcon /> },
      { to: '/admin/rooms', label: 'Rooms & Labs', icon: <DoorIcon /> },
      { to: '/admin/settings', label: 'Settings & History', icon: <DocIcon /> },
    ],
  },
]

export const TEACHER_NAV = [
  {
    section: 'Timetable & Classes',
    items: [
      { to: '/teacher/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/teacher/timetable', label: 'My Timetable', icon: <CalIcon /> },
      { to: '/teacher/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
    ],
  },

  {
    section: 'Leaves & Substitutions',
    items: [
      { to: '/teacher/leave/apply', label: 'Apply for Leave', icon: <PlusIcon /> },
      { to: '/teacher/leaves', label: 'Leave History', icon: <DocIcon /> },
      { to: '/teacher/substitution', label: 'Manage Substitutes', icon: <SwapIcon /> },
      { to: '/teacher/today-coverage', label: "Today's Coverage", icon: <DocIcon /> },
      { to: '/teacher/credits', label: 'My Credits', icon: <ChartIcon /> },
    ],
  },
]


export const SYSTEM_ADMIN_NAV = [
  {
    section: 'Calendar & Timetable',
    items: [
      { to: '/admin/academic-calendar', label: 'Calendar & Day Order', icon: <CalIcon /> },
      { to: '/admin/timetable', label: 'Timetable & Reset', icon: <CalIcon /> },
      { to: '/admin/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
      { to: '/admin/timetable/approvals', label: 'Timetable Approvals', icon: <DocIcon /> },
    ],
  },
  {
    section: 'System & Security Setup',
    items: [
      { to: '/admin/setup', label: 'Setup Guide', icon: <DocIcon /> },
      { to: '/admin/geofences', label: 'Campus Geofences', icon: <GeofenceIcon /> },
      { to: '/admin/biometrics', label: 'Biometrics & Face Profiles', icon: <BiometricIcon /> },
      { to: '/admin/departments', label: 'Departments', icon: <UsersIcon />, end: true },
      { to: '/admin/managers', label: 'Managers', icon: <UsersIcon /> },
      { to: '/admin/classes', label: 'Classes', icon: <UsersIcon /> },
      { to: '/admin/rooms', label: 'Rooms & Labs', icon: <DoorIcon /> },
      { to: '/admin/teachers', label: 'Teachers', icon: <UsersIcon /> },
      { to: '/admin/subjects', label: 'Subjects', icon: <BookIcon /> },
    ],
  },
  {
    section: 'Performance & Audit',
    items: [
      { to: '/admin/system-metrics', label: 'Real-time Traffic', icon: <ChartIcon /> },
      { to: '/admin/settings', label: 'Settings & History', icon: <DocIcon /> },
    ],
  },
  {
    section: 'Data Safety',
    items: [
      { to: '/admin/backup', label: 'Backup & Restore', icon: <DatabaseIcon /> },
      { to: '/admin/data-retention', label: 'Data Retention & Purge', icon: <TrashNavIcon /> },
    ],
  },
]

export const MANAGER_NAV = [
  {
    section: null,
    items: [
      { to: '/manager/dashboard', label: 'Home', icon: <GridIcon />, end: true },
    ],
  },
  {
    section: 'Operational Staff',
    items: [
      { to: '/manager/lab-staff', label: 'Laboratory Staff', icon: <DoorIcon /> },
      { to: '/manager/non-teaching-staff', label: 'Non-Teaching Staff', icon: <UsersIcon /> },
      { to: '/manager/leaves', label: 'Staff Leaves & Ledger', icon: <DocIcon /> },
      { to: '/manager/directory', label: 'Staff Directory', icon: <BookIcon /> },
    ],
  },
]

export const PRINCIPAL_NAV = [
  {
    section: null,
    items: [
      { to: '/principal/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/principal/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
    ],
  },
]

export const STAFF_NAV = [
  {
    section: 'Workspace',
    items: [
      { to: '/staff/dashboard', label: 'Lab & Duty Workspace', icon: <GridIcon />, end: true },
    ],
  },
  {
    section: 'Leaves & Accounting',
    items: [
      { to: '/staff/leaves', label: 'My Leaves & Ledger', icon: <DocIcon /> },
    ],
  },
]

export const GOVERNANCE_NAV = [
  {
    section: 'Governance',
    items: [
      { to: '/governance', label: 'Command Center', icon: <GridIcon />, end: true },
    ],
  },
  {
    section: 'Operations & Oversight',
    items: [
      { to: '/admin/academic-calendar', label: 'Campus Calendar', icon: <CalIcon /> },
      { to: '/admin/class-timetable', label: 'College Timetable', icon: <CalIcon /> },
      { to: '/admin/today-substitutions', label: 'Live Substitutions', icon: <SwapIcon /> },
      { to: '/admin/leaves', label: 'Leave Oversight', icon: <DocIcon /> },
      { to: '/admin/backup', label: 'Emergency Backups', icon: <DatabaseIcon /> },
      { to: '/admin/settings', label: 'Governance Audits', icon: <DocIcon /> },
    ],
  },
]





