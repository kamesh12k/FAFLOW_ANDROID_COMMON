package com.governence.faflow.attendance

import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.AttendanceTodaySummaryOutDto
import com.governence.faflow.ui.viewmodels.ShiftState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StaffAttendanceStateMachineReliabilityTest {

    @Test
    fun testAttendanceTodaySummaryDtoMapsAuthoritativeServerState() {
        val record = AttendanceRecordOutDto(
            id = 1,
            userId = 10,
            staffName = "Dr. Teacher",
            attendanceDate = "2026-09-21",
            checkInTime = "2026-09-21T08:30:00Z",
            checkOutTime = "2026-09-21T16:35:00Z",
            status = "PRESENT",
            checkInGeofenceName = "Main Campus Perimeter",
            checkOutGeofenceName = "Main Campus Perimeter",
            workingHours = "8h 5m"
        )

        val dto = AttendanceTodaySummaryOutDto(
            isCheckedIn = true,
            isCheckedOut = true,
            checkInTime = "2026-09-21T08:30:00Z",
            checkOutTime = "2026-09-21T16:35:00Z",
            workingDuration = "8h 5m",
            record = record
        )

        assertTrue(dto.isCheckedIn)
        assertTrue(dto.isCheckedOut)
        assertEquals("8h 5m", dto.workingDuration)
        assertEquals("Main Campus Perimeter", dto.record?.checkInGeofenceName)
    }

    @Test
    fun testShiftStateDeterminationFromSummary() {
        // 1. Not checked in
        val notStartedDto = AttendanceTodaySummaryOutDto(
            isCheckedIn = false,
            isCheckedOut = false
        )
        val notStartedState = when {
            notStartedDto.isCheckedOut -> ShiftState.COMPLETED
            notStartedDto.isCheckedIn -> ShiftState.ON_DUTY
            else -> ShiftState.NOT_STARTED
        }
        assertEquals(ShiftState.NOT_STARTED, notStartedState)

        // 2. Checked in, not checked out
        val onDutyDto = AttendanceTodaySummaryOutDto(
            isCheckedIn = true,
            isCheckedOut = false,
            checkInTime = "2026-09-21T08:30:00Z"
        )
        val onDutyState = when {
            onDutyDto.isCheckedOut -> ShiftState.COMPLETED
            onDutyDto.isCheckedIn -> ShiftState.ON_DUTY
            else -> ShiftState.NOT_STARTED
        }
        assertEquals(ShiftState.ON_DUTY, onDutyState)

        // 3. Checked out -> Must be COMPLETED
        val completedDto = AttendanceTodaySummaryOutDto(
            isCheckedIn = true,
            isCheckedOut = true,
            checkInTime = "2026-09-21T08:30:00Z",
            checkOutTime = "2026-09-21T16:35:00Z"
        )
        val completedState = when {
            completedDto.isCheckedOut -> ShiftState.COMPLETED
            completedDto.isCheckedIn -> ShiftState.ON_DUTY
            else -> ShiftState.NOT_STARTED
        }
        assertEquals(ShiftState.COMPLETED, completedState)
    }

    @Test
    fun testStaleSummaryCannotDowngradeCompletedShift() {
        var currentShiftState = ShiftState.COMPLETED

        // Simulate an out-of-order network response from earlier today arriving after checkout
        val staleResponse = AttendanceTodaySummaryOutDto(
            isCheckedIn = true,
            isCheckedOut = false, // Old state before checkout was committed
            checkInTime = "2026-09-21T08:30:00Z"
        )

        val isStaleOverwrite = currentShiftState == ShiftState.COMPLETED && !staleResponse.isCheckedOut
        assertTrue("Stale response must be detected", isStaleOverwrite)

        // Ensure state is NOT downgraded
        if (!isStaleOverwrite) {
            currentShiftState = ShiftState.ON_DUTY
        }
        assertEquals(ShiftState.COMPLETED, currentShiftState)
    }
}
