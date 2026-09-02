# Milestone 14: Campus Geofence Setup & Operational Configuration
## Production Institutional Perimeter Configuration

---

## 1. Campus Perimeter Configuration Workflow

```
[ ADMIN LOGS IN ] ──► [ FACULTY HUB ──► GEOFENCE ADMIN ] ──► [ INTERACTIVE CAMPUS MAP ]
                                                                       │
                                      ┌────────────────────────────────┴────────────────────────────────┐
                                      ▼                                                                 ▼
                            [ CIRCULAR PERIMETER ]                                            [ POLYGON PERIMETER ]
                            - Tap center on map                                               - Tap vertices in order
                            - Set radius slider (25m-500m)                                    - Min 3 vertices
                            - Name: "Admin Block"                                             - Name: "Engineering Quad"
                                      │                                                                 │
                                      └────────────────────────────────┬────────────────────────────────┘
                                                                       ▼
                                                       [ SAVE & ACTIVATE BOUNDARY ]
                                                                       │
                                                                       ▼
                                                       [ INSTANT CLIENT SYNC VIA API ]
```

---

## 2. Best Practices for College Campus Mapping
1. **Multi-Building Campuses**: Create discrete polygon geofences for each academic block (e.g., "Main Academic Quad", "Science Laboratory Block", "Mechanical Workshop").
2. **Boundary Buffer Margin**: A $15\text{m}$ tolerance margin is automatically factored into on-device and server-side verification to accommodate natural GPS satellite multipath drift near tall concrete buildings.
3. **Overlapping Zones**: If a faculty member is inside any active geofence, their location is verified as inside the campus.
4. **Deactivating Old Zones**: Deactivating an old geofence marks `is_active = FALSE` without deleting historical attendance audit logs.
