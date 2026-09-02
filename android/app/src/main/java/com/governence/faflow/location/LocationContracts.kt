package com.governence.faflow.location

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/**
 * High-accuracy GPS snapshot of a staff member.
 */
data class StaffLiveLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val altitude: Double = 0.0,
    val speed: Float = 0.0f,
    val isMock: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Structured, non-boolean location verification states.
 */
sealed class LocationVerificationResult {
    data class InsideGeofence(
        val geofenceId: String,
        val geofenceName: String,
        val distanceToCenterMeters: Double,
        val accuracyMeters: Float,
        val timestamp: Long = System.currentTimeMillis()
    ) : LocationVerificationResult()

    data class Boundary(
        val geofenceId: String,
        val geofenceName: String,
        val distanceToBoundaryMeters: Double,
        val accuracyMeters: Float,
        val timestamp: Long = System.currentTimeMillis()
    ) : LocationVerificationResult()

    data class OutsideAllGeofences(
        val nearestGeofenceId: String?,
        val nearestGeofenceName: String?,
        val distanceToNearestMeters: Double,
        val accuracyMeters: Float,
        val timestamp: Long = System.currentTimeMillis()
    ) : LocationVerificationResult()

    data class AccuracyInsufficient(
        val currentAccuracyMeters: Float,
        val requiredAccuracyMeters: Float = 30.0f
    ) : LocationVerificationResult()

    data class MockLocationDetected(
        val provider: String?,
        val details: String = "Spoofed / Mock Location Provider Detected"
    ) : LocationVerificationResult()

    data class StaleLocation(
        val ageSeconds: Long,
        val maxAgeSeconds: Long = 60L
    ) : LocationVerificationResult()

    data object LocationServicesDisabled : LocationVerificationResult()
    data object PermissionDenied : LocationVerificationResult()
    data object PermissionPermanentlyDenied : LocationVerificationResult()
    data object LocationUnavailable : LocationVerificationResult()
    data object NoActiveGeofences : LocationVerificationResult()
    data object Loading : LocationVerificationResult()
}

/**
 * Contract for acquiring live GPS data with lifecycle awareness.
 */
interface LocationProvider {
    val isLocationPermissionGranted: Boolean
    val isLocationServiceEnabled: Boolean
    fun getLocationUpdates(intervalMs: Long = 3000L): Flow<StaffLiveLocation>
    suspend fun getLastKnownLocation(): StaffLiveLocation?
}

/**
 * Contract for validating staff position against institutional campus boundaries.
 */
interface GeofenceValidatorContract {
    val maxAccuracyThresholdMeters: Float
    fun validate(
        location: StaffLiveLocation?,
        activeGeofences: List<CampusGeofence>
    ): LocationVerificationResult
}
