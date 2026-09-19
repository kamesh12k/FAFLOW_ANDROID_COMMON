/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Reads from CSS variables set on :root by ThemeProvider (see
        // src/context/ThemeContext.jsx), which derives all shades
        // from the single PRIMARY_COLOR value returned by
        // GET /settings/public — so every bg-primary-600 / text-primary-700
        // / etc. class across the whole app re-themes from one setting,
        // with no per-component changes needed. Falls back to the
        // original indigo values via the var(--x, fallback) syntax so the
        // app still looks right before that fetch resolves.
        primary: {
          50:  'var(--color-primary-50,  #eef2ff)',
          100: 'var(--color-primary-100, #e0e7ff)',
          200: 'var(--color-primary-200, #c7d2fe)',
          300: 'var(--color-primary-300, #a5b4fc)',
          400: 'var(--color-primary-400, #818cf8)',
          500: 'var(--color-primary-500, #6366f1)',
          600: 'var(--color-primary-600, #4f46e5)',
          700: 'var(--color-primary-700, #4338ca)',
          800: 'var(--color-primary-800, #3730a3)',
          900: 'var(--color-primary-900, #1e1b4b)',
        },
        // Named surface tokens — consumed by AppShell
        surface: 'var(--color-surface, #f8f9fc)',
        card:    'var(--color-card,    #ffffff)',
        // Sidebar dark palette — standard slate shades aliased for clarity
        'sidebar-dark': {
          bg:     '#020617', // slate-950
          border: '#1e293b', // slate-800
          hover:  '#1e293b', // slate-800
          muted:  '#64748b', // slate-500
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02)',
        'card-hover': '0 8px 30px -4px rgba(0,0,0,0.07), 0 4px 6px -2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
