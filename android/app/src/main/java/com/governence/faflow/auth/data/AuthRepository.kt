package com.governence.faflow.auth.data

import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.TokenManager
import com.governence.faflow.core.network.UserLoginRequestDto
import com.governence.faflow.domain.model.StaffMember
import kotlinx.coroutines.flow.StateFlow

/**
 * Authentication repository managing login, token lifecycle, and session restoration.
 */
class AuthRepository(
    private val apiService: FaflowApiService,
    private val tokenManager: TokenManager
) {
    val isLoggedIn: StateFlow<Boolean> = tokenManager.isLoggedIn

    suspend fun login(identifier: String, password: String): NetworkResult<StaffMember> {
        return try {
            val response = apiService.login(UserLoginRequestDto(identifier = identifier.trim(), password = password))
            if (response.isSuccessful && response.body() != null) {
                val tokenDto = response.body()!!
                val userDto = tokenDto.user

                tokenManager.saveToken(
                    token = tokenDto.accessToken,
                    userId = userDto.id,
                    userName = userDto.name,
                    userEmail = userDto.email ?: identifier,
                    role = userDto.role,
                    departmentId = userDto.departmentId
                )

                val staffMember = StaffMember(
                    id = userDto.id,
                    name = userDto.name,
                    email = userDto.email ?: identifier,
                    username = userDto.username,
                    role = userDto.role,
                    departmentId = userDto.departmentId,
                    departmentName = userDto.department,
                    isActive = userDto.isActive
                )

                NetworkResult.Success(staffMember)
            } else {
                val errorMsg = when (response.code()) {
                    401 -> "Incorrect email/username or password"
                    403 -> "Account is disabled or password change required"
                    else -> "Login failed with error ${response.code()}"
                }
                NetworkResult.Error(response.code(), errorMsg)
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Network connection error", e)
        }
    }

    suspend fun getCurrentStaff(): NetworkResult<StaffMember> {
        return try {
            val response = apiService.getMe()
            if (response.isSuccessful && response.body() != null) {
                val u = response.body()!!
                val staff = StaffMember(
                    id = u.id,
                    name = u.name,
                    email = u.email ?: "",
                    username = u.username,
                    role = u.role,
                    departmentId = u.departmentId,
                    departmentName = u.department,
                    isActive = u.isActive
                )
                NetworkResult.Success(staff)
            } else {
                NetworkResult.Error(response.code(), "Unable to fetch staff profile")
            }
        } catch (e: Exception) {
            NetworkResult.Error(-1, e.localizedMessage ?: "Failed to connect to FAFLOW server", e)
        }
    }

    fun logout() {
        tokenManager.clearSession()
    }

    fun getStoredStaffInfo(): StaffMember? {
        if (!tokenManager.hasValidToken()) return null
        return StaffMember(
            id = tokenManager.getUserId(),
            name = tokenManager.getUserName() ?: "Faculty Member",
            email = tokenManager.getUserEmail() ?: "",
            role = tokenManager.getUserRole() ?: "teacher",
            departmentId = tokenManager.getDepartmentId()
        )
    }
}
