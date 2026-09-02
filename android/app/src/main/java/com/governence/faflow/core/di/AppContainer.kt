package com.governence.faflow.core.di

import android.content.Context
import com.governence.faflow.auth.data.AuthRepository
import com.governence.faflow.core.network.FaflowApiClient
import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.core.network.TokenManager
import com.governence.faflow.faflow.data.AcademicSummaryRepository
import com.governence.faflow.faflow.data.CreditRepositoryImpl
import com.governence.faflow.faflow.data.GeofenceRepository
import com.governence.faflow.faflow.data.LeaveRepositoryImpl
import com.governence.faflow.faflow.data.NotificationRepositoryImpl
import com.governence.faflow.faflow.data.PreferencesRepositoryImpl
import com.governence.faflow.faflow.data.SubstitutionRepositoryImpl
import com.governence.faflow.faflow.data.TimetableRepositoryImpl
import com.governence.faflow.location.GeofenceValidator
import com.governence.faflow.location.StaffLocationProvider

/**
 * Service locator / Dependency container for FAFLOW Staff Mobile.
 */
class AppContainer(context: Context) {
    val tokenManager: TokenManager = TokenManager(context.applicationContext)

    val apiService: FaflowApiService = FaflowApiClient.create(
        tokenManager = tokenManager,
        onUnauthorized = {
            // Handled via TokenManager state flow
        }
    )

    val authRepository: AuthRepository = AuthRepository(apiService, tokenManager)
    val timetableRepository: TimetableRepositoryImpl = TimetableRepositoryImpl(apiService)
    val leaveRepository: LeaveRepositoryImpl = LeaveRepositoryImpl(apiService)
    val creditRepository: CreditRepositoryImpl = CreditRepositoryImpl(apiService)
    val substitutionRepository: SubstitutionRepositoryImpl = SubstitutionRepositoryImpl(apiService)
    val preferencesRepository: PreferencesRepositoryImpl = PreferencesRepositoryImpl(apiService)
    val notificationRepository: NotificationRepositoryImpl = NotificationRepositoryImpl(apiService)
    val academicSummaryRepository: AcademicSummaryRepository = AcademicSummaryRepository(apiService)

    // Milestone 4: Geofence & Location Subsystem
    val staffLocationProvider: StaffLocationProvider = StaffLocationProvider(context.applicationContext)
    val geofenceValidator: GeofenceValidator = GeofenceValidator(maxAccuracyThresholdMeters = 30.0f)
    val geofenceRepository: GeofenceRepository = GeofenceRepository(
        locationProvider = staffLocationProvider,
        geofenceValidator = geofenceValidator
    )

    companion object {
        @Volatile
        private var instance: AppContainer? = null

        fun getInstance(context: Context): AppContainer {
            return instance ?: synchronized(this) {
                instance ?: AppContainer(context).also { instance = it }
            }
        }
    }
}
