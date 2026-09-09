plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.governence.faflow"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.governence.faflow"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("src/main/jniLibs")
        }
    }
    packaging {
        jniLibs {
            useLegacyPackaging = false
            pickFirsts.add("**/libonnxruntime4j_jni.so")
        }
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
        }
    }

    kotlin {
        compilerOptions {
            freeCompilerArgs.add("-Xannotation-default-target=param-property")
        }
    }
}

fun findPythonExecutable(): String {
    val candidates = if (System.getProperty("os.name").lowercase().contains("windows")) {
        listOf("py", "python", "python3")
    } else {
        listOf("python3", "python")
    }
    for (cmd in candidates) {
        try {
            val process = ProcessBuilder(cmd, "--version").start()
            if (process.waitFor() == 0) {
                return cmd
            }
        } catch (_: Exception) {}
    }
    return if (System.getProperty("os.name").lowercase().contains("windows")) "py" else "python3"
}

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("NativeLibs") }.configureEach {
    doLast {
        val mergedDir = layout.buildDirectory.dir("intermediates/merged_native_libs").get().asFile
        if (mergedDir.exists()) {
            ProcessBuilder(findPythonExecutable(), "${rootDir}/scripts/align_native_libs.py", mergedDir.absolutePath).inheritIO().start().waitFor()
        }
    }
}

tasks.matching { it.name.startsWith("strip") && it.name.endsWith("DebugSymbols") }.configureEach {
    doLast {
        val strippedDir = layout.buildDirectory.dir("intermediates/stripped_native_libs").get().asFile
        if (strippedDir.exists()) {
            ProcessBuilder(findPythonExecutable(), "${rootDir}/scripts/align_native_libs.py", strippedDir.absolutePath).inheritIO().start().waitFor()
        }
    }
}

tasks.matching { it.name.startsWith("package") && (it.name.endsWith("Debug") || it.name.endsWith("Release")) }.configureEach {
    doLast {
        val apkDir = layout.buildDirectory.dir("outputs/apk").get().asFile
        if (apkDir.exists()) {
            apkDir.walkTopDown().filter { it.extension == "apk" }.forEach { apkFile ->
                ProcessBuilder(findPythonExecutable(), "${rootDir}/scripts/align_apk.py", apkFile.absolutePath).inheritIO().start().waitFor()
            }
        }
    }
}





dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    // CameraX
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Security (Hardware-backed EncryptedSharedPreferences)
    implementation(libs.androidx.security.crypto)

    // Location (GPS & Geofencing)
    implementation(libs.play.services.location)

    // ONNX Runtime Mobile
    implementation(libs.onnxruntime.android)

    // WorkManager (Background Attendance Synchronization)
    implementation(libs.androidx.work.runtime.ktx)

    // Lottie Animation
    implementation(libs.lottie.compose)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}