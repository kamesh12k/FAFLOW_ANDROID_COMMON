import { describe, it, expect } from 'vitest'
import { formatAudience } from '../pages/announcements/AnnouncementDetail'

describe('AnnouncementDetail — formatAudience (Bug 5)', () => {
  it('formats raw JSON array string ["ROLE:TEACHER", "DEPT:1"] cleanly', () => {
    const data = {
      target_summary: '["ROLE:TEACHER", "DEPT:1"]',
    }
    const result = formatAudience(data)
    expect(result).toBe('Teachers, Department: Computer Science')
    expect(result).not.toContain('[')
    expect(result).not.toContain(']')
    expect(result).not.toContain('ROLE:')
    expect(result).not.toContain('DEPT:')
  })

  it('formats raw array of tokens cleanly', () => {
    const data = {
      target_summary: ['ROLE:TEACHER', 'DEPT:1'],
    }
    const result = formatAudience(data)
    expect(result).toBe('Teachers, Department: Computer Science')
  })

  it('formats single role token', () => {
    const data = {
      target_summary: '["ROLE:TEACHER"]',
    }
    expect(formatAudience(data)).toBe('Teachers')
  })

  it('formats multiple roles cleanly', () => {
    const data = {
      target_summary: '["ROLE:ADMIN", "ROLE:HOD", "ROLE:STAFF"]',
    }
    expect(formatAudience(data)).toBe('Administrators, Department Heads (HODs), Staff')
  })

  it('formats single department token with ID lookup', () => {
    const data = {
      target_summary: '["DEPT:1"]',
    }
    expect(formatAudience(data)).toBe('Department: Computer Science')
  })

  it('uses department_name from data or targets when resolving department', () => {
    const data = {
      target_summary: '["DEPT:99"]',
      department_name: 'Aerospace Engineering',
      department_id: 99,
    }
    expect(formatAudience(data)).toBe('Department: Aerospace Engineering')
  })

  it('formats standard COLLEGE target summary', () => {
    expect(formatAudience({ target_summary: 'COLLEGE' })).toBe('All College Faculty')
  })

  it('formats standard DEPARTMENT target summary with department_name', () => {
    expect(formatAudience({ target_summary: 'DEPARTMENT', department_name: 'Computer Science' })).toBe('Computer Science Department')
    expect(formatAudience({ target_summary: 'DEPARTMENT' })).toBe('Department Faculty')
  })

  it('formats structured targets array with departments and users', () => {
    const data = {
      targets: [
        { target_type: 'DEPARTMENT', department_name: 'Computer Science' },
      ],
    }
    expect(formatAudience(data)).toBe('Computer Science Department')
  })

  it('formats comma-separated token string', () => {
    const data = {
      target_summary: 'ROLE:TEACHER, DEPT:1',
    }
    expect(formatAudience(data)).toBe('Teachers, Department: Computer Science')
  })

  it('handles null/undefined gracefully', () => {
    expect(formatAudience(null)).toBe('All Faculty')
    expect(formatAudience({})).toBe('Institutional Recipients')
  })
})
