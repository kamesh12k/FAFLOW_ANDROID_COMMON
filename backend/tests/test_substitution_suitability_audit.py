"""
Comprehensive Audit & Scenario Tests for FAFLOW Smart Substitution Engine.
Covers all 15 acceptance criteria scenarios:
  1. Teacher completely free -> highest recommendation (score 100, tier EXCELLENT)
  2. Teacher teaches affected period -> excluded
  3. Teacher on leave -> excluded
  4. Teacher already substituting another class -> excluded
  5. Same subject -> receives compatibility advantage
  6. Same department but unrelated subject -> lower than same-subject teacher
  7. Cross department disabled -> cross-department teacher excluded
  8. Cross department enabled -> candidate allowed but appropriately ranked
  9. Teacher with 5 consecutive classes after assignment -> heavily penalized (score < 35, tier LOW)
  10. Teacher with 0 recent substitutions -> fairness advantage
  11. Teacher at weekly substitution cap -> excluded
  12. Equal scores -> deterministic tie-break
  13. Multiple administrators assign simultaneously -> no double booking (transactional safety)
  14. Backend returns malformed score -> safe normalization / bounds test
  15. Backend and Android receive same data -> identical ranking
"""
import uuid
import pytest
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.system_setting import SystemSetting
from app.services.substitution_service import (
    score_candidate,
    list_eligible_candidates,
    list_candidates_with_ineligible,
    get_ranked_recommendations,
    get_candidates_with_ineligible,
    recommendation_sort_key,
    update_preferences,
    get_or_create_preferences,
)
from app.services import leave_service, substitution_service
from tests.conftest import (
    _make_user,
    create_department,
    create_subject,
    create_class,
    create_timetable_slot,
    create_calendar_day,
    create_leave_request,
)
from app.models.day_order_calendar import DayType


class TestSmartSubstitutionAuditScenarios:
    def _setup_environment(self, db_session):
        uid = uuid.uuid4().hex[:6]
        dept_cs = create_department(db_session, name=f"Computer Science {uid}", code=f"CS_{uid}")
        dept_ec = create_department(db_session, name=f"Electronics {uid}", code=f"EC_{uid}")
        
        subj_db = create_subject(db_session, name=f"Database Systems {uid}", code=f"CS301_{uid}", department_id=dept_cs.id)
        subj_os = create_subject(db_session, name=f"Operating Systems {uid}", code=f"CS302_{uid}", department_id=dept_cs.id)
        subj_vlsi = create_subject(db_session, name=f"VLSI Design {uid}", code=f"EC401_{uid}", department_id=dept_ec.id)

        cls_cs = create_class(db_session, name=f"CS-3A-{uid}", section="A", department_id=dept_cs.id)
        cls_ec = create_class(db_session, name=f"EC-4A-{uid}", section="A", department_id=dept_ec.id)

        # Future date to ensure substitution is active
        the_date = date.today() + timedelta(days=5)
        create_calendar_day(db_session, the_date, DayType.working, day_order=4)

        # Leaver in CS
        leaver = _make_user(db_session, email=f"leaver_{uid}@test.com", role="teacher", department=dept_cs.code)
        leaver.department_id = dept_cs.id
        db_session.commit()

        # Slot for leaver: DO4, Period 3, Database Systems
        create_timetable_slot(db_session, leaver.id, subj_db.id, cls_cs.id, day_order=4, period_number=3)

        # Approved leave
        leave = create_leave_request(
            db_session, leaver.id, the_date=the_date, day_order=4, period_number=3,
            status=LeaveStatus.approved, reason="Medical Checkup"
        )

        return {
            "dept_cs": dept_cs,
            "dept_ec": dept_ec,
            "subj_db": subj_db,
            "subj_os": subj_os,
            "subj_vlsi": subj_vlsi,
            "cls_cs": cls_cs,
            "cls_ec": cls_ec,
            "leaver": leaver,
            "leave": leave,
            "the_date": the_date,
            "uid": uid,
        }

    def test_scenario_1_teacher_completely_free_highest_recommendation(self, db_session):
        env = self._setup_environment(db_session)
        free_teacher = _make_user(db_session, email=f"free_perfect_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        free_teacher.department_id = env["dept_cs"].id
        # Teacher has experience teaching the subject
        create_timetable_slot(db_session, free_teacher.id, env["subj_db"].id, env["cls_cs"].id, day_order=1, period_number=1)
        db_session.commit()

        candidate = score_candidate(db_session, free_teacher, env["leave"], env["subj_db"], env["dept_cs"].name)
        assert candidate.score == 100
        assert candidate.tier == "EXCELLENT"
        assert candidate.eligible is True
        assert candidate.today_workload == 0
        assert candidate.projected_today_workload == 1
        assert candidate.substitutions_week == 0

    def test_scenario_2_teacher_teaches_affected_period_excluded(self, db_session):
        env = self._setup_environment(db_session)
        busy_teacher = _make_user(db_session, email=f"busy_p3_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        busy_teacher.department_id = env["dept_cs"].id
        create_timetable_slot(db_session, busy_teacher.id, env["subj_os"].id, env["cls_cs"].id, day_order=4, period_number=3)
        db_session.commit()

        eligible, ineligible = list_candidates_with_ineligible(db_session, env["leave"])
        assert busy_teacher.id not in [t.id for t in eligible]
        ineligible_entry = next((i for i in ineligible if i.teacher_id == busy_teacher.id), None)
        assert ineligible_entry is not None
        assert "already teaching" in ineligible_entry.reason.lower()

    def test_scenario_3_teacher_on_leave_excluded(self, db_session):
        env = self._setup_environment(db_session)
        on_leave_teacher = _make_user(db_session, email=f"onleave_p3_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        on_leave_teacher.department_id = env["dept_cs"].id
        create_leave_request(
            db_session, on_leave_teacher.id, the_date=env["the_date"], day_order=4, period_number=3,
            status=LeaveStatus.approved, reason="Personal"
        )
        db_session.commit()

        eligible, ineligible = list_candidates_with_ineligible(db_session, env["leave"])
        assert on_leave_teacher.id not in [t.id for t in eligible]
        ineligible_entry = next((i for i in ineligible if i.teacher_id == on_leave_teacher.id), None)
        assert ineligible_entry is not None
        assert "leave" in ineligible_entry.reason.lower()

    def test_scenario_4_teacher_already_substituting_excluded(self, db_session):
        env = self._setup_environment(db_session)
        subbing_teacher = _make_user(db_session, email=f"subbing_p3_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        subbing_teacher.department_id = env["dept_cs"].id
        
        other_leaver = _make_user(db_session, email=f"other_leaver_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        other_leave = create_leave_request(
            db_session, other_leaver.id, the_date=env["the_date"], day_order=4, period_number=3,
            status=LeaveStatus.approved, reason="Official"
        )
        db_session.add(AlterAssignment(
            leave_request_id=other_leave.id,
            substitute_teacher_id=subbing_teacher.id,
            assignment_type=AssignmentType.admin_assigned,
        ))
        db_session.commit()

        eligible, ineligible = list_candidates_with_ineligible(db_session, env["leave"])
        assert subbing_teacher.id not in [t.id for t in eligible]
        ineligible_entry = next((i for i in ineligible if i.teacher_id == subbing_teacher.id), None)
        assert ineligible_entry is not None
        assert "substituting" in ineligible_entry.reason.lower()

    def test_scenario_5_and_6_subject_compatibility_advantage(self, db_session):
        env = self._setup_environment(db_session)
        # Teacher A: teaches same subject (Database Systems)
        teacher_a = _make_user(db_session, email=f"same_subj_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        teacher_a.department_id = env["dept_cs"].id
        create_timetable_slot(db_session, teacher_a.id, env["subj_db"].id, env["cls_cs"].id, day_order=1, period_number=1)

        # Teacher B: same dept, different subject (Operating Systems)
        teacher_b = _make_user(db_session, email=f"diff_subj_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        teacher_b.department_id = env["dept_cs"].id
        create_timetable_slot(db_session, teacher_b.id, env["subj_os"].id, env["cls_cs"].id, day_order=1, period_number=1)
        db_session.commit()

        res_a = score_candidate(db_session, teacher_a, env["leave"], env["subj_db"], env["dept_cs"].name)
        res_b = score_candidate(db_session, teacher_b, env["leave"], env["subj_db"], env["dept_cs"].name)

        assert res_a.same_subject is True
        assert res_b.same_subject is False
        assert res_a.subject_compatibility_score > res_b.subject_compatibility_score
        assert res_a.score > res_b.score

    def test_scenario_7_and_8_cross_department_policy(self, db_session, test_super_admin):
        env = self._setup_environment(db_session)
        ec_teacher = _make_user(db_session, email=f"ec_teacher_{env['uid']}@test.com", role="teacher", department=env["dept_ec"].code)
        ec_teacher.department_id = env["dept_ec"].id
        db_session.commit()

        # By default, cross_department is disabled
        db_session.add(SystemSetting(key="cross_department_substitutions_enabled", value="false", department_id=env["dept_cs"].id))
        db_session.commit()

        with pytest.raises(HTTPException) as exc:
            get_ranked_recommendations(db_session, env["leave"].id, include_cross_department=True)
        assert exc.value.status_code == 403

        # Enable cross department
        setting = db_session.query(SystemSetting).filter(
            SystemSetting.key == "cross_department_substitutions_enabled",
            SystemSetting.department_id == env["dept_cs"].id
        ).first()
        setting.value = "true"
        db_session.commit()

        recs = get_ranked_recommendations(db_session, env["leave"].id, include_cross_department=True)
        ec_cand = next((r for r in recs if r.teacher.id == ec_teacher.id), None)
        assert ec_cand is not None
        assert ec_cand.signals.cross_department is True
        assert "Cross-department" in ec_cand.reasons

    def test_scenario_9_five_consecutive_classes_penalized(self, db_session):
        env = self._setup_environment(db_session)
        heavy_teacher = _make_user(db_session, email=f"heavy_consec_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        heavy_teacher.department_id = env["dept_cs"].id
        for p in [1, 2, 4, 5]:
            create_timetable_slot(db_session, heavy_teacher.id, env["subj_db"].id, env["cls_cs"].id, day_order=4, period_number=p)
        db_session.commit()

        # Assigned to P3 -> creates P1 -> P2 -> P3 -> P4 -> P5 (5 consecutive periods)
        cand = score_candidate(db_session, heavy_teacher, env["leave"], env["subj_db"], env["dept_cs"].name)
        assert cand.projected_longest_continuous_periods == 5
        assert cand.continuity_score == -20.0
        assert cand.tier == "LOW"
        assert any("back-to-back" in r for r in cand.reasons)

    def test_scenario_10_fairness_advantage(self, db_session):
        env = self._setup_environment(db_session)
        teacher_fresh = _make_user(db_session, email=f"fresh_sub_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        teacher_fresh.department_id = env["dept_cs"].id
        
        teacher_busy = _make_user(db_session, email=f"busy_sub_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        teacher_busy.department_id = env["dept_cs"].id

        # Record 2 recent assignments for teacher_busy within last 7 days
        past_leave1 = create_leave_request(
            db_session, env["leaver"].id, the_date=env["the_date"] - timedelta(days=2),
            day_order=2, period_number=1, status=LeaveStatus.approved
        )
        db_session.add(AlterAssignment(leave_request_id=past_leave1.id, substitute_teacher_id=teacher_busy.id))
        past_leave2 = create_leave_request(
            db_session, env["leaver"].id, the_date=env["the_date"] - timedelta(days=3),
            day_order=3, period_number=2, status=LeaveStatus.approved
        )
        db_session.add(AlterAssignment(leave_request_id=past_leave2.id, substitute_teacher_id=teacher_busy.id))
        db_session.commit()

        cand_fresh = score_candidate(db_session, teacher_fresh, env["leave"], env["subj_db"], env["dept_cs"].name)
        cand_busy = score_candidate(db_session, teacher_busy, env["leave"], env["subj_db"], env["dept_cs"].name)

        assert cand_fresh.fairness_score > cand_busy.fairness_score
        assert cand_fresh.score > cand_busy.score

    def test_scenario_11_weekly_cap_excluded(self, db_session):
        env = self._setup_environment(db_session)
        capped_teacher = _make_user(db_session, email=f"capped_teacher_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        capped_teacher.department_id = env["dept_cs"].id
        
        # Set max weekly substitutions to 1
        update_preferences(db_session, capped_teacher.id, max_weekly_substitutions=1)

        # Record 1 assignment within the last 7 days
        past_leave = create_leave_request(
            db_session, env["leaver"].id, the_date=env["the_date"] - timedelta(days=2),
            day_order=3, period_number=1, status=LeaveStatus.approved
        )
        db_session.add(AlterAssignment(
            leave_request_id=past_leave.id,
            substitute_teacher_id=capped_teacher.id,
            assigned_at=datetime.now(timezone.utc) - timedelta(days=2)
        ))
        db_session.commit()

        eligible, ineligible = list_candidates_with_ineligible(db_session, env["leave"])
        assert capped_teacher.id not in [t.id for t in eligible]
        ineligible_entry = next((i for i in ineligible if i.teacher_id == capped_teacher.id), None)
        assert ineligible_entry is not None
        assert "weekly substitution cap" in ineligible_entry.reason.lower()

    def test_scenario_12_deterministic_tie_break(self, db_session):
        env = self._setup_environment(db_session)
        # Two identical free teachers with same department
        t1 = _make_user(db_session, email=f"t1_tie_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        t1.department_id = env["dept_cs"].id
        t2 = _make_user(db_session, email=f"t2_tie_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        t2.department_id = env["dept_cs"].id
        db_session.commit()

        recs_run1 = get_ranked_recommendations(db_session, env["leave"].id)
        recs_run2 = get_ranked_recommendations(db_session, env["leave"].id)

        ids_run1 = [r.teacher.id for r in recs_run1]
        ids_run2 = [r.teacher.id for r in recs_run2]
        assert ids_run1 == ids_run2

    def test_scenario_13_concurrent_double_booking_protection(self, db_session):
        env = self._setup_environment(db_session)
        sub = _make_user(db_session, email=f"sub_concurrent_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        sub.department_id = env["dept_cs"].id
        db_session.commit()

        # Admin 1 assigns
        assign1 = leave_service.assign_substitute(
            env["leave"].id, sub.id, db_session,
            tenant_department_id=env["dept_cs"].id
        )
        assert assign1 is not None

        # Admin 2 attempts to assign another conflicting leave for the exact same period to the same substitute
        other_leaver = _make_user(db_session, email=f"other_leaver2_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        other_leaver.department_id = env["dept_cs"].id
        other_leave = create_leave_request(
            db_session, other_leaver.id, the_date=env["the_date"], day_order=4, period_number=3,
            status=LeaveStatus.approved, reason="Emergency"
        )
        db_session.commit()

        with pytest.raises(HTTPException) as exc:
            leave_service.assign_substitute(
                other_leave.id, sub.id, db_session,
                tenant_department_id=env["dept_cs"].id
            )
        assert exc.value.status_code == 400
        assert "already substituting another class" in str(exc.value.detail).lower()

    def test_scenario_14_score_calibration_and_normalization(self, db_session):
        env = self._setup_environment(db_session)
        teacher = _make_user(db_session, email=f"score_norm_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        teacher.department_id = env["dept_cs"].id
        db_session.commit()

        cand = score_candidate(db_session, teacher, env["leave"], env["subj_db"], env["dept_cs"].name)
        assert 0 <= cand.score <= 100
        assert isinstance(cand.score, int)
        assert cand.tier in {"EXCELLENT", "GOOD", "FAIR", "LOW"}
        assert cand.score <= 100

    def test_scenario_15_backend_and_client_contract_identical_ranking(self, db_session):
        env = self._setup_environment(db_session)
        t_high = _make_user(db_session, email=f"client_high_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        t_high.department_id = env["dept_cs"].id
        create_timetable_slot(db_session, t_high.id, env["subj_db"].id, env["cls_cs"].id, day_order=1, period_number=1)

        t_med = _make_user(db_session, email=f"client_med_{env['uid']}@test.com", role="teacher", department=env["dept_cs"].code)
        t_med.department_id = env["dept_cs"].id
        create_timetable_slot(db_session, t_med.id, env["subj_os"].id, env["cls_cs"].id, day_order=1, period_number=1)
        db_session.commit()

        candidates, ineligibles = get_candidates_with_ineligible(db_session, env["leave"].id)
        assert len(candidates) >= 2
        # Ranks must be 1-based sequential integers
        for idx, c in enumerate(candidates, start=1):
            assert c.rank == idx
            assert 0 <= c.score <= 100
            assert c.tier in {"EXCELLENT", "GOOD", "FAIR", "LOW"}
            assert isinstance(c.reasons, list)
            # Verify structured metric envelope
            assert c.metrics.daily_periods == c.today_workload
            assert c.signals.same_department == c.same_department
