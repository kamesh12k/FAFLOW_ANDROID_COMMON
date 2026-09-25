package com.governence.faflow.attendance.student.ui

import com.governence.faflow.attendance.student.data.StudentAttendanceRepository
import com.governence.faflow.attendance.student.data.StudentAttendanceResult
import com.governence.faflow.core.network.AttendanceSessionDto
import com.governence.faflow.core.network.ClassOutDto
import com.governence.faflow.core.network.ClassRosterDto
import com.governence.faflow.core.network.NetworkResult
import com.governence.faflow.core.network.StudentExceptionItemDto
import com.governence.faflow.core.network.StudentItemDto
import com.governence.faflow.core.network.TeacherPeriodSlotDto
import com.governence.faflow.core.network.TeacherTodayScheduleDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StudentAttendanceViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private val sampleRoster = ClassRosterDto(
        classId = 101,
        className = "B.Sc CS II",
        totalStudents = 3,
        students = listOf(
            StudentItemDto(id = 1, rollNumber = "23CS001", rollSuffix = "001", name = "Alice Johnson", isActive = true),
            StudentItemDto(id = 2, rollNumber = "23CS002", rollSuffix = "002", name = "Bob Smith", isActive = true),
            StudentItemDto(id = 3, rollNumber = "23CS003", rollSuffix = "003", name = "Charlie Brown", isActive = true)
        )
    )

    private val sampleSchedule = TeacherTodayScheduleDto(
        date = "2026-09-18",
        dayOrder = 3,
        isBlockedDate = false,
        currentPeriod = 2,
        directPeriods = listOf(
            TeacherPeriodSlotDto(
                timetableSlotId = 1,
                periodNumber = 1,
                startTime = "08:00",
                endTime = "09:00",
                classId = 101,
                className = "B.Sc CS II",
                subjectId = 10,
                subjectName = "Data Structures",
                isSubstitution = false
            ),
            TeacherPeriodSlotDto(
                timetableSlotId = 2,
                periodNumber = 2,
                startTime = "09:00",
                endTime = "10:00",
                classId = 101,
                className = "B.Sc CS II",
                subjectId = 11,
                subjectName = "Python Programming",
                isSubstitution = false
            )
        )
    )

    private val fakeRepo = object : StudentAttendanceRepository() {
        var submittedAbsent: List<String> = emptyList()
        var submittedExceptions: List<StudentExceptionItemDto> = emptyList()
        var emergencySubmitted: Boolean = false

        override suspend fun getTodaySchedule(targetDate: String?): NetworkResult<TeacherTodayScheduleDto> {
            return NetworkResult.Success(sampleSchedule)
        }

        override suspend fun getClassRoster(classId: Int): NetworkResult<ClassRosterDto> {
            return NetworkResult.Success(sampleRoster)
        }

        override suspend fun getAllClasses(): NetworkResult<List<ClassOutDto>> {
            return NetworkResult.Success(listOf(ClassOutDto(id = 101, name = "B.Sc CS II", section = "A", departmentId = 1)))
        }

        override suspend fun getOrCreateSession(
            slotId: Int?,
            classId: Int,
            subjectId: Int?,
            substitutionId: Int?,
            isSubstitution: Boolean
        ): AttendanceSessionDto? {
            return AttendanceSessionDto(
                id = 55,
                attendanceDate = "2026-09-18",
                periodNumber = 2,
                classId = classId,
                className = "B.Sc CS II",
                subjectId = subjectId,
                subjectName = "Python Programming",
                actualTeacherId = 1,
                actualTeacherName = "Teacher A",
                attendanceType = "NORMAL",
                status = "DRAFT",
                totalStudents = 3,
                presentCount = 3,
                absentCount = 0
            )
        }

        override suspend fun submitAttendance(
            sessionId: Int,
            classId: Int,
            absentSuffixes: List<String>,
            exceptions: List<StudentExceptionItemDto>,
            periodNumber: Int?,
            subjectId: Int?
        ): StudentAttendanceResult {
            submittedAbsent = absentSuffixes
            submittedExceptions = exceptions
            return StudentAttendanceResult.Success(
                session = AttendanceSessionDto(
                    id = sessionId,
                    attendanceDate = "2026-09-18",
                    periodNumber = 2,
                    classId = classId,
                    className = "B.Sc CS II",
                    subjectId = 11,
                    subjectName = "Python Programming",
                    actualTeacherId = 1,
                    actualTeacherName = "Teacher A",
                    attendanceType = "NORMAL",
                    status = "SUBMITTED",
                    totalStudents = 3,
                    presentCount = 3 - absentSuffixes.size,
                    absentCount = absentSuffixes.size
                ),
                isOnline = true
            )
        }

        override suspend fun submitEmergencyAttendance(
            classId: Int,
            periodNumber: Int,
            absentSuffixes: List<String>,
            exceptions: List<StudentExceptionItemDto>
        ): StudentAttendanceResult {
            emergencySubmitted = true
            submittedAbsent = absentSuffixes
            return StudentAttendanceResult.Success(
                session = AttendanceSessionDto(
                    id = 99,
                    attendanceDate = "2026-09-18",
                    periodNumber = periodNumber,
                    classId = classId,
                    className = "B.Sc CS II",
                    subjectId = 0,
                    actualTeacherId = 1,
                    actualTeacherName = "Teacher A",
                    attendanceType = "EMERGENCY",
                    status = "SUBMITTED",
                    totalStudents = 3,
                    presentCount = 3 - absentSuffixes.size,
                    absentCount = absentSuffixes.size
                ),
                isOnline = true
            )
        }

        override fun getPendingCount(): Int = 0
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun testInitialScheduleLoadAndContextualPreselection() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.schedule)
        assertEquals(2, state.schedule?.currentPeriod)

        // Contextual auto-selection should have selected Period 2 (the active period)
        assertNotNull(state.selectedSlot)
        assertEquals(2, state.selectedSlot?.periodNumber)
        assertEquals("Python Programming", state.selectedSlot?.subjectName)

        // Roster should be loaded for selected slot
        assertNotNull(state.roster)
        assertEquals(3, state.roster?.students?.size)
    }

    @Test
    fun testToggleStudentAttendanceFastEntry() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        val alice = sampleRoster.students[0]
        assertEquals("", viewModel.uiState.value.absentInput)

        // 1st Tap: Alice marks absent
        viewModel.toggleStudentAttendance(alice)
        assertEquals("001", viewModel.uiState.value.absentInput.trim())

        // 2nd Tap: Alice marks present again
        viewModel.toggleStudentAttendance(alice)
        assertEquals("", viewModel.uiState.value.absentInput.trim())
    }

    @Test
    fun testBulkMarkAllAbsentAndPresent() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        viewModel.markAllAbsent()
        val tokens = viewModel.uiState.value.absentInput.split(" ").filter { it.isNotBlank() }
        assertEquals(3, tokens.size)
        assertTrue(tokens.contains("001"))
        assertTrue(tokens.contains("002"))
        assertTrue(tokens.contains("003"))

        viewModel.markAllPresent()
        assertEquals("", viewModel.uiState.value.absentInput)
    }

    @Test
    fun testSearchQueryAndFiltering() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        viewModel.updateSearchQuery("Alice")
        assertEquals("Alice", viewModel.uiState.value.searchQuery)

        viewModel.setFilter(RosterFilter.ABSENT)
        assertEquals(RosterFilter.ABSENT, viewModel.uiState.value.selectedFilter)
    }

    @Test
    fun testReviewSheetOpenValidation() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        // Valid suffix (001)
        viewModel.updateAbsentInput("001")
        viewModel.openReviewSheet()
        assertTrue(viewModel.uiState.value.isReviewSheetOpen)
        assertNull(viewModel.uiState.value.errorMessage)

        viewModel.closeReviewSheet()
        assertFalse(viewModel.uiState.value.isReviewSheetOpen)

        // Invalid suffix (999 not in class)
        viewModel.updateAbsentInput("999")
        viewModel.openReviewSheet()
        assertFalse(viewModel.uiState.value.isReviewSheetOpen)
        assertNotNull(viewModel.uiState.value.errorMessage)
    }

    @Test
    fun testSubmissionFlow() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        viewModel.updateAbsentInput("002")
        viewModel.submitAttendance()
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.isSubmitting)
        assertEquals(listOf("002"), fakeRepo.submittedAbsent)
        assertNotNull(viewModel.uiState.value.successMessage)
    }

    @Test
    fun testEmergencyAttendanceSelectionAndSubmission() = runTest(testDispatcher) {
        val viewModel = StudentAttendanceViewModel(fakeRepo)
        advanceUntilIdle()

        val emergencyClass = ClassOutDto(id = 101, name = "B.Sc CS II", section = "A", departmentId = 1)
        viewModel.selectEmergencyClass(emergencyClass)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isEmergencyMode)
        assertEquals(101, viewModel.uiState.value.selectedSlot?.classId)

        viewModel.updateAbsentInput("003")
        viewModel.submitAttendance()
        advanceUntilIdle()

        assertTrue(fakeRepo.emergencySubmitted)
        assertEquals(listOf("003"), fakeRepo.submittedAbsent)
    }

    @Test
    fun testLargeClassPerformance150Students() = runTest(testDispatcher) {
        val largeRoster = (1..150).map { i ->
            val suf = i.toString().padStart(3, '0')
            StudentItemDto(
                id = i,
                rollNumber = "23CS$suf",
                rollSuffix = suf,
                name = "Student $i",
                isActive = true
            )
        }

        val largeRepo = object : StudentAttendanceRepository() {
            override suspend fun getTodaySchedule(targetDate: String?): NetworkResult<TeacherTodayScheduleDto> =
                NetworkResult.Success(sampleSchedule)

            override suspend fun getClassRoster(classId: Int): NetworkResult<ClassRosterDto> =
                NetworkResult.Success(ClassRosterDto(classId = 200, className = "Big Class", totalStudents = 150, students = largeRoster))

            override suspend fun getAllClasses(): NetworkResult<List<ClassOutDto>> =
                NetworkResult.Success(emptyList())

            override fun getPendingCount(): Int = 0
        }

        val viewModel = StudentAttendanceViewModel(largeRepo)
        advanceUntilIdle()

        assertEquals(150, viewModel.uiState.value.roster?.students?.size)

        // Rapidly toggle 20 students
        val startNs = System.nanoTime()
        for (i in 0 until 20) {
            viewModel.toggleStudentAttendance(largeRoster[i])
        }
        val durationMs = (System.nanoTime() - startNs) / 1_000_000

        // State update for 20 rapid mutations should be under 100ms
        assertTrue("Rapid toggle duration took ${durationMs}ms", durationMs < 100)

        val absentTokens = viewModel.uiState.value.absentInput.split(" ").filter { it.isNotBlank() }
        assertEquals(20, absentTokens.size)
    }
}
