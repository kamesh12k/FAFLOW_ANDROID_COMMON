# FAFLOW Staff Mobile: Comprehensive Project Analysis & Architecture Specification

> **Target Platform**: Android (Native Kotlin / Jetpack Compose)  
> **Target Audience**: Institutional Faculty & Staff (Teaching Staff, HODs, Lab Technicians, Non-Teaching Staff)  
> **Source of Truth Backend**: Upstream FAFLOW FastAPI + PostgreSQL Backend  
> **Core Identity**: On-Device Geofenced Biometric Shift Attendance & Faculty Operations Management  
> **Generated Timestamp**: 2026-09-06  

---

## Table of Contents
1. [Executive Summary & Core Identity](#1-executive-summary--core-identity)
2. [Technical Stack & Environment Specifications](#2-technical-stack--environment-specifications)
3. [Architectural Overview & Clean Separation of Concerns](#3-architectural-overview--clean-separation-of-concerns)
4. [Pin-to-Pin Codebase & File System Inventory](#4-pin-to-pin-codebase--file-system-inventory)
5. [In-Depth Subsystem Specifications](#5-in-depth-subsystem-specifications)
   - [5.1 Hardware Security & Cryptographic Session Subsystem](#51-hardware-security--cryptographic-session-subsystem)
   - [5.2 CameraX Hardware Acquisition Subsystem](#52-camerax-hardware-acquisition-subsystem)
   - [5.3 Deep Neural Biometric Face AI Engine](#53-deep-neural-biometric-face-ai-engine)
   - [5.4 Liveness & Presentation Attack Detection (PAD)](#54-liveness--presentation-attack-detection-pad)
   - [5.5 Geolocation & Campus Geofencing Subsystem](#55-geolocation--campus-geofencing-subsystem)
   - [5.6 Attendance Pipeline Orchestration & Offline Queue Subsystem](#56-attendance-pipeline-orchestration--offline-queue-subsystem)
   - [5.7 Academic Calendar, Timetable, Leaves & Substitution Subsystem](#57-academic-calendar-timetable-leaves--substitution-subsystem)
   - [5.8 HOD Governance & Control Plane Subsystem](#58-hod-governance--control-plane-subsystem)
   - [5.9 Institutional UI Design System & Theming](#59-institutional-ui-design-system--theming)
   - [5.10 16 KB Memory Page-Size Hardening & Native Layer](#510-16-kb-memory-page-size-hardening--native-layer)
6. [End-to-End API Integration & Backend Mapping Matrix](#6-end-to-end-api-integration--backend-mapping-matrix)
7. [Current Health Audit & Diagnostic Status](#7-current-health-audit--diagnostic-status)
8. [Summary of Strengths & Production Readiness](#8-summary-of-strengths--production-readiness)

---

## 1. Executive Summary & Core Identity

### What FAFLOW Staff Mobile Is
**FAFLOW Staff Mobile** (`com.governence.faflow`) is an enterprise-grade, native Android application built specifically for **Institutional Staff and Faculty** (Teaching Staff, Assistant/Associate Professors, Heads of Departments (HODs), Lab Technicians, and Non-Teaching Staff).

### What FAFLOW Staff Mobile Is NOT
* **NO Student Entity**: There are **zero** student models, student logins, student rosters, or student attendance features in this codebase.
* **NOT a Consumer/Public App**: It operates as an institutional terminal interfacing directly with the upstream **FAFLOW FastAPI + PostgreSQL** backend.
* **NO Cloud Biometrics**: No raw face images, unencrypted biometrics, or face video streams ever leave the device.

### Core Value Proposition & Primary Functions
1. **On-Device Biometric Shift Check-In / Check-Out**: Uses front-camera CameraX, on-device InsightFace SCRFD face detection, 5-point canonical similarity alignment (Umeyama transform), MobileFaceNet ArcFace 512-D neural feature extraction, and active/passive presentation attack defense (anti-spoofing).
2. **Campus Geofencing**: High-precision boundary verification using Google Play Services `FusedLocationProviderClient`, computing Haversine circular and Ray-Casting polygonal boundaries with strict anti-mock GPS defense.
3. **Institutional Faculty Operations**: Direct parity with the FAFLOW Web Portal: 6-Day Order $\times$ 5-Period timetable schedules, period-level emergency and planned leave requests, duty credit ledgers ($+1/-1$), peer substitution recommendations and locking, and departmental alerts.
4. **HOD Governance & Operational Control Plane**: Real-time supervisor attendance dashboard, leave approval/rejection workflows with substitution assignment, class-wise timetable directory, and faculty roster tracking.
5. **Offline Resiliency**: Embedded SQLite persistent queue with Android `WorkManager` background sync guaranteeing attendance capture during campus network dead zones.
6. **Android 15/16 16 KB Page-Size Hardening**: Custom ELF-aligned native runtime binaries complying with 16 KB memory page boundaries ($2^{14} = 16384\text{ B}$).

---

## 2. Technical Stack & Environment Specifications

| Layer | Technology / Library | Version / Details | Purpose |
|---|---|---|---|
| **Language** | Kotlin | `2.2.10` | Core language across all layers |
| **Android SDK** | `compileSdk` / `targetSdk`: `37`, `minSdk`: `26` | Android 8.0 (Oreo) to Android 16 | Operating system compatibility |
| **Build Toolchain** | Android Gradle Plugin (AGP) | `9.3.2` / Gradle `8.11.1` | Build orchestration |
| **Java Runtime** | Java 17 | `JavaVersion.VERSION_17` | Toolchain compile compatibility |
| **UI Framework** | Jetpack Compose + Material 3 | Compose BOM `2025.02.00` | Declarative UI and Design Tokens |
| **Navigation** | Navigation Compose | `2.8.8` | Type-safe declarative routing |
| **Async / Threading** | Kotlin Coroutines & Flow | `1.10.1` | Asynchronous operations & reactive UI |
| **Camera** | AndroidX CameraX | `1.4.1` (`core`, `camera2`, `lifecycle`, `view`) | Front-camera frame acquisition |
| **AI Inference** | ONNX Runtime Mobile | `1.21.0` (`com.microsoft.onnxruntime`) | On-device deep learning execution |
| **Networking** | Retrofit 2 + OkHttp 3 | Retrofit `2.11.0`, OkHttp `4.12.0` | REST API communication with FastAPI |
| **Serialization** | Moshi Kotlin | `1.15.2` (via code-gen / reflection) | JSON serialization/deserialization |
| **Hardware Security** | AndroidX Security Crypto | `1.1.0-alpha06` | Android Keystore & `EncryptedSharedPreferences` |
| **Geolocation** | Google Play Services Location | `21.3.0` | High-accuracy GPS & Geofencing |
| **Background Sync** | AndroidX WorkManager | `2.10.0` | Persistent offline queue background upload |
| **Animations** | Airbnb Lottie Compose | `6.6.2` | Vector splash & login animations |

---

## 3. Architectural Overview & Clean Separation of Concerns

The application adheres strictly to the **Clean Architecture** and **Unidirectional Data Flow (UDF)** patterns, supported by a decoupled **Service Locator (`AppContainer`)**:

```
                                    +-----------------------------+
                                    |     Jetpack Compose UI      |
                                    |  (Screens, Theme, Views)    |
                                    +--------------+--------------+
                                                   | StateFlow / User Events
                                                   v
                                    +-----------------------------+
                                    |      ViewModel Layer        |
                                    | (Attendance, Dashboard, etc)|
                                    +--------------+--------------+
                                                   |
                     +-----------------------------+-----------------------------+
                     |                             |                             |
                     v                             v                             v
+-------------------------------+  +-------------------------------+  +-------------------------------+
|       Biometric AI Core       |  |      Location Subsystem       |  |     Data Repositories         |
| - ScrfdFaceDetector (ONNX)    |  | - StaffLocationProvider       |  | - AttendanceRepository        |
| - SimilarityFaceAligner (112) |  | - GeofenceValidator           |  | - AuthRepository              |
| - MobileFaceNetEmbedder (512) |  | - GeofenceMathEngine          |  | - TimetableRepository         |
| - LivenessEngine (PAD)        |  | - Anti-Mock GPS Verifier      |  | - LeaveRepository             |
| - CosineFaceMatcher           |  | - GeofenceRepository          |  | - HodRepository               |
+-------------------------------+  +-------------------------------+  +---------------+---------------+
                     |                             |                                  |
                     +-----------------------------+----------------------------------+
                                                   |
                                                   v
                                    +-----------------------------+
                                    |       Storage & Remote      |
                                    | - EncryptedSharedPreferences|
                                    | - SQLite Offline Queue      |
                                    | - Retrofit / FastAPI Client |
                                    | - Android WorkManager       |
                                    +-----------------------------+
```

### Key Architectural Traits
1. **Zero Cold-Start Blocking**: Keystore cryptographic derivation and `EncryptedSharedPreferences` initialization can block the Android main thread for 100–400ms. In FAFLOW, `FaflowApplication.kt` pre-warms `AppContainer.kt` and `TokenManager` on a background `Dispatchers.IO` coroutine.
2. **Lazy Service Locator**: All heavy subsystems (ONNX inference runtimes, hardware SQLite databases, and Location clients) are initialized via Kotlin `lazy` delegates inside `AppContainer`, instantiating only when accessed.
3. **Single Source of Truth**: ViewModels expose immutable `StateFlow` streams. UI components emit discrete user actions, ensuring complete UI state determinism.

---

## 4. Pin-to-Pin Codebase & File System Inventory

### Package Breakdown: `com.governence.faflow`

```
b:\android\app\src\main\java\com\governence\faflow\
├── FaflowApplication.kt                  # Application class; background pre-warmer for AppContainer
├── MainActivity.kt                       # Single-activity container hosting Compose NavGraph
│
├── attendance/                           # Core Attendance & Biometrics Engine
│   ├── biometrics/
│   │   ├── FaceInterfaces.kt             # FaceDetector, FaceAligner, FaceEmbedder, FaceMatcher contracts
│   │   ├── ModelManager.kt               # Base lifecycle & memory management for ONNX models
│   │   ├── alignment/                    # 5-Point Umeyama similarity alignment to 112x112
│   │   │   ├── FaceAligner.kt            # Alignment contract & FaceAlignmentResult
│   │   │   ├── FaceAlignmentConfig.kt    # Canonical coordinates & landmark thresholds
│   │   │   ├── SimilarityFaceAligner.kt  # Least-squares 2D similarity transform matrix math
│   │   │   └── UmeyamaFaceAligner.kt     # Canonical Umeyama paper implementation
│   │   ├── detector/
│   │   │   └── NativeFaceDetector.kt     # Android framework fallback face detector
│   │   ├── embedding/
│   │   │   ├── ArcFaceEmbedder.kt        # ArcFace ONNX embedding extraction engine
│   │   │   ├── EmbeddingPreprocessor.kt  # DirectByteBuffer float normalization
│   │   │   ├── FaceRecognitionConfig.kt  # Cosine threshold (0.60), vector dimension (512)
│   │   │   └── MobileFaceNetEmbedder.kt  # MobileFaceNet w600k 512-D + deterministic fallback
│   │   ├── enrollment/
│   │   │   └── FaceEnrollmentRepository.kt # Hardware Keystore encrypted template storage
│   │   ├── liveness/                     # Multi-layer presentation attack defense (anti-spoof)
│   │   │   ├── ActiveLivenessDetector.kt # Challenge evaluator (head turn, pitch, blink)
│   │   │   ├── AntiSpoofModel.kt         # Texture / photostatic variance check
│   │   │   ├── AntiSpoofModelManager.kt  # Deep anti-spoof model wrapper
│   │   │   ├── BlinkDetector.kt          # Eye aspect ratio (EAR) blink analyzer
│   │   │   ├── ChallengeGenerator.kt     # Pseudo-random challenge generator
│   │   │   ├── HeadPoseAnalyzer.kt       # 3D Head Pose estimation (Yaw/Pitch/Roll)
│   │   │   ├── LivenessConfig.kt         # Tolerance angles and timeout constants
│   │   │   ├── LivenessEngine.kt         # High-level coordinator for passive/active checks
│   │   │   ├── LivenessModels.kt         # Observation buffers, risk levels, and challenge states
│   │   │   └── MotionAnalyzer.kt         # Temporal landmark trajectory analyzer
│   │   ├── matching/
│   │   │   └── CosineFaceMatcher.kt      # Vector dot-product cosine similarity calculator
│   │   ├── model/
│   │   │   ├── ArcFaceModelManager.kt    # ONNX session manager for MobileFaceNet
│   │   │   ├── FaceModels.kt             # FaceBox, FaceLandmarks, FaceQuality, FaceMatchResult
│   │   │   ├── MobileFaceNetModelManager.kt # Model loader for MobileFaceNet
│   │   │   ├── MobileFaceNetModelMetadata.kt# Input shapes (112x112x3), output dims (512)
│   │   │   ├── ScrfdModelManager.kt      # ONNX session manager for SCRFD 500M
│   │   │   └── ScrfdModelMetadata.kt     # Input shape (640x640x3), strides (8, 16, 32)
│   │   ├── quality/
│   │   │   └── FaceQualityValidator.kt   # Brightness, sharpness, pose angle, centering checks
│   │   ├── recognition/
│   │   │   └── FaceRecognitionEngine.kt  # End-to-end verification coordinator
│   │   └── scrfd/                        # InsightFace SCRFD 500M ONNX detection pipeline
│   │       ├── ScrfdDecoder.kt           # Multi-stride anchor decoding for bbox & landmarks
│   │       ├── ScrfdFaceDetector.kt      # ONNX Runtime frame executor with fallback
│   │       ├── ScrfdPostprocessor.kt     # Intersection-over-Union (IoU) Non-Maximum Suppression
│   │       └── ScrfdPreprocessor.kt      # Aspect-ratio letterbox padding to 640x640
│   │
│   ├── data/                             # Persistence & Repositories
│   │   ├── AttendanceLocalQueue.kt       # Persistent SQLite queue for offline punches
│   │   ├── AttendanceRepository.kt       # Online API submission + offline queue fallback
│   │   └── PendingAttendanceEntity.kt    # Data model for queued offline attendance
│   ├── geolocation/                      # Geofence & GPS engine
│   │   ├── GeofenceEngine.kt             # Geofence mathematical evaluation algorithms
│   │   ├── GeofenceValidator.kt          # Haversine distance, polygon point-in-poly, mock check
│   │   ├── LocationContracts.kt          # CampusGeofence, StaffLiveLocation, result sealed class
│   │   └── StaffLocationProvider.kt      # Google Play FusedLocationProviderClient wrapper Flow
│   ├── model/
│   │   ├── AttendanceConfig.kt           # Geofence tolerance, time windows, distance thresholds
│   │   └── AttendancePipelineStatus.kt   # 28-state comprehensive UI/business pipeline state machine
│   ├── pipeline/
│   │   └── AttendancePipelineOrchestrator.kt # Single-pass 7-stage fail-fast pipeline
│   └── sync/
│       └── AttendanceSyncWorker.kt       # Android WorkManager background sync worker
│
├── auth/                                 # Authentication & Session
│   ├── data/
│   │   └── AuthRepository.kt             # Login, profile query, logout, cached session
│   └── ui/
│       └── AuthViewModel.kt              # AuthUiState, login form state, session lifecycle
│
├── camera/                               # CameraX Hardware Subsystem
│   ├── CameraAnalyzer.kt                 # Throttled ImageAnalysis analyzer (keeps latest frame)
│   ├── CameraController.kt               # Lifecycle-bound front-camera controller
│   ├── CameraFrame.kt                    # Bitmap/NV21 frame data holder
│   ├── CameraFrameProcessor.kt           # Frame consumer interface
│   ├── CameraOverlay.kt                  # Face oval guide, status banners, feedback indicators
│   ├── CameraPreviewView.kt              # Compose AndroidView wrapper for CameraX PreviewView
│   └── CameraState.kt                    # Initializing, Ready, Unavailable, Error states
│
├── core/                                 # Central Infrastructure & Common Utilities
│   ├── di/
│   │   └── AppContainer.kt               # Central dependency injection / service locator
│   ├── network/
│   │   ├── ApiConfig.kt                  # Base URLs (Emulator, LAN, Production), timeouts
│   │   ├── FaflowApiClient.kt            # Retrofit/OkHttp builder with sanitized logging
│   │   ├── FaflowApiService.kt           # Complete Retrofit HTTP endpoint contracts
│   │   ├── FaflowDtos.kt                 # Exhaustive Moshi JSON DTOs matching FastAPI schemas
│   │   └── NetworkInfrastructure.kt      # NetworkResult<T>, TokenManager, AuthInterceptor
│   ├── security/
│   │   └── DeviceIntegrityVerifier.kt    # Hardware attestation & emulator sanity check
│   └── telemetry/
│       └── AttendanceTelemetry.kt        # In-memory non-sensitive latency & performance metrics
│
├── domain/                               # Domain Entities & Business Models
│   └── model/
│       └── DomainModels.kt               # StaffMember, StaffFaceProfile, StaffAttendanceRecord, etc.
│
├── faflow/                               # Academic & Campus Operations Repositories
│   ├── FaflowContracts.kt                # Interfaces for Timetable, Leaves, Credits, Substitutions
│   └── data/
│       ├── FaflowRepositories.kt         # Concrete implementations for all FAFLOW modules
│       └── GeofenceRepository.kt         # Campus geofence provider and location tracking flow
│
├── security/
│   └── SecurityContracts.kt              # Cryptographic and hardware key contracts
│
├── sync/
│   └── SyncManager.kt                    # Sync scheduling trigger contracts
│
├── ui/                                   # Presentation Layer (Jetpack Compose)
│   ├── components/                       # Shared design system components
│   │   ├── AppTopBar.kt                  # Standard institutional top bar
│   │   ├── DesignSystemComponents.kt     # Action buttons, dialogs, form fields, cards
│   │   ├── MainBottomNavigation.kt       # Role-aware bottom navigation bar (Teacher vs HOD)
│   │   ├── PermissionRationaleDialog.kt  # Camera/Location permission request dialog
│   │   ├── PremiumTopBar.kt              # Top bar with elevation, badges, and avatar
│   │   ├── PrimaryButton.kt              # Institutional standard interactive button
│   │   ├── ResultRow.kt                  # Key-value visual row component
│   │   ├── StatCard.kt                   # Metric summary cards for dashboards
│   │   └── StateViews.kt                 # Loading, Error, Empty state screens
│   ├── navigation/
│   │   ├── NavGraph.kt                   # Complete Jetpack Compose routing table
│   │   └── Screen.kt                     # Type-safe screen routes & BottomNavItem definitions
│   ├── screens/                          # 24 Functional Android Screens
│   │   ├── ApplyLeaveScreen.kt           # Period-wise/full-day leave application
│   │   ├── AttendanceCheckInOutScreen.kt # Fullscreen CameraX face verification & punch
│   │   ├── AttendanceHistoryScreen.kt    # Filterable monthly attendance ledger
│   │   ├── ClasswiseTimetableScreen.kt   # Timetable matrix by class and day order
│   │   ├── CreditsScreen.kt              # Duty credit balance and history ledger
│   │   ├── DashboardScreen.kt            # Primary Teacher dashboard
│   │   ├── FaceEnrollmentScreen.kt       # Guided selfie capture & biometric template enrollment
│   │   ├── GeofenceAdminScreen.kt        # Visual campus perimeter editor
│   │   ├── HodAttendanceScreen.kt        # HOD live supervisor attendance monitoring
│   │   ├── HodDashboardScreen.kt         # Primary HOD departmental dashboard
│   │   ├── HodFacultyDirectoryScreen.kt  # Faculty directory and status
│   │   ├── HodLeaveApprovalScreen.kt     # HOD leave approval & substitute assignment
│   │   ├── LeaveHistoryScreen.kt         # Faculty leave history with cancellation
│   │   ├── LoginScreen.kt                # Institutional credentials login screen
│   │   ├── MoreScreen.kt                 # Secondary features hub
│   │   ├── NotificationsScreen.kt        # In-app notifications & alerts
│   │   ├── PreferencesScreen.kt          # Substitution limits and cross-dept preferences
│   │   ├── ProfileScreen.kt              # Staff profile & credentials
│   │   ├── SettingsScreen.kt             # Server URL configuration & diagnostics
│   │   ├── SplashScreen.kt               # Pre-warm splash screen with animated logo
│   │   ├── StaffAttendanceScreen.kt      # Shift status, check-in card, mini history
│   │   ├── SubstitutionScreen.kt         # My duties, handed-over classes, candidate picker
│   │   ├── SyncStatusScreen.kt           # Offline queue status & manual sync button
│   │   ├── TimetableScreen.kt            # Personal weekly timetable (6 Day Orders)
│   │   └── TodayCoverageScreen.kt        # Day's class coverage and substitute status
│   ├── theme/                            # Design System v2 & Theme Tokens
│   │   ├── Color.kt                      # Curated institutional color palette
│   │   ├── FaflowDesignTokens.kt         # Spacing, shapes, role colors, status colors
│   │   ├── Theme.kt                      # Material 3 Theme definition
│   │   └── Type.kt                       # Institutional typography definitions
│   └── viewmodels/                       # Architecture ViewModels
│       ├── AttendanceViewModel.kt        # Face pipeline, location gating, auto-capture UX
│       ├── DashboardAndTimetableViewModels.kt # Teacher Dashboard & Timetable ViewModels
│       ├── FacultyFeatureViewModels.kt   # Leave, Credits, Substitution, Preferences ViewModels
│       ├── GeofenceAdminViewModel.kt     # Geofence CRUD & coordinate management
│       └── HodViewModel.kt               # Comprehensive HOD state management
│
└── utils/
    └── Utils.kt                          # Formatting, date helpers, time formatting
```

---

## 5. In-Depth Subsystem Specifications

---

### 5.1 Hardware Security & Cryptographic Session Subsystem

* **Key Source Files**: `core/network/NetworkInfrastructure.kt`, `auth/data/AuthRepository.kt`, `core/security/DeviceIntegrityVerifier.kt`
* **Storage Engine**: `EncryptedSharedPreferences` backed by the **Android KeyStore** hardware security module (TEE/StrongBox).
* **Cryptographic Schemes**:
  * Preference Key Encryption: `AES256_SIV`
  * Preference Value Encryption: `AES256_GCM`
  * Master Key: `MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()`
* **Session Persistence**: Stores `access_token`, `user_id`, `user_name`, `user_email`, `user_role`, and `department_id`.
* **Network Injection**: `AuthInterceptor` attaches `Authorization: Bearer <token>` to all HTTP requests unless already provided. On `HTTP 401 Unauthorized`, it automatically clears the session and triggers a global logout callback.
* **Device Integrity Verification**: `StandardDeviceIntegrityVerifier` audits static environmental fingerprints (build hardware, ranchu/goldfish emulator markers, test-keys, genymotion) to detect compromised runtime environments.

---

### 5.2 CameraX Hardware Acquisition Subsystem

* **Key Source Files**: `camera/CameraController.kt`, `camera/CameraAnalyzer.kt`, `camera/CameraPreviewView.kt`, `camera/CameraOverlay.kt`
* **Lens Selection**: Strictly forces `CameraSelector.LENS_FACING_FRONT`. Throws `CameraState.Unavailable` if no front sensor is detected.
* **Backpressure & Memory Strategy**: Configured with `ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST`. Frame processing runs on a dedicated single-thread executor (`analysisExecutor`), dropping stale frames rather than queueing up latency.
* **Resolution**: Standardized to $640 \times 480$ with fallback `FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER`.
* **Color Output**: Configured for `ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888`, avoiding expensive YUV-to-RGB conversion overhead in Kotlin.
* **Framing Guide**: `CameraOverlay` renders a central biometric ellipse (`420dp` height, `320dp` width) with dynamic border colors:
  * Gray = Searching
  * Amber = Settling / Hold Still
  * Green = Face Verified & Matched
  * Red = Error / Outside Bounds / Spoof Suspected

---

### 5.3 Deep Neural Biometric Face AI Engine

$$\text{Frame} \xrightarrow{\text{SCRFD ONNX}} \begin{pmatrix} \text{BBox} \\ \text{5 Landmarks} \end{pmatrix} \xrightarrow{\text{Umeyama Affine}} [112 \times 112] \xrightarrow{\text{MobileFaceNet}} \mathbf{v} \in \mathbb{R}^{512} \xrightarrow{\text{Cosine Match}} \text{Verified}$$

```
                                      Camera Frame Bitmap
                                              |
                                              v
                             +----------------------------------+
                             |   SCRFD 500M Face Detector       |
                             | - Preprocess: Letterbox 640x640  |
                             | - ONNX Runtime Inference         |
                             | - Postprocess: Multi-Stride NMS  |
                             +----------------+-----------------+
                                              | FaceDetectionResult
                                              | (BBox + 5 Landmarks)
                                              v
                             +----------------------------------+
                             |     Face Quality Validator       |
                             | - Lighting (0.3 <= Bright <= 0.9)|
                             | - Centering within Oval Guide    |
                             | - Head Tilt (Yaw/Pitch <= 20 deg)|
                             +----------------+-----------------+
                                              | Valid Frame
                                              v
                             +----------------------------------+
                             |   Similarity Face Aligner        |
                             | - 5-Point Umeyama Transform      |
                             | - Warps face to 112x112 Plane    |
                             +----------------+-----------------+
                                              | Aligned 112x112 Bitmap
                                              v
                             +----------------------------------+
                             |   MobileFaceNet ArcFace Embedder |
                             | - FloatBuffer Normalization      |
                             | - 512-D Feature Extraction       |
                             | - L2 Unit Normalization          |
                             +----------------+-----------------+
                                              | Live Embedding Vector [512]
                                              v
                             +----------------------------------+
                             |       Cosine Face Matcher        |
                             | - Dot Product vs Enrolled Vector |
                             | - Threshold >= 0.60              |
                             +----------------+-----------------+
                                              | Match Result
                                              v
                                      [ Identity Verified ]
```

#### 1. Face Detection: SCRFD 500M (`ScrfdFaceDetector.kt`)
* **Input Tensor**: Shape `[1, 3, 640, 640]` NCHW float tensor.
* **Anchor Strides**: Decodes 3 feature pyramid strides:
  * Stride 8: $80 \times 80 = 6,400$ anchors (small faces)
  * Stride 16: $40 \times 40 = 1,600$ anchors (medium faces)
  * Stride 32: $20 \times 20 = 400$ anchors (large faces)
  * Total: 8,400 candidate anchors decoded per pass.
* **Thresholds**: Default confidence score threshold $= 0.50$; IoU NMS threshold $= 0.40$.
* **Landmarks**: Extracts 5 facial landmarks: Left Eye, Right Eye, Nose Tip, Left Mouth Corner, Right Mouth Corner.
* **Native Fallback**: If the ONNX session fails or native libraries are missing, delegates seamlessly to `NativeFaceDetector` (Android `android.media.FaceDetector`).

#### 2. Canonical Alignment: Similarity Face Aligner (`SimilarityFaceAligner.kt`)
* Implements the **Umeyama (1991)** closed-form 2D least-squares similarity transformation algorithm.
* **Biological Validation Checks**:
  1. Landmark boundary check within image canvas.
  2. Inter-pupillary distance $\ge 20\text{ px}$.
  3. Eye ordering ($X_{\text{left}} < X_{\text{right}}$).
  4. Nose vertical position ($Y_{\text{nose}} > Y_{\text{eye-midpoint}}$).
  5. Mouth vertical position ($Y_{\text{mouth}} > Y_{\text{nose}}$).
  6. Mouth corner ordering ($X_{\text{mouth-left}} < X_{\text{mouth-right}}$).
* Warps source face onto canonical $112 \times 112$ plane matching InsightFace coordinates:
  * Left Eye: `(38.2946, 51.6963)`
  * Right Eye: `(73.5318, 51.5014)`
  * Nose: `(56.0252, 71.7366)`
  * Left Mouth: `(41.5493, 92.3655)`
  * Right Mouth: `(70.7299, 92.2041)`

#### 3. Feature Embedding: MobileFaceNet ArcFace (`MobileFaceNetEmbedder.kt`)
* **Input**: Aligned $112 \times 112 \times 3$ RGB Bitmap.
* **Normalization**: $\text{pixel}_{\text{norm}} = \frac{\text{pixel} - 127.5}{128.0}$. Reuses direct native `FloatBuffer` and `IntArray` to eliminate allocation garbage.
* **Output Vector**: 512-dimensional float array.
* **$L_2$ Normalization**:
  $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\max(\|\mathbf{v}\|_2, 10^{-12})}$$
  Protects against zero-vectors, `NaN`, and `Infinity`.
* **Deterministic Fallback**: In test environments or unsupported runtimes, computes a deterministic 512-D vector across 4 sub-feature sets:
  1. $4 \times 4$ Grid blocks (Mean, Variance, Min, Max): 64 features.
  2. Local Binary Patterns (LBP) histogram (16 bins $\times$ 16 blocks): 256 features.
  3. Horizontal and vertical gradients: 128 features.
  4. Biological facial structure ratios: 64 features.

#### 4. Face Matching: Cosine Similarity (`CosineFaceMatcher.kt`)
* Matches normalized probe vector $\hat{\mathbf{v}}$ against enrolled vector $\hat{\mathbf{u}}$:
  $$\text{Similarity}(\hat{\mathbf{v}}, \hat{\mathbf{u}}) = \sum_{i=0}^{511} \hat{v}_i \cdot \hat{u}_i$$
* **Threshold**: $\theta = 0.60$ (configurable between $0.60 - 0.70$). Returns match confirmed if $\text{Score} \ge \theta$.

---

### 5.4 Liveness & Presentation Attack Detection (PAD)

* **Key Source Files**: `attendance/biometrics/liveness/LivenessEngine.kt`, `attendance/biometrics/liveness/HeadPoseAnalyzer.kt`, `attendance/biometrics/liveness/MotionAnalyzer.kt`, `attendance/biometrics/liveness/ActiveLivenessDetector.kt`
* **Passive Defense**:
  * Evaluates temporal landmark trajectory over a rolling window.
  * Rejects static print/photo attacks if micro-movement variance is near-zero over consecutive frames (`PresentationAttackRisk.HIGH`).
* **Active Defense**:
  * Estimates 3D head pose (Yaw, Pitch, Roll) continuously from 5 landmarks.
  * Issues randomized challenges: `TURN_LEFT` ($\text{Yaw} < -18^\circ$), `TURN_RIGHT` ($\text{Yaw} > 18^\circ$), `LOOK_UP` ($\text{Pitch} < -12^\circ$), `LOOK_DOWN` ($\text{Pitch} > 12^\circ$), and `BLINK`.
  * Enforces a configurable per-challenge timeout (default 4000ms).
* **Smart Settling Window (Auto-Capture UX)**:
  * In instant auto-capture mode, evaluates a **300ms natural settling window** requiring **4 consecutive valid quality frames**.
  * Maintains a ranked pool of candidate frames (`CandidateFaceFrame`), selecting the highest quality frame for the final ArcFace embedding pass.

---

### 5.5 Geolocation & Campus Geofencing Subsystem

* **Key Source Files**: `attendance/geolocation/GeofenceValidator.kt`, `attendance/geolocation/GeofenceEngine.kt`, `attendance/geolocation/StaffLocationProvider.kt`, `ui/screens/GeofenceAdminScreen.kt`
* **Position Provider**: `FusedLocationProviderClient` requesting `PRIORITY_HIGH_ACCURACY` with 3-second update intervals.
* **Anti-Spoofing Rules**:
  1. Rejects any location where `location.isMock` is true (`MockLocationDetected`).
  2. Rejects stale fixes older than 60 seconds (`StaleLocation`).
  3. Rejects fixes with horizontal accuracy radius $> 30\text{ meters}$ (`AccuracyInsufficient`).
* **Mathematical Evaluation Models**:
  * **Circular Geofences**: Evaluates great-circle distance using the **Haversine Formula**:
    $$d = 2R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
    Valid if $d \le r_{\text{radius}} + \epsilon_{\text{tolerance}}$.
  * **Polygonal Geofences**: Evaluates arbitrary geometric campus zones using the **Ray-Casting Algorithm (Jordan Curve Theorem)**:
    Casts a horizontal semi-infinite ray from staff point $(P_x, P_y)$ and counts ray-edge intersections with polygon vertices. An odd intersection count confirms the point is inside.
* **Visual Admin Map Editor**: Built into `GeofenceAdminScreen.kt`, allowing campus administrators to visually inspect, create, modify, and delete circular and polygonal campus zones.

---

### 5.6 Attendance Pipeline Orchestration & Offline Queue Subsystem

* **Key Source Files**: `attendance/pipeline/AttendancePipelineOrchestrator.kt`, `attendance/model/AttendancePipelineStatus.kt`, `attendance/data/AttendanceLocalQueue.kt`, `attendance/sync/AttendanceSyncWorker.kt`
* **7-Stage Fail-Fast Execution Pipeline**:
  1. *Location Check*: Evaluates in-memory pre-warmed GPS fix. Fails immediately if outside all geofences without consuming camera CPU.
  2. *Single-Frame Detection*: Executes SCRFD 500M inference on camera bitmap.
  3. *Passive Liveness*: Confirms human facial micro-movement and frequency texture.
  4. *Canonical Alignment*: Warps 5 landmarks to $112 \times 112$.
  5. *Feature Extraction*: Generates 512-D ArcFace embedding vector.
  6. *Cosine Matching*: Compares vector against local enrolled template ($\theta \ge 0.60$).
  7. *Persistence*: Submits to FastAPI endpoint or enqueues in SQLite offline table.
* **Comprehensive 28-State Pipeline (`AttendancePipelineStatus`)**:
  `Initializing`, `Authenticating`, `RequestingPermissions`, `Locating`, `LocationUnavailable`, `OutsideGeofence`, `PoorGpsAccuracy`, `MockLocationBlocked`, `CameraInitializing`, `NoFace`, `MultipleFaces`, `FaceDetected`, `FaceTooSmall`, `FaceOutOfFrame`, `FaceAlignmentRequired`, `FaceVerification`, `LivenessCheck`, `VerificationFailed`, `ReadyForCheckIn`, `CheckingIn`, `CheckedIn`, `ReadyForCheckOut`, `CheckingOut`, `CheckedOut`, `SavedOffline`, `SyncPending`, `Syncing`, `Synced`, `ServerRejected`, `Error`.
* **Offline SQLite Database Schema (`faflow_attendance.db`)**:
  ```sql
  CREATE TABLE pending_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,          -- 'CHECK_IN' or 'CHECK_OUT'
      created_at INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_meters REAL NOT NULL,
      geofence_id TEXT,
      face_similarity_score REAL NOT NULL,
      liveness_verified INTEGER NOT NULL,
      verification_method TEXT NOT NULL,     -- 'FACE_ON_DEVICE'
      device_reference TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      last_error TEXT
  );
  ```
* **WorkManager Background Sync (`AttendanceSyncWorker.kt`)**:
  * Triggered automatically upon network reconnect via `NetworkType.CONNECTED`.
  * Scheduled for 15-minute periodic checks via `PeriodicWorkRequestBuilder`.
  * Uses UUID idempotency keys so repeated uploads never create duplicate attendance punches on the server.

---

### 5.7 Academic Calendar, Timetable, Leaves & Substitution Subsystem

* **Key Source Files**: `faflow/data/FaflowRepositories.kt`, `ui/viewmodels/DashboardAndTimetableViewModels.kt`, `ui/viewmodels/FacultyFeatureViewModels.kt`
* **Academic Calendar**:
  * Queries `GET /academic-calendar/my-today-summary` to resolve current Day Order (1 to 6), day type (working day, holiday, examination), and operational blocking flags.
* **Timetable**:
  * Represents 5 daily periods across 6 Day Orders.
  * Queries `GET /timetable/teacher/{teacher_id}` and `GET /timetable/` filtered by class, department, teacher, and day order.
* **Leaves Management**:
  * Period-level leave requests (`POST /leaves/`) or batch multi-period leave (`POST /leaves/batch`).
  * Detects Emergency Leave ($< 2\text{ hours}$ before shift start) and tags `isEmergency = true`.
  * Leave status lifecycle: `PENDING` $\rightarrow$ `APPROVED` / `REJECTED` / `CANCELLED`.
* **Substitution & Duty Credits**:
  * Queries `GET /teacher/substitution/leave/{id}/candidates` to receive AI/rules-ranked candidate colleagues based on free period matching and departmental compatibility score.
  * Duty Credit Ledger: Queries `GET /teachers/{id}/credits` and `/credits/my/transactions`. Faculty earn $+1$ credit for taking substitution classes and spend credits on leaves.
  * Substitution Preferences: Faculty configure daily/weekly substitution limits (`PUT /campus-operations/preferences/me`).

---

### 5.8 HOD Governance & Control Plane Subsystem

* **Key Source Files**: `ui/viewmodels/HodViewModel.kt`, `ui/screens/HodDashboardScreen.kt`, `ui/screens/HodLeaveApprovalScreen.kt`, `ui/screens/HodAttendanceScreen.kt`
* **Role-Based Dynamic Navigation**:
  * Roles: `admin` or `hod` dynamically unlock the **HOD Control Plane**.
  * Dedicated Bottom Bar navigation: **Overview**, **Leaves**, **Timetable**, **Attendance**, and **More**.
* **Supervisory Functions**:
  1. *Live Department Attendance*: Queries `GET /attendance/admin/live-status`, tracking present staff, absent staff, currently active personnel, and check-out counts in real time.
  2. *Leave Approvals & Substitutions*: HODs approve/reject pending faculty leave requests and allocate or re-assign substitute teachers in a single flow.
  3. *Today's Substitution Coverage*: Queries `GET /substitutions/today` to audit uncovered class periods across the department.
  4. *Faculty Directory*: Full search and status view of all departmental teachers.

---

### 5.9 Institutional UI Design System & Theming

* **Key Source Files**: `ui/theme/FaflowDesignTokens.kt`, `ui/theme/Color.kt`, `ui/theme/Theme.kt`, `ui/theme/Type.kt`
* **Design Philosophy**: High-clarity institutional design system (FAFLOW Design System v2), prioritizing contrast, readability, and zero clutter.
* **Palette Tokens**:
  * Primary Institutional Navy: `FaflowNavy` (`#1B3A6B`), Tint: `FaflowNavyTint` (`#EAF0F9`)
  * Teal Accent: `FaflowTeal` (`#0E8074`), Tint: `FaflowTealTint` (`#E4F3F1`)
  * HOD Violet: `FaflowViolet` (`#6C4FCE`), Tint: `FaflowVioletTint` (`#EFEBFC`)
  * Gold Accent: `FaflowGold` (`#A6790A`), Tint: `FaflowGoldTint` (`#FBF1DF`)
  * Surface / Background: `FaflowBg` (`#F5F6F8`), `FaflowSurface` (`#FFFFFF`), `FaflowBorder` (`#E6E8EC`)
  * Success / Danger: `FaflowSuccess` (`#1E8E5A`), `FaflowDanger` (`#C13F3F`)
* **Shapes**: Standardized Corner Radii (`button = 10dp`, `card = 13dp`, `checkinHero = 16dp`, `sheet = 24dp`).

---

### 5.10 16 KB Memory Page-Size Hardening & Native Layer

* **Key Source Files**: `app/build.gradle.kts`, `scripts/align_native_libs.py`, `scripts/align_apk.py`, `scripts/verify-16kb.ps1`
* **The Android 15/16 16 KB Challenge**:
  * Android 15 and 16 require that all native `.so` shared libraries have their ELF `PT_LOAD` segments aligned to 16 KB ($2^{14} = 16384\text{ B}$) page boundaries.
  * Standard Microsoft `onnxruntime-android:1.21.0` ships `libonnxruntime4j_jni.so` compiled with 4 KB alignment (`0x1000`), which causes runtime crashes on 16 KB kernels.
* **Hardening Implementation**:
  1. Patched 64-bit binaries (`arm64-v8a` and `x86_64`) stored under `app/src/main/jniLibs`.
  2. Gradle automated task hooks:
     * `merge*NativeLibs`: Runs `align_native_libs.py` on merged intermediate native directories.
     * `strip*DebugSymbols`: Re-verifies alignment after symbol stripping.
     * `package*`: Runs `align_apk.py` on output APKs to ensure zip file entry boundaries satisfy `zipalign -P 16`.

---

## 6. End-to-End API Integration & Backend Mapping Matrix

| Subsystem / Feature | HTTP Method & FastAPI Endpoint | Android Repository / Client Call | Request / Response DTOs |
|---|---|---|---|
| **User Login** | `POST /auth/login` | `AuthRepository.login()` | `UserLoginRequestDto` $\rightarrow$ `TokenDto` |
| **Current User Profile** | `GET /teachers/me` | `AuthRepository.getCurrentStaff()` | `UserOutDto` |
| **Day Order Summary** | `GET /academic-calendar/my-today-summary` | `AcademicSummaryRepository.getMyTodaySummary()` | `TeacherTodaySummaryDto` |
| **Day Order Resolver** | `GET /academic-calendar/resolve` | `AcademicSummaryRepository.resolveDate()` | `DayOrderResolveDto` |
| **Teacher Timetable** | `GET /timetable/teacher/{teacher_id}` | `TimetableRepositoryImpl.getTimetableForTeacher()` | `List<TimetableSlotOutDto>` |
| **General Timetable** | `GET /timetable/` | `HodRepositoryImpl.getTimetable()` | `List<TimetableSlotOutDto>` |
| **Class Directory** | `GET /classes/` | `HodRepositoryImpl.getClasses()` | `List<ClassOutDto>` |
| **Teacher Directory** | `GET /teachers/` | `HodRepositoryImpl.getDepartmentTeachers()` | `List<TeacherOutDto>` |
| **My Leaves** | `GET /leaves/my` | `LeaveRepositoryImpl.getMyLeaves()` | `List<LeaveOutDto>` |
| **All Leaves (HOD)** | `GET /leaves/` | `HodRepositoryImpl.getDepartmentLeaves()` | `List<LeaveOutDto>` |
| **Apply Single Leave** | `POST /leaves/` | `LeaveRepositoryImpl.applyLeave()` | `LeaveCreateDto` $\rightarrow$ `LeaveOutDto` |
| **Apply Batch Leave** | `POST /leaves/batch` | `LeaveRepositoryImpl.applyLeaveBatch()` | `LeaveBatchCreateDto` $\rightarrow$ `List<LeaveOutDto>` |
| **Cancel Leave** | `DELETE /leaves/{leave_id}` | `LeaveRepositoryImpl.cancelLeave()` | `Response<Unit>` |
| **Approve Leave (HOD)** | `PATCH /leaves/{leave_id}/approve` | `HodRepositoryImpl.approveLeave()` | `LeaveApproveResponseDto` |
| **Reject Leave (HOD)** | `PATCH /leaves/{leave_id}/reject` | `HodRepositoryImpl.rejectLeave()` | `LeaveOutDto` |
| **Update Leave Status** | `PATCH /leaves/{leave_id}/status` | Direct API Service call | `LeaveStatusUpdateDto` |
| **Assign Substitute** | `POST /leaves/{leave_id}/assign` | `HodRepositoryImpl.assignSubstitute()` | `LeaveAlterAssignmentCreateDto` $\rightarrow$ `AlterAssignmentOutDto` |
| **Today's Coverage** | `GET /substitutions/today` | `HodRepositoryImpl.getTodayCoverage()` | `TodaySubstitutionCoverageDto` |
| **Credit Balance** | `GET /teachers/{teacher_id}/credits` | `CreditRepositoryImpl.getCreditBalance()` | `CreditBalanceOutDto` |
| **Credit Ledger** | `GET /credits/my/transactions` | `CreditRepositoryImpl.getCreditTransactions()` | `List<CreditTransactionOutDto>` |
| **My Substitute Duties** | `GET /teacher/substitution/my-leaves` | `SubstitutionRepositoryImpl.getMyDuties()` | `List<LeaveOutDto>` |
| **Candidate Colleague** | `GET /teacher/substitution/leave/{id}/candidates` | Direct API Service call | `List<RecommendationOutDto>` |
| **Self-Assign Sub** | `POST /teacher/substitution/leave/{id}/assign/{sub_id}` | `SubstitutionRepositoryImpl.assignSubstitute()` | `AlterAssignmentOutDto` |
| **Undo Sub Assignment** | `POST /teacher/substitution/leave/{id}/undo-assignment` | `SubstitutionRepositoryImpl.undoAssignment()` | `LeaveOutDto` |
| **Get Preferences** | `GET /campus-operations/preferences/me` | `PreferencesRepositoryImpl.getPreferences()` | `SubstitutionPreferenceOutDto` |
| **Update Preferences** | `PUT /campus-operations/preferences/me` | `PreferencesRepositoryImpl.updatePreferences()` | `SubstitutionPreferenceUpdateDto` |
| **List Notifications** | `GET /notifications/` | `NotificationRepositoryImpl.getNotifications()` | `List<NotificationOutDto>` |
| **Unread Alerts Count** | `GET /notifications/unread-count` | `NotificationRepositoryImpl.getUnreadCount()` | `UnreadCountDto` |
| **Mark Notice Read** | `PATCH /notifications/{id}/read` | `NotificationRepositoryImpl.markAsRead()` | `StatusOkDto` |
| **Mark All Read** | `PATCH /notifications/read-all` | Direct API Service call | `StatusOkDto` |
| **Shift Check-In** | `POST /attendance/check-in` | `AttendanceRepository.checkIn()` | `AttendanceCheckInRequestDto` $\rightarrow$ `AttendanceRecordOutDto` |
| **Shift Check-Out** | `POST /attendance/check-out` | `AttendanceRepository.checkOut()` | `AttendanceCheckOutRequestDto` $\rightarrow$ `AttendanceRecordOutDto` |
| **Today Attendance** | `GET /attendance/today` | `AttendanceRepository.getTodaySummary()` | `AttendanceTodaySummaryOutDto` |
| **Attendance History** | `GET /attendance/my` | `AttendanceRepository.getMyHistory()` | `List<AttendanceRecordOutDto>` |
| **Live Supervisor** | `GET /attendance/admin/live-status` | `HodRepositoryImpl.getSupervisorLiveStatus()` | `SupervisorLiveStatusOutDto` |
| **Active Geofences** | `GET /geofences/active` | Direct API Service call | `List<GeofenceOutDto>` |
| **List All Geofences** | `GET /geofences/` | Direct API Service call | `List<GeofenceOutDto>` |
| **Create Geofence** | `POST /geofences/` | Direct API Service call | `GeofenceCreateDto` $\rightarrow$ `GeofenceOutDto` |
| **Update Geofence** | `PUT /geofences/{geofence_id}` | Direct API Service call | `GeofenceUpdateDto` $\rightarrow$ `GeofenceOutDto` |
| **Delete Geofence** | `DELETE /geofences/{geofence_id}` | Direct API Service call | `StatusOkDto` |
| **Effective Policy** | `GET /system/institutions/{id}/policy`| `SystemPolicyRepositoryImpl.getEffectivePolicy()` | `InstitutionPolicyDto` |

---

## 7. Current Health Audit & Diagnostic Status

### Gradle Unit Test Suite Execution:
```powershell
.\gradlew.bat testDebugUnitTest --offline
```

* **Total Unit Tests Run**: 94 tests across all modules.
* **Passed Tests**: 89 tests passed ($94.7\%$).
* **Failing Tests**: 5 tests failed.

### Forensic Breakdown of the 5 Test Failures:
1. **`FaflowIntegrationTest > testAttendanceTelemetryMetricsCollection`**:
   * *Origin*: Line 144. Direct call to `android.util.Log.d()` inside `AttendanceTelemetry.kt` throws `RuntimeException: Method d in android.util.Log not mocked` in standard headless JVM unit tests.
2. **`FaflowIntegrationTest > testActiveChallengeStepAdvancement`**:
   * *Origin*: Line 572. Assertion discrepancy in sequential challenge state transition during multi-step verification.
3. **`FaceRecognitionProductionTest`** (`testAutoCaptureMicroStabilityGate`, `testRetryCaptureResetsLockedState`, `testQualityRejectionResetsStability`):
   * *Origin*: Lines 388, 527, 494. Direct `android.util.Log` invocations introduced during the recent auto-capture performance overhaul (commit `73d44c3`) without JVM mock wrappers.

* **Production Packaging & Build Health**: Clean pass (`BUILD SUCCESSFUL`). All DEX compilation, R8/ProGuard optimizations, and APK packaging tasks complete with zero issues.

---

## 8. Summary of Strengths & Production Readiness

1. **Biometric Privacy**: 100% on-device AI processing ensures compliance with modern biometric privacy regulations (zero raw facial telemetry transmitted).
2. **Device Hardware Utilization**: Employs Android KeyStore TEE, CameraX front-camera pipeline, and direct native memory buffers for sub-second inference.
3. **Enterprise Institutional Depth**: Covers all faculty workflows (Timetable Day Orders 1–6, duty credit economy, leave delegation, and HOD approvals).
4. **Resilient Offline Architecture**: SQLite-backed queue combined with Android WorkManager guarantees zero lost attendance punches during network downtime.
5. **Modern Android Architecture**: 100% Jetpack Compose with Material 3 design system, type-safe navigation, Coroutines/StateFlow, and 16 KB page-size compliance.
