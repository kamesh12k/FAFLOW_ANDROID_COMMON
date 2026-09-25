package com.governence.faflow.domain.model

import com.governence.faflow.core.network.PeriodEntryDto

/**
 * Institutional Schedule & Academic Timetable Configuration for FAFLOW.
 * Defines the standard institutional milestones, teaching period time ranges, and break slots.
 * Supports dynamic runtime configuration synced from the Governance Business Rules Control Plane.
 */
object InstitutionalSchedule {

    // Daily Institutional Milestones
    const val WORKING_DAY_START = "09:10"
    const val STUDENT_REPORTING = "09:15"
    const val FIRST_PERIOD_START = "09:20"
    const val COLLEGE_DAY_END = "15:50"
    const val STAFF_EXTENDED_END = "17:45"

    // Break & Interval Milestones
    const val MORNING_BREAK_START = "11:15"
    const val MORNING_BREAK_END = "11:40"
    const val LUNCH_START = "12:35"
    const val LUNCH_END = "13:35"
    const val AFTERNOON_BREAK_START = "14:30"
    const val AFTERNOON_BREAK_END = "14:55"

    /**
     * Factory default period timing mappings.
     */
    val DEFAULT_PERIOD_TIMES: Map<Int, String> = mapOf(
        1 to "09:20–10:20",
        2 to "10:20–11:15",
        3 to "11:40–12:35",
        4 to "13:35–14:30",
        5 to "14:55–15:50"
    )

    val DEFAULT_PERIOD_MINUTE_RANGES: Map<Int, IntRange> = mapOf(
        1 to (9 * 60 + 20)..(10 * 60 + 19),   // 09:20 – 10:19
        2 to (10 * 60 + 20)..(11 * 60 + 14),  // 10:20 – 11:14
        3 to (11 * 60 + 40)..(12 * 60 + 34),  // 11:40 – 12:34
        4 to (13 * 60 + 35)..(14 * 60 + 29),  // 13:35 – 14:29
        5 to (14 * 60 + 55)..(15 * 60 + 49)   // 14:55 – 15:49
    )

    @Volatile
    private var dynamicPeriodTimes: Map<Int, String> = DEFAULT_PERIOD_TIMES

    @Volatile
    private var dynamicPeriodMinuteRanges: Map<Int, IntRange> = DEFAULT_PERIOD_MINUTE_RANGES

    @Volatile
    var suggestionLeadTimeMinutes: Int = 15
        private set

    @Volatile
    var suggestionStartWindowMinutes: Int = 15
        private set

    @Volatile
    var suggestionExpirationWindowMinutes: Int = 15
        private set

    @Volatile
    var currentPeriodToleranceMinutes: Int = 0
        private set

    @Volatile
    var submissionWindowMinutes: Int = 15
        private set

    /**
     * Map of period numbers (1 to 5+) to formatted time range strings.
     * Backwards-compatible getter that returns active (dynamic or default) period times.
     */
    val PERIOD_TIMES: Map<Int, String>
        get() = dynamicPeriodTimes

    /**
     * Period timing definitions with start & end minutes from midnight for schedule calculations.
     * Backwards-compatible getter that returns active (dynamic or default) minute ranges.
     */
    val PERIOD_MINUTE_RANGES: Map<Int, IntRange>
        get() = dynamicPeriodMinuteRanges

    /**
     * Returns formatted time range string for a given period number (e.g., "09:20–10:20").
     */
    fun getPeriodTime(periodNumber: Int): String {
        return PERIOD_TIMES[periodNumber] ?: "Period $periodNumber"
    }

    /**
     * Updates active period schedules and timing windows from backend governance configuration.
     */
    fun updateFromConfig(
        periodList: List<PeriodEntryDto>?,
        leadTime: Int = 15,
        startWindow: Int = 15,
        expirationWindow: Int = 15,
        tolerance: Int = 0,
        submissionWindow: Int = 15
    ) {
        if (!periodList.isNullOrEmpty()) {
            val newTimes = mutableMapOf<Int, String>()
            val newRanges = mutableMapOf<Int, IntRange>()

            for (p in periodList) {
                val startParts = p.startTime.split(":")
                val endParts = p.endTime.split(":")
                if (startParts.size >= 2 && endParts.size >= 2) {
                    val startH = startParts[0].toIntOrNull() ?: 0
                    val startM = startParts[1].toIntOrNull() ?: 0
                    val endH = endParts[0].toIntOrNull() ?: 0
                    val endM = endParts[1].toIntOrNull() ?: 0

                    val startMin = startH * 60 + startM
                    val endMin = endH * 60 + endM

                    newTimes[p.periodNumber] = "${p.startTime}–${p.endTime}"
                    val inclusiveEnd = if (endMin > startMin) endMin - 1 else startMin
                    newRanges[p.periodNumber] = startMin..inclusiveEnd
                }
            }

            if (newTimes.isNotEmpty()) {
                dynamicPeriodTimes = newTimes
                dynamicPeriodMinuteRanges = newRanges
            }
        }

        suggestionLeadTimeMinutes = leadTime
        suggestionStartWindowMinutes = startWindow
        suggestionExpirationWindowMinutes = expirationWindow
        currentPeriodToleranceMinutes = tolerance
        submissionWindowMinutes = submissionWindow
    }

    /**
     * Resets period schedules and timing windows back to institutional factory defaults.
     */
    fun resetToDefaults() {
        dynamicPeriodTimes = DEFAULT_PERIOD_TIMES
        dynamicPeriodMinuteRanges = DEFAULT_PERIOD_MINUTE_RANGES
        suggestionLeadTimeMinutes = 15
        suggestionStartWindowMinutes = 15
        suggestionExpirationWindowMinutes = 15
        currentPeriodToleranceMinutes = 0
        submissionWindowMinutes = 15
    }

    /**
     * Resolves the active period number for a given minute since midnight, or null during breaks/off-hours.
     */
    fun resolvePeriodNumber(minutesSinceMidnight: Int): Int? {
        return PERIOD_MINUTE_RANGES.entries.firstOrNull { minutesSinceMidnight in it.value }?.key
    }

    /**
     * Resolves the active or most recent academic period. During breaks/lunch/afternoon tea,
     * it maps to the period that just occurred or is occurring (e.g. 14:30 -> Period 4).
     */
    fun resolveActiveOrRecentPeriod(minutesSinceMidnight: Int): Int {
        resolvePeriodNumber(minutesSinceMidnight)?.let { return it }

        val sorted = PERIOD_MINUTE_RANGES.entries.sortedBy { it.value.first }
        if (sorted.isEmpty()) return 1

        for (entry in sorted) {
            if (minutesSinceMidnight < entry.value.first) {
                val index = sorted.indexOf(entry)
                return if (index > 0) sorted[index - 1].key else entry.key
            }
        }
        return sorted.last().key
    }

    fun getPeriodStartMinute(periodNumber: Int): Int {
        return PERIOD_MINUTE_RANGES[periodNumber]?.first ?: (9 * 60 + 20)
    }

    /**
     * Checks if current minutesSinceMidnight is within the official submission window
     * from the period start time.
     */
    fun isWithin15MinuteWindow(periodNumber: Int, minutesSinceMidnight: Int): Boolean {
        val start = getPeriodStartMinute(periodNumber)
        return minutesSinceMidnight in start..(start + submissionWindowMinutes)
    }

    /**
     * Checks if a scheduled class period has started.
     * If targetDateString is for a past date, it has already started.
     * If targetDateString is in the future, it has not started yet.
     * For today's date (or null), verifies whether nowMinutes >= startMinute of the period.
     */
    fun hasPeriodStarted(periodNumber: Int, targetDateString: String? = null): Boolean {
        if (com.governence.faflow.BuildConfig.DEBUG) {
            return true
        }
        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        if (targetDateString != null && targetDateString < todayStr) {
            return true
        }
        if (targetDateString != null && targetDateString > todayStr) {
            return false
        }
        val cal = java.util.Calendar.getInstance()
        val nowMinutes = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)
        val startMin = getPeriodStartMinute(periodNumber)
        return nowMinutes >= startMin
    }

    /**
     * Returns formatted start time for a period, e.g. "09:20".
     */
    fun getPeriodStartTimeFormatted(periodNumber: Int): String {
        val range = PERIOD_TIMES[periodNumber]
        if (range != null && range.contains("–")) {
            return range.split("–")[0].trim()
        }
        if (range != null && range.contains("-")) {
            return range.split("-")[0].trim()
        }
        val startMin = getPeriodStartMinute(periodNumber)
        val h = startMin / 60
        val m = startMin % 60
        return String.format(java.util.Locale.US, "%02d:%02d", h, m)
    }
}
