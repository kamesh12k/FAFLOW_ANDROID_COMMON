package com.governence.faflow.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.governence.faflow.MainActivity
import com.governence.faflow.R

/**
 * Native Android OS Notification Manager for FAFLOW.
 * Posts system tray and heads-up notifications for announcements, circulars,
 * substitution alerts, and governance events.
 */
object FaflowNotificationManager {

    const val CHANNEL_ID_ANNOUNCEMENTS = "faflow_announcements"
    const val CHANNEL_ID_ALERTS = "faflow_alerts"

    private const val PREFS_NOTIFICATIONS = "faflow_system_notifications_cache"
    private const val KEY_NOTIFIED_IDS = "notified_notification_ids"

    /**
     * Initializes high-priority notification channels with sound and vibration.
     * Safe to call repeatedly; required for Android 8.0+ (API 26+).
     */
    fun initChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            // Channel 1: Announcements & Circulars
            val announcementChannel = NotificationChannel(
                CHANNEL_ID_ANNOUNCEMENTS,
                "Announcements & Circulars",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Official college circulars, broadcasts, and department announcements"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            // Channel 2: FAFLOW Alerts (Substitutions, Leaves, Timetable)
            val alertsChannel = NotificationChannel(
                CHANNEL_ID_ALERTS,
                "FAFLOW Alerts & Tasks",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Substitution requests, leave approvals, and timetable adjustments"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            notificationManager.createNotificationChannel(announcementChannel)
            notificationManager.createNotificationChannel(alertsChannel)
        }
    }

    /**
     * Checks whether an alert has already been posted to the device's system tray.
     * Optionally scoped by userId to avoid cross-user notification suppressions.
     */
    fun isAlreadyNotified(context: Context, notificationId: Int, userId: Int? = null): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NOTIFICATIONS, Context.MODE_PRIVATE)
        val key = if (userId != null && userId > 0) "${KEY_NOTIFIED_IDS}_$userId" else KEY_NOTIFIED_IDS
        val notified = prefs.getStringSet(key, emptySet()) ?: emptySet()
        return notified.contains(notificationId.toString())
    }

    /**
     * Records a notification ID in the local cache to prevent duplicate alerts.
     * Scoped by userId so switching accounts maintains clean tracking.
     */
    fun markAsNotified(context: Context, notificationId: Int, userId: Int? = null) {
        val prefs = context.getSharedPreferences(PREFS_NOTIFICATIONS, Context.MODE_PRIVATE)
        val key = if (userId != null && userId > 0) "${KEY_NOTIFIED_IDS}_$userId" else KEY_NOTIFIED_IDS
        val notified = (prefs.getStringSet(key, emptySet()) ?: emptySet()).toMutableSet()
        notified.add(notificationId.toString())
        // Keep up to 200 most recent IDs to prevent unbounded cache growth
        if (notified.size > 200) {
            val pruned = notified.toList().takeLast(100).toSet()
            prefs.edit().putStringSet(key, pruned).apply()
        } else {
            prefs.edit().putStringSet(key, notified).apply()
        }
    }

    /**
     * Clears all notification history caches upon logout.
     */
    fun clearCache(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NOTIFICATIONS, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    /**
     * Posts a native Android OS notification into the status bar / notification shade.
     */
    fun showNotification(
        context: Context,
        id: Int,
        title: String,
        body: String,
        eventType: String? = null
    ): Boolean {
        val notificationManagerCompat = NotificationManagerCompat.from(context)

        // Verify system-level permission
        if (!notificationManagerCompat.areNotificationsEnabled()) {
            return false
        }

        // Determine channel
        val isAnnouncement = eventType?.contains("announcement", ignoreCase = true) == true ||
                eventType?.contains("circular", ignoreCase = true) == true
        val channelId = if (isAnnouncement) CHANNEL_ID_ANNOUNCEMENTS else CHANNEL_ID_ALERTS

        // Deep-link intent targeting MainActivity
        val targetRoute = when {
            isAnnouncement -> "announcements"
            eventType?.contains("duty", ignoreCase = true) == true ||
                eventType?.contains("discipline", ignoreCase = true) == true ||
                eventType?.contains("exam", ignoreCase = true) == true ||
                eventType?.contains("wing", ignoreCase = true) == true -> "my_duties"
            eventType?.contains("substitut", ignoreCase = true) == true -> "substitution"
            eventType?.contains("leave", ignoreCase = true) == true -> "leave_history"
            eventType?.contains("attendance", ignoreCase = true) == true -> "attendance_check_in_out"
            else -> "notifications"
        }
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("EXTRA_NOTIFICATION_ID", id)
            putExtra("EXTRA_EVENT_TYPE", eventType)
            putExtra("EXTRA_ROUTE", targetRoute)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification_small)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            notificationManagerCompat.notify(id, notification)
            return true
        } catch (e: SecurityException) {
            // Android 13+ POST_NOTIFICATIONS runtime permission not yet granted
            return false
        }
    }

    /**
     * Intelligently posts a batch of unread notifications with anti-burst protection:
     * - If 1-2 notifications: posts them individually.
     * - If 3+ notifications: posts the top 2 as individual alerts and consolidates the rest into an inbox summary,
     *   preventing notification alarm fatigue and stutter.
     */
    fun showBatchNotifications(
        context: Context,
        notifications: List<com.governence.faflow.core.network.NotificationOutDto>,
        userId: Int? = null
    ) {
        val newNotifications = notifications.filter { !isAlreadyNotified(context, it.id, userId) }
        if (newNotifications.isEmpty()) return

        if (newNotifications.size <= 2) {
            for (item in newNotifications) {
                showNotification(
                    context = context,
                    id = item.id,
                    title = item.title,
                    body = item.body,
                    eventType = item.eventType
                )
                markAsNotified(context, item.id, userId)
            }
        } else {
            // Anti-burst: post top 2 most recent, then summary for the rest
            val head = newNotifications.take(2)
            val rest = newNotifications.drop(2)

            for (item in head) {
                showNotification(
                    context = context,
                    id = item.id,
                    title = item.title,
                    body = item.body,
                    eventType = item.eventType
                )
                markAsNotified(context, item.id, userId)
            }

            // Summary notification for remaining
            val summaryTitle = "${newNotifications.size} New FAFLOW Updates"
            val summaryBody = rest.take(3).joinToString(" • ") { it.title }
            showNotification(
                context = context,
                id = 999999,
                title = summaryTitle,
                body = summaryBody,
                eventType = "system_summary"
            )
            for (item in rest) {
                markAsNotified(context, item.id, userId)
            }
        }
    }

    /**
     * Cancels all notifications posted by FAFLOW in the device notification shade.
     */
    fun cancelAll(context: Context) {
        try {
            NotificationManagerCompat.from(context).cancelAll()
        } catch (_: Exception) {}
    }
}
