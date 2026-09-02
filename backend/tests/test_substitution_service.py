"""Tests for app.services.substitution_service."""
import pytest
from datetime import datetime, timedelta, timezone, date
from fastapi import HTTPException

from app.services.substitution_service import (
    get_mode, set_mode, get_emergency_window_hours,
    get_or_create_preferences, update_preferences,
    count_recent_substitutions, fairness_score,
    list_eligible_candidates, score_candidate,
    get_ranked_recommendations, create_assignment,
    auto_process_approved_leave, mark_emergency_if_applicable,
)
from app.models.system_setting import SystemSetting
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.credit import TeacherCredit
from tests.conftest import (
    _make_user, create_department, create_subject, create_class,
    create_timetable_slot, create_calendar_day, create_leave_request,
    create_teacher_credit,
)
from app.models.day_order_calendar import DayType


class TestMode:
    def test_get_default(self, db_session):
        assert get_mode(db_session) == "manual"


    def test_set_and_get(self, db_session, test_super_admin):
        set_mode(db_session, "autonomous", test_super_admin)
        assert get_mode(db_session) == "autonomous"

    def test_invalid_mode(self, db_session, test_super_admin):
        with pytest.raises(HTTPException):
            set_mode(db_session, "invalid", test_super_admin)


class TestEmergencyWindow:
    def test_default(self, db_session):
        assert get_emergency_window_hours(db_session) == 2

    def test_custom(self, db_session):
        db_session.add(SystemSetting(key="emergency_window_hours", value="5"))
        db_session.commit()
        assert get_emergency_window_hours(db_session) == 5


class TestPreferences:
    def test_get_or_create(self, db_session, test_teacher):
        pref = get_or_create_preferences(db_session, test_teacher.id)
        assert pref.accept_auto_assignments is True

    def test_update(self, db_session, test_teacher):
        pref = update_preferences(db_session, test_teacher.id, accept_auto_assignments=False)
        assert pref.accept_auto_assignments is False


class TestFairness:
    def test_no_assignments(self, db_session, test_teacher):
        assert fairness_score(db_session, test_teacher.id) == 100.0


class TestEligibility:
    def _setup_leave(self, db_session):
        teacher = _make_user(db_session, email="leaver@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(
            db_session, teacher.id, date(2026, 7, 1),
            day_order=1, period_number=1, status=LeaveStatus.approved,
        )
        return teacher, leave

    def test_excludes_self(self, db_session):
        teacher, leave = self._setup_leave(db_session)
        eligible = list_eligible_candidates(db_session, leave)
        assert teacher.id not in [t.id for t in eligible]

    def test_includes_free_teacher(self, db_session):
        _, leave = self._setup_leave(db_session)
        free = _make_user(db_session, email="free@test.com")
        eligible = list_eligible_candidates(db_session, leave)
        assert free.id in [t.id for t in eligible]

    def test_excludes_busy_teacher(self, db_session):
        _, leave = self._setup_leave(db_session)
        busy = _make_user(db_session, email="busy@test.com")
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, busy.id, subj.id, cls.id, day_order=1, period_number=1)
        eligible = list_eligible_candidates(db_session, leave)
        assert busy.id not in [t.id for t in eligible]

    def test_excludes_already_subbed_today_in_auto_mode(self, db_session):
        leaver, leave = self._setup_leave(db_session)
        substitute = _make_user(db_session, email="substitute@test.com")
        
        other_leave = create_leave_request(
            db_session, leaver.id, date(2026, 7, 1),
            day_order=1, period_number=2, status=LeaveStatus.approved
        )
        create_assignment(db_session, other_leave, substitute, AssignmentType.auto_assigned, 100.0, None)
        
        eligible_manual = list_eligible_candidates(db_session, leave, require_auto_opt_in=False)
        assert substitute.id in [t.id for t in eligible_manual]
        
        eligible_auto = list_eligible_candidates(db_session, leave, require_auto_opt_in=True)
        assert substitute.id not in [t.id for t in eligible_auto]


class TestMarkEmergency:
    def test_same_day_is_emergency(self, db_session):
        leave = LeaveRequest(
            teacher_id=1, date=datetime.now(timezone.utc).date(),
            day_order=1, period_number=1, reason="test",
            status=LeaveStatus.pending,
        )
        mark_emergency_if_applicable(db_session, leave)
        assert leave.is_emergency is True

    def test_far_future_not_emergency(self, db_session):
        leave = LeaveRequest(
            teacher_id=1, date=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
            day_order=1, period_number=1, reason="test",
            status=LeaveStatus.pending,
        )
        mark_emergency_if_applicable(db_session, leave)
        assert leave.is_emergency is False


class TestScoring:
    def _setup_leave_and_candidate(self, db_session):
        from app.models.subject import Subject
        from app.models.department import Department
        from app.models.class_ import Class
        
        dept_cs = create_department(db_session, name="CS", code="CS")
        dept_it = create_department(db_session, name="IT", code="IT")
        
        # Leaver
        leaver = _make_user(db_session, email="leaver@test.com", department="CS")
        
        # Candidate
        candidate = _make_user(db_session, email="candidate@test.com", department="CS")
        
        leave = LeaveRequest(
            teacher_id=leaver.id,
            date=date(2026, 7, 1),
            day_order=1,
            period_number=1,
            status=LeaveStatus.approved,
        )
        return candidate, leave, dept_cs, dept_it

    def test_zero_workload_scores_100(self, db_session):
        candidate, leave, _, _ = self._setup_leave_and_candidate(db_session)
        res = score_candidate(db_session, candidate, leave, None, None)
        assert res.score == 100.0
        assert res.today_workload == 0
        assert res.projected_today_workload == 1
        assert res.week_workload == 0
        assert res.projected_week_workload == 1
        assert "0 substitutions this week" in res.reasons

    def test_five_periods_today_scores_heavy_penalty(self, db_session):
        candidate, leave, dept, _ = self._setup_leave_and_candidate(db_session)
        
        # Create 5 periods today
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        for p in range(1, 6):
            create_timetable_slot(db_session, candidate.id, subj.id, cls.id, day_order=1, period_number=p)
            
        res = score_candidate(db_session, candidate, leave, None, None)
        assert res.today_workload == 5
        assert res.week_workload == 5
        # Today score is 0, continuous score is 0 (>=5 continuous periods), weekly score is reduced
        assert res.score < 35.0

    def test_preference_toggles_no_effect(self, db_session):
        candidate, leave, _, _ = self._setup_leave_and_candidate(db_session)
        
        # Turn on preferences
        pref = get_or_create_preferences(db_session, candidate.id)
        update_preferences(
            db_session, candidate.id,
            prefer_morning_classes=True,
            prefer_same_department=True
        )
        
        # Compute score
        res = score_candidate(db_session, candidate, leave, None, None)
        # Should still be 100 because preferences don't add arbitrary bonuses
        assert res.score == 100.0

    def test_consecutive_block_penalty_vs_distributed(self, db_session):
        """Test 3 & 4: Teacher with contiguous block (P1, P2, P3) proposed P4 vs Teacher with distributed workload (P1, P2, P4, P5)"""
        dept = create_department(db_session, name="CS_DEPT", code="CSD")
        subj = create_subject(db_session, department_id=dept.id)
        cls_a = create_class(db_session, name="CS-A", section="A", department_id=dept.id)
        cls_b = create_class(db_session, name="CS-B", section="B", department_id=dept.id)
        
        leaver = _make_user(db_session, email="leaver_block@test.com", department="CSD")
        # Leave for P4 on Day Order 1
        leave = LeaveRequest(
            teacher_id=leaver.id,
            date=date(2026, 7, 1),
            day_order=1,
            period_number=4,
            status=LeaveStatus.approved,
        )
        
        # Teacher A: Distributed workload (P1, P2, P5) -> 3 periods, longest block 2. After P4: longest block is 2 (P1,P2) and (P4,P5)
        teacher_a = _make_user(db_session, email="teacher_a@test.com", department="CSD")
        create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=1, period_number=2)
        create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=1, period_number=5)
        
        # Teacher B: Contiguous block (P1, P2, P3) -> 3 periods, longest block 3. After P4: longest block is 4 (P1,P2,P3,P4)!
        teacher_b = _make_user(db_session, email="teacher_b@test.com", department="CSD")
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=1, period_number=2)
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=1, period_number=3)
        
        res_a = score_candidate(db_session, teacher_a, leave, None, None)
        res_b = score_candidate(db_session, teacher_b, leave, None, None)
        
        # Both have 3 periods before, 4 after, but Teacher A's longest continuous block is 2, while Teacher B's is 4!
        assert res_a.projected_longest_continuous_periods == 2
        assert res_b.projected_longest_continuous_periods == 4
        assert res_a.score > res_b.score
        assert any("back-to-back" in r for r in res_b.reasons)

    def test_weekly_workload_ranking(self, db_session):
        """Test 5: Teacher A (11->12) vs Teacher B (18->19) with identical daily workload"""
        dept = create_department(db_session, name="CS_DEPT2", code="CSD2")
        subj = create_subject(db_session, department_id=dept.id)
        cls_a = create_class(db_session, name="CS-WKA", section="A", department_id=dept.id)
        cls_b = create_class(db_session, name="CS-WKB", section="B", department_id=dept.id)
        
        leaver = _make_user(db_session, email="leaver_wk@test.com", department="CSD2")
        leave = LeaveRequest(
            teacher_id=leaver.id,
            date=date(2026, 7, 1),
            day_order=1,
            period_number=1,
            status=LeaveStatus.approved,
        )
        
        # Teacher A: 11 periods on other day orders
        teacher_a = _make_user(db_session, email="teacher_wk_a@test.com", department="CSD2")
        for p in range(1, 6):
            create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=2, period_number=p)
            create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=3, period_number=p)
        create_timetable_slot(db_session, teacher_a.id, subj.id, cls_a.id, day_order=4, period_number=1)  # 11 total
        
        # Teacher B: 18 periods on other day orders
        teacher_b = _make_user(db_session, email="teacher_wk_b@test.com", department="CSD2")
        for do in range(2, 5):
            for p in range(1, 6):
                create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=do, period_number=p)  # 15
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=5, period_number=1)
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=5, period_number=2)
        create_timetable_slot(db_session, teacher_b.id, subj.id, cls_b.id, day_order=5, period_number=3)  # 18 total
        
        res_a = score_candidate(db_session, teacher_a, leave, None, None)
        res_b = score_candidate(db_session, teacher_b, leave, None, None)
        
        assert res_a.week_workload == 11
        assert res_b.week_workload == 18
        assert res_a.score > res_b.score

    def test_fairness_ranking(self, db_session):
        """Test 6: Teacher A (0 subs this week) vs Teacher B (4 subs this week)"""
        dept = create_department(db_session, name="CS_DEPT3", code="CSD3")
        leaver = _make_user(db_session, email="leaver_fair@test.com", department="CSD3")
        leave = LeaveRequest(
            teacher_id=leaver.id,
            date=date(2026, 7, 1),
            day_order=1,
            period_number=1,
            status=LeaveStatus.approved,
        )
        
        teacher_a = _make_user(db_session, email="teacher_fair_a@test.com", department="CSD3")
        teacher_b = _make_user(db_session, email="teacher_fair_b@test.com", department="CSD3")
        
        # Assign 4 substitutions to Teacher B in the 7-day window prior to leave.date
        for i in range(1, 5):
            other_leave = LeaveRequest(
                teacher_id=leaver.id,
                date=date(2026, 6, 26) + timedelta(days=i),
                day_order=i,
                period_number=2,
                status=LeaveStatus.approved,
                reason="Sub",
            )
            db_session.add(other_leave)
            db_session.flush()
            create_assignment(db_session, other_leave, teacher_b, AssignmentType.admin_assigned, 100.0, None)
        
        res_a = score_candidate(db_session, teacher_a, leave, None, None)
        res_b = score_candidate(db_session, teacher_b, leave, None, None)
        
        assert res_a.substitutions_week == 0
        assert res_b.substitutions_week == 4
        assert res_a.score > res_b.score


class TestCampusModeOverride:
    def test_department_distinct_modes(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, get_mode
        dept1 = create_department(db_session, name="Dept 1", code="D1")
        dept2 = create_department(db_session, name="Dept 2", code="D2")
        
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept1.id)
        set_mode(db_session, "manual", test_super_admin, tenant_department_id=dept2.id)
        
        assert get_mode(db_session, tenant_department_id=dept1.id) == "autonomous"
        assert get_mode(db_session, tenant_department_id=dept2.id) == "manual"
        assert get_mode(db_session, tenant_department_id=9999) == "manual"

    def test_global_override_precedence(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, get_mode, set_global_override
        dept1 = create_department(db_session, name="Dept 1", code="D1")
        dept2 = create_department(db_session, name="Dept 2", code="D2")
        
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept1.id)
        assert get_mode(db_session, tenant_department_id=dept1.id) == "autonomous"
        
        set_global_override(db_session, "manual", test_super_admin)
        assert get_mode(db_session, tenant_department_id=dept1.id) == "manual"
        assert get_mode(db_session, tenant_department_id=dept2.id) == "manual"
        
        set_global_override(db_session, "none", test_super_admin)
        assert get_mode(db_session, tenant_department_id=dept1.id) == "autonomous"
        assert get_mode(db_session, tenant_department_id=dept2.id) == "manual"


class TestDryRunSimulation:
    def test_simulation_assigns_mock_candidate(self, db_session, test_super_admin):
        from app.services.substitution_service import run_dry_run_simulation
        from tests.conftest import create_leave_request, _make_user, create_department
        from app.models.leave import LeaveStatus
        
        dept = create_department(db_session, name="Dept 1", code="D1")
        teacher1 = _make_user(db_session, name="teacher1", email="teacher1@test.com", username="teacher1", role="teacher")
        teacher1.department_id = dept.id
        substitute = _make_user(db_session, name="sub1", email="sub1@test.com", username="sub1", role="teacher")
        substitute.department_id = dept.id
        db_session.commit()
        
        leave = create_leave_request(db_session, teacher1.id, the_date=date(2026, 7, 20), day_order=1, period_number=1, status=LeaveStatus.approved, reason="Sick")
        db_session.commit()
        
        res = run_dry_run_simulation(db_session, date(2026, 7, 20), date(2026, 7, 20), dept.id)
        assert res["leaves_processed"] == 1
        assert res["simulated_successful_assignments"] == 1
        assert res["simulated_failed_assignments"] == 0
        assert res["estimated_credit_transactions"] == 1
        assert res["simulated_assignments"][0]["substitute_teacher_name"] == "sub1"
        assert res["simulated_assignments"][0]["status"] == "success"

    def test_simulation_respects_weekly_cap(self, db_session, test_super_admin):
        from app.services.substitution_service import run_dry_run_simulation, update_preferences
        from tests.conftest import create_leave_request, _make_user, create_department
        from app.models.leave import LeaveStatus
        
        dept = create_department(db_session, name="Dept 1", code="D1")
        teacher = _make_user(db_session, name="teacher1", email="teacher2@test.com", username="teacher1", role="teacher")
        teacher.department_id = dept.id
        substitute = _make_user(db_session, name="sub1", email="sub2@test.com", username="sub1", role="teacher")
        substitute.department_id = dept.id
        db_session.commit()
        
        update_preferences(db_session, substitute.id, max_weekly_substitutions=1)
        db_session.commit()
        
        leave1 = create_leave_request(db_session, teacher.id, the_date=date(2026, 7, 20), day_order=1, period_number=1, status=LeaveStatus.approved, reason="Sick")
        leave2 = create_leave_request(db_session, teacher.id, the_date=date(2026, 7, 21), day_order=1, period_number=1, status=LeaveStatus.approved, reason="Sick")
        db_session.commit()
        
        res = run_dry_run_simulation(db_session, date(2026, 7, 20), date(2026, 7, 21), dept.id)
        assert res["leaves_processed"] == 2
        assert res["simulated_successful_assignments"] == 1
        assert res["simulated_failed_assignments"] == 1
        assert res["simulated_assignments"][0]["status"] == "success"
        assert res["simulated_assignments"][1]["status"] == "failed"
        assert res["simulated_assignments"][1]["reason"] == "No eligible candidates"


class TestAutonomousSafety:
    def test_autonomous_skips_unsafe_heavy_candidate(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, auto_process_approved_leave
        dept = create_department(db_session, name="Dept Safety", code="DS")
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept.id)
        
        leaver = _make_user(db_session, email="leaver_safe@test.com", role="teacher", department="DS")
        candidate = _make_user(db_session, email="cand_unsafe@test.com", role="teacher", department="DS")
        
        # Candidate already teaches 4 consecutive periods (P1, P2, P3, P4)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        for p in range(1, 5):
            create_timetable_slot(db_session, candidate.id, subj.id, cls.id, day_order=1, period_number=p)
            
        # Leave is for P5 on Day Order 1 -> assigning would result in 5 continuous periods and 5 daily periods (unsafe!)
        leave = create_leave_request(
            db_session, leaver.id, the_date=date(2026, 7, 20),
            day_order=1, period_number=5, status=LeaveStatus.approved, reason="Emergency",
        )
        
        # Auto-process should decline auto-assignment because candidate exceeds continuous threshold (>=5)
        assignment = auto_process_approved_leave(db_session, leave)
        assert assignment is None


class TestAutonomousDepartmentBoundary:
    def test_auto_substitution_same_department_only_when_cross_disabled(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, auto_process_approved_leave
        from app.services.system_setting_service import set_setting

        dept_a = create_department(db_session, name="Dept A", code="DA")
        dept_b = create_department(db_session, name="Dept B", code="DB")
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept_a.id)
        set_setting(db_session, "cross_department_substitutions_enabled", "false", department_id=dept_a.id)

        leaver = _make_user(db_session, email="leaver_da@test.com", role="teacher", department="DA")
        same_dept_teacher = _make_user(db_session, email="same_da@test.com", role="teacher", department="DA")
        _make_user(db_session, email="other_db@test.com", role="teacher", department="DB")

        leave = create_leave_request(
            db_session, leaver.id, the_date=date(2026, 7, 20),
            day_order=1, period_number=1, status=LeaveStatus.approved, reason="Medical",
        )

        assignment = auto_process_approved_leave(db_session, leave)
        assert assignment is not None
        assert assignment.substitute_teacher_id == same_dept_teacher.id

    def test_auto_substitution_excludes_other_dept_when_cross_disabled(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, auto_process_approved_leave
        from app.services.system_setting_service import set_setting

        dept_a = create_department(db_session, name="Dept A2", code="DA2")
        dept_b = create_department(db_session, name="Dept B2", code="DB2")
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept_a.id)
        set_setting(db_session, "cross_department_substitutions_enabled", "false", department_id=dept_a.id)

        leaver = _make_user(db_session, email="leaver_da2@test.com", role="teacher", department="DA2")
        _make_user(db_session, email="other_db2@test.com", role="teacher", department="DB2")

        leave = create_leave_request(
            db_session, leaver.id, the_date=date(2026, 7, 20),
            day_order=1, period_number=1, status=LeaveStatus.approved, reason="Medical",
        )

        assignment = auto_process_approved_leave(db_session, leave)
        assert assignment is None

    def test_auto_substitution_allows_other_dept_when_cross_enabled(self, db_session, test_super_admin):
        from app.services.substitution_service import set_mode, auto_process_approved_leave
        from app.services.system_setting_service import set_setting

        dept_a = create_department(db_session, name="Dept A3", code="DA3")
        dept_b = create_department(db_session, name="Dept B3", code="DB3")
        set_mode(db_session, "autonomous", test_super_admin, tenant_department_id=dept_a.id)
        set_setting(db_session, "cross_department_substitutions_enabled", "true", department_id=dept_a.id)

        leaver = _make_user(db_session, email="leaver_da3@test.com", role="teacher", department="DA3")
        other_dept_teacher = _make_user(db_session, email="other_db3@test.com", role="teacher", department="DB3")

        leave = create_leave_request(
            db_session, leaver.id, the_date=date(2026, 7, 20),
            day_order=1, period_number=1, status=LeaveStatus.approved, reason="Medical",
        )

        assignment = auto_process_approved_leave(db_session, leave)
        assert assignment is not None
        assert assignment.substitute_teacher_id == other_dept_teacher.id


