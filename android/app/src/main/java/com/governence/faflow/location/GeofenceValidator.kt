package com.governence.faflow.location

/**
 * Validates staff live GPS snapshots against institutional geofences.
 */
class GeofenceValidator(
    override val maxAccuracyThresholdMeters: Float = 30.0f,
    private val maxLocationAgeSeconds: Long = 60L
) : GeofenceValidatorContract {

    override fun validate(
        location: StaffLiveLocation?,
        activeGeofences: List<CampusGeofence>
    ): LocationVerificationResult {
        if (location == null) {
            return LocationVerificationResult.Loading
        }

        // 1. Anti-Spoofing / Mock Location Verification
        if (location.isMock) {
            return LocationVerificationResult.MockLocationDetected(
                provider = "Android Mock Location Provider",
                details = "Fake GPS / Spoofed location detected. Attendance cannot be registered."
            )
        }

        // 2. Stale Location Verification
        val ageSeconds = (System.currentTimeMillis() - location.timestamp) / 1000L
        if (ageSeconds > maxLocationAgeSeconds) {
            return LocationVerificationResult.StaleLocation(
                ageSeconds = ageSeconds,
                maxAgeSeconds = maxLocationAgeSeconds
            )
        }

        // 3. GPS Signal Quality & Accuracy Threshold Verification
        if (location.accuracyMeters > maxAccuracyThresholdMeters) {
            return LocationVerificationResult.AccuracyInsufficient(
                currentAccuracyMeters = location.accuracyMeters,
                requiredAccuracyMeters = maxAccuracyThresholdMeters
            )
        }

        val activeList = activeGeofences.filter { it.isActive }
        if (activeList.isEmpty()) {
            return LocationVerificationResult.NoActiveGeofences
        }

        val staffPoint = GeoPoint(location.latitude, location.longitude)
        var nearestGeofence: CampusGeofence? = null
        var minDistance = Double.MAX_VALUE

        for (geofence in activeList) {
            when (geofence.type) {
                GeofenceType.CIRCLE -> {
                    val centerPoint = GeoPoint(geofence.centerLatitude, geofence.centerLongitude)
                    val (isInside, isBoundary, distance) = GeofenceMathEngine.evaluateCircle(
                        point = staffPoint,
                        center = centerPoint,
                        radiusMeters = geofence.radiusMeters,
                        toleranceMeters = geofence.toleranceMeters
                    )

                    if (distance < minDistance) {
                        minDistance = distance
                        nearestGeofence = geofence
                    }

                    if (isBoundary) {
                        return LocationVerificationResult.Boundary(
                            geofenceId = geofence.id,
                            geofenceName = geofence.name,
                            distanceToBoundaryMeters = Math.abs(distance - geofence.radiusMeters),
                            accuracyMeters = location.accuracyMeters,
                            timestamp = location.timestamp
                        )
                    }

                    if (isInside) {
                        return LocationVerificationResult.InsideGeofence(
                            geofenceId = geofence.id,
                            geofenceName = geofence.name,
                            distanceToCenterMeters = distance,
                            accuracyMeters = location.accuracyMeters,
                            timestamp = location.timestamp
                        )
                    }
                }

                GeofenceType.POLYGON -> {
                    val isInside = GeofenceMathEngine.isInsidePolygon(
                        point = staffPoint,
                        vertices = geofence.polygonVertices
                    )

                    val centerPoint = GeoPoint(geofence.centerLatitude, geofence.centerLongitude)
                    val distance = GeofenceMathEngine.calculateDistanceMeters(
                        staffPoint.latitude,
                        staffPoint.longitude,
                        centerPoint.latitude,
                        centerPoint.longitude
                    )

                    if (distance < minDistance) {
                        minDistance = distance
                        nearestGeofence = geofence
                    }

                    if (isInside) {
                        return LocationVerificationResult.InsideGeofence(
                            geofenceId = geofence.id,
                            geofenceName = geofence.name,
                            distanceToCenterMeters = distance,
                            accuracyMeters = location.accuracyMeters,
                            timestamp = location.timestamp
                        )
                    }
                }
            }
        }

        // Outside all active geofences
        return LocationVerificationResult.OutsideAllGeofences(
            nearestGeofenceId = nearestGeofence?.id,
            nearestGeofenceName = nearestGeofence?.name,
            distanceToNearestMeters = minDistance,
            accuracyMeters = location.accuracyMeters,
            timestamp = location.timestamp
        )
    }
}
