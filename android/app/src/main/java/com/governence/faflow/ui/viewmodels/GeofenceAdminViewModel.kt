package com.governence.faflow.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.GeofenceCreateDto
import com.governence.faflow.core.network.GeofenceOutDto
import com.governence.faflow.core.network.GeofenceUpdateDto
import com.governence.faflow.location.GeoPoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class GeofenceAdminUiState(
    val isLoading: Boolean = false,
    val geofences: List<GeofenceOutDto> = emptyList(),
    val selectedGeofence: GeofenceOutDto? = null,
    val isCreatingNew: Boolean = false,
    val editorType: String = "circle", // "circle" or "polygon"
    val newName: String = "",
    val newDescription: String = "",
    val circleCenter: GeoPoint = GeoPoint(11.016844, 76.955833),
    val circleRadiusMeters: Double = 150.0,
    val polygonVertices: List<GeoPoint> = emptyList(),
    val toleranceMeters: Double = 15.0,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

class GeofenceAdminViewModel(
    private val apiService: FaflowApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(GeofenceAdminUiState())
    val uiState: StateFlow<GeofenceAdminUiState> = _uiState.asStateFlow()

    init {
        loadGeofences()
    }

    fun loadGeofences() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val response = apiService.listAllGeofences()
                if (response.isSuccessful) {
                    val list = response.body() ?: emptyList()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        geofences = list
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "Failed to load geofences (HTTP ${response.code()})"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.localizedMessage ?: "Network error loading geofences"
                )
            }
        }
    }

    fun startCreating(type: String = "circle") {
        _uiState.value = _uiState.value.copy(
            isCreatingNew = true,
            selectedGeofence = null,
            editorType = type,
            newName = "",
            newDescription = "",
            circleRadiusMeters = 150.0,
            polygonVertices = emptyList(),
            errorMessage = null,
            successMessage = null
        )
    }

    fun cancelEditing() {
        _uiState.value = _uiState.value.copy(
            isCreatingNew = false,
            selectedGeofence = null,
            errorMessage = null,
            successMessage = null
        )
    }

    fun setCircleCenter(lat: Double, lon: Double) {
        _uiState.value = _uiState.value.copy(circleCenter = GeoPoint(lat, lon))
    }

    fun setCircleRadius(radius: Double) {
        _uiState.value = _uiState.value.copy(circleRadiusMeters = radius.coerceAtLeast(10.0))
    }

    fun addPolygonVertex(lat: Double, lon: Double) {
        val current = _uiState.value.polygonVertices.toMutableList()
        current.add(GeoPoint(lat, lon))
        _uiState.value = _uiState.value.copy(polygonVertices = current)
    }

    fun removePolygonVertex(index: Int) {
        val current = _uiState.value.polygonVertices.toMutableList()
        if (index in current.indices) {
            current.removeAt(index)
            _uiState.value = _uiState.value.copy(polygonVertices = current)
        }
    }

    fun clearPolygonVertices() {
        _uiState.value = _uiState.value.copy(polygonVertices = emptyList())
    }

    fun updateName(name: String) {
        _uiState.value = _uiState.value.copy(newName = name)
    }

    fun updateDescription(desc: String) {
        _uiState.value = _uiState.value.copy(newDescription = desc)
    }

    fun saveGeofence() {
        val state = _uiState.value
        if (state.newName.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Geofence name is required")
            return
        }

        if (state.editorType == "polygon" && state.polygonVertices.size < 3) {
            _uiState.value = _uiState.value.copy(errorMessage = "Polygon requires at least 3 vertices")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val createDto = if (state.editorType == "circle") {
                    GeofenceCreateDto(
                        name = state.newName.trim(),
                        description = state.newDescription.trim().ifEmpty { null },
                        type = "circle",
                        centerLatitude = state.circleCenter.latitude,
                        centerLongitude = state.circleCenter.longitude,
                        radiusMeters = state.circleRadiusMeters,
                        toleranceMeters = state.toleranceMeters
                    )
                } else {
                    GeofenceCreateDto(
                        name = state.newName.trim(),
                        description = state.newDescription.trim().ifEmpty { null },
                        type = "polygon",
                        polygonVertices = state.polygonVertices.map { listOf(it.latitude, it.longitude) },
                        toleranceMeters = state.toleranceMeters
                    )
                }

                val response = apiService.createGeofence(createDto)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isCreatingNew = false,
                        successMessage = "Campus geofence '${state.newName}' created successfully"
                    )
                    loadGeofences()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "Failed to create geofence (HTTP ${response.code()})"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.localizedMessage ?: "Error saving geofence"
                )
            }
        }
    }

    fun toggleGeofence(id: Int, currentActive: Boolean) {
        viewModelScope.launch {
            try {
                val updateDto = GeofenceUpdateDto(isActive = !currentActive)
                val response = apiService.updateGeofence(id, updateDto)
                if (response.isSuccessful) {
                    loadGeofences()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = "Failed to toggle geofence state")
            }
        }
    }

    fun deleteGeofence(id: Int) {
        viewModelScope.launch {
            try {
                val response = apiService.deleteGeofence(id)
                if (response.isSuccessful) {
                    loadGeofences()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = "Failed to delete geofence")
            }
        }
    }
}
