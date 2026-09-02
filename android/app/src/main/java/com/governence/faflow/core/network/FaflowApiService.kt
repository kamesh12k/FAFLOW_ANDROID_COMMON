package com.governence.faflow.core.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit API interface connecting directly to FAFLOW FastAPI backend endpoints.
 */
interface FaflowApiService {

    // ---------- Auth ----------
    @POST("auth/login")
    suspend fun login(
        @Body request: UserLoginRequestDto
    ): Response<TokenDto>

    @GET("teachers/me")
    suspend fun getMe(): Response<UserOutDto>

    // ---------- Academic Calendar & Day Order ----------
    @GET("academic-calendar/my-today-summary")
    suspend fun getMyTodaySummary(
        @Query("date") date: String? = null
    ): Response<TeacherTodaySummaryDto>

    @GET("academic-calendar/resolve")
    suspend fun resolveDayOrder(
        @Query("date") date: String
    ): Response<DayOrderResolveDto>

    // ---------- Timetable ----------
    @GET("timetable/teacher/{teacher_id}")
    suspend fun getTimetableByTeacher(
        @Path("teacher_id") teacherId: Int
    ): Response<List<TimetableSlotOutDto>>

    @GET("timetable/")
    suspend fun getTimetable(
        @Query("class_id") classId: Int? = null,
        @Query("department_id") departmentId: Int? = null,
        @Query("teacher_id") teacherId: Int? = null,
        @Query("day_order") dayOrder: Int? = null
    ): Response<List<TimetableSlotOutDto>>

    // ---------- Classes & Teachers ----------
    @GET("classes/")
    suspend fun getClasses(
        @Query("department_id") departmentId: Int? = null
    ): Response<List<ClassOutDto>>

    @GET("teachers/")
    suspend fun getTeachers(
        @Query("department_id") departmentId: Int? = null
    ): Response<List<TeacherOutDto>>

    // ---------- Leaves ----------
    @GET("leaves/my")
    suspend fun getMyLeaves(
        @Query("include_expired") includeExpired: Boolean = false
    ): Response<List<LeaveOutDto>>

    @GET("leaves/")
    suspend fun getAllLeaves(): Response<List<LeaveOutDto>>

    @POST("leaves/")
    suspend fun applyLeave(
        @Body request: LeaveCreateDto
    ): Response<LeaveOutDto>

    @POST("leaves/batch")
    suspend fun applyLeaveBatch(
        @Body request: LeaveBatchCreateDto
    ): Response<List<LeaveOutDto>>

    @DELETE("leaves/{leave_id}")
    suspend fun cancelLeave(
        @Path("leave_id") leaveId: Int
    ): Response<Unit>

    @PATCH("leaves/{leave_id}/approve")
    suspend fun approveLeave(
        @Path("leave_id") leaveId: Int
    ): Response<LeaveApproveResponseDto>

    @PATCH("leaves/{leave_id}/reject")
    suspend fun rejectLeave(
        @Path("leave_id") leaveId: Int
    ): Response<LeaveOutDto>

    @PATCH("leaves/{leave_id}/status")
    suspend fun updateLeaveStatus(
        @Path("leave_id") leaveId: Int,
        @Body request: LeaveStatusUpdateDto
    ): Response<Map<String, Any>>

    @POST("leaves/{leave_id}/assign")
    suspend fun assignSubstitute(
        @Path("leave_id") leaveId: Int,
        @Body request: LeaveAlterAssignmentCreateDto
    ): Response<AlterAssignmentOutDto>

    // ---------- Today Coverage ----------
    @GET("substitutions/today")
    suspend fun getTodayCoverage(
        @Query("date") date: String? = null
    ): Response<TodaySubstitutionCoverageDto>

    // ---------- System Policy ----------
    @GET("system/institutions/{institution_id}/policy")
    suspend fun getEffectivePolicy(
        @Path("institution_id") institutionId: Int
    ): Response<InstitutionPolicyDto>


    // ---------- Credits ----------
    @GET("teachers/{teacher_id}/credits")
    suspend fun getTeacherCredits(
        @Path("teacher_id") teacherId: Int
    ): Response<CreditBalanceOutDto>

    @GET("credits/my/transactions")
    suspend fun getMyCreditTransactions(): Response<List<CreditTransactionOutDto>>

    // ---------- Teacher Substitution ----------
    @GET("teacher/substitution/my-leaves")
    suspend fun getTeacherSubstitutionDuties(
        @Query("include_expired") includeExpired: Boolean = false
    ): Response<List<LeaveOutDto>>

    @GET("teacher/substitution/leave/{leave_id}/candidates")
    suspend fun getSubstitutionCandidates(
        @Path("leave_id") leaveId: Int,
        @Query("include_cross_department") includeCrossDept: Boolean = false
    ): Response<List<RecommendationOutDto>>

    @POST("teacher/substitution/leave/{leave_id}/assign/{substitute_id}")
    suspend fun assignSubstitute(
        @Path("leave_id") leaveId: Int,
        @Path("substitute_id") substituteId: Int
    ): Response<AlterAssignmentOutDto>

    @POST("teacher/substitution/leave/{leave_id}/undo-assignment")
    suspend fun undoSubstitutionAssignment(
        @Path("leave_id") leaveId: Int
    ): Response<LeaveOutDto>

    // ---------- Preferences ----------
    @GET("campus-operations/preferences/me")
    suspend fun getMyPreferences(): Response<SubstitutionPreferenceOutDto>

    @PUT("campus-operations/preferences/me")
    suspend fun updateMyPreferences(
        @Body request: SubstitutionPreferenceUpdateDto
    ): Response<SubstitutionPreferenceOutDto>

    // ---------- Notifications ----------
    @GET("notifications/")
    suspend fun listNotifications(
        @Query("unread_only") unreadOnly: Boolean = false
    ): Response<List<NotificationOutDto>>

    @GET("notifications/unread-count")
    suspend fun getUnreadCount(): Response<UnreadCountDto>

    @PATCH("notifications/{notification_id}/read")
    suspend fun markNotificationRead(
        @Path("notification_id") notificationId: Int
    ): Response<StatusOkDto>

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<StatusOkDto>

    // ---------- Attendance ----------
    @POST("attendance/check-in")
    suspend fun checkIn(
        @Body request: AttendanceCheckInRequestDto
    ): Response<AttendanceRecordOutDto>

    @POST("attendance/check-out")
    suspend fun checkOut(
        @Body request: AttendanceCheckOutRequestDto
    ): Response<AttendanceRecordOutDto>

    @GET("attendance/today")
    suspend fun getTodayAttendance(): Response<AttendanceTodaySummaryOutDto>

    @GET("attendance/my")
    suspend fun getMyAttendanceHistory(
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0
    ): Response<List<AttendanceRecordOutDto>>

    @GET("attendance/admin/live-status")
    suspend fun getSupervisorLiveStatus(
        @Query("date") date: String? = null,
        @Query("department_id") departmentId: Int? = null,
        @Query("status") status: String? = null
    ): Response<SupervisorLiveStatusOutDto>

    // ---------- Geofences ----------
    @GET("geofences/active")
    suspend fun getActiveGeofences(): Response<List<GeofenceOutDto>>

    @GET("geofences/")
    suspend fun listAllGeofences(
        @Query("is_active") isActive: Boolean? = null
    ): Response<List<GeofenceOutDto>>

    @POST("geofences/")
    suspend fun createGeofence(
        @Body request: GeofenceCreateDto
    ): Response<GeofenceOutDto>

    @PUT("geofences/{geofence_id}")
    suspend fun updateGeofence(
        @Path("geofence_id") geofenceId: Int,
        @Body request: GeofenceUpdateDto
    ): Response<GeofenceOutDto>

    @DELETE("geofences/{geofence_id}")
    suspend fun deleteGeofence(
        @Path("geofence_id") geofenceId: Int
    ): Response<StatusOkDto>
}
