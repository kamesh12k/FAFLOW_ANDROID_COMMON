# FAFLOW — Google Maps Geofence Configuration Architecture

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Architectural Principle: Decoupled Configuration vs Execution

In the FAFLOW ecosystem, **Google Maps is strictly a visual configuration and administrative design layer**, NOT the attendance authorization or security engine.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ADMIN CONFIGURATION WORKFLOW                          │
│                                                                             │
│  Administrator opens Geofence Settings (Web Dashboard)                      │
│       │                                                                     │
│       ▼                                                                     │
│  Searches campus / address via Google Maps / Geocoder                       │
│       │                                                                     │
│       ▼                                                                     │
│  Adjusts center pin & drag-resizes radius handle / polygon vertices         │
│       │                                                                     │
│       ▼                                                                     │
│  Reviews real-time coordinates, area, and tolerance meters                  │
│       │                                                                     │
│       ▼                                                                     │
│  POST /geofences/ -> PostgreSQL (Stores provider-neutral geometries)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ (Persisted once)
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ATTENDANCE VERIFICATION RUNTIME (ZERO MAPS)                 │
│                                                                             │
│  Teacher opens FAFLOW Android App -> Taps "Check In"                        │
│       │                                                                     │
│       ▼                                                                     │
│  Android FusedLocationProviderClient acquires real device GPS               │
│       │                                                                     │
│       ▼                                                                     │
│  POST /attendance/check-in {lat, lon, accuracy, ...}                        │
│       │                                                                     │
│       ▼                                                                     │
│  FastAPI Backend validates accuracy <= 50m, mock status, freshness          │
│       │                                                                     │
│       ▼                                                                     │
│  Backend queries PostgreSQL active geofences directly                       │
│       │                                                                     │
│       ▼                                                                     │
│  Backend computes Haversine distance / Jordan Curve ray-casting             │
│       │                                                                     │
│       ▼                                                                     │
│  InsideGeofence -> Allow | OutsideAllGeofences -> Reject                    │
│                                                                             │
│  *** ZERO GOOGLE MAPS API CALLS OCCUR DURING ATTENDANCE ***                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Google Maps Usage Matrix

| Functional Area | Google Maps Allowed? | Rationale |
| :--- | :---: | :--- |
| **Admin Address Search** | **YES** | Search campus addresses, institution names, or pincodes. |
| **Admin Campus Placement** | **YES** | Drop pin, inspect boundary, satellite vs roadmap toggle. |
| **Admin Radius / Polygon Tuning** | **YES** | Visual circle radius slider and draggable polygon vertices. |
| **Coordinate Confirmation** | **YES** | Visual feedback showing latitude and longitude before saving. |
| **Teacher Attendance Check In** | **NO** | Replaced by native Android GPS + Backend Haversine math. |
| **Teacher Attendance Check Out** | **NO** | Replaced by native Android GPS + Backend Haversine math. |
| **Continuous Location Tracking** | **NO** | Prohibited for privacy and zero battery drain. |
| **Backend Geofence Calculation** | **NO** | Pure Python spherical trigonometry; no external API dependency. |
| **Biometric Face Verification** | **NO** | On-device ONNX runtime execution. |

---

## 3. Database Source of Truth (`campus_geofences`)

All geofence perimeters are persisted in PostgreSQL in provider-neutral formats:

```sql
CREATE TABLE campus_geofences (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'circle' or 'polygon'
    center_latitude DOUBLE PRECISION NOT NULL,
    center_longitude DOUBLE PRECISION NOT NULL,
    radius_meters DOUBLE PRECISION NOT NULL,
    polygon_vertices JSONB, -- Array of [lat, lon] pairs
    tolerance_meters DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    area_sq_meters DOUBLE PRECISION,
    perimeter_meters DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Because coordinates, radii, and polygon vertices are stored as pure numbers, FAFLOW can swap map providers (e.g., Google Maps, Leaflet, Mapbox, OpenStreetMap) at any time without altering a single line of the backend attendance engine.

---

## 4. Cost Optimization & Security

1. **Zero Recurring Attendance Cost:** If an institution logs 10,000 teacher check-ins per day, Google Maps API call volume is **0 calls**. Google Maps is called only when an administrator edits or creates a perimeter (typically once per semester or year).
2. **Key Restrictions:** When a Google Maps API Key (`VITE_GOOGLE_MAPS_API_KEY`) is deployed:
   - Restrict to HTTP referrers (e.g. `https://faflow.institution.edu/*`).
   - Enable only Maps JavaScript API and Geocoding API.
   - Set daily request quotas to prevent runaway billing.
3. **No Client Trust:** The frontend map state is NEVER accepted as proof of location. The Android app sends raw GPS hardware readings signed by the device, and the FastAPI backend performs the definitive mathematical containment check.

---

## 5. Administrative UI/UX Workflow

In `frontend/src/pages/admin/Geofences.jsx` and `CampusMapEditor.jsx`:
1. **Search:** Admin types campus name (e.g. "PSG College of Technology, Coimbatore") or pastes exact coordinates (`11.0168, 76.9558`).
2. **Visual Inspection:** Map flies to location. Admin can toggle between **Standard Map**, **Google Maps (Roadmap)**, **Google Satellite**, and **Hybrid Satellite**.
3. **Boundary Adjustment:**
   - Circular: Drag the radial edge handle to resize radius in meters in real time.
   - Polygonal: Drag numbered vertices, click `+` midpoints to insert new vertices, with full Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) support.
4. **Instant Test Playground:** Admin can click any location on the map to run an authoritative backend simulation (`POST /geofences/test-location`) before activating the geofence for staff.
5. **Save:** Configuration is saved directly to PostgreSQL.
