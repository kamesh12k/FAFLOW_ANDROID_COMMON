# FAFLOW — Geolocation & Server-Authoritative Geofencing

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  

---

## 1. Dual-Boundary Geofencing Architecture

FAFLOW combines real device sensor acquisition on Android with cryptographic and mathematical validation on the FastAPI backend.

```
+-------------------------------------------------------------+
|                      ANDROID SENSOR                         |
|  - Google FusedLocationProviderClient (PRIORITY_HIGH_ACCURACY)|
|  - Validates !isFromMockProvider                            |
|  - Accuracy must be <= 50 meters                            |
|  - Timestamp must be fresh (< 60 seconds old)               |
+------------------------------+------------------------------+
                               |
                               v (TLS 1.3 encrypted payload)
+-------------------------------------------------------------+
|                  FASTAPI BACKEND AUTHORIZER                 |
|  1. Re-validates accuracy <= 50.0m                          |
|  2. Fetches active institutional geofences from PostgreSQL  |
|  3. Evaluates geometry:                                     |
|     - Circular: Haversine distance <= radius + tolerance    |
|     - Polygon: Ray-casting (odd/even intersections)         |
|  4. Attaches authorized geofence_id to ledger record        |
+-------------------------------------------------------------+
```

---

## 2. Mathematical Formulations

### 2.1 Circular Geofence: Haversine Formula

$$\Delta \text{lat} = \text{lat}_2 - \text{lat}_1, \quad \Delta \text{lon} = \text{lon}_2 - \text{lon}_1$$

$$a = \sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1) \cdot \cos(\text{lat}_2) \cdot \sin^2\left(\frac{\Delta \text{lon}}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

$$d = R \cdot c \quad \text{where } R = 6,371,000 \text{ meters}$$

A coordinate is **INSIDE** if $d \le (\text{radius} + \text{tolerance})$.

### 2.2 Polygonal Geofence: Jordan Curve Ray-Casting

The ray-casting algorithm casts an infinite horizontal ray east from the target point $(x, y)$. If the ray intersects an odd number of boundary line segments, the point is strictly inside the polygon.
