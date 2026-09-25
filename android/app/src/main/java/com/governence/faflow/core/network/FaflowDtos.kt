package com.governence.faflow.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ---------- Auth DTOs ----------

@JsonClass(generateAdapter = true)
data class UserLoginRequestDto(
    @Json(name = "identifier") val identifier: String,
    @Json(name = "password") val password: String
)

@JsonClass(generateAdapter = true)
data class UserOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String?,
    @Json(name = "username") val username: String?,
    @Json(name = "role") val role: String,
    @Json(name = "admin_level") val adminLevel: String? = null,
    @Json(name = "department") val department: String?,
    @Json(name = "department_id") val departmentId: Int?,
    @Json(name = "must_change_credentials") val mustChangeCredentials: Boolean = false,
    @Json(name = "policy_version_accepted") val policyVersionAccepted: String? = null,
    @Json(name = "policy_accepted_at") val policyAcceptedAt: String? = null,
    @Json(name = "onboarding_completed") val onboardingCompleted: Boolean = false,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class TokenDto(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "token_type") val tokenType: String = "bearer",
    @Json(name = "user") val user: UserOutDto
)

// ---------- Policy & Onboarding DTOs ----------

@JsonClass(generateAdapter = true)
data class PolicySectionDto(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String,
    @Json(name = "content") val content: String,
    @Json(name = "required") val required: Boolean = true
)

@JsonClass(generateAdapter = true)
data class CurrentPolicyDto(
    @Json(name = "version") val version: String,
    @Json(name = "effective_date") val effectiveDate: String,
    @Json(name = "sections") val sections: List<PolicySectionDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class PolicyAcceptRequestDto(
    @Json(name = "version") val version: String
)

@JsonClass(generateAdapter = true)
data class PolicyAcceptResponseDto(
    @Json(name = "success") val success: Boolean,
    @Json(name = "version_accepted") val versionAccepted: String,
    @Json(name = "accepted_at") val acceptedAt: String?,
    @Json(name = "user") val user: UserOutDto
)

@JsonClass(generateAdapter = true)
data class OnboardingStatusResponseDto(
    @Json(name = "success") val success: Boolean,
    @Json(name = "onboarding_completed") val onboardingCompleted: Boolean,
    @Json(name = "user") val user: UserOutDto
)

// ---------- Academic Calendar & Day Order DTOs ----------

@JsonClass(generateAdapter = true)
data class DayOrderResolveDto(
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int?,
    @Json(name = "day_type") val dayType: String,
    @Json(name = "blocks_operations") val blocksOperations: Boolean
)

@JsonClass(generateAdapter = true)
data class TeacherTodaySummaryDto(
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int?,
    @Json(name = "day_type") val dayType: String,
    @Json(name = "blocks_operations") val blocksOperations: Boolean = false,
    @Json(name = "is_on_leave") val isOnLeave: Boolean = false,
    @Json(name = "leave_periods") val leavePeriods: List<Int> = emptyList(),
    @Json(name = "substitute_duties_today") val substituteDutiesToday: List<SubstituteDutyDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SubstituteDutyDto(
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "class_name") val className: String?,
    @Json(name = "covering_for_name") val coveringForName: String?
)

// ---------- Timetable DTOs ----------

@JsonClass(generateAdapter = true)
data class TimetableSlotOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "subject_id") val subjectId: Int?,
    @Json(name = "class_id") val classId: Int,
    @Json(name = "room_id") val roomId: Int?,
    @Json(name = "day_order") val dayOrder: Int,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "subject_name") val subjectName: String? = null,
    @Json(name = "subject_code") val subjectCode: String? = null,
    @Json(name = "class_name") val className: String? = null,
    @Json(name = "class_section") val classSection: String? = null,
    @Json(name = "room_number") val roomNumber: String? = null,
    @Json(name = "teacher_name") val teacherName: String? = null
)

// ---------- Leave DTOs ----------

@JsonClass(generateAdapter = true)
data class LeaveCreateDto(
    @Json(name = "date") val date: String,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "reason") val reason: String,
    @Json(name = "proposed_substitute_id") val proposedSubstituteId: Int? = null,
    @Json(name = "leave_policy_id") val leavePolicyId: Int? = null,
    @Json(name = "leave_type") val leaveType: String? = null,
    @Json(name = "document_url") val documentUrl: String? = null,
    @Json(name = "policy_warning_acknowledged") val policyWarningAcknowledged: Boolean = false
)

@JsonClass(generateAdapter = true)
data class LeaveBatchCreateDto(
    @Json(name = "date") val date: String,
    @Json(name = "period_numbers") val periodNumbers: List<Int>? = null,
    @Json(name = "whole_day") val wholeDay: Boolean? = null,
    @Json(name = "reason") val reason: String,
    @Json(name = "period_substitutes") val periodSubstitutes: Map<String, Int>? = null,
    @Json(name = "leave_policy_id") val leavePolicyId: Int? = null,
    @Json(name = "leave_type") val leaveType: String? = null,
    @Json(name = "document_url") val documentUrl: String? = null,
    @Json(name = "policy_warning_acknowledged") val policyWarningAcknowledged: Boolean = false
)

@JsonClass(generateAdapter = true)
data class LeaveOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "reason") val reason: String,
    @Json(name = "status") val status: String,
    @Json(name = "is_emergency") val isEmergency: Boolean = false,
    @Json(name = "teacher_name") val teacherName: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "batch_id") val batchId: String? = null,
    @Json(name = "alter_assignment") val alterAssignment: AlterAssignmentOutDto? = null,
    @Json(name = "proposed_substitute_id") val proposedSubstituteId: Int? = null,
    @Json(name = "proposed_substitute") val proposedSubstitute: ProposedSubstituteDto? = null,
    @Json(name = "leave_policy_id") val leavePolicyId: Int? = null,
    @Json(name = "leave_type") val leaveType: String? = null,
    @Json(name = "consumed_at") val consumedAt: String? = null,
    @Json(name = "document_url") val documentUrl: String? = null,
    @Json(name = "leave_policy") val leavePolicy: LeavePolicyOutDto? = null,
    @Json(name = "policy_compliant") val policyCompliant: Boolean? = true,
    @Json(name = "policy_violation") val policyViolation: Boolean? = false,
    @Json(name = "policy_enforcement_mode") val policyEnforcementMode: String? = null,
    @Json(name = "policy_warning_acknowledged") val policyWarningAcknowledged: Boolean? = false,
    @Json(name = "exception_reason") val exceptionReason: String? = null
)

// ---------- Leave Policy & Balance DTOs ----------

@JsonClass(generateAdapter = true)
data class LeavePolicyOutDto(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "name") val name: String = "",
    @Json(name = "code") val code: String = "",
    @Json(name = "description") val description: String? = null,
    @Json(name = "entitlement_days") val entitlementDays: Double = 0.0,
    @Json(name = "entitlement") val entitlement: Double? = null,
    @Json(name = "entitlement_period") val entitlementPeriod: String = "YEAR",
    @Json(name = "period") val period: String? = null,
    @Json(name = "max_consecutive_days") val maxConsecutiveDays: Int? = null,
    @Json(name = "max_per_month") val maxPerMonth: Int? = null,
    @Json(name = "monthly_limit") val monthlyLimit: Double? = null,
    @Json(name = "requires_document") val requiresDocument: Boolean = false,
    @Json(name = "document_required") val documentRequired: Boolean? = null,
    @Json(name = "requires_prior_notice_days") val requiresPriorNoticeDays: Int = 0,
    @Json(name = "is_active") val isActive: Boolean = true
) {
    val effectiveEntitlementDays: Double
        get() = if (entitlementDays > 0.0) entitlementDays else (entitlement ?: 0.0)

    val effectiveEntitlementPeriod: String
        get() = if (entitlementPeriod.isNotBlank()) entitlementPeriod else (period ?: "YEAR")

    val effectiveRequiresDocument: Boolean
        get() = requiresDocument || (documentRequired ?: false)
}

@JsonClass(generateAdapter = true)
data class TeacherPolicyBalanceDto(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "policy_id") val policyId: Int = 0,
    @Json(name = "policy_code") val policyCode: String = "",
    @Json(name = "code") val code: String? = null,
    @Json(name = "policy_name") val policyName: String = "",
    @Json(name = "name") val name: String? = null,
    @Json(name = "entitlement") val entitlement: Double = 0.0,
    @Json(name = "consumed") val consumed: Double = 0.0,
    @Json(name = "pending") val pending: Double = 0.0,
    @Json(name = "remaining") val remaining: Double = 0.0,
    @Json(name = "period") val period: String = "YEAR",
    @Json(name = "max_per_month") val maxPerMonth: Int? = null,
    @Json(name = "monthly_limit") val monthlyLimit: Double? = null,
    @Json(name = "requires_document") val requiresDocument: Boolean = false,
    @Json(name = "document_required") val documentRequired: Boolean? = null
) {
    val effectivePolicyCode: String
        get() = if (policyCode.isNotBlank()) policyCode else (code ?: "")

    val effectivePolicyName: String
        get() = if (policyName.isNotBlank()) policyName else (name ?: "")

    val effectiveRequiresDocument: Boolean
        get() = requiresDocument || (documentRequired ?: false)
}

@JsonClass(generateAdapter = true)
data class TeacherLeaveBalanceSummaryDto(
    @Json(name = "teacher_id") val teacherId: Int = 0,
    @Json(name = "academic_year") val academicYear: String = "",
    @Json(name = "balances") val balances: List<TeacherPolicyBalanceDto> = emptyList(),
    @Json(name = "total_entitled") val totalEntitled: Double = 0.0,
    @Json(name = "total_consumed") val totalConsumed: Double = 0.0,
    @Json(name = "total_remaining") val totalRemaining: Double = 0.0
)

@JsonClass(generateAdapter = true)
data class LeaveValidationRequestDto(
    @Json(name = "policy_id") val policyId: Int,
    @Json(name = "date") val date: String,
    @Json(name = "days") val days: Double = 1.0,
    @Json(name = "consecutive_days") val consecutiveDays: Int = 1
)

@JsonClass(generateAdapter = true)
data class LeaveValidationOutDto(
    @Json(name = "allowed") val allowed: Boolean = true,
    @Json(name = "message") val message: String? = null,
    @Json(name = "policy_code") val policyCode: String = "",
    @Json(name = "policy_name") val policyName: String = "",
    @Json(name = "remaining_before") val remainingBefore: Double = 0.0,
    @Json(name = "projected_remaining") val projectedRemaining: Double = 0.0,
    @Json(name = "monthly_limit_reached") val monthlyLimitReached: Boolean = false,
    @Json(name = "requires_document") val requiresDocument: Boolean = false,
    @Json(name = "enforcement_mode") val enforcementMode: String = "STRICT",
    @Json(name = "requires_warning") val requiresWarning: Boolean = false,
    @Json(name = "violations") val violations: List<PolicyViolationItemDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class PolicyViolationItemDto(
    @Json(name = "policy_id") val policyId: Int? = null,
    @Json(name = "policy_code") val policyCode: String? = null,
    @Json(name = "policy_name") val policyName: String? = null,
    @Json(name = "violation_type") val violationType: String = "",
    @Json(name = "message") val message: String = "",
    @Json(name = "advisory_allowed") val advisoryAllowed: Boolean = true
)

@JsonClass(generateAdapter = true)
data class PolicyEvaluationResultDto(
    @Json(name = "compliant") val compliant: Boolean = true,
    @Json(name = "enforcement_mode") val enforcementMode: String = "STRICT",
    @Json(name = "can_submit") val canSubmit: Boolean = true,
    @Json(name = "requires_warning") val requiresWarning: Boolean = false,
    @Json(name = "violations") val violations: List<PolicyViolationItemDto> = emptyList(),
    @Json(name = "policy_id") val policyId: Int? = null,
    @Json(name = "policy_code") val policyCode: String? = null,
    @Json(name = "policy_name") val policyName: String? = null
)

@JsonClass(generateAdapter = true)
data class LeavePolicyEvalRequestDto(
    @Json(name = "leave_policy_id") val leavePolicyId: Int,
    @Json(name = "date") val date: String,
    @Json(name = "period_numbers") val periodNumbers: List<Int>? = null,
    @Json(name = "whole_day") val wholeDay: Boolean = false
)

@JsonClass(generateAdapter = true)
data class ApproveWithExceptionRequestDto(
    @Json(name = "hod_acknowledged") val hodAcknowledged: Boolean = true,
    @Json(name = "exception_reason") val exceptionReason: String
)

@JsonClass(generateAdapter = true)
data class PolicyEnforcementModeResponseDto(
    @Json(name = "mode") val mode: String = "STRICT",
    @Json(name = "description") val description: String? = null,
    @Json(name = "can_toggle") val canToggle: Boolean = false,
    @Json(name = "institution_name") val institutionName: String? = null,
    @Json(name = "is_configured") val isConfigured: Boolean = false
)

@JsonClass(generateAdapter = true)
data class LeaveBalanceTransactionDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "policy_id") val policyId: Int,
    @Json(name = "policy_code") val policyCode: String? = null,
    @Json(name = "policy_name") val policyName: String? = null,
    @Json(name = "transaction_type") val transactionType: String,
    @Json(name = "days") val days: Double = 0.0,
    @Json(name = "balance_before") val balanceBefore: Double = 0.0,
    @Json(name = "balance_after") val balanceAfter: Double = 0.0,
    @Json(name = "leave_request_id") val leaveRequestId: Int? = null,
    @Json(name = "reason") val reason: String? = null,
    @Json(name = "created_at") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ProposedSubstituteDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String? = null,
    @Json(name = "department") val department: String? = null
)

@JsonClass(generateAdapter = true)
data class SlotCandidateOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "compatibility_score") val compatibilityScore: Float = 100f,
    @Json(name = "weekly_assignment_count") val weeklyAssignmentCount: Int = 0,
    @Json(name = "today_assignment_count") val todayAssignmentCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class CampusOperationsModeDto(
    @Json(name = "mode") val mode: String = "standard",
    @Json(name = "configured_mode") val configuredMode: String? = null,
    @Json(name = "global_override") val globalOverride: String? = null,
    @Json(name = "is_overridden") val isOverridden: Boolean = false
)

@JsonClass(generateAdapter = true)
data class AlterAssignmentOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "leave_request_id") val leaveRequestId: Int,
    @Json(name = "substitute_teacher_id") val substituteTeacherId: Int,
    @Json(name = "substitute_name") val substituteName: String? = null,
    @Json(name = "assignment_type") val assignmentType: String = "admin_assigned",
    @Json(name = "compatibility_score") val compatibilityScore: Float? = null,
    @Json(name = "is_locked") val isLocked: Boolean = false
)

// ---------- Credits DTOs ----------

@JsonClass(generateAdapter = true)
data class CreditBalanceOutDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "balance") val balance: Int
)

@JsonClass(generateAdapter = true)
data class CreditTransactionOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "teacher_name") val teacherName: String? = null,
    @Json(name = "change") val change: Int,
    @Json(name = "reason") val reason: String,
    @Json(name = "category") val category: String? = "other",
    @Json(name = "related_leave_id") val relatedLeaveId: Int? = null,
    @Json(name = "created_at") val createdAt: String
)

// ---------- Substitution DTOs ----------

@JsonClass(generateAdapter = true)
data class RecommendationTeacherDto(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "department") val department: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null
)

@JsonClass(generateAdapter = true)
data class CandidateMetricsDto(
    @Json(name = "daily_periods") val dailyPeriods: Int = 0,
    @Json(name = "projected_daily_periods") val projectedDailyPeriods: Int = 0,
    @Json(name = "weekly_periods") val weeklyPeriods: Int = 0,
    @Json(name = "projected_weekly_periods") val projectedWeeklyPeriods: Int = 0,
    @Json(name = "substitutions_last_7_days") val substitutionsLast7Days: Int = 0,
    @Json(name = "longest_continuous_before") val longestContinuousBefore: Int = 0,
    @Json(name = "longest_continuous_after") val longestContinuousAfter: Int = 0
)

@JsonClass(generateAdapter = true)
data class CandidateSignalsDto(
    @Json(name = "same_department") val sameDepartment: Boolean = false,
    @Json(name = "same_subject") val sameSubject: Boolean = false,
    @Json(name = "cross_department") val crossDepartment: Boolean = false
)

@JsonClass(generateAdapter = true)
data class RecommendationOutDto(
    @Json(name = "rank") val rank: Int? = null,
    @Json(name = "tier") val tier: String? = null,
    @Json(name = "eligible") val eligible: Boolean = true,
    @Json(name = "teacher") val teacher: RecommendationTeacherDto? = null,
    @Json(name = "score") val score: Float? = null,
    @Json(name = "metrics") val metrics: CandidateMetricsDto? = null,
    @Json(name = "signals") val signals: CandidateSignalsDto? = null,
    @Json(name = "reasons") val reasons: List<String> = emptyList(),
    @Json(name = "today_workload") val todayWorkload: Int? = null,
    @Json(name = "projected_today_workload") val projectedTodayWorkload: Int? = null,
    @Json(name = "week_workload") val weekWorkload: Int? = null,
    @Json(name = "projected_week_workload") val projectedWeekWorkload: Int? = null,
    @Json(name = "longest_continuous_periods") val longestContinuousPeriods: Int? = null,
    @Json(name = "projected_longest_continuous_periods") val projectedLongestContinuousPeriods: Int? = null,
    @Json(name = "today_periods") val todayPeriods: List<Int> = emptyList(),
    @Json(name = "substitutions_week") val substitutionsWeek: Int? = null,
    // Fallback flat fields for backwards compatibility
    @Json(name = "id") val explicitId: Int? = null,
    @Json(name = "teacher_id") val flatTeacherId: Int? = null,
    @Json(name = "teacher_name") val flatTeacherName: String? = null,
    @Json(name = "department") val flatDepartment: String? = null,
    @Json(name = "compatibility_score") val flatCompatibilityScore: Float? = null,
    @Json(name = "reason") val flatReason: String? = null
) {
    constructor(
        teacherId: Int,
        teacherName: String,
        department: String?,
        compatibilityScore: Float,
        reason: String? = null
    ) : this(
        teacher = RecommendationTeacherDto(id = teacherId, name = teacherName, department = department),
        score = compatibilityScore,
        reasons = if (reason != null) listOf(reason) else emptyList(),
        flatTeacherId = teacherId,
        flatTeacherName = teacherName,
        flatDepartment = department,
        flatCompatibilityScore = compatibilityScore,
        flatReason = reason
    )

    val teacherId: Int get() = teacher?.id ?: explicitId ?: flatTeacherId ?: 0
    val id: Int get() = teacherId
    val teacherName: String get() = teacher?.name ?: flatTeacherName ?: "Faculty #${teacherId}"
    val department: String? get() = teacher?.department ?: flatDepartment
    val compatibilityScore: Float get() = score ?: flatCompatibilityScore ?: 0f
    val normalizedScore: Int get() {
        val raw = score ?: flatCompatibilityScore ?: 0f
        return raw.toInt().coerceIn(0, 100)
    }
    val suitabilityTier: String get() {
        if (!tier.isNullOrBlank()) return tier
        val s = normalizedScore
        return when {
            s >= 90 -> "EXCELLENT"
            s >= 75 -> "GOOD"
            s >= 60 -> "FAIR"
            else -> "LOW"
        }
    }
    val reason: String? get() = reasons.firstOrNull() ?: flatReason

    // Simulation helpers matching backend CandidateMetrics and web ApplyLeave.jsx
    val resolvedTodayLoad: Int get() = metrics?.dailyPeriods ?: todayWorkload ?: 0
    val resolvedProjToday: Int get() = metrics?.projectedDailyPeriods ?: projectedTodayWorkload ?: (resolvedTodayLoad + 1)
    val resolvedWeekLoad: Int get() = metrics?.weeklyPeriods ?: weekWorkload ?: 0
    val resolvedProjWeek: Int get() = metrics?.projectedWeeklyPeriods ?: projectedWeekWorkload ?: (resolvedWeekLoad + 1)
    val resolvedContLoad: Int get() = metrics?.longestContinuousBefore ?: longestContinuousPeriods ?: 0
    val resolvedProjCont: Int get() = metrics?.longestContinuousAfter ?: projectedLongestContinuousPeriods ?: (resolvedContLoad + 1)
    val hasContinuousWarning: Boolean get() = resolvedProjCont >= 4
    val resolvedSubsWeek: Int get() = substitutionsWeek ?: metrics?.substitutionsLast7Days ?: 0
}

@JsonClass(generateAdapter = true)
data class SubstitutionPreferenceOutDto(
    @Json(name = "teacher_id") val teacherId: Int? = null,
    @Json(name = "accept_auto_assignments") val acceptAutoAssignments: Boolean = true,
    @Json(name = "allow_emergency_assignments") val allowEmergencyAssignments: Boolean = false,
    @Json(name = "max_weekly_substitutions") val maxWeeklySubstitutions: Int? = null,
    @Json(name = "prefer_morning_classes") val preferMorningClasses: Boolean = false,
    @Json(name = "prefer_same_department") val preferSameDepartment: Boolean = true,
    @Json(name = "only_my_classes") val onlyMyClasses: Boolean = false,
    @Json(name = "max_substitutions_per_day") val maxSubstitutionsPerDay: Int? = null,
    @Json(name = "max_substitutions_per_week") val maxSubstitutionsPerWeek: Int? = null,
    @Json(name = "willing_for_cross_department") val willingForCrossDepartment: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class SubstitutionPreferenceUpdateDto(
    @Json(name = "accept_auto_assignments") val acceptAutoAssignments: Boolean? = null,
    @Json(name = "allow_emergency_assignments") val allowEmergencyAssignments: Boolean? = null,
    @Json(name = "max_weekly_substitutions") val maxWeeklySubstitutions: Int? = null,
    @Json(name = "prefer_morning_classes") val preferMorningClasses: Boolean? = null,
    @Json(name = "prefer_same_department") val preferSameDepartment: Boolean? = null,
    @Json(name = "only_my_classes") val onlyMyClasses: Boolean? = null,
    @Json(name = "max_substitutions_per_day") val maxSubstitutionsPerDay: Int? = null,
    @Json(name = "max_substitutions_per_week") val maxSubstitutionsPerWeek: Int? = null,
    @Json(name = "willing_for_cross_department") val willingForCrossDepartment: Boolean? = null
)

// ---------- Notifications DTOs ----------

@JsonClass(generateAdapter = true)
data class NotificationOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "body") val body: String,
    @Json(name = "event_type") val eventType: String? = null,
    @Json(name = "related_leave_id") val relatedLeaveId: Int? = null,
    @Json(name = "is_read") val isRead: Boolean = false,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class UnreadCountDto(
    @Json(name = "count") val count: Int
)

@JsonClass(generateAdapter = true)
data class StatusOkDto(
    @Json(name = "ok") val ok: Boolean = true
)

// ---------- Attendance DTOs ----------

@JsonClass(generateAdapter = true)
data class AttendanceCheckInRequestDto(
    @Json(name = "idempotency_key") val idempotencyKey: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "accuracy_meters") val accuracyMeters: Double,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double,
    @Json(name = "liveness_verified") val livenessVerified: Boolean,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "device_reference") val deviceReference: String? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceCheckOutRequestDto(
    @Json(name = "idempotency_key") val idempotencyKey: String,
    @Json(name = "latitude") val latitude: Double,
    @Json(name = "longitude") val longitude: Double,
    @Json(name = "accuracy_meters") val accuracyMeters: Double,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double,
    @Json(name = "liveness_verified") val livenessVerified: Boolean,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "device_reference") val deviceReference: String? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceRecordOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "user_id") val userId: Int,
    @Json(name = "staff_name") val staffName: String? = null,
    @Json(name = "attendance_date") val attendanceDate: String,
    @Json(name = "check_in_time") val checkInTime: String? = null,
    @Json(name = "check_out_time") val checkOutTime: String? = null,
    @Json(name = "status") val status: String,
    @Json(name = "check_in_geofence_name") val checkInGeofenceName: String? = null,
    @Json(name = "check_out_geofence_name") val checkOutGeofenceName: String? = null,
    @Json(name = "face_similarity_score") val faceSimilarityScore: Double? = null,
    @Json(name = "liveness_verified") val livenessVerified: Boolean = false,
    @Json(name = "verification_method") val verificationMethod: String = "FACE_ON_DEVICE",
    @Json(name = "working_hours") val workingHours: String? = null,
    @Json(name = "is_synced") val isSynced: Boolean = true,
    @Json(name = "late_minutes") val lateMinutes: Int = 0
) {
    val staffId: Int get() = userId
    val workingDuration: String? get() = workingHours
}

@JsonClass(generateAdapter = true)
data class AttendanceTodaySummaryOutDto(
    @Json(name = "is_checked_in") val isCheckedIn: Boolean = false,
    @Json(name = "is_checked_out") val isCheckedOut: Boolean = false,
    @Json(name = "check_in_time") val checkInTime: String? = null,
    @Json(name = "check_out_time") val checkOutTime: String? = null,
    @Json(name = "working_duration") val workingDuration: String? = null,
    @Json(name = "record") val record: AttendanceRecordOutDto? = null
)

// ---------- Geofence DTOs ----------

@JsonClass(generateAdapter = true)
data class GeofenceOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String = "circle",
    @Json(name = "center_latitude") val centerLatitude: Double,
    @Json(name = "center_longitude") val centerLongitude: Double,
    @Json(name = "radius_meters") val radiusMeters: Double? = 150.0,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double = 15.0,
    @Json(name = "area_sq_meters") val areaSqMeters: Double? = null,
    @Json(name = "perimeter_meters") val perimeterMeters: Double? = null,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class GeofenceCreateDto(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "type") val type: String = "circle",
    @Json(name = "center_latitude") val centerLatitude: Double? = null,
    @Json(name = "center_longitude") val centerLongitude: Double? = null,
    @Json(name = "radius_meters") val radiusMeters: Double? = null,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double = 15.0
)

@JsonClass(generateAdapter = true)
data class GeofenceUpdateDto(
    @Json(name = "name") val name: String? = null,
    @Json(name = "description") val description: String? = null,
    @Json(name = "center_latitude") val centerLatitude: Double? = null,
    @Json(name = "center_longitude") val centerLongitude: Double? = null,
    @Json(name = "radius_meters") val radiusMeters: Double? = null,
    @Json(name = "polygon_vertices") val polygonVertices: List<List<Double>>? = null,
    @Json(name = "tolerance_meters") val toleranceMeters: Double? = null,
    @Json(name = "is_active") val isActive: Boolean? = null
)

// ---------- Supervisor Live Status DTOs ----------

@JsonClass(generateAdapter = true)
data class SupervisorLiveStatusOutDto(
    @Json(name = "date") val date: String? = null,
    @Json(name = "total_staff") val totalStaff: Int = 0,
    @Json(name = "present_count") val presentCount: Int = 0,
    @Json(name = "absent_count") val absentCount: Int = 0,
    @Json(name = "currently_active_count") val currentlyActiveCount: Int = 0,
    @Json(name = "checked_out_count") val checkedOutCount: Int = 0,
    @Json(name = "records") val records: List<AttendanceRecordOutDto> = emptyList(),
    @Json(name = "checked_in_count") val checkedInCount: Int? = null,
    @Json(name = "active_shifts") val activeShifts: List<AttendanceRecordOutDto>? = null,
    @Json(name = "anomalies_count") val anomaliesCount: Int = 0
) {
    val displayActiveCount: Int get() = checkedInCount ?: currentlyActiveCount
    val displayRecords: List<AttendanceRecordOutDto> get() = activeShifts?.takeIf { it.isNotEmpty() } ?: records
}

// ---------- Class & Teacher DTOs ----------

@JsonClass(generateAdapter = true)
data class ClassOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "section") val section: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "semester") val semester: Int? = null
)

@JsonClass(generateAdapter = true)
data class TeacherOutDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String? = null,
    @Json(name = "username") val username: String? = null,
    @Json(name = "role") val role: String = "teacher",
    @Json(name = "department") val department: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "is_active") val isActive: Boolean = true
)

// ---------- Leave Action DTOs ----------

@JsonClass(generateAdapter = true)
data class LeaveStatusUpdateDto(
    @Json(name = "status") val status: String,
    @Json(name = "admin_notes") val adminNotes: String? = null
)

@JsonClass(generateAdapter = true)
data class LeaveAlterAssignmentCreateDto(
    @Json(name = "substitute_teacher_id") val substituteTeacherId: Int,
    @Json(name = "assignment_type") val assignmentType: String = "admin_assigned",
    @Json(name = "period_number") val periodNumber: Int? = null,
    @Json(name = "date") val date: String? = null,
    @Json(name = "notes") val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class LeaveApproveResponseDto(
    @Json(name = "leave") val leave: LeaveOutDto,
    @Json(name = "free_teachers") val freeTeachers: List<TeacherOutDto> = emptyList()
)

// ---------- Today Coverage DTOs ----------

@JsonClass(generateAdapter = true)
data class TodaySubstitutionItemDto(
    @Json(name = "id") val id: Int,
    @Json(name = "leave_id") val leaveId: Int? = null,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "day_order") val dayOrder: Int? = null,
    @Json(name = "class_name") val className: String? = null,
    @Json(name = "subject_name") val subjectName: String? = null,
    @Json(name = "original_teacher_name") val originalTeacherName: String? = null,
    @Json(name = "substitute_teacher_name") val substituteTeacherName: String? = null,
    @Json(name = "status") val status: String = "assigned",
    @Json(name = "date") val date: String? = null
)

@JsonClass(generateAdapter = true)
data class TodaySubstitutionCoverageDto(
    @Json(name = "date") val date: String,
    @Json(name = "day_order") val dayOrder: Int? = null,
    @Json(name = "total_leaves_today") val totalLeavesToday: Int = 0,
    @Json(name = "covered_slots") val coveredSlots: Int = 0,
    @Json(name = "uncovered_slots") val uncoveredSlots: Int = 0,
    @Json(name = "substitutions") val substitutions: List<TodaySubstitutionItemDto> = emptyList()
)

// ---------- System Policy DTOs ----------

@JsonClass(generateAdapter = true)
data class InstitutionPolicyDto(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "institution_id") val institutionId: Int? = null,
    @Json(name = "face_enrollment_allowed") val faceEnrollmentAllowed: Boolean = true,
    @Json(name = "face_enrollment_update_allowed") val faceEnrollmentUpdateAllowed: Boolean = true,
    @Json(name = "biometric_attendance_enabled") val biometricAttendanceEnabled: Boolean = true,
    @Json(name = "max_geofence_radius_meters") val maxGeofenceRadiusMeters: Double = 500.0,
    @Json(name = "require_device_integrity") val requireDeviceIntegrity: Boolean = false,
    @Json(name = "allowed_auth_roles") val allowedAuthRoles: List<String> = emptyList()
)

// ---------- Student Attendance DTOs ----------

@JsonClass(generateAdapter = true)
data class StudentItemDto(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "roll_number") val rollNumber: String = "",
    @Json(name = "name") val name: String = "",
    @Json(name = "roll_suffix") val rollSuffix: String = "",
    @Json(name = "class_id") val classId: Int? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "is_active") val isActive: Boolean = true
)

@JsonClass(generateAdapter = true)
data class ClassRosterDto(
    @Json(name = "class_id") val classId: Int = 0,
    @Json(name = "class_name") val className: String = "",
    @Json(name = "section") val section: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "total_students") val totalStudents: Int = 0,
    @Json(name = "students") val students: List<StudentItemDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class TeacherPeriodSlotDto(
    @Json(name = "timetable_slot_id") val timetableSlotId: Int? = null,
    @Json(name = "period_number") val periodNumber: Int = 1,
    @Json(name = "period_time") val periodTime: String? = null,
    @Json(name = "start_time") val startTime: String? = null,
    @Json(name = "end_time") val endTime: String? = null,
    @Json(name = "class_id") val classId: Int = 0,
    @Json(name = "class_name") val className: String = "",
    @Json(name = "section") val section: String? = null,
    @Json(name = "subject_id") val subjectId: Int? = null,
    @Json(name = "subject_name") val subjectName: String? = null,
    @Json(name = "room_id") val roomId: Int? = null,
    @Json(name = "room_number") val roomNumber: String? = null,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "is_substitution") val isSubstitution: Boolean = false,
    @Json(name = "scheduled_teacher_name") val scheduledTeacherName: String? = null,
    @Json(name = "substitution_id") val substitutionId: Int? = null,
    @Json(name = "session_id") val sessionId: Int? = null,
    @Json(name = "session_status") val sessionStatus: String? = null
) {
    val displayTime: String get() = periodTime ?: if (startTime != null && endTime != null) "$startTime - $endTime" else "Period $periodNumber"
}

@JsonClass(generateAdapter = true)
data class TeacherTodayScheduleDto(
    @Json(name = "date") val date: String = "",
    @Json(name = "day_order") val dayOrder: Int? = null,
    @Json(name = "is_blocked_date") val isBlockedDate: Boolean = false,
    @Json(name = "is_holiday") val isHolidayFallback: Boolean = false,
    @Json(name = "block_reason") val blockReason: String? = null,
    @Json(name = "holiday_reason") val holidayReasonFallback: String? = null,
    @Json(name = "current_period") val currentPeriod: Int? = null,
    @Json(name = "scheduled_classes") val scheduledClasses: List<TeacherPeriodSlotDto> = emptyList(),
    @Json(name = "substitutions") val substitutions: List<TeacherPeriodSlotDto> = emptyList(),
    @Json(name = "periods") val directPeriods: List<TeacherPeriodSlotDto> = emptyList()
) {
    val isHoliday: Boolean get() = isBlockedDate || isHolidayFallback
    val holidayReason: String? get() = blockReason ?: holidayReasonFallback
    val periods: List<TeacherPeriodSlotDto> get() = when {
        directPeriods.isNotEmpty() -> directPeriods.filterIsInstance<TeacherPeriodSlotDto>()
        scheduledClasses.isNotEmpty() || substitutions.isNotEmpty() -> (scheduledClasses + substitutions).filterIsInstance<TeacherPeriodSlotDto>().sortedBy { it.periodNumber }
        else -> emptyList()
    }
}

@JsonClass(generateAdapter = true)
data class StudentRecordDto(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "student_id") val studentId: Int = 0,
    @Json(name = "student_roll") val studentRoll: String? = null,
    @Json(name = "student_roll_number") val fallbackRollNumber: String? = null,
    @Json(name = "student_name") val studentName: String = "",
    @Json(name = "student_suffix") val studentSuffix: String? = null,
    @Json(name = "roll_suffix") val fallbackRollSuffix: String? = null,
    @Json(name = "status") val status: String = "present",
    @Json(name = "marked_at") val markedAt: String? = null
) {
    val studentRollNumber: String get() = studentRoll ?: fallbackRollNumber ?: ""
    val rollSuffix: String get() = studentSuffix ?: fallbackRollSuffix ?: ""
}

@JsonClass(generateAdapter = true)
data class AttendanceSessionDto(
    @Json(name = "id") val id: Int = 0,
    @Json(name = "attendance_date") val attendanceDate: String = "",
    @Json(name = "period_number") val periodNumber: Int = 0,
    @Json(name = "day_order") val dayOrder: Int? = null,
    @Json(name = "class_id") val classId: Int = 0,
    @Json(name = "class_name") val className: String = "",
    @Json(name = "section") val section: String? = null,
    @Json(name = "subject_id") val subjectId: Int? = null,
    @Json(name = "subject_name") val subjectName: String? = null,
    @Json(name = "scheduled_teacher_id") val scheduledTeacherId: Int? = null,
    @Json(name = "scheduled_teacher_name") val scheduledTeacherName: String? = null,
    @Json(name = "actual_teacher_id") val actualTeacherId: Int = 0,
    @Json(name = "actual_teacher_name") val actualTeacherName: String? = null,
    @Json(name = "attendance_type") val attendanceType: String = "NORMAL",
    @Json(name = "status") val status: String = "PENDING",
    @Json(name = "total_students") val totalStudents: Int = 0,
    @Json(name = "present_count") val presentCount: Int = 0,
    @Json(name = "absent_count") val absentCount: Int = 0,
    @Json(name = "late_count") val lateCount: Int = 0,
    @Json(name = "on_duty_count") val onDutyCount: Int = 0,
    @Json(name = "leave_count") val leaveCount: Int = 0,
    @Json(name = "medical_count") val medicalCount: Int = 0,
    @Json(name = "correction_deadline") val correctionDeadline: String? = null,
    @Json(name = "correction_allowed") val correctionAllowed: Boolean? = null,
    @Json(name = "can_edit") val canEdit: Boolean = false,
    @Json(name = "records") val records: List<StudentRecordDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class StudentExceptionItemDto(
    @Json(name = "student_id") val studentId: Int? = null,
    @Json(name = "roll_suffix") val rollSuffix: String? = null,
    @Json(name = "status") val status: String
)

@JsonClass(generateAdapter = true)
data class AttendanceSessionCreateDto(
    @Json(name = "timetable_slot_id") val timetableSlotId: Int? = null,
    @Json(name = "class_id") val classId: Int? = null,
    @Json(name = "subject_id") val subjectId: Int? = null,
    @Json(name = "period_number") val periodNumber: Int? = null,
    @Json(name = "substitution_id") val substitutionId: Int? = null,
    @Json(name = "attendance_type") val attendanceType: String = "NORMAL"
)

@JsonClass(generateAdapter = true)
data class AttendanceSubmitRequestDto(
    @Json(name = "absent_roll_suffixes") val absentRollSuffixes: List<String> = emptyList(),
    @Json(name = "student_exceptions") val studentExceptions: List<StudentExceptionItemDto> = emptyList(),
    @Json(name = "client_timestamp") val clientTimestamp: String? = null
)

@JsonClass(generateAdapter = true)
data class EmergencyAttendanceRequestDto(
    @Json(name = "class_id") val classId: Int,
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "subject_id") val subjectId: Int? = null,
    @Json(name = "absent_roll_suffixes") val absentRollSuffixes: List<String> = emptyList(),
    @Json(name = "student_exceptions") val studentExceptions: List<StudentExceptionItemDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class StudentAttendanceSyncPayloadDto(
    @Json(name = "session_id") val sessionId: Int? = null,
    @Json(name = "class_id") val classId: Int? = null,
    @Json(name = "period_number") val periodNumber: Int? = null,
    @Json(name = "subject_id") val subjectId: Int? = null,
    @Json(name = "absent_roll_suffixes") val absentRollSuffixes: List<String> = emptyList(),
    @Json(name = "student_exceptions") val studentExceptions: List<StudentExceptionItemDto> = emptyList(),
    @Json(name = "client_timestamp") val clientTimestamp: String? = null
)

@JsonClass(generateAdapter = true)
data class OfflineSyncOperationDto(
    @Json(name = "operation_id") val operationId: String,
    @Json(name = "idempotency_key") val idempotencyKey: String,
    @Json(name = "operation_type") val operationType: String,
    @Json(name = "payload") val payload: StudentAttendanceSyncPayloadDto,
    @Json(name = "device_id") val deviceId: String? = null,
    @Json(name = "client_timestamp") val clientTimestamp: String? = null
)

@JsonClass(generateAdapter = true)
data class OfflineBatchSyncRequestDto(
    @Json(name = "device_id") val deviceId: String? = null,
    @Json(name = "operations") val operations: List<OfflineSyncOperationDto>
)

@JsonClass(generateAdapter = true)
data class OfflineSyncResultDto(
    @Json(name = "operation_id") val operationId: String,
    @Json(name = "idempotency_key") val idempotencyKey: String? = null,
    @Json(name = "success") val success: Boolean,
    @Json(name = "status") val status: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "error") val error: String? = null,
    @Json(name = "session_id") val sessionId: Int? = null
) {
    val errorOrMessage: String? get() = error ?: message
}

@JsonClass(generateAdapter = true)
data class OfflineBatchSyncResponseDto(
    @Json(name = "synced_count") val syncedCount: Int = 0,
    @Json(name = "failed_count") val failedCount: Int = 0,
    @Json(name = "success_count") val successCount: Int = 0,
    @Json(name = "failure_count") val failureCount: Int = 0,
    @Json(name = "processed") val processed: Int = 0,
    @Json(name = "results") val results: List<OfflineSyncResultDto> = emptyList()
) {
    val effectiveSuccessCount: Int get() = if (syncedCount > 0) syncedCount else successCount
    val effectiveFailureCount: Int get() = if (failedCount > 0) failedCount else failureCount
}

// ---------- First Login Setup DTO ----------

@JsonClass(generateAdapter = true)
data class FirstLoginSetupRequestDto(
    @Json(name = "new_username") val newUsername: String? = null,
    @Json(name = "new_email") val newEmail: String? = null,
    @Json(name = "new_password") val newPassword: String,
    @Json(name = "confirm_password") val confirmPassword: String
)

// ---------- Announcements DTOs ----------

@JsonClass(generateAdapter = true)
data class AnnouncementAttachmentDto(
    @Json(name = "id") val id: Int,
    @Json(name = "announcement_id") val announcementId: Int,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_type") val fileType: String,
    @Json(name = "file_size") val fileSize: Int,
    @Json(name = "storage_key") val storageKey: String,
    @Json(name = "download_url") val downloadUrl: String? = null,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class AnnouncementListItemDto(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "body_snippet") val bodySnippet: String,
    @Json(name = "type") val type: String = "GENERAL",
    @Json(name = "priority") val priority: String = "NORMAL",
    @Json(name = "status") val status: String = "PUBLISHED",
    @Json(name = "target_summary") val targetSummary: String = "All College",
    @Json(name = "is_pinned") val isPinned: Boolean = false,
    @Json(name = "requires_acknowledgement") val requiresAcknowledgement: Boolean = false,
    @Json(name = "allow_replies") val allowReplies: Boolean = true,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "author_name") val authorName: String,
    @Json(name = "author_role") val authorRole: String,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "attachment_count") val attachmentCount: Int = 0,
    @Json(name = "attachments") val attachments: List<AnnouncementAttachmentDto> = emptyList(),
    @Json(name = "is_read") val isRead: Boolean = false,
    @Json(name = "is_acknowledged") val isAcknowledged: Boolean = false
)

@JsonClass(generateAdapter = true)
data class AnnouncementDetailDto(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "body") val body: String,
    @Json(name = "type") val type: String = "GENERAL",
    @Json(name = "priority") val priority: String = "NORMAL",
    @Json(name = "status") val status: String = "PUBLISHED",
    @Json(name = "target_summary") val targetSummary: String = "All College",
    @Json(name = "is_pinned") val isPinned: Boolean = false,
    @Json(name = "requires_acknowledgement") val requiresAcknowledgement: Boolean = false,
    @Json(name = "allow_replies") val allowReplies: Boolean = true,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "author_name") val authorName: String,
    @Json(name = "author_role") val authorRole: String,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "attachments") val attachments: List<AnnouncementAttachmentDto> = emptyList(),
    @Json(name = "is_read") val isRead: Boolean = false,
    @Json(name = "is_acknowledged") val isAcknowledged: Boolean = false
)

// ---------- Campus Duty DTOs ----------

@JsonClass(generateAdapter = true)
data class DutyAssignmentDto(
    @Json(name = "id") val id: Int,
    @Json(name = "duty_id") val dutyId: Int,
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "teacher_name") val teacherName: String,
    @Json(name = "department") val department: String? = null,
    @Json(name = "assignment_state") val assignmentState: String = "ASSIGNED",
    @Json(name = "is_locked") val isLocked: Boolean = false,
    @Json(name = "locked_at") val lockedAt: String? = null,
    @Json(name = "locked_by") val lockedBy: String? = null,
    @Json(name = "selection_reason") val selectionReason: String? = null,
    @Json(name = "selection_reasons") val selectionReasons: List<String> = emptyList(),
    @Json(name = "selection_score") val selectionScore: Double? = null,
    @Json(name = "is_overridden") val isOverridden: Boolean = false,
    @Json(name = "overridden_by") val overriddenBy: String? = null,
    @Json(name = "override_reason") val overrideReason: String? = null,
    @Json(name = "is_replaced") val isReplaced: Boolean = false,
    @Json(name = "replacement_reason") val replacementReason: String? = null
)

@JsonClass(generateAdapter = true)
data class CampusDutyDto(
    @Json(name = "id") val id: Int,
    @Json(name = "title") val title: String,
    @Json(name = "duty_type") val dutyType: String,
    @Json(name = "duty_date") val dutyDate: String,
    @Json(name = "start_time") val startTime: String,
    @Json(name = "end_time") val endTime: String,
    @Json(name = "area_name") val areaName: String? = null,
    @Json(name = "break_name") val breakName: String? = null,
    @Json(name = "required_teachers") val requiredTeachers: Int = 1,
    @Json(name = "assigned_teachers") val assignedTeachers: Int = 0,
    @Json(name = "status") val status: String = "DRAFT",
    @Json(name = "is_locked") val isLocked: Boolean = false,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "room_id") val roomId: Int? = null,
    @Json(name = "room_number") val roomNumber: String? = null,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "location_hierarchy") val locationHierarchy: String? = null,
    @Json(name = "instructions") val instructions: String? = null,
    @Json(name = "assignments") val assignments: List<DutyAssignmentDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DutyCandidateDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "teacher_name") val teacherName: String,
    @Json(name = "department") val department: String? = null,
    @Json(name = "is_eligible") val isEligible: Boolean = true,
    @Json(name = "total_score") val totalScore: Double = 0.0,
    @Json(name = "free_before_break") val freeBeforeBreak: Boolean = false,
    @Json(name = "duties_today") val dutiesToday: Int = 0,
    @Json(name = "duties_this_week") val dutiesThisWeek: Int = 0,
    @Json(name = "selection_reasons") val selectionReasons: List<String> = emptyList(),
    @Json(name = "ineligibility_reasons") val ineligibilityReasons: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DutyCandidatesResponseDto(
    @Json(name = "duty_id") val dutyId: Int,
    @Json(name = "required_count") val requiredCount: Int = 1,
    @Json(name = "candidates") val candidates: List<DutyCandidateDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DutyDashboardMetricsDto(
    @Json(name = "total_duties") val totalDuties: Int = 0,
    @Json(name = "filled_duties") val filledDuties: Int = 0,
    @Json(name = "unfilled_duties") val unfilledDuties: Int = 0,
    @Json(name = "teachers_assigned") val teachersAssigned: Int = 0,
    @Json(name = "replacements_needed") val replacementsNeeded: Int = 0,
    @Json(name = "locked_duties") val lockedDuties: Int = 0,
    @Json(name = "discipline_duties") val disciplineDuties: Int = 0,
    @Json(name = "wing_duties") val wingDuties: Int = 0,
    @Json(name = "exam_duties") val examDuties: Int = 0
)

@JsonClass(generateAdapter = true)
data class DutyCreateRequestDto(
    @Json(name = "title") val title: String,
    @Json(name = "duty_type") val dutyType: String = "DISCIPLINE_DUTY",
    @Json(name = "duty_date") val dutyDate: String,
    @Json(name = "start_time") val startTime: String,
    @Json(name = "end_time") val endTime: String,
    @Json(name = "area_name") val areaName: String? = null,
    @Json(name = "break_name") val breakName: String? = null,
    @Json(name = "required_teachers") val requiredTeachers: Int = 1,
    @Json(name = "instructions") val instructions: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null
)

@JsonClass(generateAdapter = true)
data class DutyOverrideRequestDto(
    @Json(name = "new_teacher_id") val newTeacherId: Int,
    @Json(name = "reason") val reason: String
)

@JsonClass(generateAdapter = true)
data class DutyReplaceRequestDto(
    @Json(name = "reason") val reason: String? = null
)

@JsonClass(generateAdapter = true)
data class DutyAssignRequestDto(
    @Json(name = "teacher_id") val teacherId: Int,
    @Json(name = "reason") val reason: String? = null
)

@JsonClass(generateAdapter = true)
data class DutyLockRequestDto(
    @Json(name = "reason") val reason: String? = null
)

// ---------- Governance / Public Config DTOs ----------

@JsonClass(generateAdapter = true)
data class PeriodEntryDto(
    @Json(name = "period_number") val periodNumber: Int,
    @Json(name = "start_time") val startTime: String,
    @Json(name = "end_time") val endTime: String,
    @Json(name = "label") val label: String
)

@JsonClass(generateAdapter = true)
data class PublicGovernanceConfigDto(
    @Json(name = "period_schedule") val periodSchedule: List<PeriodEntryDto> = emptyList(),
    @Json(name = "suggestion_lead_time_minutes") val suggestionLeadTimeMinutes: Int = 15,
    @Json(name = "suggestion_start_window_minutes") val suggestionStartWindowMinutes: Int = 15,
    @Json(name = "suggestion_expiration_window_minutes") val suggestionExpirationWindowMinutes: Int = 15,
    @Json(name = "current_period_tolerance_minutes") val currentPeriodToleranceMinutes: Int = 0,
    @Json(name = "student_attendance_submission_window_minutes") val studentAttendanceSubmissionWindowMinutes: Int = 15,
    @Json(name = "periods_per_day") val periodsPerDay: Int = 5,
    @Json(name = "day_order_max") val dayOrderMax: Int = 6,
    @Json(name = "leave_same_day_apply_cutoff_time") val leaveSameDayApplyCutoffTime: String = "09:00"
)
