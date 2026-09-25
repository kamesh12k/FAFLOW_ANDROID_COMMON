package com.governence.faflow.faflow.data

import com.governence.faflow.core.network.*

class CampusStructureRepositoryImpl(
    private val apiService: FaflowApiService
) {
    suspend fun getCampusStructureTree(): NetworkResult<CampusStructureTreeResponse> {
        return try {
            val response = apiService.getCampusStructureTree()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to load campus structure (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to connect to campus structure service", e)
        }
    }

    suspend fun getCampusStructureMetrics(): NetworkResult<CampusStructureMetricsDto> {
        return try {
            val response = apiService.getCampusStructureMetrics()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to load structure metrics (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error loading metrics", e)
        }
    }

    suspend fun smartAutofillBlock(request: SmartBlockAutoFillRequestDto): NetworkResult<SmartBlockAutoFillResponseDto> {
        return try {
            val response = apiService.smartAutofillBlock(request)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Smart Auto-Fill generation failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error during Auto-Fill generation", e)
        }
    }

    suspend fun previewRoomPattern(request: RoomPatternPreviewRequestDto): NetworkResult<PatternPreviewResponseDto> {
        return try {
            val response = apiService.previewRoomPattern(request)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Pattern preview failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error generating preview", e)
        }
    }

    suspend fun bulkAssignRooms(request: BulkRoomAssignRequestDto): NetworkResult<BulkAssignResponseDto> {
        return try {
            val response = apiService.bulkAssignRooms(request)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Bulk room assignment failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error during bulk assignment", e)
        }
    }

    suspend fun duplicateBlock(blockId: Int, request: DuplicateBlockRequestDto): NetworkResult<DuplicateBlockResponseDto> {
        return try {
            val response = apiService.duplicateBlock(blockId, request)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Structure duplication failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error during structure duplication", e)
        }
    }

    suspend fun searchCampus(query: String): NetworkResult<CampusSearchResponseDto> {
        return try {
            val response = apiService.searchCampus(query)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Campus search failed (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error during campus search", e)
        }
    }
}
