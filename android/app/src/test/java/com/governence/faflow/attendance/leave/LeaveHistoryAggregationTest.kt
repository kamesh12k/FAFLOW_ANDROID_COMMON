package com.governence.faflow.attendance.leave

import com.governence.faflow.core.network.FaflowApiService
import com.governence.faflow.domain.model.LeaveHistoryDay
import com.governence.faflow.domain.model.LeaveRequest
import com.governence.faflow.domain.model.LeaveStatus
import com.governence.faflow.faflow.data.LeaveRepositoryImpl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.lang.reflect.Proxy

class LeaveHistoryAggregationTest {

    private lateinit var leaveRepository: LeaveRepositoryImpl

    @Before
    fun setUp() {
        val mockApi = Proxy.newProxyInstance(
            FaflowApiService::class.java.classLoader,
            arrayOf(FaflowApiService::class.java)
        ) { _, _, _ -> null } as FaflowApiService
        leaveRepository = LeaveRepositoryImpl(mockApi)
    }

    // Test 1 — Full day leave (5 periods P1..P5)
    @Test
    fun test01_fullDayLeave_aggregatedToOneEntry() {
        val rawRecords = listOf(
            LeaveRequest(id = 101, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 1, reason = "Personal leave", status = LeaveStatus.APPROVED, batchId = "batch-full-1"),
            LeaveRequest(id = 102, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 2, reason = "Personal leave", status = LeaveStatus.APPROVED, batchId = "batch-full-1"),
            LeaveRequest(id = 103, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 3, reason = "Personal leave", status = LeaveStatus.APPROVED, batchId = "batch-full-1"),
            LeaveRequest(id = 104, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 4, reason = "Personal leave", status = LeaveStatus.APPROVED, batchId = "batch-full-1"),
            LeaveRequest(id = 105, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 5, reason = "Personal leave", status = LeaveStatus.APPROVED, batchId = "batch-full-1")
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("5 raw period records for a full day must aggregate to exactly 1 LeaveHistoryDay", 1, dayGroups.size)
        val fullDay = dayGroups.first()
        assertEquals("2026-09-08", fullDay.date)
        assertEquals(3, fullDay.dayOrder)
        assertEquals(LeaveStatus.APPROVED, fullDay.status)
        assertTrue("isFullDay must be true", fullDay.isFullDay)
        assertEquals("Full Day Leave", fullDay.leaveTypeDisplay)
        assertEquals("5 periods covered", fullDay.periodSummarySubtitle)
        assertEquals(5, fullDay.periods.size)
        assertEquals(listOf(1, 2, 3, 4, 5), fullDay.periods.map { it.periodNumber })
    }

    // Test 2 — Three periods (P1, P3, P5)
    @Test
    fun test02_threePeriods_aggregatedToOnePartialDayEntry() {
        val rawRecords = listOf(
            LeaveRequest(id = 201, teacherId = 1, date = "2026-09-09", dayOrder = 4, periodNumber = 1, reason = "Medical consultation", status = LeaveStatus.PENDING, batchId = "batch-partial-1"),
            LeaveRequest(id = 202, teacherId = 1, date = "2026-09-09", dayOrder = 4, periodNumber = 3, reason = "Medical consultation", status = LeaveStatus.PENDING, batchId = "batch-partial-1"),
            LeaveRequest(id = 203, teacherId = 1, date = "2026-09-09", dayOrder = 4, periodNumber = 5, reason = "Medical consultation", status = LeaveStatus.PENDING, batchId = "batch-partial-1")
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("3 period records must aggregate to exactly 1 LeaveHistoryDay", 1, dayGroups.size)
        val partialDay = dayGroups.first()
        assertEquals("2026-09-09", partialDay.date)
        assertFalse("isFullDay must be false for partial periods", partialDay.isFullDay)
        assertEquals("Partial Day Leave", partialDay.leaveTypeDisplay)
        assertEquals("3 periods · P1, P3, P5", partialDay.periodSummarySubtitle)
        assertEquals(3, partialDay.periods.size)
    }

    // Test 3 — Single period (P3)
    @Test
    fun test03_singlePeriod_aggregatedToOnePeriodEntry() {
        val rawRecords = listOf(
            LeaveRequest(id = 301, teacherId = 1, date = "2026-09-10", dayOrder = 5, periodNumber = 3, reason = "Guest lecture", status = LeaveStatus.PENDING)
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("Single period record must aggregate to 1 LeaveHistoryDay", 1, dayGroups.size)
        val periodLeave = dayGroups.first()
        assertEquals("2026-09-10", periodLeave.date)
        assertFalse("isFullDay must be false", periodLeave.isFullDay)
        assertEquals("Period Leave", periodLeave.leaveTypeDisplay)
        assertEquals("P3 · 10:15–11:15", periodLeave.periodSummarySubtitle)
        assertEquals(1, periodLeave.periods.size)
    }

    // Test 4 — Two separate leave requests on the same date
    @Test
    fun test04_twoSeparateRequestsOnSameDate_notMerged() {
        val rawRecords = listOf(
            // Request A: Morning leave P1-P2 (batch A)
            LeaveRequest(id = 401, teacherId = 1, date = "2026-09-12", dayOrder = 2, periodNumber = 1, reason = "Dentist appointment", status = LeaveStatus.APPROVED, batchId = "batch-morning"),
            LeaveRequest(id = 402, teacherId = 1, date = "2026-09-12", dayOrder = 2, periodNumber = 2, reason = "Dentist appointment", status = LeaveStatus.APPROVED, batchId = "batch-morning"),

            // Request B: Afternoon leave P4-P5 (batch B)
            LeaveRequest(id = 403, teacherId = 1, date = "2026-09-12", dayOrder = 2, periodNumber = 4, reason = "Urgent family event", status = LeaveStatus.APPROVED, batchId = "batch-afternoon"),
            LeaveRequest(id = 404, teacherId = 1, date = "2026-09-12", dayOrder = 2, periodNumber = 5, reason = "Urgent family event", status = LeaveStatus.APPROVED, batchId = "batch-afternoon")
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("Two separate requests on the same date must produce 2 distinct LeaveHistoryDay cards", 2, dayGroups.size)
        val reasons = dayGroups.map { it.reason }.toSet()
        assertTrue(reasons.contains("Dentist appointment"))
        assertTrue(reasons.contains("Urgent family event"))
    }

    // Test 5 — Different dates
    @Test
    fun test05_differentDates_produceSeparateDayCards() {
        val rawRecords = mutableListOf<LeaveRequest>()
        // 08 Sep Full Day (P1-P5)
        for (p in 1..5) {
            rawRecords.add(LeaveRequest(id = 500 + p, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = p, reason = "Conference", status = LeaveStatus.APPROVED, batchId = "batch-sep8"))
        }
        // 09 Sep Full Day (P1-P5)
        for (p in 1..5) {
            rawRecords.add(LeaveRequest(id = 510 + p, teacherId = 1, date = "2026-09-09", dayOrder = 4, periodNumber = p, reason = "Conference", status = LeaveStatus.APPROVED, batchId = "batch-sep9"))
        }

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("Two different full-day dates must produce exactly 2 LeaveHistoryDay cards", 2, dayGroups.size)
        val dates = dayGroups.map { it.date }.toSet()
        assertTrue(dates.contains("2026-09-08"))
        assertTrue(dates.contains("2026-09-09"))
        assertTrue("Both must be Full Day Leave", dayGroups.all { it.isFullDay })
    }

    // Test 6 — Mixed status on the same date
    @Test
    fun test06_mixedStatusOnSameDate_notMerged() {
        val rawRecords = listOf(
            LeaveRequest(id = 601, teacherId = 1, date = "2026-09-15", dayOrder = 1, periodNumber = 1, reason = "Medical checkup", status = LeaveStatus.APPROVED, createdAt = "2026-09-14T09:00:00Z"),
            LeaveRequest(id = 602, teacherId = 1, date = "2026-09-15", dayOrder = 1, periodNumber = 2, reason = "Personal issue", status = LeaveStatus.PENDING, createdAt = "2026-09-14T14:00:00Z")
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals("Leaves with different statuses on the same date must NOT be merged", 2, dayGroups.size)
        val statuses = dayGroups.map { it.status }.toSet()
        assertTrue(statuses.contains(LeaveStatus.APPROVED))
        assertTrue(statuses.contains(LeaveStatus.PENDING))
    }

    // Test 7 — Substitute assignment preservation
    @Test
    fun test07_substituteAssignmentPreservedInPeriods() {
        val rawRecords = listOf(
            LeaveRequest(id = 701, teacherId = 1, date = "2026-09-18", dayOrder = 5, periodNumber = 1, reason = "Official Duty", status = LeaveStatus.APPROVED, substituteTeacherName = "Dr. Ramesh", batchId = "batch-sub-1"),
            LeaveRequest(id = 702, teacherId = 1, date = "2026-09-18", dayOrder = 5, periodNumber = 2, reason = "Official Duty", status = LeaveStatus.APPROVED, substituteTeacherName = "Prof. Priya", batchId = "batch-sub-1"),
            LeaveRequest(id = 703, teacherId = 1, date = "2026-09-18", dayOrder = 5, periodNumber = 3, reason = "Official Duty", status = LeaveStatus.APPROVED, substituteTeacherName = null, batchId = "batch-sub-1"),
            LeaveRequest(id = 704, teacherId = 1, date = "2026-09-18", dayOrder = 5, periodNumber = 4, reason = "Official Duty", status = LeaveStatus.APPROVED, substituteTeacherName = null, batchId = "batch-sub-1"),
            LeaveRequest(id = 705, teacherId = 1, date = "2026-09-18", dayOrder = 5, periodNumber = 5, reason = "Official Duty", status = LeaveStatus.APPROVED, substituteTeacherName = null, batchId = "batch-sub-1")
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals(1, dayGroups.size)
        val day = dayGroups.first()
        assertTrue("Group must report having substitutes", day.hasSubstitutes)
        assertEquals("Group must report 2 covered periods", 2, day.coveredPeriodsCount)

        // Verify underlying period details
        assertEquals("Dr. Ramesh", day.periods[0].substituteTeacherName)
        assertEquals("Prof. Priya", day.periods[1].substituteTeacherName)
        assertEquals(null, day.periods[2].substituteTeacherName)
    }

    // Test 8 — Day-level status counters
    @Test
    fun test08_dayLevelStatusCounters() {
        val rawRecords = listOf(
            // Day 1: 5 periods Approved
            LeaveRequest(id = 801, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 1, reason = "R1", status = LeaveStatus.APPROVED, batchId = "b1"),
            LeaveRequest(id = 802, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 2, reason = "R1", status = LeaveStatus.APPROVED, batchId = "b1"),
            LeaveRequest(id = 803, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 3, reason = "R1", status = LeaveStatus.APPROVED, batchId = "b1"),
            LeaveRequest(id = 804, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 4, reason = "R1", status = LeaveStatus.APPROVED, batchId = "b1"),
            LeaveRequest(id = 805, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 5, reason = "R1", status = LeaveStatus.APPROVED, batchId = "b1"),

            // Day 2: 1 period Pending
            LeaveRequest(id = 806, teacherId = 1, date = "2026-09-10", dayOrder = 5, periodNumber = 2, reason = "R2", status = LeaveStatus.PENDING)
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        val totalDays = dayGroups.size
        val approvedDays = dayGroups.count { it.status == LeaveStatus.APPROVED }
        val pendingDays = dayGroups.count { it.status == LeaveStatus.PENDING }

        assertEquals("Total leave days must be 2, not 6 raw period records", 2, totalDays)
        assertEquals("Approved leave days must be 1, not 5", 1, approvedDays)
        assertEquals("Pending leave days must be 1", 1, pendingDays)
    }

    // Test 9 — Chronological sorting: newest dates first
    @Test
    fun test09_chronologicalSorting_newestFirst() {
        val rawRecords = listOf(
            LeaveRequest(id = 901, teacherId = 1, date = "2026-09-02", dayOrder = 1, periodNumber = 1, reason = "Early sep", status = LeaveStatus.APPROVED),
            LeaveRequest(id = 902, teacherId = 1, date = "2026-09-15", dayOrder = 2, periodNumber = 1, reason = "Mid sep", status = LeaveStatus.APPROVED),
            LeaveRequest(id = 903, teacherId = 1, date = "2026-09-08", dayOrder = 3, periodNumber = 1, reason = "Between sep", status = LeaveStatus.APPROVED)
        )

        val dayGroups = leaveRepository.groupLeavesByDay(rawRecords)

        assertEquals(listOf("2026-09-15", "2026-09-08", "2026-09-02"), dayGroups.map { it.date })
    }
}
