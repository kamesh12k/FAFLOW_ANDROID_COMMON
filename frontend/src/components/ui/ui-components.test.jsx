import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, StatusBadge, ErrorAlert, CreditChip, RoleBadge, Chip, Pagination } from './index'

describe('UI Components', () => {
  describe('Button', () => {
    it('renders with children text and handles clickability', () => {
      render(<Button>Click Me</Button>)
      const btn = screen.getByRole('button', { name: /click me/i })
      expect(btn).toBeInTheDocument()
      expect(btn).not.toBeDisabled()
    })

    it('renders disabled state when disabled prop is true', () => {
      render(<Button disabled>Disabled Action</Button>)
      const btn = screen.getByRole('button', { name: /disabled action/i })
      expect(btn).toBeDisabled()
    })

    it('renders loading state when loading prop is true', () => {
      render(<Button loading>Saving</Button>)
      const btn = screen.getByRole('button')
      expect(btn).toBeDisabled()
    })
  })

  describe('StatusBadge', () => {
    it('renders correct label and status styling for approved', () => {
      render(<StatusBadge status="approved" />)
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('renders special label for approved_with_exception', () => {
      render(<StatusBadge status="approved_with_exception" />)
      expect(screen.getByText('Approved w/ Exception')).toBeInTheDocument()
    })

    it('handles pending status', () => {
      render(<StatusBadge status="pending" />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
  })

  describe('ErrorAlert', () => {
    it('returns null when message is empty or null', () => {
      const { container } = render(<ErrorAlert message="" />)
      expect(container.firstChild).toBeNull()
    })

    it('humanizes 401 unauthorized errors', () => {
      render(<ErrorAlert message="401 unauthorized" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Your session has expired/i)).toBeInTheDocument()
    })

    it('displays custom string error messages', () => {
      render(<ErrorAlert message="Failed to connect to biometric scanner" />)
      expect(screen.getByText(/Failed to connect to biometric scanner/i)).toBeInTheDocument()
    })
  })

  describe('CreditChip', () => {
    it('displays positive numbers with plus prefix', () => {
      render(<CreditChip value={5} />)
      expect(screen.getByText('+5')).toBeInTheDocument()
    })

    it('displays zero without plus prefix', () => {
      render(<CreditChip value={0} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('displays negative values correctly', () => {
      render(<CreditChip value={-3} />)
      expect(screen.getByText('-3')).toBeInTheDocument()
    })
  })

  describe('RoleBadge', () => {
    it('renders Teacher role badge', () => {
      render(<RoleBadge role="teacher" />)
      expect(screen.getByText(/Teacher/i)).toBeInTheDocument()
    })

    it('renders Principal role badge', () => {
      render(<RoleBadge role="principal" />)
      expect(screen.getByText(/Principal/i)).toBeInTheDocument()
    })

    it('renders Governance role badge', () => {
      render(<RoleBadge role="governance" />)
      expect(screen.getByText(/Governance/i)).toBeInTheDocument()
    })
  })

  describe('Chip', () => {
    it('renders label and handles remove click', () => {
      let removed = false
      render(<Chip label="Biometrics" onRemove={() => { removed = true }} />)
      expect(screen.getByText('Biometrics')).toBeInTheDocument()
      const removeBtn = screen.getByRole('button', { name: /remove biometrics/i })
      removeBtn.click()
      expect(removed).toBe(true)
    })
  })

  describe('Pagination', () => {
    it('returns null when totalPages <= 1', () => {
      const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders page info and navigation buttons when totalPages > 1', () => {
      let currentPage = 2
      render(
        <Pagination
          page={currentPage}
          totalPages={5}
          onChange={(p) => { currentPage = p }}
        />
      )
      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
      const prevBtn = screen.getByRole('button', { name: /previous page/i })
      const nextBtn = screen.getByRole('button', { name: /next page/i })
      expect(prevBtn).not.toBeDisabled()
      expect(nextBtn).not.toBeDisabled()

      nextBtn.click()
      expect(currentPage).toBe(3)

      prevBtn.click()
      expect(currentPage).toBe(1)
    })

    it('disables Prev button on first page and Next button on last page', () => {
      const { rerender } = render(<Pagination page={1} totalPages={3} onChange={() => {}} />)
      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled()

      rerender(<Pagination page={3} totalPages={3} onChange={() => {}} />)
      expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
    })
  })
})
