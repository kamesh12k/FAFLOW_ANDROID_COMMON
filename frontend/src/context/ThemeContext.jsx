import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { publicSettingsApi } from '../api/services'
import { BRAND_CONFIG } from '../config/branding'
import { THEMES } from '../config/themes'

const ThemeContext = createContext(null)

const DEFAULT_BRANDING = {
  app_name: 'FAFLOW',
  primary_color: '#4f46e5',
  periods_per_day: 5,
  day_order_max: 6,
}

// --- Tiny hex <-> HSL helpers, just enough to derive a 5-shade scale from
// one base color without pulling in a color library for this one feature. ---

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  } else {
    return null // not a recognizable hex string; caller falls back to defaults
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToHex(h, s, l) {
  s = Math.min(1, Math.max(0, s))
  l = Math.min(1, Math.max(0, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Lightness targets chosen to visually match the original indigo scale's
// own shade spacing (50 very light, 900 very dark, 600 as the "base" tone).
const SHADE_LIGHTNESS = { 50: 0.95, 100: 0.9, 500: 0.6, 600: 0.5, 700: 0.4, 900: 0.15 }

function deriveShades(baseHex) {
  const hsl = hexToHsl(baseHex)
  if (!hsl) return null
  const shades = {}
  for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
    // Keep saturation reasonably strong for the lighter tints so they
    // don't wash out to gray, and slightly reduce it for the darkest
    // shade so 900 doesn't look neon.
    const s = shade === '900' ? Math.min(hsl.s, 0.6) : hsl.s
    shades[shade] = hslToHex(hsl.h, s, lightness)
  }
  return shades
}

function applyTheme(branding, themeName = 'enterprise') {
  const preset = THEMES[themeName] || THEMES.enterprise
  const primaryColor = preset.primaryColor || branding.primary_color || '#4f46e5'
  
  const shades = deriveShades(primaryColor) || deriveShades(DEFAULT_BRANDING.primary_color)
  if (shades) {
    const root = document.documentElement
    for (const [key, hex] of Object.entries(shades)) {
      root.style.setProperty(`--color-primary-${key}`, hex)
    }
    
    // Inject accent color and custom CSS tokens
    root.style.setProperty('--color-accent', preset.accentColor || '#3b82f6')
    root.style.setProperty('--border-radius-custom', preset.borderRadius === 'rounded-md' ? '6px' : (preset.borderRadius === 'rounded-2xl' ? '16px' : '12px'))
    
    // Handle Dark Mode
    if (preset.isDarkMode) {
      root.classList.add('dark')
      root.style.setProperty('--color-surface', '#0f172a')
      root.style.setProperty('--color-card', '#1e293b')
      root.style.setProperty('--color-text-base', '#f1f5f9')
    } else {
      root.classList.remove('dark')
      root.style.setProperty('--color-surface', '#f8f9fc')
      root.style.setProperty('--color-card', '#ffffff')
      root.style.setProperty('--color-text-base', '#1e293b')
    }
  }
  
  const title = branding.app_name || BRAND_CONFIG.appName
  document.title = title
}

export function ThemeProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loaded, setLoaded] = useState(false)
  const [activeTheme, setActiveThemeState] = useState(() => {
    return localStorage.getItem('faflow_active_theme') || BRAND_CONFIG.defaultTheme
  })

  const changeTheme = useCallback((themeName) => {
    if (THEMES[themeName]) {
      localStorage.setItem('faflow_active_theme', themeName)
      setActiveThemeState(themeName)
      applyTheme(branding, themeName)
    }
  }, [branding])

  useEffect(() => {
    publicSettingsApi.get()
      .then(r => {
        const merged = { ...DEFAULT_BRANDING, ...r.data }
        setBranding(merged)
        applyTheme(merged, activeTheme)
      })
      .catch(() => {
        applyTheme(DEFAULT_BRANDING, activeTheme)
      })
      .finally(() => setLoaded(true))
  }, [activeTheme])

  const themePreset = THEMES[activeTheme] || THEMES.enterprise

  return (
    <ThemeContext.Provider value={{ 
      ...branding, 
      loaded, 
      activeTheme, 
      changeTheme, 
      themePreset, 
      THEMES 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
