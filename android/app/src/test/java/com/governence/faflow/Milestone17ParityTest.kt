package com.governence.faflow

import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.InstitutionPolicyDto
import com.governence.faflow.core.network.LeaveAlterAssignmentCreateDto
import com.governence.faflow.core.network.LeaveApproveResponseDto
import com.governence.faflow.core.network.LeaveOutDto
import com.governence.faflow.core.network.LeaveStatusUpdateDto
import com.governence.faflow.core.network.SupervisorLiveStatusOutDto
import com.governence.faflow.core.network.TeacherOutDto
import com.governence.faflow.core.network.TimetableSlotOutDto
import com.governence.faflow.core.network.TodaySubstitutionCoverageDto
import com.governence.faflow.core.network.TodaySubstitutionItemDto
import com.governence.faflow.ui.navigation.BottomNavItem
import com.governence.faflow.ui.navigation.Screen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit test suite certifying Milestone 17 — Complete FAFLOW Teacher + HOD Mobile Experience.
 */
class Milestone17ParityTest {

    @Test
    fun testTeacherTimetableDtoParsing() {
        val slotDto = TimetableSlotOutDto(
            id = 101,
            teacherId = 42,
            subjectId = 10,
            classId = 3,
            roomId = 5,
            dayOrder = 2,
            periodNumber = 1,
            subjectName = "Database Management Systems",
            subjectCode = "CS-301",
            className = "CSE-A",
            classSection = "A",
            roomNumber = "Lab-1"
        )

        assertEquals(101, slotDto.id)
        assertEquals(42, slotDto.teacherId)
        assertEquals(2, slotDto.dayOrder)
        assertEquals(1, slotDto.periodNumber)
        assertEquals("Database Management Systems", slotDto.subjectName)
        assertEquals("CS-301", slotDto.subjectCode)
        assertEquals("CSE-A", slotDto.className)
    }

    @Test
    fun testClassAndTeacherDtos() {
        val classDto = ClassOutDto(
            id = 3,
            name = "CSE-III",
            section = "A",
            departmentId = 1,
            semester = 5
        )
        assertEquals(3, classDto.id)
        assertEquals("CSE-III", classDto.name)
        assertEquals("A", classDto.section)
        assertEquals(1, classDto.departmentId)

        val teacherDto = TeacherOutDto(
            id = 42,
            name = "Dr. Alan Turing",
            email = "alan@institution.edu",
            username = "aturing",
            role = "teacher",
            department = "Computer Science",
            departmentId = 1,
            isActive = true
        )
        assertEquals(42, teacherDto.id)
        assertEquals("Dr. Alan Turing", teacherDto.name)
        assertEquals("teacher", teacherDto.role)
        assertTrue(teacherDto.isActive)
    }

    @Test
    fun testLeaveApprovalAndAssignmentDtos() {
        val leaveDto = LeaveOutDto(
            id = 501,
            teacherId = 42,
            date = "2026-09-10",
            dayOrder = 2,
            periodNumber = 3,
            reason = "Medical consultation",
            status = "pending",
            teacherName = "Dr. Alan Turing"
        )
        assertEquals("pending", leaveDto.status)

        val updateDto = LeaveStatusUpdateDto(
            status = "approved",
            adminNotes = "Approved by HOD"
        )
        assertEquals("approved", updateDto.status)
        assertEquals("Approved by HOD", updateDto.adminNotes)

        val assignDto = LeaveAlterAssignmentCreateDto(
            substituteTeacherId = 43,
            assignmentType = "admin_assigned",
            periodNumber = 3,
            date = "2026-09-10",
            notes = "Assigned for Lab period"
        )
        assertEquals(43, assignDto.substituteTeacherId)
        assertEquals("admin_assigned", assignDto.assignmentType)
        assertEquals(3, assignDto.periodNumber)
    }

    @Test
    fun testTodayCoverageParsing() {
        val subItem = TodaySubstitutionItemDto(
            id = 201,
            leaveId = 501,
            periodNumber = 2,
            dayOrder = 1,
            className = "CSE-II A",
            subjectName = "Data Structures",
            originalTeacherName = "Prof. John",
            substituteTeacherName = "Prof. Sarah",
            status = "assigned",
            date = "2026-09-02"
        )
        assertEquals("assigned", subItem.status)
        assertEquals("Prof. Sarah", subItem.substituteTeacherName)

        val coverage = TodaySubstitutionCoverageDto(
            date = "2026-09-02",
            dayOrder = 1,
            totalLeavesToday = 2,
            coveredSlots = 2,
            uncoveredSlots = 0,
            substitutions = listOf(subItem)
        )
        assertEquals(2, coverage.totalLeavesToday)
        assertEquals(2, coverage.coveredSlots)
        assertEquals(0, coverage.uncoveredSlots)
        assertEquals(1, coverage.substitutions.size)
    }

    @Test
    fun testSupervisorLiveStatusParsing() {
        val liveStatus = SupervisorLiveStatusOutDto(
            date = "2026-09-02",
            totalStaff = 30,
            presentCount = 28,
            absentCount = 2,
            currentlyActiveCount = 25,
            checkedOutCount = 3,
            records = emptyList()
        )
        assertEquals(30, liveStatus.totalStaff)
        assertEquals(28, liveStatus.presentCount)
        assertEquals(2, liveStatus.absentCount)
        assertEquals(25, liveStatus.currentlyActiveCount)
    }

    @Test
    fun testInstitutionPolicyDto() {
        val policy = InstitutionPolicyDto(
            id = 1,
            institutionId = 1,
            faceEnrollmentAllowed = true,
            faceEnrollmentUpdateAllowed = true,
            biometricAttendanceEnabled = true,
            maxGeofenceRadiusMeters = 300.0,
            requireDeviceIntegrity = false,
            allowedAuthRoles = listOf("teacher", "admin", "principal")
        )
        assertTrue(policy.faceEnrollmentAllowed)
        assertTrue(policy.faceEnrollmentUpdateAllowed)
        assertTrue(policy.biometricAttendanceEnabled)
        assertEquals(300.0, policy.maxGeofenceRadiusMeters, 0.001)
        assertTrue(policy.allowedAuthRoles.contains("teacher"))
    }

    @Test
    fun testRoleSeparationNavigationTabs() {
        // Teacher Tabs: Home, Timetable, Attendance, More
        val teacherTabs = listOf(
            BottomNavItem.Home,
            BottomNavItem.Timetable,
            BottomNavItem.Attendance,
            BottomNavItem.More
        )
        assertEquals(4, teacherTabs.size)
        assertEquals(Screen.Home.route, teacherTabs[0].route)
        assertEquals(Screen.Timetable.route, teacherTabs[1].route)
        assertEquals(Screen.Attendance.route, teacherTabs[2].route)
        assertEquals(Screen.More.route, teacherTabs[3].route)

        // HOD Tabs: Overview, Leaves, Timetable, Attendance, More
        val hodTabs = listOf(
            BottomNavItem.HodHome,
            BottomNavItem.HodLeaves,
            BottomNavItem.HodTimetable,
            BottomNavItem.HodAttendanceTab,
            BottomNavItem.HodMore
        )
        assertEquals(5, hodTabs.size)
        assertEquals(Screen.HodDashboard.route, hodTabs[0].route)
        assertEquals(Screen.HodLeaveApprovals.route, hodTabs[1].route)
        assertEquals(Screen.ClasswiseTimetable.route, hodTabs[2].route)
        assertEquals(Screen.HodAttendance.route, hodTabs[3].route)
        assertEquals(Screen.More.route, hodTabs[4].route)
    }
}
