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
import com.governence.faflow.attendance.geolocation.GeofenceValidator
import com.governence.faflow.attendance.geolocation.StaffLocationProvider

/**
 * Service locator / Dependency container for FAFLOW Staff Mobile.
 * Uses lazy delegates to prevent heavy initialization (Keystore, Database, ONNX models)
 * from blocking the Android UI thread during application launch.
 */
class AppContainer(private val context: Context) {

    /**
     * Initializes base URL from SharedPreferences (or default) and pre-warms
     * the TokenManager (EncryptedSharedPreferences + Keystore).
     * MUST be called from a background thread. Called by FaflowApplication.onCreate().
     */
    fun initializeTokenManager() {
        // Base URL reads from SharedPreferences — background thread only.
        FaflowApiClient.initBaseUrl(context.applicationContext)
        // Trigger lazy TokenManager construction on the background thread,
        // then call initialize() to populate isLoggedIn StateFlow.
        tokenManager.initialize()
    }


    val tokenManager: TokenManager by lazy {
        TokenManager(context.applicationContext)
    }

    val apiService: FaflowApiService by lazy {
        FaflowApiClient.create(
            tokenManager = tokenManager,
            onUnauthorized = {
                // Handled via TokenManager state flow
            }
        )
    }

    val authRepository: AuthRepository by lazy {
        AuthRepository(apiService, tokenManager)
    }

    val timetableRepository: TimetableRepositoryImpl by lazy {
        TimetableRepositoryImpl(apiService)
    }

    val leaveRepository: LeaveRepositoryImpl by lazy {
        LeaveRepositoryImpl(apiService)
    }

    val creditRepository: CreditRepositoryImpl by lazy {
        CreditRepositoryImpl(apiService)
    }

    val substitutionRepository: SubstitutionRepositoryImpl by lazy {
        SubstitutionRepositoryImpl(apiService)
    }

    val preferencesRepository: PreferencesRepositoryImpl by lazy {
        PreferencesRepositoryImpl(apiService)
    }

    val notificationRepository: NotificationRepositoryImpl by lazy {
        NotificationRepositoryImpl(apiService)
    }

    val academicSummaryRepository: AcademicSummaryRepository by lazy {
        AcademicSummaryRepository(apiService)
    }

    val hodRepository: com.governence.faflow.faflow.data.HodRepositoryImpl by lazy {
        com.governence.faflow.faflow.data.HodRepositoryImpl(apiService)
    }

    val systemPolicyRepository: com.governence.faflow.faflow.data.SystemPolicyRepositoryImpl by lazy {
        com.governence.faflow.faflow.data.SystemPolicyRepositoryImpl(apiService)
    }

    // Milestone 4: Geofence & Location Subsystem (Lazy)
    val staffLocationProvider: StaffLocationProvider by lazy {
        StaffLocationProvider(context.applicationContext)
    }

    val geofenceValidator: GeofenceValidator by lazy {
        GeofenceValidator(maxAccuracyThresholdMeters = 50.0f)
    }

    val geofenceRepository: GeofenceRepository by lazy {
        GeofenceRepository(
            locationProvider = staffLocationProvider,
            geofenceValidator = geofenceValidator,
            apiService = apiService
        )
    }

    // Milestone 9 & 10: Attendance & Device Integrity Subsystem (Lazy)
    val attendanceLocalQueue: com.governence.faflow.attendance.data.AttendanceLocalQueue by lazy {
        com.governence.faflow.attendance.data.AttendanceLocalQueue(context.applicationContext)
    }

    val attendanceRepository: com.governence.faflow.attendance.data.AttendanceRepository by lazy {
        com.governence.faflow.attendance.data.AttendanceRepository(apiService, attendanceLocalQueue)
    }

    val deviceIntegrityVerifier: com.governence.faflow.core.security.DeviceIntegrityVerifier by lazy {
        com.governence.faflow.core.security.StandardDeviceIntegrityVerifier(context.applicationContext)
    }

    // Milestone 8 & 9: On-Device Biometric Face AI Subsystem (Lazy - does not block startup)
    val scrfdModelManager: com.governence.faflow.attendance.biometrics.model.ScrfdModelManager by lazy {
        com.governence.faflow.attendance.biometrics.model.ScrfdModelManager(context.applicationContext)
    }

    val faceDetector: com.governence.faflow.attendance.biometrics.scrfd.ScrfdFaceDetector by lazy {
        com.governence.faflow.attendance.biometrics.scrfd.ScrfdFaceDetector(scrfdModelManager)
    }

    val mobileFaceNetModelManager: com.governence.faflow.attendance.biometrics.model.MobileFaceNetModelManager by lazy {
        com.governence.faflow.attendance.biometrics.model.MobileFaceNetModelManager(context.applicationContext)
    }

    val faceEmbedder: com.governence.faflow.attendance.biometrics.FaceEmbedder by lazy {
        com.governence.faflow.attendance.biometrics.embedding.MobileFaceNetEmbedder(mobileFaceNetModelManager)
    }

    val faceAligner: com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner by lazy {
        com.governence.faflow.attendance.biometrics.alignment.SimilarityFaceAligner()
    }

    val faceEnrollmentRepository: com.governence.faflow.attendance.biometrics.enrollment.LocalFaceEnrollmentRepository by lazy {
        com.governence.faflow.attendance.biometrics.enrollment.LocalFaceEnrollmentRepository(context.applicationContext)
    }

    val faceMatcher: com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher by lazy {
        com.governence.faflow.attendance.biometrics.matching.CosineFaceMatcher()
    }

    val livenessEngine: com.governence.faflow.attendance.biometrics.liveness.LivenessEngine by lazy {
        com.governence.faflow.attendance.biometrics.liveness.LivenessEngine()
    }

    val faceRecognitionEngine: com.governence.faflow.attendance.biometrics.recognition.FaceRecognitionEngine by lazy {
        com.governence.faflow.attendance.biometrics.recognition.FaceRecognitionEngine(
            aligner = faceAligner,
            embedder = faceEmbedder,
            matcher = faceMatcher,
            enrollmentRepository = faceEnrollmentRepository,
            livenessEngine = livenessEngine
        )
    }

    val attendancePipelineOrchestrator: com.governence.faflow.attendance.pipeline.AttendancePipelineOrchestrator by lazy {
        com.governence.faflow.attendance.pipeline.AttendancePipelineOrchestrator(
            attendanceRepository = attendanceRepository,
            recognitionEngine = faceRecognitionEngine
        )
    }

    companion object {
        @Volatile
        private var instance: AppContainer? = null

        fun getInstance(context: Context): AppContainer {
            return instance ?: synchronized(this) {
                instance ?: AppContainer(context.applicationContext).also { instance = it }
            }
        }
    }
}
