/**
 * FAFLOW Unified Design System Tokens
 * AUTO-GENERATED from design/tokens/faflow_design_tokens.json
 * DO NOT EDIT DIRECTLY. Run: python scripts/generate_design_tokens.py
 */

export const FaflowColors = {
  // Brand Primitives
  navy: {
    '100': '#D5E2F4',
    '200': '#ABC4E9',
    '300': '#81A6DE',
    '400': '#5788D3',
    '50': '#EAF0F9',
    '500': '#2E5490',
    '600': '#1B3A6B',
    '700': '#162E56',
    '800': '#102340',
    '900': '#0B172B',
  },
  teal: {
    '100': '#C9E8E4',
    '200': '#94D1C9',
    '300': '#5FBAAE',
    '400': '#2AA393',
    '50': '#E4F3F1',
    '500': '#128C7E',
    '600': '#0E8074',
    '700': '#0B665D',
    '800': '#084C46',
    '900': '#05332F',
  },
  violet: {
    '100': '#DFD7FA',
    '200': '#BFAFF5',
    '300': '#9F87F0',
    '400': '#7F5FEB',
    '50': '#EFEBFC',
    '500': '#6C4FCE',
    '600': '#5B42AE',
    '700': '#49358C',
    '800': '#37286B',
    '900': '#251B49',
  },
  gold: {
    '100': '#F6E3BE',
    '200': '#EDC87D',
    '300': '#E3AC3C',
    '400': '#C4901C',
    '50': '#FBF1DF',
    '500': '#A6790A',
    '600': '#876208',
    '700': '#7A5806',
    '800': '#5A4004',
    '900': '#3A2902',
  },
  slate: {
    '100': '#F1F5F9',
    '200': '#E2E8F0',
    '300': '#CBD5E1',
    '400': '#94A3B8',
    '50': '#F8FAFC',
    '500': '#64748B',
    '600': '#475569',
    '700': '#334155',
    '800': '#1E293B',
    '900': '#0F172A',
    '950': '#020617',
  },
  emerald: {
    '100': '#D1FAE5',
    '200': '#A7F3D0',
    '300': '#6EE7B7',
    '400': '#34D399',
    '50': '#ECFDF5',
    '500': '#10B981',
    '600': '#059669',
    '700': '#166B45',
    '800': '#0F5234',
    '900': '#064E3B',
  },
  rose: {
    '100': '#FFE4E6',
    '200': '#FECDD3',
    '300': '#FDA4AF',
    '400': '#FB7185',
    '50': '#FFF1F2',
    '500': '#F43F5E',
    '600': '#E11D48',
    '700': '#B02A2A',
    '800': '#8C1D1D',
    '900': '#681212',
  },
  blue: {
    '100': '#DBEAFE',
    '200': '#BFDBFE',
    '300': '#93C5FD',
    '400': '#60A5FA',
    '50': '#EFF6FF',
    '500': '#3B82F6',
    '600': '#2563EB',
    '700': '#1D4ED8',
    '800': '#1E40AF',
    '900': '#1E3A8A',
  },
  coral: {
    '500': '#E05638',
    '600': '#C44327',
    '700': '#A2321A',
  },

  // Semantic Surfaces & Neutrals
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceHover: '#F9FAFC',
  sidebar: '#FFFFFF',
  sidebarBorder: '#E6E8EC',
  sidebarActive: '#EAF0F9',
  sidebarActiveText: '#1B3A6B',

  // Borders
  border: '#E6E8EC',
  borderDivider: '#EEF0F3',
  borderControl: '#828C99',
  borderFocus: '#1B3A6B',

  // Typography
  text1: '#1A1D21',
  text2: '#5B6169',
  textMuted: '#667085',
  textInverse: '#FFFFFF',
  textBrand: '#1B3A6B',

  // Disabled & Skeletons
  disabledText: '#94A3B8',
  disabledBg: '#F1F5F9',
  disabledBorder: '#E2E8F0',
  skeletonBase: '#E2E8F0',
  skeletonHighlight: '#F1F5F9',
};

export const FaflowRoleColors = {
  teacher: { primary: '#1B3A6B', bg: '#EAF0F9', border: '#ABC4E9', label: 'Faculty / Teacher' },
  hod: { primary: '#6C4FCE', bg: '#EFEBFC', border: '#BFAFF5', label: 'Head of Department (HOD)' },
  principal: { primary: '#7A5806', bg: '#FBF1DF', border: '#EDC87D', label: 'Principal / Dean' },
  governance: { primary: '#0B665D', bg: '#E4F3F1', border: '#94D1C9', label: 'Governance Control' },
  manager: { primary: '#334155', bg: '#F1F5F9', border: '#CBD5E1', label: 'Operational Manager' },
  staff: { primary: '#1B3A6B', bg: '#EAF0F9', border: '#ABC4E9', label: 'Support & Lab Staff' },
};

export const FaflowStatusColors = {
  success: { text: '#166B45', bg: '#ECFDF5', border: '#A7F3D0' },
  warning: { text: '#7A5806', bg: '#FBF1DF', border: '#EDC87D' },
  error: { text: '#B02A2A', bg: '#FFF1F2', border: '#FECDD3' },
  info: { text: '#1B3A6B', bg: '#EAF0F9', border: '#ABC4E9' },
  neutral: { text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
};

export const FaflowCharts = [
  "#1B3A6B",
  "#0E8074",
  "#6C4FCE",
  "#7A5806",
  "#2563EB",
  "#E05638"
];

export const FaflowSpacing = {
  "xxs": "2px",
  "xs": "4px",
  "sm": "8px",
  "md": "12px",
  "lg": "16px",
  "xl": "20px",
  "xxl": "24px",
  "xxxl": "32px",
  "huge": "40px",
  "giant": "48px"
};

export const FaflowRadius = {
  "xs": "4px",
  "sm": "8px",
  "input": "10px",
  "button": "10px",
  "badge": "11px",
  "md": "12px",
  "card": "14px",
  "hero": "16px",
  "lg": "16px",
  "xl": "20px",
  "sheet": "24px",
  "full": "9999px"
};

export const FaflowElevation = {
  "flat": "none",
  "sm": "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
  "card": "0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px -1px rgba(16, 24, 40, 0.04)",
  "cardHover": "0 8px 20px -4px rgba(27, 58, 107, 0.08), 0 4px 6px -2px rgba(27, 58, 107, 0.04)",
  "raised": "0 4px 8px -2px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04)",
  "dialog": "0 20px 25px -5px rgba(16, 24, 40, 0.1), 0 8px 10px -6px rgba(16, 24, 40, 0.08)",
  "sheet": "0 -8px 24px -4px rgba(16, 24, 40, 0.12)"
};

