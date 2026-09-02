package com.governence.faflow.faflow.data

import com.governence.faflow.location.CampusGeofence
import com.governence.faflow.location.GeoPoint
import com.governence.faflow.location.GeofenceType
import com.governence.faflow.location.GeofenceValidator
import com.governence.faflow.location.LocationVerificationResult
import com.governence.faflow.location.StaffLiveLocation
import com.governence.faflow.location.StaffLocationProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

/**
 * Repository managing active campus geofences with memory caching and battery-efficient location monitoring.
 */
class GeofenceRepository(
    private val locationProvider: StaffLocationProvider,
    private val geofenceValidator: GeofenceValidator = GeofenceValidator(),
    private val externalScope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) {
    // Default institutional campus boundaries
    private val defaultGeofences = listOf(
        CampusGeofence(
            id = "GEO-CAMPUS-MAIN",
            name = "Main Academic Block",
            type = GeofenceType.CIRCLE,
            centerLatitude = 11.016844,
            centerLongitude = 76.955833,
            radiusMeters = 200.0,
            toleranceMeters = 20.0,
            isActive = true
        ),
        CampusGeofence(
            id = "GEO-CAMPUS-TECH",
            name = "Science & Engineering Complex",
            type = GeofenceType.POLYGON,
            centerLatitude = 11.018000,
            centerLongitude = 76.957000,
            polygonVertices = listOf(
                GeoPoint(11.017500, 76.956500),
                GeoPoint(11.018500, 76.956500),
                GeoPoint(11.018500, 76.957500),
                GeoPoint(11.017500, 76.957500)
            ),
            toleranceMeters = 15.0,
            isActive = true
        )
    )

    private val _geofences = MutableStateFlow<List<CampusGeofence>>(defaultGeofences)
    val geofences: StateFlow<List<CampusGeofence>> = _geofences.asStateFlow()

    private val _liveLocation = MutableStateFlow<StaffLiveLocation?>(null)
    val liveLocation: StateFlow<StaffLiveLocation?> = _liveLocation.asStateFlow()

    private val _verificationResult = MutableStateFlow<LocationVerificationResult>(LocationVerificationResult.Loading)
    val verificationResult: StateFlow<LocationVerificationResult> = _verificationResult.asStateFlow()

    private var monitoringJob: Job? = null

    init {
        startLocationMonitoring()
    }

    fun hasLocationPermission(): Boolean = locationProvider.isLocationPermissionGranted
    fun isLocationEnabled(): Boolean = locationProvider.isLocationServiceEnabled

    fun startLocationMonitoring() {
        if (!locationProvider.isLocationPermissionGranted) {
            _verificationResult.value = LocationVerificationResult.PermissionDenied
            return
        }

        if (!locationProvider.isLocationServiceEnabled) {
            _verificationResult.value = LocationVerificationResult.LocationServicesDisabled
            return
        }

        monitoringJob?.cancel()
        monitoringJob = externalScope.launch {
            locationProvider.getLocationUpdates(intervalMs = 3000L)
                .catch { e ->
                    if (e is SecurityException) {
                        _verificationResult.value = LocationVerificationResult.PermissionDenied
                    } else {
                        _verificationResult.value = LocationVerificationResult.LocationUnavailable
                    }
                }
                .collect { location ->
                    _liveLocation.value = location
                    _verificationResult.value = geofenceValidator.validate(location, _geofences.value)
                }
        }
    }

    fun stopLocationMonitoring() {
        monitoringJob?.cancel()
        monitoringJob = null
    }

    fun updateGeofences(newGeofences: List<CampusGeofence>) {
        _geofences.value = newGeofences
        _liveLocation.value?.let { loc ->
            _verificationResult.value = geofenceValidator.validate(loc, newGeofences)
        }
    }
}
