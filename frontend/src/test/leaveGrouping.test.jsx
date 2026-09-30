import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LeaveHistory from '../pages/teacher/LeaveHistory'
import { leavesApi, leaveBalancesApi } from '../api/services'

vi.mock('../api/services', () => ({
  leavesApi: {
    myLeaves: vi.fn(),
    cancel: vi.fn().mockResolvedValue({ data: {} }),
  },
  leaveBalancesApi: {
    getMyBalances: vi.fn().mockResolvedValue({ data: { balances: [], substitution_credit_balance: 0 } }),
    getTeacherLedger: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Dr. Jane Smith', role: 'teacher', department_id: 1 },
    token: 'fake-token',
    isAdmin: false,
    isSecondaryAdmin: false,
    isSuperAdmin: false,
  }),
}))

describe('LeaveHistory — Period Duplication Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('separates multiple cancelled batches on the same day instead of lumping into 11 duplicated periods', async () => {
    // 11 cancelled records on Sep 22, 2026 from 3 separate submissions on Sep 21:
    // Batch 1 (5 periods): P1, P2, P3, P4, P5
    // Batch 2 (5 periods): P1, P2, P3, P4, P5
    // Batch 3 (1 period):  P2
    const mockLeaves = [
      // Batch 1
      { id: 1, date: '2026-09-22', day_order: 4, period_number: 1, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-1', created_at: '2026-09-21T10:00:00Z' },
      { id: 2, date: '2026-09-22', day_order: 4, period_number: 2, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-1', created_at: '2026-09-21T10:00:00Z' },
      { id: 3, date: '2026-09-22', day_order: 4, period_number: 3, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-1', created_at: '2026-09-21T10:00:00Z' },
      { id: 4, date: '2026-09-22', day_order: 4, period_number: 4, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-1', created_at: '2026-09-21T10:00:00Z' },
      { id: 5, date: '2026-09-22', day_order: 4, period_number: 5, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-1', created_at: '2026-09-21T10:00:00Z' },

      // Batch 2
      { id: 6, date: '2026-09-22', day_order: 4, period_number: 1, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-2', created_at: '2026-09-21T14:00:00Z' },
      { id: 7, date: '2026-09-22', day_order: 4, period_number: 2, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-2', created_at: '2026-09-21T14:00:00Z' },
      { id: 8, date: '2026-09-22', day_order: 4, period_number: 3, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-2', created_at: '2026-09-21T14:00:00Z' },
      { id: 9, date: '2026-09-22', day_order: 4, period_number: 4, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-2', created_at: '2026-09-21T14:00:00Z' },
      { id: 10, date: '2026-09-22', day_order: 4, period_number: 5, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-2', created_at: '2026-09-21T14:00:00Z' },

      // Batch 3
      { id: 11, date: '2026-09-22', day_order: 4, period_number: 2, status: 'cancelled', reason: 'Personal reason', batch_id: 'batch-3', created_at: '2026-09-21T16:27:48Z' },
    ]

    leavesApi.myLeaves.mockResolvedValue({ data: mockLeaves })

    render(
      <MemoryRouter>
        <LeaveHistory />
      </MemoryRouter>
    )

    await waitFor(() => {
      // It should NOT render "11 Periods"
      expect(screen.queryByText('11 Periods')).toBeNull()
    })

    // It should render two "5 Periods" rows and one "1 Period" row
    const fivePeriodsElements = screen.getAllByText('5 Periods')
    expect(fivePeriodsElements.length).toBeGreaterThanOrEqual(1)

    const onePeriodElements = screen.getAllByText('1 Period')
    expect(onePeriodElements.length).toBeGreaterThanOrEqual(1)

    // Open Details on the 5-period group (index 1, since index 0 is the 16:27:48 1-period leave)
    const detailsButtons = screen.getAllByRole('button', { name: 'Details' })
    fireEvent.click(detailsButtons[1])

    // Inside the modal, the switch period buttons should only show 5 unique periods (P1 to P5), never duplicates
    const modalPeriodButtons = screen.getAllByRole('button', { name: /^Period [1-5]$/ })
    expect(modalPeriodButtons.length).toBe(5)
    expect(modalPeriodButtons.map(b => b.textContent)).toEqual([
      'Period 1',
      'Period 2',
      'Period 3',
      'Period 4',
      'Period 5',
    ])
  })

  it('safely isolates unbatched leaves with different timestamps and prevents period collisions', async () => {
    // Legacy / unbatched leaves without batch_id
    const mockLeaves = [
      { id: 101, date: '2026-09-22', day_order: 4, period_number: 1, status: 'cancelled', reason: 'Personal reason', batch_id: null, created_at: '2026-09-21T10:00:00Z' },
      { id: 102, date: '2026-09-22', day_order: 4, period_number: 1, status: 'cancelled', reason: 'Personal reason', batch_id: null, created_at: '2026-09-21T14:00:00Z' },
    ]

    leavesApi.myLeaves.mockResolvedValue({ data: mockLeaves })

    render(
      <MemoryRouter>
        <LeaveHistory />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Should NOT group them into "2 Periods" with P1 P1
      expect(screen.queryByText('2 Periods')).toBeNull()
    })

    // Both should be "1 Period" groups
    const onePeriodElements = screen.getAllByText('1 Period')
    expect(onePeriodElements.length).toBeGreaterThanOrEqual(2)
  })
})
