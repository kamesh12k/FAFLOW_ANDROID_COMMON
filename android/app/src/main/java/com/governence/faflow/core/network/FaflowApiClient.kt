package com.governence.faflow.core.network

import android.content.Context
import android.util.Log
import com.governence.faflow.BuildConfig
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Singleton HTTP client builder for FAFLOW API communication.
 * Connects via sanitized Retrofit / OkHttp stack with graceful timeout handling.
 */
object FaflowApiClient {
    private const val TAG = "FAFLOW_NET"

    const val DEFAULT_EMULATOR_URL = ApiConfig.EMULATOR_10_0_2_2_URL
    const val DEFAULT_EMULATOR_LOOPBACK_URL = ApiConfig.EMULATOR_127_0_0_1_URL
    const val DEFAULT_LAN_URL = ApiConfig.DEFAULT_LAN_URL

    var baseUrl: String = ApiConfig.getDefaultBaseUrl()
        private set

    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    fun isEmulator(): Boolean = ApiConfig.isEmulator()

    fun initBaseUrl(context: Context) {
        baseUrl = ApiConfig.getBaseUrl(context)
        Log.i(TAG, "Initialized FAFLOW API Base URL: $baseUrl (isEmulator=${isEmulator()})")
    }

    fun setAndPersistBaseUrl(context: Context, url: String) {
        val normalized = if (url.endsWith("/")) url else "$url/"
        baseUrl = normalized
        ApiConfig.saveBaseUrl(context, normalized)
        Log.i(TAG, "Updated and persisted FAFLOW API Base URL: $baseUrl")
    }

    /**
     * Sanitized logging interceptor preventing password and Bearer token leaks in Logcat.
     */
    private class SafeLoggingInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val startTimeNs = System.nanoTime()

            if (BuildConfig.DEBUG) {
                val safeHeaders = request.headers.newBuilder()
                if (request.header("Authorization") != null) {
                    safeHeaders.set("Authorization", "Bearer [REDACTED]")
                }
                Log.d(TAG, "--> ${request.method} ${request.url}")
            }

            val response: Response
            try {
                response = chain.proceed(request)
            } catch (e: IOException) {
                val durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTimeNs)
                Log.e(TAG, "<-- HTTP FAILED: ${request.method} ${request.url} after ${durationMs}ms - ${e.message}")
                throw e
            }

            val durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTimeNs)
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "<-- ${response.code} ${response.message} ${request.url} (${durationMs}ms)")
            }

            return response
        }
    }

    fun create(tokenManager: TokenManager, onUnauthorized: () -> Unit = {}): FaflowApiService {
        val authInterceptor = AuthInterceptor(tokenManager, onUnauthorized)
        val safeLoggingInterceptor = SafeLoggingInterceptor()

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(safeLoggingInterceptor)
            .connectTimeout(ApiConfig.CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(ApiConfig.READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(ApiConfig.WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .callTimeout(ApiConfig.CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"

        return Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(FaflowApiService::class.java)
    }
}
