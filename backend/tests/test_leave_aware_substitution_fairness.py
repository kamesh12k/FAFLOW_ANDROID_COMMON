"""
Unit & Integration Tests for Leave-Aware Substitution Fairness / Workload Rebalancing.
"""
from datetime import date, timedelta, datetime, timezone
import pytest
from fastapi import HTTPException

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.services.substitution_service import (
    calculate_leave_recovery,
    _calculate_leave_duration_bonus,
    _calculate_leave_recency_factor,
    LEAVE_RECOVERY_LOOKBACK_DAYS,
    MAX_LEAVE_RECOVERY_BONUS,
    score_candidate,
    list_eligible_candidates,
    get_ranked_recommendations,
)
from app.services import teacher_substitution_service
from tests.conftest import (
    _make_user,
    create_department,
    create_subject,
    create_class,
    create_leave_request,
    create_timetable_slot,
)


class TestLeaveAwareFairness:
    """Test suite verifying leave recovery scoring, duration merging, recency decay, and safety dominance."""

    def test_1_no_leave(self, db_session):
        """Test 1: Teacher with no approved leave receives 0.0 leave recovery."""
        teacher = _make_user(db_session, name="T NoLeave", email="noleave@test.com", role=Role.teacher, department="CS")
        requester = _make_user(db_session, name="T Req1", email="req1@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert bonus == 0.0
        assert reason is None
        assert dur == 0
        assert days_ago == 0

        req_leave = create_leave_request(db_session, teacher_id=requester.id, the_date=target_date, period_number=1)
        res = score_candidate(db_session, teacher, req_leave, None, None)
        assert res.leave_recovery == 0.0
        assert res.leave_recovery_reason is None

    def test_2_short_leave(self, db_session):
        """Test 2: 1-day completed leave gives a small graduated bonus (duration bonus = +1)."""
        teacher = _make_user(db_session, name="T ShortLeave", email="shortleave@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # 1 day leave completed yesterday (Aug 18)
        create_leave_request(
            db_session, teacher_id=teacher.id, the_date=date(2026, 8, 18), period_number=1, status=LeaveStatus.approved
        )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert dur == 1
        assert days_ago == 1
        # Duration bonus: 1.0, Recency: 1.0 -> 1.0
        assert bonus == 1.0
        assert "Returned from 1-day approved leave (1d ago)" in reason

    def test_3_medium_leave(self, db_session):
        """Test 3: 5-day completed leave gives moderate bonus (+3 duration baseline)."""
        teacher = _make_user(db_session, name="T MedLeave", email="medleave@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # Aug 10 to Aug 14 (5 consecutive days, ended Aug 14, which is 5 days ago)
        for d in range(10, 15):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert dur == 5
        assert days_ago == 5
        # Duration bonus: 3.0. Recency for 5 days ago: 1.0 - (4/30) = 0.8667 -> 3.0 * 0.8667 = 2.6
        assert bonus == 2.6
        assert "Returned from 5-day approved leave (5d ago)" in reason

    def test_4_long_leave(self, db_session):
        """Test 4: 10-day completed leave gives high/maximum baseline bonus (+7)."""
        teacher = _make_user(db_session, name="T LongLeave", email="longleave@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # Aug 08 to Aug 17 (10 consecutive days, ended Aug 17 -> 2 days ago)
        for d in range(8, 18):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert dur == 10
        assert days_ago == 2
        # Duration bonus: 7.0. Recency for 2 days ago: 1.0 - (1/30) = 0.9667 -> 7.0 * 0.9667 = 6.8
        assert bonus == 6.8
        assert "Returned from 10-day approved leave (2d ago)" in reason

    def test_5_very_long_leave_capped(self, db_session):
        """Test 5: 30-day completed leave gives bonus capped at +7.0."""
        teacher = _make_user(db_session, name="T VeryLong", email="verylong@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # July 19 to Aug 17 (30 consecutive days, ended Aug 17 -> 2 days ago)
        start_dt = date(2026, 7, 19)
        for i in range(30):
            cur = start_dt + timedelta(days=i)
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=cur, period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert dur == 30
        assert bonus <= MAX_LEAVE_RECOVERY_BONUS
        assert bonus == 6.8  # 7.0 * (1 - 1/30) = 6.8

    def test_6_old_leave_beyond_lookback(self, db_session):
        """Test 6: 10-day leave completed 6 months ago gives 0.0 bonus (outside lookback window)."""
        teacher = _make_user(db_session, name="T OldLeave", email="oldleave@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # Feb 01 to Feb 10, 2026 (ended ~190 days ago)
        for d in range(1, 11):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 2, d), period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert bonus == 0.0
        assert reason is None

    def test_7_future_leave_gives_no_bonus(self, db_session):
        """Test 7: 10-day future leave gives 0.0 bonus (must be completed prior to substitution date)."""
        teacher = _make_user(db_session, name="T FutureLeave", email="futureleave@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # Aug 20 to Aug 29 (future)
        for d in range(20, 30):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert bonus == 0.0
        assert reason is None

    def test_8_current_leave_is_hard_ineligible(self, db_session):
        """Test 8: Teacher on approved leave on substitution date is hard ineligible."""
        teacher = _make_user(db_session, name="T OnLeaveToday", email="onleavetoday@test.com", role=Role.teacher, department="CS")
        requester = _make_user(db_session, name="T Req8", email="req8@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)
        # Previous leave Aug 01-10
        for d in range(1, 11):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )
        # ALSO on leave today for period 2
        create_leave_request(
            db_session, teacher_id=teacher.id, the_date=target_date, period_number=2, status=LeaveStatus.approved
        )

        other_req = create_leave_request(
            db_session, teacher_id=requester.id, the_date=target_date, period_number=2, status=LeaveStatus.approved
        )
        eligible = list_eligible_candidates(db_session, other_req)
        assert teacher not in eligible

    def test_9_leave_recovery_combines_with_fairness(self, db_session):
        """Test 9: Teacher A with 10-day completed leave outranks Teacher B with equal availability."""
        teacher_a = _make_user(db_session, name="T Returned A", email="returned_a@test.com", role=Role.teacher, department="CS")
        teacher_b = _make_user(db_session, name="T Working B", email="working_b@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)

        subj = create_subject(db_session, code="CS109", name="CS Basics")
        cls_a = create_class(db_session, name="CS-1A", section="A")
        cls_b = create_class(db_session, name="CS-1B", section="B")

        # Both have 1 class on period 1 so baseline daily score is 28.0 (2 projected periods)
        create_timetable_slot(db_session, teacher_id=teacher_a.id, subject_id=subj.id, class_id=cls_a.id, day_order=1, period_number=1)
        create_timetable_slot(db_session, teacher_id=teacher_b.id, subject_id=subj.id, class_id=cls_b.id, day_order=1, period_number=1)


        # Teacher A returned from 10-day leave on Aug 18 (ended Aug 17 -> 2 days ago)
        for d in range(8, 18):
            create_leave_request(
                db_session, teacher_id=teacher_a.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        requester = _make_user(db_session, name="T Requester", email="requester@test.com", role=Role.teacher, department="CS")
        leave = create_leave_request(
            db_session, teacher_id=requester.id, the_date=target_date, day_order=1, period_number=3, status=LeaveStatus.approved
        )

        res_a = score_candidate(db_session, teacher_a, leave, None, "CS")
        res_b = score_candidate(db_session, teacher_b, leave, None, "CS")

        assert res_a.leave_recovery > 0
        assert res_b.leave_recovery == 0.0
        assert res_a.score > res_b.score


    def test_10_workload_safety_dominates_leave_recovery(self, db_session):
        """Test 10: Teacher A has +7 leave bonus but heavy workload/fatigue; Teacher B with light workload wins."""
        teacher_a = _make_user(db_session, name="T Fatigued A", email="fatigued_a@test.com", role=Role.teacher, department="CS")
        teacher_b = _make_user(db_session, name="T Fresh B", email="fresh_b@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 19)

        # Teacher A has 10-day recent leave (Aug 8-17)
        for d in range(8, 18):
            create_leave_request(
                db_session, teacher_id=teacher_a.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        subj = create_subject(db_session, code="CS500", name="Advanced CS")
        cls_obj = create_class(db_session, name="CS-A", section="A")

        # BUT Teacher A has heavy timetable on Day Order 1 (periods 1, 2, 3, 4)
        for p in [1, 2, 3, 4]:
            create_timetable_slot(
                db_session, teacher_id=teacher_a.id, subject_id=subj.id, class_id=cls_obj.id, day_order=1, period_number=p
            )

        # Leave to cover is period 5 (would create 5 consecutive periods and 5 total daily periods for Teacher A)
        requester = _make_user(db_session, name="T Req2", email="req2@test.com", role=Role.teacher, department="CS")
        leave = create_leave_request(
            db_session, teacher_id=requester.id, the_date=target_date, day_order=1, period_number=5, status=LeaveStatus.approved
        )

        res_a = score_candidate(db_session, teacher_a, leave, None, "CS")
        res_b = score_candidate(db_session, teacher_b, leave, None, "CS")

        # Teacher B has 0 periods today, so daily + consecutive safety = 35 + 35 = 70.
        # Teacher A has 4 periods -> projected 5 consecutive -> consecutive score = 0, daily score = 7.
        # Even with +6.8 leave recovery, Teacher A score is far below Teacher B.
        assert res_b.score > res_a.score

    def test_11_contiguous_leave_records_merged(self, db_session):
        """Test 11: Contiguous separate leave records (Aug 1-5 & Aug 6-10) merge into one continuous 10-day leave."""
        teacher = _make_user(db_session, name="T Contiguous", email="contiguous@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 12)

        # Record 1: Aug 01 - Aug 05
        for d in range(1, 6):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )
        # Record 2: Aug 06 - Aug 10
        for d in range(6, 11):
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        assert dur == 10
        assert days_ago == 2
        assert "Returned from 10-day approved leave" in reason

    def test_12_overlapping_leave_records_deduplicated(self, db_session):
        """Test 12: Overlapping leave requests on same calendar dates are merged without double counting."""
        teacher = _make_user(db_session, name="T Overlap", email="overlap@test.com", role=Role.teacher, department="CS")
        target_date = date(2026, 8, 15)

        # Multiple period leaves for Aug 10, 11, 12 (3 calendar days)
        for d in [10, 11, 12]:
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=1, status=LeaveStatus.approved
            )
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=2, status=LeaveStatus.approved
            )
            create_leave_request(
                db_session, teacher_id=teacher.id, the_date=date(2026, 8, d), period_number=3, status=LeaveStatus.approved
            )

        bonus, reason, dur, days_ago = calculate_leave_recovery(db_session, teacher.id, target_date)
        # 3 calendar days (Aug 10, 11, 12), not 9
        assert dur == 3
        assert days_ago == 3
        assert "Returned from 3-day approved leave" in reason



