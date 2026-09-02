# Milestone 12: Graphical Campus Geofence Administration Guide
## FAFLOW Institutional Staff Attendance Management

---

## 1. Overview
The Campus Geofence Administration system enables authorized Institutional Administrators, Principals, and HODs to visually define and manage attendance perimeters.

---

## 2. Geofence Geometries & Rules

### A. Circular Geofences
- **Definition**: Defined by a central coordinate $(lat, lon)$ and a radial boundary in meters.
- **Visual Editing**:
  - Center point placed on interactive map canvas.
  - Interactive slider controls radius ($25\text{m} - 500\text{m}$).
  - Live circle overlay displays visual perimeter in real-time.
- **Validation**:
  - Center latitude must be within $[-90.0, 90.0]$ and longitude within $[-180.0, 180.0]$.
  - Radius must be strictly positive ($r > 0$).

### B. Polygonal Geofences
- **Definition**: Arbitrary non-convex or convex polygons defined by an ordered list of vertices $[(lat_1, lon_1), (lat_2, lon_2), \dots, (lat_n, lon_n)]$.
- **Visual Editing**:
  - Administrator taps canvas to add vertex coordinates.
  - Connect-the-dots renderer draws filled area in real-time.
  - Actions to add, remove individual points, or clear vertices.
- **Validation**:
  - Must have at least 3 distinct vertices.
  - Geodesic area must be strictly greater than $1\text{ m}^2$.
  - Centroid and enclosing bounding radius are automatically computed.

---

## 3. Administrator Endpoints & Role-Based Access

| Method | Endpoint | Authorized Roles | Description |
|---|---|---|---|
| `GET` | `/geofences/active` | All Staff & Faculty | Returns active geofence perimeters for client-side evaluation. |
| `GET` | `/geofences/` | Admin, Principal, HOD, Manager | Lists all geofences with creator and timestamp metadata. |
| `POST` | `/geofences/` | Admin, Principal, HOD, Manager | Creates a new circular or polygonal campus boundary. |
| `PUT` | `/geofences/{id}` | Admin, Principal, HOD, Manager | Updates existing boundary parameters, radius, or vertices. |
| `DELETE` | `/geofences/{id}` | Admin, Principal, HOD, Manager | Deactivates or removes a campus boundary. |
