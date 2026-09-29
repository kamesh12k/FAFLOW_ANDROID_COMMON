import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationBell from '../components/layout/NotificationBell'
import { notificationsApi } from '../api/services'

vi.mock('../api/services', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('NotificationBell & notificationsApi (Bug 7 — Persistence)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationsApi.unreadCount.mockResolvedValue({ data: { count: 2 } })
    notificationsApi.list.mockResolvedValue({
      data: [
        {
          id: 101,
          title: 'Leave Approved',
          body: 'Your leave application was approved by Principal.',
          event_type: 'leave_approved',
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 102,
          title: 'Timetable Assigned',
          body: 'You have been assigned Period 3 on Monday.',
          event_type: 'timetable_assigned',
          is_read: true,
          created_at: new Date().toISOString(),
        },
      ],
    })
    notificationsApi.clearAll.mockResolvedValue({ data: { ok: true, message: 'All notifications cleared' } })
    notificationsApi.delete.mockResolvedValue({ data: { ok: true } })
    notificationsApi.markAllRead.mockResolvedValue({ data: { ok: true } })
  })

  it('notificationsApi exports clearAll and delete functions', () => {
    expect(typeof notificationsApi.clearAll).toBe('function')
    expect(typeof notificationsApi.delete).toBe('function')
  })

  it('renders unread badge count from backend', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('opens notification popover and displays notification items', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    const bellBtn = screen.getByLabelText(/Notifications/i)
    fireEvent.click(bellBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Leave Approved' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Timetable Assigned' })).toBeInTheDocument()
    })
  })

  it('calls notificationsApi.clearAll when Clear all is clicked, emptying items and refreshing count', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    // Open popover
    const bellBtn = screen.getByLabelText(/Notifications/i)
    fireEvent.click(bellBtn)

    await waitFor(() => {
      expect(screen.getByText('Clear all')).toBeInTheDocument()
    })

    // Click Clear all
    const clearBtn = screen.getByText('Clear all')
    fireEvent.click(clearBtn)

    await waitFor(() => {
      expect(notificationsApi.clearAll).toHaveBeenCalledTimes(1)
    })

    // Assert empty state is displayed
    await waitFor(() => {
      expect(screen.getByText(/No notifications yet/i)).toBeInTheDocument()
    })
  })

  it('calls notificationsApi.delete when an individual item dismiss button is clicked', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    // Open popover
    const bellBtn = screen.getByLabelText(/Notifications/i)
    fireEvent.click(bellBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Leave Approved' })).toBeInTheDocument()
    })

    // Find dismiss buttons (title="Dismiss notification")
    const dismissBtns = screen.getAllByTitle('Dismiss notification')
    expect(dismissBtns.length).toBe(2)

    // Click dismiss on first item
    fireEvent.click(dismissBtns[0])

    await waitFor(() => {
      expect(notificationsApi.delete).toHaveBeenCalledWith(101)
    })
  })
})
