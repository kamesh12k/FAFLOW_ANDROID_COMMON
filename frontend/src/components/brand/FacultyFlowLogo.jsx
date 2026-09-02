import React from 'react';

/**
 * FacultyFlowLogo — Centralized FACULTY FLOW brand mark component.
 *
 * Inline SVG vector rendering based on the official brand identity.
 * Transparent background, works on dark & light surfaces.
 *
 * Props:
 *   variant     'mark'    → symbol only               (collapsed sidebar, mobile topbar)
 *               'inline'  → symbol + wordmark h-stack (sidebar expanded)
 *               'full'    → symbol + wordmark v-stack (login / register headers)
 *   size        number    → mark height/width in px   (default 40)
 *   dark        boolean   → true = light text (dark bg), false = dark navy text (light bg)
 *   showTagline boolean   → render sub-tagline below wordmark (full variant only)
 *   className   string    → extra classes on wrapper
 */
export default function FacultyFlowLogo({
  variant = 'mark',
  size = 40,
  dark = false,
  showTagline = false,
  className = '',
}) {
  const wordSize = Math.max(14, Math.round(size * 0.44));
  const tagSize = Math.max(7, Math.round(size * 0.16));
  const primaryTextColor = dark ? '#ffffff' : '#104470';
  const secondaryTextColor = dark ? '#93c5fd' : '#1e5385';
  const taglineColor = dark ? '#94a3b8' : '#64748b';

  /**
   * Vector Mark:
   * ViewBox 0 0 200 200 containing the rising dynamic arrow,
   * open book icon, and ascending faculty figures with gradient streams.
   */
  const Mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Faculty Flow"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="ff-blue-grad" x1="20" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0072bc" />
          <stop offset="100%" stopColor="#0d3b66" />
        </linearGradient>
        <linearGradient id="ff-cyan-grad" x1="40" y1="60" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="ff-green-grad" x1="50" y1="120" x2="170" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {/* Main Upward Swooping Arrow */}
      <path
        d="M 64 165 C 45 135 48 82 82 48 L 74 42 L 102 36 L 96 66 L 89 59 C 62 88 58 132 75 152 Z"
        fill="url(#ff-blue-grad)"
      />

      {/* Inner Leaf / Stream Curve */}
      <path
        d="M 68 152 C 58 128 66 84 87 72 C 77 96 74 126 84 140 Z"
        fill="#0284c7"
      />

      {/* Open Book Symbol */}
      <g fill="#14b8a6">
        {/* Left Book Page */}
        <path d="M 76 68 C 84 66 91 69 91 69 L 91 91 C 91 91 84 88 76 90 Z" />
        {/* Right Book Page */}
        <path d="M 94 69 C 94 69 101 66 109 68 L 109 90 C 101 88 94 91 94 91 Z" />
      </g>

      {/* Faculty Figures - Heads */}
      <circle cx="130" cy="62" r="7.5" fill="#1e4e79" />
      <circle cx="147" cy="50" r="8" fill="#1c598a" />
      <circle cx="165" cy="38" r="9" fill="#1a6296" />

      {/* Ascending People Bodies / Unified Flow Waves */}
      <path
        d="M 65 178 C 65 178 78 140 102 118 C 114 107 122 88 126 73 C 132 84 139 74 144 63 C 150 74 158 64 167 52 C 176 44 179 46 181 48 C 173 60 162 68 155 76 C 138 95 106 122 75 186 Z"
        fill="url(#ff-blue-grad)"
      />

      {/* Mid Flow Ribbon (Cyan-Teal) */}
      <path
        d="M 65 186 C 85 160 120 126 142 108 C 160 93 170 76 174 65 C 167 80 148 100 128 116 C 102 137 76 170 65 186 Z"
        fill="url(#ff-cyan-grad)"
      />

      {/* Lower Dynamic Wave (Emerald Green) */}
      <path
        d="M 67 195 C 72 178 88 150 110 135 C 134 118 160 98 169 77 C 166 94 140 118 118 135 C 92 155 73 186 67 195 Z"
        fill="url(#ff-green-grad)"
      />
    </svg>
  );

  /* Variant: mark only */
  if (variant === 'mark') {
    return (
      <span className={`inline-flex shrink-0 ${className}`} aria-label="Faculty Flow">
        {Mark}
      </span>
    );
  }

  /* Variant: inline (side-by-side) */
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-3 min-w-0 ${className}`}>
        <span className="shrink-0">{Mark}</span>
        <span className="flex flex-col justify-center leading-none select-none">
          <span
            style={{
              fontSize: wordSize,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: primaryTextColor,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.05,
            }}
          >
            FACULTY
          </span>
          <span
            style={{
              fontSize: Math.round(wordSize * 0.95),
              fontWeight: 400,
              letterSpacing: '0.08em',
              color: secondaryTextColor,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.05,
            }}
          >
            FLOW
          </span>
        </span>
      </span>
    );
  }

  /* Variant: full (stacked - for auth/landing pages) */
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {Mark}
      <div
        className="flex flex-col items-center select-none"
        style={{ marginTop: Math.round(size * 0.2) }}
      >
        <span
          style={{
            fontSize: wordSize,
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: primaryTextColor,
            lineHeight: 1,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          FACULTY
        </span>
        <span
          style={{
            fontSize: Math.round(wordSize * 0.95),
            fontWeight: 400,
            letterSpacing: '0.1em',
            color: secondaryTextColor,
            lineHeight: 1.1,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          FLOW
        </span>
      </div>
      {showTagline && (
        <p
          style={{
            fontSize: tagSize,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: taglineColor,
            marginTop: Math.round(size * 0.12),
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Academic Workflow Application
        </p>
      )}
    </div>
  );
}
