# Milestone 15: 16 KB Page-Size Fix & Alignment Engineering Report
## FAFLOW Staff Mobile Android Toolchain & ELF Alignment

---

## 1. Toolchain & Dependency Upgrades Applied

| Component | Before Milestone 15 | After Milestone 15 | Rationale & Outcome |
|---|---|---|---|
| **Android Gradle Plugin (AGP)** | `9.3.2` | `9.3.2` | Modern AGP natively emits 16 KB-aligned zip packaging for uncompressed native libraries. |
| **Gradle Wrapper** | `9.5.0` | `9.5.0` | Supported Gradle daemon for Kotlin 2.2.10. |
| **ONNX Runtime Android** | `1.20.0` | `1.21.0` | Upgraded to latest stable release; `libonnxruntime.so` aligned to `0x4000` (16 KB). |
| **CameraX Subsystem** | `1.4.1` | `1.4.1` | Verified `libsurface_util_jni.so` and `libimage_processing_util_jni.so` are natively 16 KB aligned (`0x4000`). |
| **AndroidX Graphics Path** | Compose BOM `2024.12.01` | Compose BOM `2024.12.01` | Verified `libandroidx.graphics.path.so` is natively 16 KB aligned (`0x4000`). |
| **JNI Packaging Strategy** | Default | `useLegacyPackaging = false` | Ensures APK packaging preserves page alignment during Android OS mmap operations. |

---

## 2. ELF LOAD Segment Inspection Output

```
ABI: arm64-v8a
  libandroidx.graphics.path.so       PASS (16 KB)  align=0x4000
  libimage_processing_util_jni.so    PASS (16 KB)  align=0x4000
  libonnxruntime.so                  PASS (16 KB)  align=0x4000
  libsurface_util_jni.so             PASS (16 KB)  align=0x4000
  libonnxruntime4j_jni.so            FAIL (4 KB)   align=0x1000 (Upstream ONNX Runtime issue #24902)

ABI: x86_64
  libandroidx.graphics.path.so       PASS (16 KB)  align=0x4000
  libimage_processing_util_jni.so    PASS (16 KB)  align=0x4000
  libonnxruntime.so                  PASS (16 KB)  align=0x4000
  libsurface_util_jni.so             PASS (16 KB)  align=0x4000
  libonnxruntime4j_jni.so            FAIL (4 KB)   align=0x1000 (Upstream ONNX Runtime issue #24902)
```
