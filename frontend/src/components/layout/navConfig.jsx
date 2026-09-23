import {
  GridIcon, UsersIcon, CalIcon, BookIcon, DoorIcon, DocIcon, ChartIcon,
  PlusIcon, SwapIcon, MegaphoneIcon,
  DatabaseIcon, TrashNavIcon, GeofenceIcon, BiometricIcon, AttendanceNavIcon,
  ShieldIcon,
} from '../icons'

export const ADMIN_NAV = [
  {
    section: null,
    items: [
      { to: '/admin/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
      { to: '/admin/attendance', label: 'Staff Attendance', icon: <AttendanceNavIcon /> },
      { to: '/admin/student-attendance', label: 'Student Attendance', icon: <UsersIcon /> },
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
      { to: '/admin/today-substitutions', label: "Today's Substitutions", icon: <SwapIcon /> },
      { to: '/admin/duties', label: 'Campus Duties', icon: <DoorIcon /> },
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
      { to: '/admin/campus-structure', label: 'Campus Builder', icon: <DoorIcon /> },
    ],
  },
]

export const TEACHER_NAV = [
  {
    section: 'My Work',
    items: [
      { to: '/teacher/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
      { to: '/teacher/student-attendance', label: 'Student Attendance', icon: <AttendanceNavIcon /> },
      { to: '/teacher/duties', label: 'My Duties', icon: <DoorIcon /> },
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
      { to: '/teacher/today-coverage', label: "Today's Coverage", icon: <SwapIcon /> },
      { to: '/teacher/credits', label: 'My Credits', icon: <ChartIcon /> },
    ],
  },
]


export const SYSTEM_ADMIN_NAV = [
  {
    section: null,
    items: [
      { to: '/admin/dashboard', label: 'Home', icon: <GridIcon />, end: true },
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
    ],
  },
  {
    section: 'Calendar & Timetable',
    items: [
      { to: '/admin/academic-calendar', label: 'Calendar & Day Order', icon: <CalIcon /> },
      { to: '/admin/timetable', label: 'Timetable', icon: <CalIcon /> },
      { to: '/admin/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
      { to: '/admin/timetable/approvals', label: 'Timetable Approvals', icon: <DocIcon /> },
    ],
  },
  {
    section: 'Security & Campus',
    items: [
      { to: '/admin/geofences', label: 'Campus Geofences', icon: <GeofenceIcon /> },
      { to: '/admin/biometrics', label: 'Biometrics & Face Profiles', icon: <BiometricIcon /> },
      { to: '/admin/attendance', label: 'Live Attendance', icon: <AttendanceNavIcon /> },
      { to: '/admin/duties', label: 'Campus Duties', icon: <DoorIcon /> },
      { to: '/admin/campus-structure', label: 'Campus Builder', icon: <DoorIcon /> },
    ],
  },
  {
    section: 'Platform Setup',
    items: [
      { to: '/admin/setup', label: 'Setup Guide', icon: <DocIcon /> },
      { to: '/admin/departments', label: 'Departments', icon: <UsersIcon />, end: true },
      { to: '/admin/managers', label: 'Managers', icon: <UsersIcon /> },
      { to: '/admin/classes', label: 'Classes', icon: <UsersIcon /> },
      { to: '/admin/rooms', label: 'Rooms & Labs', icon: <DoorIcon /> },
      { to: '/admin/teachers', label: 'Teachers', icon: <UsersIcon /> },
      { to: '/admin/subjects', label: 'Subjects', icon: <BookIcon /> },
    ],
  },
  {
    section: 'Monitoring & Audit',
    items: [
      { to: '/admin/system-metrics', label: 'Real-time Traffic', icon: <ChartIcon /> },
      { to: '/admin/settings', label: 'Settings & History', icon: <DocIcon /> },
      { to: '/admin/governance-rules', label: 'Business Rules', icon: <ShieldIcon /> },
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
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
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
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
      { to: '/principal/student-attendance', label: 'Student Attendance', icon: <UsersIcon /> },
      { to: '/principal/attendance', label: 'Faculty Attendance', icon: <AttendanceNavIcon /> },
      { to: '/principal/duties', label: 'Campus Duties', icon: <DoorIcon /> },
      { to: '/principal/campus-structure', label: 'Campus Structure', icon: <DoorIcon /> },
      { to: '/principal/class-timetable', label: 'Classwise Timetable', icon: <CalIcon /> },
      { to: '/principal/settings', label: 'Settings & Campus Mode', icon: <DocIcon /> },
    ],
  },
]

export const STAFF_NAV = [
  {
    section: 'Workspace',
    items: [
      { to: '/staff/dashboard', label: 'Lab & Duty Workspace', icon: <GridIcon />, end: true },
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
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
      { to: '/announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
      { to: '/governance/student-attendance', label: 'Student Attendance', icon: <UsersIcon /> },
      { to: '/governance/attendance', label: 'Live Attendance', icon: <AttendanceNavIcon /> },
      { to: '/governance/duties', label: 'Campus Duties', icon: <DoorIcon /> },
    ],
  },
  {
    section: 'Oversight',
    items: [
      { to: '/admin/academic-calendar', label: 'Campus Calendar', icon: <CalIcon /> },
      { to: '/admin/class-timetable', label: 'College Timetable', icon: <CalIcon /> },
      { to: '/admin/today-substitutions', label: 'Live Substitutions', icon: <SwapIcon /> },
      { to: '/admin/leaves', label: 'Leave Oversight', icon: <DocIcon /> },
      { to: '/admin/backup', label: 'Emergency Backups', icon: <DatabaseIcon /> },
      { to: '/admin/settings', label: 'Governance Audits', icon: <DocIcon /> },
      { to: '/governance/rules', label: 'Business Rules', icon: <ShieldIcon /> },
    ],
  },
]
