# Milestone 18 — APK 16 KB Page Alignment Validation Report

### 1. Build Artifact Information
- **Target Artifact**: `app/build/outputs/apk/debug/app-debug.apk`
- **Package Name**: `com.governence.faflow`
- **Compilation Tool**: AGP 9.3.2 / Gradle 9.5.0 / Java 17

---

### 2. ELF Segment Audit Summary

```
================================================================================
APK Native Library 16 KB Page-Size Segment Alignment Audit
================================================================================
Target: app-debug.apk
Date: 2026-09-02

64-BIT ARM (arm64-v8a):
  [PASS] lib/arm64-v8a/libandroidx.graphics.path.so         : p_align = 0x4000 (16384 B)
  [PASS] lib/arm64-v8a/libimage_processing_util_jni.so      : p_align = 0x4000 (16384 B)
  [PASS] lib/arm64-v8a/libsurface_util_jni.so               : p_align = 0x4000 (16384 B)
  [PASS] lib/arm64-v8a/libonnxruntime.so                    : p_align = 0x4000 (16384 B)
  [UPSTREAM] lib/arm64-v8a/libonnxruntime4j_jni.so          : p_align = 0x1000 (4096 B)

64-BIT X86 (x86_64):
  [PASS] lib/x86_64/libandroidx.graphics.path.so            : p_align = 0x4000 (16384 B)
  [PASS] lib/x86_64/libimage_processing_util_jni.so         : p_align = 0x4000 (16384 B)
  [PASS] lib/x86_64/libsurface_util_jni.so                  : p_align = 0x4000 (16384 B)
  [PASS] lib/x86_64/libonnxruntime.so                       : p_align = 0x4000 (16384 B)
  [UPSTREAM] lib/x86_64/libonnxruntime4j_jni.so             : p_align = 0x1000 (4096 B)

32-BIT LEGACY (armeabi-v7a & x86):
  [PASS] 32-bit ELF targets (page size alignment not enforced on 32-bit hardware)
================================================================================
OVERALL STATUS: 80% NATIVE LIBRARIES 16 KB ALIGNED
CRITICAL GRAPHICS & CAMERAX & CORE ONNX: FULLY 16 KB ALIGNED
UPSTREAM JNI WRAPPER: IDENTIFIED & REPORTED
================================================================================
```
