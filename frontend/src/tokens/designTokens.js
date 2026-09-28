/**
 * FAFLOW Unified Design System Tokens
 * Canonical token export derived from design/tokens/faflow_design_tokens.json
 * Maps 1:1 with Android's com.governence.faflow.ui.theme.FaflowDesignTokens
 */

export const FaflowColors = {
  // Brand Palettes
  navy: {
    50: '#EAF0F9',
    100: '#D5E2F4',
    200: '#ABC4E9',
    300: '#81A6DE',
    400: '#5788D3',
    500: '#2E5490',
    600: '#1B3A6B',
    700: '#162E56',
    800: '#102340',
    900: '#0B172B',
  },
  teal: {
    50: '#E4F3F1',
    100: '#C9E8E4',
    200: '#94D1C9',
    300: '#5FBAAE',
    400: '#2AA393',
    500: '#128C7E',
    600: '#0E8074',
    700: '#0B665D',
    800: '#084C46',
    900: '#05332F',
  },
  violet: {
    50: '#EFEBFC',
    100: '#DFD7FA',
    200: '#BFAFF5',
    300: '#9F87F0',
    400: '#7F5FEB',
    500: '#6C4FCE',
    600: '#5B42AE',
    700: '#49358C',
    800: '#37286B',
    900: '#251B49',
  },
  gold: {
    50: '#FBF1DF',
    100: '#F6E3BE',
    200: '#EDC87D',
    300: '#E3AC3C',
    400: '#C4901C',
    500: '#A6790A',
    600: '#876208',
    700: '#674B06',
    800: '#483404',
    900: '#281D02',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
  },
  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
  },

  // Surfaces & Base
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E6E8EC',
  divider: '#EEF0F3',
  text1: '#1A1D21',
  text2: '#5B6169',
  text3: '#9AA1A9',
}

export const FaflowRoleColors = {
  teacher: { primary: '#1B3A6B', bg: '#EAF0F9', label: 'Faculty / Teacher' },
  hod: { primary: '#6C4FCE', bg: '#EFEBFC', label: 'Head of Department' },
  principal: { primary: '#A6790A', bg: '#FBF1DF', label: 'Principal' },
  governance: { primary: '#0E8074', bg: '#E4F3F1', label: 'Governance Admin' },
  manager: { primary: '#475569', bg: '#F1F5F9', label: 'Operational Manager' },
  staff: { primary: '#334155', bg: '#F8FAFC', label: 'Staff Member' },
}

export const FaflowStatusColors = {
  approved: { text: '#1E8E5A', bg: '#E4F3F1', border: '#A7F3D0', label: 'Approved' },
  present: { text: '#1E8E5A', bg: '#E4F3F1', border: '#A7F3D0', label: 'Present' },
  pending: { text: '#A6790A', bg: '#FBF1DF', border: '#EDC87D', label: 'Pending Review' },
  rejected: { text: '#C13F3F', bg: '#FDE8E8', border: '#FECDD3', label: 'Rejected' },
  absent: { text: '#C13F3F', bg: '#FDE8E8', border: '#FECDD3', label: 'Absent' },
  cancelled: { text: '#55606B', bg: '#EEF0F2', border: '#CBD5E1', label: 'Cancelled' },
  info: { text: '#1B3A6B', bg: '#EAF0F9', border: '#ABC4E9', label: 'Info' },
}

export const FaflowSpacing = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
}

export const FaflowRadius = {
  xs: '4px',
  sm: '8px',
  input: '10px',
  button: '10px',
  badge: '11px',
  md: '12px',
  card: '13px',
  hero: '14px',
  lg: '16px',
  xl: '20px',
  sheet: '24px',
  full: '9999px',
}
