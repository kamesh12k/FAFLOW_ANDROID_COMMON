package com.governence.faflow.attendance

import com.governence.faflow.core.network.AttendanceRecordOutDto
import com.governence.faflow.core.network.SupervisorLiveStatusOutDto
import com.governence.faflow.ui.viewmodels.AttendanceViewModel
import com.governence.faflow.ui.viewmodels.ShiftState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AttendanceParityAndRedesignTest {

    @Test
    fun testShiftStateEnumValues() {
        assertEquals(3, ShiftState.entries.size)
        assertTrue(ShiftState.entries.contains(ShiftState.NOT_STARTED))
        assertTrue(ShiftState.entries.contains(ShiftState.ON_DUTY))
        assertTrue(ShiftState.entries.contains(ShiftState.COMPLETED))
    }

    @Test
    fun testSupervisorLiveStatusOutDtoBackendParity() {
        val record = AttendanceRecordOutDto(
            id = 101,
            userId = 42,
            staffName = "Dr. Alan Turing",
            attendanceDate = "2026-09-08",
            checkInTime = "2026-09-08T09:15:00",
            checkOutTime = null,
            status = "PRESENT",
            checkInGeofenceName = "Main Campus",
            checkOutGeofenceName = null,
            workingHours = null
        )

        val liveStatus = SupervisorLiveStatusOutDto(
            totalStaff = 50,
            presentCount = 35,
            checkedOutCount = 10,
            absentCount = 5,
            currentlyActiveCount = 35,
            records = listOf(record)
        )

        assertEquals(50, liveStatus.totalStaff)
        assertEquals(35, liveStatus.presentCount)
        assertEquals(35, liveStatus.currentlyActiveCount)
        assertEquals(10, liveStatus.checkedOutCount)
        assertEquals(5, liveStatus.absentCount)
        assertEquals(1, liveStatus.displayRecords.size)
        assertEquals("Dr. Alan Turing", liveStatus.displayRecords[0].staffName)
    }

    @Test
    fun testSanitizeErrorMessageRemovesTechnicalJargon() {
        val rawCosineError = "Biometric face similarity score (0.54) below threshold 0.60"
        val cleanCosine = AttendanceViewModel.sanitizeErrorMessage(rawCosineError)
        assertEquals("Face not recognized", cleanCosine)
        assertFalse(cleanCosine.contains("0.54"))
        assertFalse(cleanCosine.contains("threshold"))

        val rawLivenessError = "Liveness / presentation attack verification failed"
        val cleanLiveness = AttendanceViewModel.sanitizeErrorMessage(rawLivenessError)
        assertEquals("Unable to verify your face", cleanLiveness)

        val rawGeofenceError = "Location verification failed: Staff member is outside institutional campus geofence perimeters"
        val cleanGeofence = AttendanceViewModel.sanitizeErrorMessage(rawGeofenceError)
        assertEquals("Outside authorized campus perimeter", cleanGeofence)

        val duplicateCheckIn = "Staff member is already checked in for today (2026-09-08)"
        val cleanDuplicate = AttendanceViewModel.sanitizeErrorMessage(duplicateCheckIn)
        assertEquals("Staff member is already checked in for today", cleanDuplicate)
    }

    @Test
    fun testLiveWorkingDurationCalculation() {
        val now = Date()
        val twoHoursThirtyMinsAgo = Date(now.time - (3600 * 1000 * 2 + 1800 * 1000))
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val checkInStr = isoFormat.format(twoHoursThirtyMinsAgo)

        val duration = AttendanceViewModel.calculateLiveWorkingDuration(checkInStr)
        assertNotNull(duration)
        assertTrue(duration!!.contains("2h"))
    }
}
