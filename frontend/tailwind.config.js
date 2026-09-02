/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Reads from CSS variables set on :root by ThemeProvider (see
        // src/context/ThemeContext.jsx), which derives all five shades
        // from the single PRIMARY_COLOR value returned by
        // GET /settings/public — so every bg-primary-600 / text-primary-700
        // / etc. class across the whole app re-themes from one setting,
        // with no per-component changes needed. Falls back to the
        // original indigo values via the var(--x, fallback) syntax so the
        // app still looks right before that fetch resolves.
        primary: {
          50:  'var(--color-primary-50, #eef2ff)',
          100: 'var(--color-primary-100, #e0e7ff)',
          500: 'var(--color-primary-500, #6366f1)',
          600: 'var(--color-primary-600, #4f46e5)',
          700: 'var(--color-primary-700, #4338ca)',
          900: 'var(--color-primary-900, #1e1b4b)',
        },
        surface: '#f8f9fc',
        card: '#ffffff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
