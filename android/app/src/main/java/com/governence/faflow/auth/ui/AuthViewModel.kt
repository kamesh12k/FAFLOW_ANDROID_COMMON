package com.governence.faflow.auth.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.domain.model.StaffMember
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    data object Idle : AuthUiState()
    data object Loading : AuthUiState()
    data class Authenticated(val staff: StaffMember) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        restoreSession()
    }

    fun restoreSession() {
        val storedStaff = authRepository.getStoredStaffInfo()
        if (storedStaff != null) {
            _uiState.value = AuthUiState.Authenticated(storedStaff)
            // Refresh in background
            viewModelScope.launch {
                when (val result = authRepository.getCurrentStaff()) {
                    is NetworkResult.Success -> {
                        _uiState.value = AuthUiState.Authenticated(result.data)
                    }
                    is NetworkResult.Error -> {
                        if (result.code == 401) {
                            authRepository.logout()
                            _uiState.value = AuthUiState.Idle
                        }
                    }
                    NetworkResult.Loading -> Unit
                }
            }
        } else {
            _uiState.value = AuthUiState.Idle
        }
    }

    fun login(identifier: String, password: String) {
        if (identifier.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Please enter your email/username and password")
            return
        }

        _uiState.value = AuthUiState.Loading
        viewModelScope.launch {
            when (val result = authRepository.login(identifier, password)) {
                is NetworkResult.Success -> {
                    _uiState.value = AuthUiState.Authenticated(result.data)
                }
                is NetworkResult.Error -> {
                    _uiState.value = AuthUiState.Error(result.message)
                }
                NetworkResult.Loading -> Unit
            }
        }
    }

    fun logout() {
        authRepository.logout()
        _uiState.value = AuthUiState.Idle
    }

    fun clearError() {
        if (_uiState.value is AuthUiState.Error) {
            _uiState.value = AuthUiState.Idle
        }
    }
}
