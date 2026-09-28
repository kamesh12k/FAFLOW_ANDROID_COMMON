/**
 * FAFLOW Core Frontend Type Definitions
 * Reconciled against openapi.yaml and backend SQLAlchemy models
 */

export type Role =
  | 'system_admin'
  | 'admin'
  | 'principal'
  | 'governance'
  | 'manager'
  | 'staff'
  | 'teacher'

export type AdminLevel = 'super' | 'standard' | 'viewer'

export interface User {
  id: number
  username: string
  name: string
  email: string
  role: Role
  admin_level?: AdminLevel | null
  department_id?: number | null
  department?: Department | null
  is_active: boolean
  phone_number?: string | null
  biometric_registered?: boolean
  must_change_credentials?: boolean
  policy_version_accepted?: string | null
  onboarding_completed?: boolean
  created_at?: string
  updated_at?: string
}

export interface Department {
  id: number
  name: string
  code: string
  is_active: boolean
  created_at?: string
}

export interface Subject {
  id: number
  name: string
  code: string
  department_id: number
  department?: Department | null
  credits: number
  is_active: boolean
}

export interface Class {
  id: number
  name: string
  code: string
  department_id: number
  department?: Department | null
  semester: number
  section: string
  default_room_id?: number | null
  is_active: boolean
}

export interface Room {
  id: number
  name: string
  room_number: string
  block?: string | null
  floor?: number | null
  capacity: number
  is_lab: boolean
  is_active: boolean
}

export interface TimetableSlot {
  id: number
  day_order: number
  period: number
  class_id: number
  class_?: Class | null
  subject_id: number
  subject?: Subject | null
  teacher_id: number
  teacher?: User | null
  room_id?: number | null
  room?: Room | null
  is_active: boolean
}

export type AttendanceStatus = 'present' | 'absent' | 'od' | 'late'

export interface Student {
  id: number
  roll_number: string
  register_number?: string | null
  name: string
  class_id: number
  is_active: boolean
}

export interface StudentAttendanceRecord {
  id: number
  attendance_session_id: number
  student_id: number
  student?: Student | null
  status: AttendanceStatus
  remarks?: string | null
  marked_at?: string
}

export interface AttendanceSession {
  id: number
  attendance_date: string
  timetable_slot_id?: number | null
  class_id: number
  class_?: Class | null
  subject_id: number
  subject?: Subject | null
  scheduled_teacher_id: number
  actual_teacher_id: number
  period: number
  status: 'draft' | 'submitted' | 'locked'
  submitted_at?: string | null
  records?: StudentAttendanceRecord[]
}

export type LeaveType = 'casual' | 'medical' | 'duty' | 'earned' | 'compensation'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveRequest {
  id: number
  teacher_id: number
  teacher?: User | null
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
  status: LeaveStatus
  approved_by_id?: number | null
  approved_by?: User | null
  decision_at?: string | null
  decision_notes?: string | null
  created_at: string
}

export interface SubstitutionRecord {
  id: number
  leave_request_id?: number | null
  timetable_slot_id: number
  date: string
  period: number
  original_teacher_id: number
  substitute_teacher_id: number
  original_teacher?: User | null
  substitute_teacher?: User | null
  status: 'assigned' | 'completed' | 'cancelled'
  fairness_score?: number | null
}

export interface DayOrderInfo {
  date: string
  day_type: 'working' | 'holiday' | 'exam' | 'event'
  day_order?: number | null
  description?: string | null
}

export interface ApiErrorEnvelope {
  detail: string | {
    title?: string
    reason?: string
    message?: string
    [key: string]: unknown
  }
}
