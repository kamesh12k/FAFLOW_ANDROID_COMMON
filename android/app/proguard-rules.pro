# =====================================================================
# FAFLOW Staff Mobile: Production ProGuard & R8 Optimization Rules
# =====================================================================

# ONNX Runtime Mobile (InsightFace SCRFD & ArcFace ONNX inference)
-keep class ai.onnxruntime.** { *; }
-dontwarn ai.onnxruntime.**
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Native JNI bindings for ONNX Runtime
-keepclasseswithmembernames class * {
    native <methods>;
}

# Moshi JSON DTO serialization
-keep class com.governence.faflow.core.network.** { *; }
-keepclassmembers class com.governence.faflow.core.network.** {
    <fields>;
    <init>(...);
}
-keepattributes *Annotation*
-dontwarn com.squareup.moshi.**

# Retrofit & OkHttp Network Infrastructure
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepclassmembers,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.**
-dontwarn okhttp3.**

# WorkManager background sync workers
-keep class * extends androidx.work.Worker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep class * extends androidx.work.CoroutineWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Android Jetpack Security (EncryptedSharedPreferences)
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**
