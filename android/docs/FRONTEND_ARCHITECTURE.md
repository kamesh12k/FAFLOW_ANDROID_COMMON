# FAFLOW — Web Frontend Architecture

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  
**Runtime:** React 18 + Vite 5 + TailwindCSS / Modern Vanilla CSS Modules + React Router DOM 6  

---

## 1. Directory Structure

```
frontend/
├── src/
│   ├── components/         # Reusable design system components (Badges, Buttons, Tables)
│   ├── pages/              # Routed pages
│   │   ├── Geofences.jsx   # Dedicated Google Maps campus geofence configuration
│   │   ├── Dashboard.jsx   # Department & institutional dashboards
│   │   ├── Attendance.jsx  # Real-time attendance ledger and daily status
│   │   ├── Biometrics.jsx  # Biometric status audit and enrollment flags
│   │   ├── Leaves.jsx      # Multi-tier leave requests and approval workflows
│   │   ├── Timetable.jsx   # Timetable matrix and slot allocation
│   │   └── Backup.jsx      # System backup and restore controls
│   ├── services/           # Axios HTTP API client layer
│   ├── context/            # Authentication & notification context providers
│   ├── styles/             # Curated design tokens, themes, typography
│   └── App.jsx             # Route definitions & guards
├── vite.config.js
└── package.json
```

---

## 2. Google Maps Admin Perimeter Configuration

Google Maps is strictly constrained to the administrative dashboard (`Geofences.jsx`):
- **Function:** Allows System Admins to search for campus addresses, drop center markers, drag circular radius handles, or draw arbitrary polygon boundaries with dynamic vertex manipulation.
- **Independence:** The calculation engine on the backend is completely decoupled from Google Maps; coordinates and radii are saved as clean numerical geometries in PostgreSQL (`center_latitude`, `center_longitude`, `radius_meters`, `polygon_vertices`).
- **Security:** Google Maps API keys are restricted to HTTP referrers and the Geocoding/Maps JavaScript APIs only.
