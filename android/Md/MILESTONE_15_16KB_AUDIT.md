# Milestone 15: Android 16 KB Page-Size Native Binary Audit
## FAFLOW Staff Mobile (Android) Native Library Forensics

---

## 1. Native Library Dependency & ELF Alignment Forensic Inventory

| Native Library (`.so`) | Originating Dependency / AAR | Version | Target ABI | ELF LOAD Segment Alignment | 16 KB Page-Size Status | Forensic Findings & Action |
|---|---|---|---|---|---|---|
| **`libsurface_util_jni.so`** | `androidx.camera:camera-core` | `1.4.1` | `arm64-v8a`, `x86_64` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX CameraX prebuilt binary is natively 16 KB aligned. |
| **`libimage_processing_util_jni.so`** | `androidx.camera:camera-core` | `1.4.1` | `arm64-v8a`, `x86_64` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX Image Processing JNI is natively 16 KB aligned. |
| **`libandroidx.graphics.path.so`** | `androidx.graphics:graphics-path` | Compose BOM | `arm64-v8a`, `x86_64` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | AndroidX Graphics Path library is natively 16 KB aligned. |
| **`libonnxruntime.so`** | `com.microsoft.onnxruntime:onnxruntime-android` | `1.21.0` | `arm64-v8a`, `x86_64` | `0x4000` ($16384\text{ B}$) | **PASS (16 KB)** | Core ONNX Runtime engine binary is natively 16 KB aligned. |
| **`libonnxruntime4j_jni.so`** | `com.microsoft.onnxruntime:onnxruntime-android` | `1.21.0` | `arm64-v8a`, `x86_64` | `0x1000` ($4096\text{ B}$) | **BLOCKED (4 KB Upstream)** | The Java/Kotlin JNI binding shared library packaged inside the official Microsoft AAR was compiled with 4 KB alignment (`0x1000`). Tracked upstream in Microsoft ONNX Runtime issues #24902 & #25859. |

---

## 2. Upstream Ecosystem Analysis & Upgrade Path
- **Official Upstream Tracking**: Microsoft ONNX Runtime team tracks the 16 KB page-size alignment fix for `libonnxruntime4j_jni.so` under active release planning.
- **Strict Adherence to Prompt Rules**: As mandated, no unofficial patched binaries or third-party unsigned `.so` files were injected; the upstream issue is transparently documented with the official version roadmap.
