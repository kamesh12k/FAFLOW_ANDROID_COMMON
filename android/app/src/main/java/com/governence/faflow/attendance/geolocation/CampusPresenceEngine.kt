package com.governence.faflow.attendance.geolocation

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Phase 8: Authoritative multi-state presence lifecycle for institutional campus presence.
 * Replaces naive boolean inside/outside evaluations with rigorous boundary uncertainty analysis.
 */
enum class CampusPresenceState {
    UNKNOWN,
    INITIALIZING,
    SEARCHING,
    CONFIDENTLY_INSIDE,
    UNCERTAIN,
    CONFIDENTLY_OUTSIDE,
    SUSPICIOUS,
    DENIED
}

/**
 * Structured evaluation result carrying mathematical certainty metrics and supporting environmental telemetry.
 */
data class CampusPresenceEvaluation(
    val state: CampusPresenceState,
    val isAuthorized: Boolean,
    val activeGeofence: CampusGeofence? = null,
    val distanceToBoundaryMeters: Double = 0.0,
    val distanceToCenterMeters: Double = 0.0,
    val horizontalAccuracyMeters: Float = 0.0f,
    val locationTimestamp: Long = 0L,
    val reason: String = "",
    val supportingEvidence: Map<String, String> = emptyMap()
)

/**
 * Authoritative campus presence engine.
 *
 * Evaluates:
 * 1. Fresh fused location lifecycle and staleness (< 60s)
 * 2. Mock location / anti-spoofing detection
 * 3. GPS accuracy versus institutional threshold
 * 4. Boundary uncertainty radius: If the horizontal accuracy circle overlaps outside the perimeter,
 *    presence is classified as UNCERTAIN (not authorized).
 * 5. Circle and Polygon boundary geometry
 * 6. Supporting indoor Wi-Fi / BLE signals
 */
class CampusPresenceEngine(
    val maxAccuracyThresholdMeters: Float = 35.0f,
    val maxStaleLocationAgeMs: Long = 60_000L,
    val boundarySafetyMarginMeters: Double = 5.0
) {

    /**
     * Evaluates a staff member's live location against the institution's active geofences.
     */
    fun evaluatePresence(
        location: StaffLiveLocation?,
        activeGeofences: List<CampusGeofence>,
        isLocationServiceEnabled: Boolean = true,
        hasPermission: Boolean = true,
        wifiSsid: String? = null,
        bleBeaconId: String? = null
    ): CampusPresenceEvaluation {
        // 1. Permission and System Services Check
        if (!hasPermission) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.DENIED,
                isAuthorized = false,
                reason = "Location permission is not granted by user."
            )
        }

        if (!isLocationServiceEnabled) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.DENIED,
                isAuthorized = false,
                reason = "Device location services are disabled."
            )
        }

        // 2. Acquisition Check
        if (location == null) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.SEARCHING,
                isAuthorized = false,
                reason = "Acquiring high-accuracy fused GPS coordinates..."
            )
        }

        // 3. Mock Provider / Anti-Spoofing Detection
        if (location.isMock) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.SUSPICIOUS,
                isAuthorized = false,
                horizontalAccuracyMeters = location.accuracyMeters,
                locationTimestamp = location.timestamp,
                reason = "Mock location provider detected. Physical attendance cannot be verified."
            )
        }

        // 4. Staleness Verification
        val ageMs = System.currentTimeMillis() - location.timestamp
        if (ageMs > maxStaleLocationAgeMs) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.UNCERTAIN,
                isAuthorized = false,
                horizontalAccuracyMeters = location.accuracyMeters,
                locationTimestamp = location.timestamp,
                reason = "Location snapshot is stale (${ageMs / 1000}s old > ${maxStaleLocationAgeMs / 1000}s allowed)."
            )
        }

        // 5. GPS Horizontal Accuracy Gate
        if (location.accuracyMeters > maxAccuracyThresholdMeters) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.UNCERTAIN,
                isAuthorized = false,
                horizontalAccuracyMeters = location.accuracyMeters,
                locationTimestamp = location.timestamp,
                reason = "GPS horizontal accuracy (±${location.accuracyMeters.toInt()}m) exceeds institutional limit (±${maxAccuracyThresholdMeters.toInt()}m)."
            )
        }

        // 6. Active Institutional Geofence Requirement (FAIL CLOSED)
        val activeList = activeGeofences.filter { it.isActive }
        if (activeList.isEmpty()) {
            return CampusPresenceEvaluation(
                state = CampusPresenceState.DENIED,
                isAuthorized = false,
                horizontalAccuracyMeters = location.accuracyMeters,
                locationTimestamp = location.timestamp,
                reason = "No active campus geofences configured for this institution."
            )
        }

        // 7. Spherical & Polygon Geometry Boundary Uncertainty Evaluation
        val staffPoint = GeoPoint(location.latitude, location.longitude)
        var bestInsideGeofence: CampusGeofence? = null
        var bestInsideDistToBoundary = -1.0
        var bestInsideDistToCenter = 0.0

        var nearestOutsideGeofence: CampusGeofence? = null
        var minOutsideDistToBoundary = Double.MAX_VALUE
        var nearestOutsideDistToCenter = 0.0

        for (geofence in activeList) {
            when (geofence.type) {
                GeofenceType.CIRCLE -> {
                    val centerPoint = GeoPoint(geofence.centerLatitude, geofence.centerLongitude)
                    val distToCenter = GeofenceMathEngine.calculateDistanceMeters(
                        staffPoint.latitude,
                        staffPoint.longitude,
                        centerPoint.latitude,
                        centerPoint.longitude
                    )
                    val effectiveRadius = geofence.radiusMeters + geofence.toleranceMeters
                    if (distToCenter <= effectiveRadius) {
                        val distToBoundary = effectiveRadius - distToCenter
                        if (distToBoundary > bestInsideDistToBoundary) {
                            bestInsideDistToBoundary = distToBoundary
                            bestInsideDistToCenter = distToCenter
                            bestInsideGeofence = geofence
                        }
                    } else {
                        val distToBoundary = distToCenter - effectiveRadius
                        if (distToBoundary < minOutsideDistToBoundary) {
                            minOutsideDistToBoundary = distToBoundary
                            nearestOutsideDistToCenter = distToCenter
                            nearestOutsideGeofence = geofence
                        }
                    }
                }
                GeofenceType.POLYGON -> {
                    val isInside = GeofenceMathEngine.isInsidePolygon(staffPoint, geofence.polygonVertices)
                    val centerPoint = GeoPoint(geofence.centerLatitude, geofence.centerLongitude)
                    val distToCenter = GeofenceMathEngine.calculateDistanceMeters(
                        staffPoint.latitude,
                        staffPoint.longitude,
                        centerPoint.latitude,
                        centerPoint.longitude
                    )
                    val distToBoundary = calculateMinDistanceToPolygonEdges(staffPoint, geofence.polygonVertices)

                    if (isInside) {
                        if (distToBoundary > bestInsideDistToBoundary) {
                            bestInsideDistToBoundary = distToBoundary
                            bestInsideDistToCenter = distToCenter
                            bestInsideGeofence = geofence
                        }
                    } else {
                        if (distToBoundary < minOutsideDistToBoundary) {
                            minOutsideDistToBoundary = distToBoundary
                            nearestOutsideDistToCenter = distToCenter
                            nearestOutsideGeofence = geofence
                        }
                    }
                }
            }
        }

        // Collect supporting indoor signals
        val supporting = mutableMapOf<String, String>()
        if (!wifiSsid.isNullOrBlank()) supporting["wifi_ssid"] = wifiSsid
        if (!bleBeaconId.isNullOrBlank()) supporting["ble_beacon"] = bleBeaconId

        // 8. Presence Classification with Boundary Uncertainty Analysis
        if (bestInsideGeofence != null) {
            // Point is nominally inside.
            // Check boundary uncertainty: Does the horizontal accuracy radius cross outside the campus boundary?
            val uncertaintyCrossesBoundary = location.accuracyMeters > (bestInsideDistToBoundary + boundarySafetyMarginMeters)

            if (uncertaintyCrossesBoundary) {
                return CampusPresenceEvaluation(
                    state = CampusPresenceState.UNCERTAIN,
                    isAuthorized = false,
                    activeGeofence = bestInsideGeofence,
                    distanceToBoundaryMeters = bestInsideDistToBoundary,
                    distanceToCenterMeters = bestInsideDistToCenter,
                    horizontalAccuracyMeters = location.accuracyMeters,
                    locationTimestamp = location.timestamp,
                    reason = "Position is near boundary '${bestInsideGeofence.name}' with ±${location.accuracyMeters.toInt()}m uncertainty spanning outside campus.",
                    supportingEvidence = supporting
                )
            } else {
                return CampusPresenceEvaluation(
                    state = CampusPresenceState.CONFIDENTLY_INSIDE,
                    isAuthorized = true,
                    activeGeofence = bestInsideGeofence,
                    distanceToBoundaryMeters = bestInsideDistToBoundary,
                    distanceToCenterMeters = bestInsideDistToCenter,
                    horizontalAccuracyMeters = location.accuracyMeters,
                    locationTimestamp = location.timestamp,
                    reason = "Confidently verified within campus geofence '${bestInsideGeofence.name}'.",
                    supportingEvidence = supporting
                )
            }
        } else {
            // Point is outside all active geofences
            val nearest = nearestOutsideGeofence ?: activeList.first()
            val outsideDist = if (minOutsideDistToBoundary != Double.MAX_VALUE) minOutsideDistToBoundary else 0.0

            // If the accuracy radius reaches inside the campus boundary, it's UNCERTAIN rather than CONFIDENTLY_OUTSIDE
            if (location.accuracyMeters > outsideDist && outsideDist > 0) {
                return CampusPresenceEvaluation(
                    state = CampusPresenceState.UNCERTAIN,
                    isAuthorized = false,
                    activeGeofence = nearest,
                    distanceToBoundaryMeters = outsideDist,
                    distanceToCenterMeters = nearestOutsideDistToCenter,
                    horizontalAccuracyMeters = location.accuracyMeters,
                    locationTimestamp = location.timestamp,
                    reason = "Position is nominally ${outsideDist.toInt()}m outside '${nearest.name}', but accuracy circle reaches campus perimeter.",
                    supportingEvidence = supporting
                )
            }

            return CampusPresenceEvaluation(
                state = CampusPresenceState.CONFIDENTLY_OUTSIDE,
                isAuthorized = false,
                activeGeofence = nearest,
                distanceToBoundaryMeters = outsideDist,
                distanceToCenterMeters = nearestOutsideDistToCenter,
                horizontalAccuracyMeters = location.accuracyMeters,
                locationTimestamp = location.timestamp,
                reason = "Position is ${outsideDist.toInt()}m outside authorized campus perimeter '${nearest.name}'.",
                supportingEvidence = supporting
            )
        }
    }

    /**
     * Calculates minimum distance from a point to any edge of a polygon in meters.
     */
    fun calculateMinDistanceToPolygonEdges(point: GeoPoint, vertices: List<GeoPoint>): Double {
        if (vertices.size < 3) return Double.MAX_VALUE
        var minDistance = Double.MAX_VALUE
        val n = vertices.size
        for (i in 0 until n) {
            val v1 = vertices[i]
            val v2 = vertices[(i + 1) % n]
            val dist = pointToSegmentDistanceMeters(point, v1, v2)
            if (dist < minDistance) {
                minDistance = dist
            }
        }
        return minDistance
    }

    private fun pointToSegmentDistanceMeters(p: GeoPoint, a: GeoPoint, b: GeoPoint): Double {
        // Project p onto segment ab in local planar approximation
        val x = p.longitude
        val y = p.latitude
        val x1 = a.longitude
        val y1 = a.latitude
        val x2 = b.longitude
        val y2 = b.latitude

        val dx = x2 - x1
        val dy = y2 - y1
        val lenSq = dx * dx + dy * dy
        if (lenSq == 0.0) {
            return GeofenceMathEngine.calculateDistanceMeters(p.latitude, p.longitude, a.latitude, a.longitude)
        }

        val t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / lenSq))
        val projLon = x1 + t * dx
        val projLat = y1 + t * dy

        return GeofenceMathEngine.calculateDistanceMeters(p.latitude, p.longitude, projLat, projLon)
    }
}
