import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ApplyLeave from '../pages/teacher/ApplyLeave'
import StudentAttendance from '../pages/teacher/StudentAttendance'
import ErrorBoundary from '../components/ErrorBoundary'
import { AlertTriangleIcon } from '../components/icons'

// Mock services
vi.mock('../api/services', () => ({
  leavesApi: {
    myLeaves: vi.fn().mockResolvedValue({ data: [] }),
    apply: vi.fn().mockResolvedValue({ data: {} }),
    applyBatch: vi.fn().mockResolvedValue({ data: {} }),
    slotCandidates: vi.fn().mockResolvedValue({ data: { candidates: [] } }),
    evaluatePolicy: vi.fn().mockResolvedValue({ data: { is_compliant: true, warnings: [] } }),
  },
  academicCalendarApi: {
    getUpcoming: vi.fn().mockResolvedValue({ data: [] }),
    getSummary: vi.fn().mockResolvedValue({ data: {} }),
    resolve: vi.fn().mockResolvedValue({ data: { is_instructional_day: true, day_order: 1 } }),
  },
  campusOperationsApi: {
    getStatus: vi.fn().mockResolvedValue({ data: {} }),
    getMode: vi.fn().mockResolvedValue({ data: { mode: 'normal' } }),
  },
  timetableApi: {
    getByTeacher: vi.fn().mockResolvedValue({ data: [] }),
  },
  leavePoliciesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
    getActive: vi.fn().mockResolvedValue({ data: [] }),
  },
  leaveBalancesApi: {
    getMyBalances: vi.fn().mockResolvedValue({ data: { balances: [], substitution_credit_balance: 0 } }),
  },
  teachersApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  studentAttendanceApi: {
    getTodaySchedule: vi.fn().mockResolvedValue({ data: { periods: [] } }),
    getClassRoster: vi.fn().mockResolvedValue({ data: { students: [] } }),
    getSession: vi.fn().mockResolvedValue({ data: {} }),
    createSession: vi.fn().mockResolvedValue({ data: {} }),
    emergencyAttendance: vi.fn().mockResolvedValue({ data: {} }),
    submitAttendance: vi.fn().mockResolvedValue({ data: {} }),
    correctAttendance: vi.fn().mockResolvedValue({ data: {} }),
  },
  classesApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', name: 'Dr. Jane Smith', role: 'teacher', department_id: 'dept-1' },
    token: 'fake-token',
    isAdmin: false,
    isManager: false,
    isStaff: false,
  }),
}))

describe('Phase 1 Crash Fixes (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Bug 1 — /teacher/leave/apply: ReferenceError: AlertTriangleIcon is not defined', () => {
    it('verifies AlertTriangleIcon is exported properly from components/icons', () => {
      expect(AlertTriangleIcon).toBeDefined()
      const { container } = render(<AlertTriangleIcon className="w-5 h-5 text-amber-500" />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders ApplyLeave without throwing ReferenceError for AlertTriangleIcon', async () => {
      const { container } = render(
        <MemoryRouter>
          <ApplyLeave />
        </MemoryRouter>
      )
      expect(container).toBeDefined()
      // Verify page loaded content
      await waitFor(() => {
        expect(screen.getByText(/Apply for Leave/i)).toBeInTheDocument()
      })
    })

    it('ErrorBoundary catches unexpected errors without blanking the application', () => {
      const ProblemComponent = () => {
        throw new Error('Test crash in child component')
      }

      // Suppress React error boundary console log for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary inline title="Apply Leave">
          <ProblemComponent />
        </ErrorBoundary>
      )

      expect(screen.getByRole('heading', { name: 'Apply Leave' })).toBeInTheDocument()
      expect(screen.getByText(/Test crash in child component/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()

      consoleError.mockRestore()
    })
  })

  describe('Bug 4 — /teacher/student-attendance: minified React error #31 on 422 responses', () => {
    it('safely renders FastAPI/Pydantic 422 validation error objects without throwing React Error #31', async () => {
      const { studentAttendanceApi } = await import('../api/services')

      // Mock 422 validation response containing raw objects {type, loc, msg, input, ctx}
      const pydantic422Error = {
        response: {
          status: 422,
          data: {
            detail: [
              {
                type: 'missing',
                loc: ['body', 'period_number'],
                msg: 'Field required',
                input: null,
                ctx: {}
              }
            ]
          }
        }
      }

      studentAttendanceApi.getTodaySchedule.mockRejectedValueOnce(pydantic422Error)

      render(
        <MemoryRouter>
          <StudentAttendance />
        </MemoryRouter>
      )

      // The error should be formatted cleanly as a string, preventing React Error #31
      await waitFor(() => {
        expect(screen.getByText(/period_number: Field required/i)).toBeInTheDocument()
      })
    })
  })
})
