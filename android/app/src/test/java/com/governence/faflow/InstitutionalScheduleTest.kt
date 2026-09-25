package com.governence.faflow

import com.governence.faflow.core.network.PeriodEntryDto
import com.governence.faflow.domain.model.InstitutionalSchedule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class InstitutionalScheduleTest {

    @Before
    fun setUp() {
        InstitutionalSchedule.resetToDefaults()
    }

    @After
    fun tearDown() {
        InstitutionalSchedule.resetToDefaults()
    }

    @Test
    fun testDefaultInstitutionalScheduleMatchesProductionStandards() {
        assertEquals("09:20–10:20", InstitutionalSchedule.getPeriodTime(1))
        assertEquals("10:20–11:15", InstitutionalSchedule.getPeriodTime(2))
        assertEquals("11:40–12:35", InstitutionalSchedule.getPeriodTime(3))
        assertEquals("13:35–14:30", InstitutionalSchedule.getPeriodTime(4))
        assertEquals("14:55–15:50", InstitutionalSchedule.getPeriodTime(5))

        assertEquals(15, InstitutionalSchedule.submissionWindowMinutes)
        assertEquals(15, InstitutionalSchedule.suggestionLeadTimeMinutes)
        assertEquals(0, InstitutionalSchedule.currentPeriodToleranceMinutes)

        // Period 1 start is 09:20 (560 minutes)
        assertEquals(9 * 60 + 20, InstitutionalSchedule.getPeriodStartMinute(1))
    }

    @Test
    fun testDefaultPeriodResolution() {
        // 09:30 is during Period 1 (09:20–10:20)
        assertEquals(1, InstitutionalSchedule.resolvePeriodNumber(9 * 60 + 30))

        // 11:00 is during Period 2 (10:20–11:15)
        assertEquals(2, InstitutionalSchedule.resolvePeriodNumber(11 * 60 + 0))

        // 11:25 is during Morning Break (11:15–11:40) -> null active period
        assertNull(InstitutionalSchedule.resolvePeriodNumber(11 * 60 + 25))

        // Active or recent period during Morning Break should resolve to Period 2
        assertEquals(2, InstitutionalSchedule.resolveActiveOrRecentPeriod(11 * 60 + 25))

        // 13:00 is during Lunch Break (12:35–13:35) -> resolve to Period 3
        assertEquals(3, InstitutionalSchedule.resolveActiveOrRecentPeriod(13 * 60 + 0))
    }

    @Test
    fun testDefaultSubmissionWindow() {
        // Period 1 starts at 09:20 (560 min)
        // 09:25 is within 15-minute window
        assertTrue(InstitutionalSchedule.isWithin15MinuteWindow(1, 9 * 60 + 25))

        // 09:35 is within 15-minute window (560 + 15 = 575)
        assertTrue(InstitutionalSchedule.isWithin15MinuteWindow(1, 9 * 60 + 35))

        // 09:40 is outside 15-minute window
        assertFalse(InstitutionalSchedule.isWithin15MinuteWindow(1, 9 * 60 + 40))
    }

    @Test
    fun testDynamicGovernanceConfigUpdate() {
        val customPeriods = listOf(
            PeriodEntryDto(periodNumber = 1, startTime = "08:30", endTime = "09:30", label = "Period 1"),
            PeriodEntryDto(periodNumber = 2, startTime = "09:30", endTime = "10:30", label = "Period 2"),
            PeriodEntryDto(periodNumber = 3, startTime = "11:00", endTime = "12:00", label = "Period 3"),
            PeriodEntryDto(periodNumber = 4, startTime = "13:00", endTime = "14:00", label = "Period 4"),
            PeriodEntryDto(periodNumber = 5, startTime = "14:15", endTime = "15:15", label = "Period 5"),
            PeriodEntryDto(periodNumber = 6, startTime = "15:30", endTime = "16:30", label = "Period 6")
        )

        InstitutionalSchedule.updateFromConfig(
            periodList = customPeriods,
            leadTime = 20,
            startWindow = 25,
            expirationWindow = 30,
            tolerance = 5,
            submissionWindow = 25
        )

        // Verify updated period times
        assertEquals("08:30–09:30", InstitutionalSchedule.getPeriodTime(1))
        assertEquals("15:30–16:30", InstitutionalSchedule.getPeriodTime(6))

        // Verify updated period start
        assertEquals(8 * 60 + 30, InstitutionalSchedule.getPeriodStartMinute(1))

        // Verify dynamic period resolution
        assertEquals(1, InstitutionalSchedule.resolvePeriodNumber(8 * 60 + 45))
        assertEquals(2, InstitutionalSchedule.resolvePeriodNumber(9 * 60 + 45))
        assertEquals(6, InstitutionalSchedule.resolvePeriodNumber(16 * 60 + 0))

        // Verify updated submission window (25 min)
        // 08:30 + 20 min = 08:50 (within 25-minute window)
        assertTrue(InstitutionalSchedule.isWithin15MinuteWindow(1, 8 * 60 + 50))
        // 08:30 + 30 min = 09:00 (outside 25-minute window)
        assertFalse(InstitutionalSchedule.isWithin15MinuteWindow(1, 9 * 60 + 0))

        assertEquals(25, InstitutionalSchedule.submissionWindowMinutes)
        assertEquals(20, InstitutionalSchedule.suggestionLeadTimeMinutes)
    }

    @Test
    fun testResetToDefaultsRestoresInstitutionalBaseline() {
        val customPeriods = listOf(
            PeriodEntryDto(periodNumber = 1, startTime = "07:00", endTime = "08:00", label = "Early Period")
        )
        InstitutionalSchedule.updateFromConfig(customPeriods, submissionWindow = 30)
        assertEquals("07:00–08:00", InstitutionalSchedule.getPeriodTime(1))

        // Reset
        InstitutionalSchedule.resetToDefaults()

        assertEquals("09:20–10:20", InstitutionalSchedule.getPeriodTime(1))
        assertEquals(15, InstitutionalSchedule.submissionWindowMinutes)
        assertEquals(5, InstitutionalSchedule.PERIOD_TIMES.size)
    }
}
