import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminClasses from '../pages/admin/Classes'
import { classesApi, departmentsApi, roomsApi } from '../api/services'

vi.mock('../api/services', () => ({
  classesApi: {
    list: vi.fn(),
    create: vi.fn(),
    bulkCreate: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  departmentsApi: {
    list: vi.fn(),
  },
  roomsApi: {
    list: vi.fn(),
  },
  classRollRulesApi: {
    previewImport: vi.fn(),
    commitImport: vi.fn(),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', role: 'system_admin' },
    isSystemAdmin: true,
  }),
}))

describe('Bug 8 — /admin/classes Base Room Assignment', () => {
  const mockClasses = [
    {
      id: 1,
      name: 'I CS',
      section: 'A',
      department_id: 1,
      semester: 1,
      default_room_id: null,
      default_room_number: null,
      default_room_type: null,
    },
    {
      id: 2,
      name: 'II CS',
      section: 'B',
      department_id: 1,
      semester: 3,
      default_room_id: 10,
      default_room_number: 'B-101',
      default_room_type: 'classroom',
    },
  ]

  const mockRooms = [
    { id: 10, room_number: 'B-101', room_type: 'classroom', capacity: 60, primary_class_name: 'II CS' },
    { id: 11, room_number: 'B-102', room_type: 'classroom', capacity: 60, primary_class_name: null },
  ]

  const mockDepartments = [
    { id: 1, name: 'Computer Science', code: 'CS' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    classesApi.list.mockResolvedValue({ data: mockClasses })
    roomsApi.list.mockResolvedValue({ data: mockRooms })
    departmentsApi.list.mockResolvedValue({ data: mockDepartments })
    classesApi.update.mockResolvedValue({ data: { ...mockClasses[0], default_room_id: 11, default_room_number: 'B-102' } })
  })

  it('renders "+ Assign Room" button for classes without base room', async () => {
    render(
      <MemoryRouter>
        <AdminClasses />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('I CS')).toBeInTheDocument()
    })

    const assignBtn = screen.getByTitle('Assign base classroom for I CS - A')
    expect(assignBtn).toBeInTheDocument()
    expect(assignBtn).toHaveTextContent('+ Assign Room')
  })

  it('renders room badge when class already has an assigned base room', async () => {
    render(
      <MemoryRouter>
        <AdminClasses />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('II CS')).toBeInTheDocument()
    })

    const roomBadge = screen.getByTitle('Click to change base classroom')
    expect(roomBadge).toBeInTheDocument()
    expect(roomBadge).toHaveTextContent('B-101')
  })

  it('opens Assign Base Classroom modal and submits assignment', async () => {
    render(
      <MemoryRouter>
        <AdminClasses />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('I CS')).toBeInTheDocument()
    })

    // Click "+ Assign Room" button
    const assignBtn = screen.getByTitle('Assign base classroom for I CS - A')
    fireEvent.click(assignBtn)

    // Modal should be open
    await waitFor(() => {
      expect(screen.getByText('Assign Base Classroom')).toBeInTheDocument()
    })

    // Select room B-102
    const select = screen.getByLabelText('Select Base Classroom')
    fireEvent.change(select, { target: { value: '11' } })

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /Save Room Assignment/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(classesApi.update).toHaveBeenCalledWith(1, {
        name: 'I CS',
        section: 'A',
        department_id: 1,
        semester: 1,
        default_room_id: 11,
      })
    })
  })
})
