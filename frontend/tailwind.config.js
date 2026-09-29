/** @type {import('tailwindcss').Config} */
import { faflowTailwindTheme } from './src/tokens/tailwindTheme.js'

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem',
      },
      colors: {
        ...faflowTailwindTheme.colors,
        primary: {
          50:  'var(--faflow-navy-50,  #EAF0F9)',
          100: 'var(--faflow-navy-100, #DBEAFE)',
          200: 'var(--faflow-navy-200, #BFDBFE)',
          300: 'var(--faflow-navy-300, #93C5FD)',
          400: 'var(--faflow-navy-400, #60A5FA)',
          500: 'var(--faflow-navy-500, #2E5490)',
          600: 'var(--faflow-navy-600, #1B3A6B)',
          700: 'var(--faflow-navy-700, #152E55)',
          800: 'var(--faflow-navy-800, #0F223E)',
          900: 'var(--faflow-navy-900, #0A1628)',
        },
        surface: 'var(--color-bg, #F5F6F8)',
        card:    'var(--color-card, #FFFFFF)',
        sidebar: {
          bg:          'var(--color-sidebar, #FFFFFF)',
          border:      'var(--color-sidebar-border, #E6E8EC)',
          active:      'var(--color-sidebar-active, #EAF0F9)',
          'active-text': 'var(--color-sidebar-active-text, #1B3A6B)',
        },
        control: {
          border: 'var(--color-border-control, #828C99)',
          focus:  'var(--color-border-focus, #1B3A6B)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        ...faflowTailwindTheme.boxShadow,
      },
    },
  },
  plugins: [],
}
