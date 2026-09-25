package com.governence.faflow.faflow.data

import com.governence.faflow.core.network.AnnouncementDetailDto
import com.governence.faflow.core.network.AnnouncementListItemDto
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.NetworkResult

class AnnouncementRepositoryImpl(
    private val apiService: FaflowApiService
) {
    suspend fun getAnnouncements(
        tab: String = "all",
        search: String? = null,
        page: Int = 1,
        limit: Int = 30
    ): NetworkResult<List<AnnouncementListItemDto>> {
        return try {
            val response = apiService.getAnnouncements(tab = tab, search = search, page = page, limit = limit)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Unable to fetch announcements (${response.code()})")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to connect to announcements feed", e)
        }
    }

    suspend fun getUnreadCount(): NetworkResult<Int> {
        return try {
            val response = apiService.getUnreadAnnouncementsCount()
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!.count)
            } else {
                NetworkResult.Error(response.code(), "Unable to fetch unread count")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error", e)
        }
    }

    suspend fun getAnnouncementDetail(id: Int): NetworkResult<AnnouncementDetailDto> {
        return try {
            val response = apiService.getAnnouncementDetail(id)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Unable to load circular details")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error", e)
        }
    }

    suspend fun acknowledgeAnnouncement(id: Int): NetworkResult<AnnouncementDetailDto> {
        return try {
            val response = apiService.acknowledgeAnnouncement(id)
            if (response.isSuccessful && response.body() != null) {
                NetworkResult.Success(response.body()!!)
            } else {
                NetworkResult.Error(response.code(), "Failed to record acknowledgment")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network error", e)
        }
    }
}
