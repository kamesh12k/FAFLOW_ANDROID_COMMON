# FAFLOW — Android Mobile Integration

**Company:** GOVERNENCE  
**Product:** FAFLOW  
**Developer:** KAMESHGOVINDHAN  
**Platform:** Android 8.0+ (API 26+) / Target API 35 (Android 15)  
**Architecture:** Modern Clean Architecture + Jetpack Compose + Kotlin Coroutines & Flow  

---

## 1. Application Layering

```
com.governence.faflow/
├── attendance/
│   ├── biometrics/
│   │   ├── alignment/         # Umeyama 5-point affine similarity transform
│   │   ├── detector/          # Native & SCRFD face detection wrappers
│   │   ├── embedding/         # MobileFaceNet / ArcFace ONNX inference
│   │   ├── liveness/          # Passive PAD and active gesture debounce state machine
│   │   ├── model/             # Face detection, landmarks, and quality data structures
│   │   ├── quality/           # Brightness, sharpness, frontal pose validators
│   │   └── scrfd/             # SCRFD ONNX session runner and decoder
│   ├── data/                  # AttendanceRepository, Offline queue, Retrofit clients
│   ├── geolocation/           # FusedLocationProviderClient & geofence distance calculator
│   └── sync/                  # WorkManager periodic and triggered attendance sync
├── camera/                    # CameraX lifecycle controller & preview overlay
├── core/
│   ├── di/                    # AppContainer manual dependency injection
│   ├── logging/               # FaflowLogger with safe JVM test fallback
│   ├── network/               # Retrofit 2 + OkHttp 4 + AuthInterceptor
│   ├── security/              # EncryptedSharedPreferences, Keystore, Play Integrity
│   └── telemetry/             # Nanosecond-precision diagnostic latency recorder
├── domain/                    # Pure Kotlin domain entities and business rules
└── ui/
    ├── components/            # Reusable Compose UI components
    ├── screens/               # Compose screens (Attendance, Timetable, Substitution, Profile)
    ├── theme/                 # Design tokens, color palette, typography
    └── viewmodels/            # AttendanceViewModel, AuthViewModel, etc.
```

---

## 2. Low-Overhead Camera Analysis

The camera pipeline is configured for minimal garbage collection and zero frame queuing:

```kotlin
val imageAnalysis = ImageAnalysis.Builder()
    .setTargetResolution(Size(640, 480))
    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
    .build()
```

- **Single Frame Executor:** Inference is run on `Dispatchers.Default` using pre-allocated direct byte buffers.
- **Settling Window:** Once a face is detected within the guide oval, the app evaluates consecutive candidate frames over a 300ms window and selects the highest multi-metric quality frame for embedding generation.
