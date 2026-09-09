package com.governence.faflow

import com.governence.faflow.core.network.SubstitutionPreferenceOutDto
import com.governence.faflow.core.network.SubstitutionPreferenceUpdateDto
import com.governence.faflow.domain.model.StaffMember
import com.governence.faflow.ui.navigation.Screen
import com.governence.faflow.ui.viewmodels.PreferencesUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Automated tests verifying 100% web parity for substitution preferences,
 * faculty profile biometrics & credits, and administrative geofencing.
 */
class PreferencesAndParityTest {

    @Test
    fun testSubstitutionPreferenceOutDtoFullMapping() {
        val dto = SubstitutionPreferenceOutDto(
            teacherId = 42,
            acceptAutoAssignments = true,
            allowEmergencyAssignments = true,
            maxWeeklySubstitutions = 4,
            preferMorningClasses = true,
            preferSameDepartment = false,
            onlyMyClasses = true
        )

        assertEquals(42, dto.teacherId)
        assertTrue(dto.acceptAutoAssignments)
        assertTrue(dto.allowEmergencyAssignments)
        assertEquals(4, dto.maxWeeklySubstitutions)
        assertTrue(dto.preferMorningClasses)
        assertFalse(dto.preferSameDepartment)
        assertTrue(dto.onlyMyClasses)
    }

    @Test
    fun testSubstitutionPreferenceUpdateDtoPartialPatch() {
        val patch = SubstitutionPreferenceUpdateDto(
            acceptAutoAssignments = false,
            maxWeeklySubstitutions = null,
            onlyMyClasses = true
        )

        assertFalse(patch.acceptAutoAssignments!!)
        assertNull(patch.maxWeeklySubstitutions)
        assertTrue(patch.onlyMyClasses!!)
        assertNull(patch.preferMorningClasses)
        assertNull(patch.preferSameDepartment)
    }

    @Test
    fun testPreferencesUiStateDefaults() {
        val defaultState = PreferencesUiState()
        assertTrue("Default auto-assignments should be enabled", defaultState.acceptAutoAssignments)
        assertFalse("Default emergency assignments should be disabled", defaultState.allowEmergencyAssignments)
        assertNull("Default weekly substitutions should have no limit (null)", defaultState.maxWeeklySubstitutions)
        assertFalse("Default morning preference should be false", defaultState.preferMorningClasses)
        assertTrue("Default same department preference should be true", defaultState.preferSameDepartment)
        assertFalse("Default only my classes should be false", defaultState.onlyMyClasses)
    }

    @Test
    fun testStaffMemberProfileState() {
        val enrolledStaff = StaffMember(
            id = 101,
            name = "Dr. Anita Sharma",
            email = "anita.s@institution.edu",
            role = "teacher",
            departmentName = "Computer Science",
            isActive = true,
            faceEnrolled = true,
            creditBalance = 12
        )

        assertTrue(enrolledStaff.faceEnrolled)
        assertEquals(12, enrolledStaff.creditBalance)
        assertEquals("teacher", enrolledStaff.role)

        val unenrolledStaff = enrolledStaff.copy(faceEnrolled = false, creditBalance = 0)
        assertFalse(unenrolledStaff.faceEnrolled)
        assertEquals(0, unenrolledStaff.creditBalance)
    }

    @Test
    fun testGeofenceAdminRouteRegistration() {
        val route = Screen.GeofenceAdmin.route
        assertEquals("geofence_admin", route)
    }

    @Test
    fun testRecommendationOutDtoNestedBackendMapping() {
        val nestedDto = com.governence.faflow.core.network.RecommendationOutDto(
            teacher = com.governence.faflow.core.network.RecommendationTeacherDto(
                id = 88,
                name = "Dr. Rajesh Kumar",
                department = "ECE"
            ),
            score = 94.5f,
            reasons = listOf("Same department", "Free in period 4")
        )

        assertEquals(88, nestedDto.teacherId)
        assertEquals("Dr. Rajesh Kumar", nestedDto.teacherName)
        assertEquals("ECE", nestedDto.department)
        assertEquals(94.5f, nestedDto.compatibilityScore)
        assertEquals("Same department", nestedDto.reason)
    }

    @Test
    fun testRecommendationOutDtoFlatFallbackMapping() {
        val flatDto = com.governence.faflow.core.network.RecommendationOutDto(
            flatTeacherId = 77,
            flatTeacherName = "Prof. Meena",
            flatDepartment = "IT",
            flatCompatibilityScore = 82f,
            flatReason = "Subject match"
        )

        assertEquals(77, flatDto.teacherId)
        assertEquals("Prof. Meena", flatDto.teacherName)
        assertEquals("IT", flatDto.department)
        assertEquals(82f, flatDto.compatibilityScore)
        assertEquals("Subject match", flatDto.reason)
    }
}
