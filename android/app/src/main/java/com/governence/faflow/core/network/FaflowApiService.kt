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

    @POST("admin/first-login/setup")
    suspend fun completeFirstLoginSetup(
        @Body request: FirstLoginSetupRequestDto
    ): Response<TokenDto>

    @GET("teachers/me")
    suspend fun getMe(): Response<UserOutDto>

    // ---------- Policy & Onboarding ----------
    @GET("policy/current")
    suspend fun getCurrentPolicy(): Response<CurrentPolicyDto>

    @POST("policy/accept")
    suspend fun acceptPolicy(
        @Body request: PolicyAcceptRequestDto
    ): Response<PolicyAcceptResponseDto>

    @POST("policy/onboarding/complete")
    suspend fun completeOnboarding(): Response<OnboardingStatusResponseDto>

    @POST("policy/onboarding/reset")
    suspend fun resetOnboarding(): Response<OnboardingStatusResponseDto>

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

    @POST("leaves/evaluate-policy")
    suspend fun evaluatePolicy(
        @Body request: LeavePolicyEvalRequestDto
    ): Response<PolicyEvaluationResultDto>

    @PATCH("leaves/{leave_id}/approve-with-exception")
    suspend fun approveLeaveWithException(
        @Path("leave_id") leaveId: Int,
        @Body request: ApproveWithExceptionRequestDto
    ): Response<LeaveApproveResponseDto>

    @GET("enforcement-mode")
    suspend fun getEnforcementMode(): Response<PolicyEnforcementModeResponseDto>

    // ---------- Leave Policies & Balances ----------
    @GET("leave-balances/policies")
    suspend fun getActiveLeavePolicies(): Response<List<LeavePolicyOutDto>>

    @GET("leave-balances/me")
    suspend fun getMyLeaveBalances(): Response<TeacherLeaveBalanceSummaryDto>

    @POST("leave-balances/validate")
    suspend fun validateLeaveApplication(
        @Body request: LeaveValidationRequestDto
    ): Response<LeaveValidationOutDto>

    @GET("leave-balances/teacher/{teacher_id}/ledger")
    suspend fun getTeacherLeaveLedger(
        @Path("teacher_id") teacherId: Int
    ): Response<List<LeaveBalanceTransactionDto>>

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

    @GET("leaves/{leave_id}/candidates")
    suspend fun getFallbackSubstitutionCandidates(
        @Path("leave_id") leaveId: Int,
        @Query("include_cross_department") includeCrossDept: Boolean = false
    ): Response<List<RecommendationOutDto>>

    @POST("teacher/substitution/leave/{leave_id}/assign/{substitute_id}")
    suspend fun assignSubstitute(
        @Path("leave_id") leaveId: Int,
        @Path("substitute_id") substituteId: Int
    ): Response<okhttp3.ResponseBody>

    @POST("teacher/substitution/leave/{leave_id}/undo-assignment")
    suspend fun undoSubstitutionAssignment(
        @Path("leave_id") leaveId: Int
    ): Response<okhttp3.ResponseBody>

    // ---------- Flexible Mode — Slot Candidates ----------
    @GET("leaves/slot-candidates")
    suspend fun getSlotCandidates(
        @Query("date") date: String,
        @Query("period_number") periodNumber: Int,
        @Query("include_cross_department") includeCrossDepartment: Boolean = false,
        @Query("only_handles_class") onlyHandlesClass: Boolean = false
    ): Response<List<RecommendationOutDto>>

    // ---------- Campus Operations Mode ----------
    @GET("campus-operations/mode")
    suspend fun getCampusOperationsMode(): Response<CampusOperationsModeDto>

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

    @DELETE("notifications/")
    suspend fun clearAllNotifications(): Response<StatusOkDto>

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

    // ---------- Biometrics ----------
    @POST("teachers/me/biometrics/enroll")
    suspend fun enrollBiometrics(): Response<UserOutDto>

    // ---------- Student Attendance ----------
    @GET("student-attendance/today")
    suspend fun getStudentAttendanceToday(
        @Query("target_date") targetDate: String? = null
    ): Response<TeacherTodayScheduleDto>

    @GET("student-attendance/classes/{class_id}/roster")
    suspend fun getStudentClassRoster(
        @Path("class_id") classId: Int
    ): Response<ClassRosterDto>

    @GET("student-attendance/sessions/{session_id}")
    suspend fun getStudentAttendanceSession(
        @Path("session_id") sessionId: Int
    ): Response<AttendanceSessionDto>

    @POST("student-attendance/sessions")
    suspend fun createStudentAttendanceSession(
        @Body request: AttendanceSessionCreateDto
    ): Response<AttendanceSessionDto>

    @POST("student-attendance/sessions/{session_id}/submit")
    suspend fun submitStudentAttendance(
        @Path("session_id") sessionId: Int,
        @Body request: AttendanceSubmitRequestDto
    ): Response<AttendanceSessionDto>

    @POST("student-attendance/emergency")
    suspend fun emergencyStudentAttendance(
        @Body request: EmergencyAttendanceRequestDto
    ): Response<AttendanceSessionDto>

    @POST("student-attendance/sync")
    suspend fun syncOfflineAttendanceBatch(
        @Body request: OfflineBatchSyncRequestDto
    ): Response<OfflineBatchSyncResponseDto>

    // ---------- Announcements ----------
    @GET("announcements")
    suspend fun getAnnouncements(
        @Query("tab") tab: String = "all",
        @Query("search") search: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<List<AnnouncementListItemDto>>

    @GET("announcements/unread-count")
    suspend fun getUnreadAnnouncementsCount(): Response<UnreadCountDto>

    @GET("announcements/{id}")
    suspend fun getAnnouncementDetail(
        @Path("id") id: Int
    ): Response<AnnouncementDetailDto>

    @POST("announcements/{id}/acknowledge")
    suspend fun acknowledgeAnnouncement(
        @Path("id") id: Int
    ): Response<AnnouncementDetailDto>

    // ---------- Campus Duty Management ----------
    @GET("campus-duties/my")
    suspend fun getMyDuties(
        @Query("date") date: String? = null
    ): Response<List<CampusDutyDto>>

    @GET("campus-duties")
    suspend fun getCampusDuties(
        @Query("date") date: String? = null,
        @Query("duty_type") dutyType: String? = null,
        @Query("department_id") departmentId: Int? = null
    ): Response<List<CampusDutyDto>>

    @GET("campus-duties/{duty_id}")
    suspend fun getDutyDetail(
        @Path("duty_id") dutyId: Int
    ): Response<CampusDutyDto>

    @POST("campus-duties")
    suspend fun createDuty(
        @Body request: DutyCreateRequestDto
    ): Response<CampusDutyDto>

    @POST("campus-duties/{duty_id}/auto-assign")
    suspend fun autoAssignDuty(
        @Path("duty_id") dutyId: Int
    ): Response<CampusDutyDto>

    @POST("campus-duties/generate-today-discipline")
    suspend fun generateTodayDiscipline(
        @Query("target_date") targetDate: String? = null,
        @Query("department_id") departmentId: Int? = null
    ): Response<List<CampusDutyDto>>

    @GET("campus-duties/{duty_id}/candidates")
    suspend fun getDutyCandidates(
        @Path("duty_id") dutyId: Int
    ): Response<DutyCandidatesResponseDto>

    @POST("campus-duties/{duty_id}/assignments")
    suspend fun assignTeacher(
        @Path("duty_id") dutyId: Int,
        @Body request: DutyAssignRequestDto
    ): Response<DutyAssignmentDto>

    @POST("campus-duties/{duty_id}/assignments/{assignment_id}/lock")
    suspend fun lockAssignment(
        @Path("duty_id") dutyId: Int,
        @Path("assignment_id") assignmentId: Int,
        @Body request: DutyLockRequestDto
    ): Response<DutyAssignmentDto>

    @POST("campus-duties/{duty_id}/assignments/{assignment_id}/unlock")
    suspend fun unlockAssignment(
        @Path("duty_id") dutyId: Int,
        @Path("assignment_id") assignmentId: Int
    ): Response<DutyAssignmentDto>

    @POST("campus-duties/{duty_id}/assignments/{assignment_id}/override")
    suspend fun overrideAssignment(
        @Path("duty_id") dutyId: Int,
        @Path("assignment_id") assignmentId: Int,
        @Body request: DutyOverrideRequestDto
    ): Response<DutyAssignmentDto>

    @POST("campus-duties/{duty_id}/assignments/{assignment_id}/replace")
    suspend fun replaceAssignment(
        @Path("duty_id") dutyId: Int,
        @Path("assignment_id") assignmentId: Int,
        @Body request: DutyReplaceRequestDto
    ): Response<DutyAssignmentDto>

    @GET("campus-duties/metrics/summary")
    suspend fun getDutyMetrics(
        @Query("date") date: String? = null,
        @Query("department_id") departmentId: Int? = null
    ): Response<DutyDashboardMetricsDto>

    // ---------- Campus Structure Builder ----------
    @GET("campus-structure/tree")
    suspend fun getCampusStructureTree(): Response<CampusStructureTreeResponse>

    @GET("campus-structure/metrics")
    suspend fun getCampusStructureMetrics(): Response<CampusStructureMetricsDto>

    @POST("campus-structure/blocks/smart-autofill")
    suspend fun smartAutofillBlock(
        @Body request: SmartBlockAutoFillRequestDto
    ): Response<SmartBlockAutoFillResponseDto>

    @POST("campus-structure/rooms/preview")
    suspend fun previewRoomPattern(
        @Body request: RoomPatternPreviewRequestDto
    ): Response<PatternPreviewResponseDto>

    @POST("campus-structure/rooms/bulk-assign")
    suspend fun bulkAssignRooms(
        @Body request: BulkRoomAssignRequestDto
    ): Response<BulkAssignResponseDto>

    @POST("campus-structure/blocks/{block_id}/duplicate")
    suspend fun duplicateBlock(
        @Path("block_id") blockId: Int,
        @Body request: DuplicateBlockRequestDto
    ): Response<DuplicateBlockResponseDto>

    @GET("campus-structure/search")
    suspend fun searchCampus(
        @Query("q") query: String
    ): Response<CampusSearchResponseDto>

    // ---------- Governance / Public Config ----------
    @GET("system/governance/public-config")
    suspend fun getPublicGovernanceConfig(): Response<PublicGovernanceConfigDto>
}
