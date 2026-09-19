# Milestone 15: 16 KB Page-Size Compatibility Audit
## Native Shared Library Forensics & Upstream Tracking

---

## 1. Native Library Forensic Audit Table

| Native Shared Library (`.so`) | Dependency / Provider | Version | ABI Architectures | ELF LOAD Segment Alignment | 16 KB Status | Forensic Findings & Action |
|---|---|---|---|---|---|---|
| **`libsurface_util_jni.so`** | `androidx.camera:camera-core` | `1.4.1` | `arm64-v8a`, `x86_64`, `armeabi-v7a`, `x86` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX CameraX prebuilt binary is natively 16 KB aligned. |
| **`libimage_processing_util_jni.so`** | `androidx.camera:camera-core` | `1.4.1` | `arm64-v8a`, `x86_64`, `armeabi-v7a`, `x86` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX Image Processing JNI is natively 16 KB aligned. |
| **`libandroidx.graphics.path.so`** | `androidx.graphics:graphics-path` | Compose BOM | `arm64-v8a`, `x86_64`, `armeabi-v7a`, `x86` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX Graphics Path library is natively 16 KB aligned. |
| **`libonnxruntime.so`** | `com.microsoft.onnxruntime:onnxruntime-android` | `1.21.0` | `arm64-v8a`, `x86_64`, `armeabi-v7a`, `x86` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | Core ONNX Runtime engine binary is natively 16 KB aligned. |
| **`libonnxruntime4j_jni.so`** | `com.microsoft.onnxruntime:onnxruntime-android` | `1.21.0` | `arm64-v8a`, `x86_64`, `armeabi-v7a`, `x86` | `0x1000` ($4096\text{ B}$) | **BLOCKED (4 KB Upstream)** | Java/Kotlin JNI binding shared library inside Microsoft AAR compiled with 4 KB alignment (`0x1000`). Tracked upstream in Microsoft ONNX Runtime issues #24902 & #25859. |

---

## 2. ABI Compatibility Matrix

| Target ABI | Build Verification | Install / Launch | CameraX Pipeline | ONNX Runtime Inference | Biometric Attendance | 16 KB Page Compatibility |
|---|---|---|---|---|---|---|
| **`arm64-v8a`** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Core 16 KB / JNI 4 KB Upstream |
| **`armeabi-v7a`** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Legacy 32-bit (4 KB standard) |
| **`x86_64`** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Core 16 KB / JNI 4 KB Upstream |
| **`x86`** | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Legacy 32-bit (4 KB standard) |
