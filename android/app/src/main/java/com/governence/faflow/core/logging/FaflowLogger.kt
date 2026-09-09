package com.governence.faflow.core.logging

/**
 * Enterprise logging abstraction for FAFLOW.
 *
 * Provides safe logging across both real Android runtime and pure JVM unit tests.
 * Prevents "Method d in android.util.Log not mocked" crashes during unit testing
 * by gracefully falling back to standard stdout/stderr when Android framework classes
 * are not mocked.
 */
object FaflowLogger {

    var isEnabled: Boolean = true

    fun d(tag: String, message: String, throwable: Throwable? = null) {
        if (!isEnabled) return
        try {
            android.util.Log.d(tag, message, throwable)
        } catch (_: RuntimeException) {
            // JVM unit test fallback
            println("DEBUG [$tag] $message")
            throwable?.printStackTrace(System.out)
        }
    }

    fun i(tag: String, message: String, throwable: Throwable? = null) {
        if (!isEnabled) return
        try {
            android.util.Log.i(tag, message, throwable)
        } catch (_: RuntimeException) {
            println("INFO  [$tag] $message")
            throwable?.printStackTrace(System.out)
        }
    }

    fun w(tag: String, message: String, throwable: Throwable? = null) {
        if (!isEnabled) return
        try {
            android.util.Log.w(tag, message, throwable)
        } catch (_: RuntimeException) {
            System.err.println("WARN  [$tag] $message")
            throwable?.printStackTrace(System.err)
        }
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        if (!isEnabled) return
        try {
            android.util.Log.e(tag, message, throwable)
        } catch (_: RuntimeException) {
            System.err.println("ERROR [$tag] $message")
            throwable?.printStackTrace(System.err)
        }
    }
}
