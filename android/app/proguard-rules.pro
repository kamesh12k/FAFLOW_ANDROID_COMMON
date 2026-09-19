# =====================================================================
# FAFLOW Staff Mobile: Optimized Production ProGuard & R8 Rules
# Optimized according to Android Skills guidelines (r8-analyzer)
# =====================================================================

# Global attribute preservation for Kotlin, reflection, and serialization
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# ONNX Runtime Mobile (InsightFace SCRFD & ArcFace ONNX inference)
-keep class ai.onnxruntime.OrtEnvironment, ai.onnxruntime.OrtSession, ai.onnxruntime.OnnxTensor { *; }
-dontwarn ai.onnxruntime.**

# Moshi JSON DTO Serialization (Scoped to annotated models)
-keep @com.squareup.moshi.JsonClass class * {
    <fields>;
    <init>(...);
}
-keep class *JsonAdapter {
    <init>(...);
}
-keepclassmembers class * {
    @com.squareup.moshi.Json <fields>;
}
-dontwarn com.squareup.moshi.**

# Android Jetpack Security (Warnings suppression; consumer rules bundled in AAR)
-dontwarn androidx.security.crypto.**

# Network Stack Warnings Suppressions (Retrofit & OkHttp provide their own consumer keep rules)
-dontwarn retrofit2.**
-dontwarn okhttp3.**
