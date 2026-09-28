package com.governence.faflow.core.network

import org.json.JSONArray
import org.json.JSONObject

/**
 * Standardized client error parser for FastAPI responses.
 * Extracts clean, human-readable error messages from standard FastAPI error envelopes:
 *  - {"detail": "Error message"}
 *  - {"detail": {"title": "...", "reason": "...", "message": "..."}}
 *  - {"detail": [{"msg": "...", "loc": [...]}]} (Pydantic validation error)
 */
object ApiErrorParser {

    fun parse(rawBody: String?, fallbackMessage: String = "An unexpected error occurred."): String {
        if (rawBody.isNullOrBlank()) return fallbackMessage

        return try {
            val trimmed = rawBody.trim()
            if (trimmed.startsWith("{")) {
                val json = JSONObject(trimmed)
                if (json.has("detail")) {
                    val detail = json.get("detail")
                    when (detail) {
                        is String -> detail
                        is JSONObject -> {
                            when {
                                detail.has("message") -> detail.getString("message")
                                detail.has("title") && detail.has("reason") -> "${detail.getString("title")}: ${detail.getString("reason")}"
                                detail.has("reason") -> detail.getString("reason")
                                detail.has("title") -> detail.getString("title")
                                else -> detail.toString()
                            }
                        }
                        is JSONArray -> {
                            val messages = mutableListOf<String>()
                            for (i in 0 until detail.length()) {
                                val item = detail.optJSONObject(i)
                                if (item != null && item.has("msg")) {
                                    messages.add(item.getString("msg"))
                                }
                            }
                            if (messages.isNotEmpty()) messages.joinToString("; ") else fallbackMessage
                        }
                        else -> detail.toString()
                    }
                } else if (json.has("message")) {
                    json.getString("message")
                } else {
                    fallbackMessage
                }
            } else {
                trimmed
            }
        } catch (e: Exception) {
            fallbackMessage
        }
    }
}
