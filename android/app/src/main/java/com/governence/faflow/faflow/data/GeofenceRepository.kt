package com.governence.faflow.faflow.data

import com.governence.faflow.attendance.geolocation.CampusGeofence
import com.governence.faflow.attendance.geolocation.GeoPoint
import com.governence.faflow.attendance.geolocation.GeofenceType
import com.governence.faflow.attendance.geolocation.GeofenceValidator
import com.governence.faflow.attendance.geolocation.LocationVerificationResult
import com.governence.faflow.attendance.geolocation.StaffLiveLocation
import com.governence.faflow.attendance.geolocation.StaffLocationProvider
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
    private val locationProvider: com.governence.faflow.attendance.geolocation.LocationProvider,
    private val geofenceValidator: GeofenceValidator = GeofenceValidator(),
    private val apiService: com.governence.faflow.core.network.FaflowApiService? = null,
    private val externalScope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) {
    // Authoritative institutional campus boundaries with live synchronization fallback
    private val defaultGeofences = listOf(
        CampusGeofence(
            id = "5",
            name = "Main Campus Perimeter",
            type = GeofenceType.CIRCLE,
            centerLatitude = 11.69061998,
            centerLongitude = 78.39581827,
            radiusMeters = 300.0,
            toleranceMeters = 50.0,
            isActive = true
        ),
        CampusGeofence(
            id = "1",
            name = "Main Campus Center",
            type = GeofenceType.CIRCLE,
            centerLatitude = 13.0827,
            centerLongitude = 80.2707,
            radiusMeters = 200.0,
            toleranceMeters = 25.0,
            isActive = true
        ),
        CampusGeofence(
            id = "2",
            name = "Faculty Complex Quadrangle",
            type = GeofenceType.POLYGON,
            centerLatitude = 13.0825,
            centerLongitude = 80.2700,
            polygonVertices = listOf(
                GeoPoint(13.08, 80.268),
                GeoPoint(13.085, 80.268),
                GeoPoint(13.085, 80.272),
                GeoPoint(13.08, 80.272)
            ),
            toleranceMeters = 20.0,
            isActive = true
        ),
        CampusGeofence(
            id = "GEO-CAMPUS-COIMBATORE",
            name = "Coimbatore Academic Zone",
            type = GeofenceType.CIRCLE,
            centerLatitude = 11.016844,
            centerLongitude = 76.955833,
            radiusMeters = 300.0,
            toleranceMeters = 30.0,
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
        fetchActiveGeofences()
        startLocationMonitoring()
    }

    fun hasLocationPermission(): Boolean = locationProvider.isLocationPermissionGranted
    fun isLocationEnabled(): Boolean = locationProvider.isLocationServiceEnabled

    fun fetchActiveGeofences() {
        val api = apiService ?: return
        externalScope.launch {
            try {
                val response = api.getActiveGeofences()
                if (response.isSuccessful) {
                    val dtoList = response.body() ?: emptyList()
                    if (dtoList.isNotEmpty()) {
                        val mapped = dtoList.map { dto ->
                            CampusGeofence(
                                id = dto.id.toString(),
                                name = dto.name,
                                type = if (dto.type.equals("polygon", ignoreCase = true)) GeofenceType.POLYGON else GeofenceType.CIRCLE,
                                centerLatitude = dto.centerLatitude,
                                centerLongitude = dto.centerLongitude,
                                radiusMeters = dto.radiusMeters ?: 150.0,
                                toleranceMeters = dto.toleranceMeters,
                                polygonVertices = dto.polygonVertices?.mapNotNull { pt ->
                                    if (pt.size >= 2) GeoPoint(pt[0], pt[1]) else null
                                } ?: emptyList(),
                                isActive = dto.isActive
                            )
                        }
                        _geofences.value = mapped
                        _liveLocation.value?.let { loc ->
                            _verificationResult.value = geofenceValidator.validate(loc, mapped)
                        }
                    }
                }
            } catch (e: Exception) {
                // Keep default boundaries on offline or network issue
            }
        }
    }

    fun startLocationMonitoring() {
        fetchActiveGeofences()
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
