/**
 * Predefined theme configurations for FAFLOW.
 * Enables quick client-specific style changes without rewriting code.
 */
export const THEMES = {
  enterprise: {
    name: 'Enterprise',
    primaryColor: '#0f172a', // Slate 900
    secondaryColor: '#475569', // Slate 600
    accentColor: '#3b82f6', // Blue 500
    borderRadius: 'rounded-xl',
    fontFamily: 'font-sans',
    sidebarStyle: 'dark',
    cardShadow: 'shadow-sm border border-slate-100',
    loginBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
  },
  university: {
    name: 'University',
    primaryColor: '#1e3a8a', // Navy 900
    secondaryColor: '#3b82f6', // Blue 500
    accentColor: '#b91c1c', // Red 700
    borderRadius: 'rounded-md',
    fontFamily: 'font-serif',
    sidebarStyle: 'light border-r border-slate-200',
    cardShadow: 'shadow-md border border-slate-200/60',
    loginBg: 'bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900',
  },
  school: {
    name: 'School',
    primaryColor: '#0f766e', // Teal 700
    secondaryColor: '#0d9488', // Teal 600
    accentColor: '#10b981', // Emerald 500
    borderRadius: 'rounded-2xl',
    fontFamily: 'font-sans',
    sidebarStyle: 'accent',
    cardShadow: 'shadow-sm border border-teal-100',
    loginBg: 'bg-gradient-to-br from-teal-800 via-emerald-900 to-teal-950',
  },
  corporate: {
    name: 'Corporate',
    primaryColor: '#1e293b', // Slate 800
    secondaryColor: '#64748b', // Slate 500
    accentColor: '#10b981', // Emerald 500
    borderRadius: 'rounded-xl',
    fontFamily: 'font-sans',
    sidebarStyle: 'dark',
    cardShadow: 'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] border border-slate-100',
    loginBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-850',
  },
  healthcare: {
    name: 'Healthcare',
    primaryColor: '#0284c7', // Sky 600
    secondaryColor: '#0ea5e9', // Sky 500
    accentColor: '#0d9488', // Teal 600
    borderRadius: 'rounded-2xl',
    fontFamily: 'font-sans',
    sidebarStyle: 'light border-r border-slate-100',
    cardShadow: 'shadow-sm border border-slate-100',
    loginBg: 'bg-gradient-to-br from-sky-900 via-teal-950 to-slate-900',
  },
  dark: {
    name: 'Dark Mode',
    primaryColor: '#6366f1', // Indigo 500
    secondaryColor: '#a5b4fc', // Indigo 300
    accentColor: '#818cf8', // Indigo 400
    borderRadius: 'rounded-xl',
    fontFamily: 'font-sans',
    sidebarStyle: 'dark',
    cardShadow: 'shadow-sm border border-slate-800/80 bg-slate-900 text-white',
    loginBg: 'bg-slate-950',
    isDarkMode: true,
  },
}
