import pytest
from datetime import date
from app.services import substitution_dashboard_service as service
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.day_order_calendar import CalendarDay, DayType
from tests.conftest import (
    create_department, create_subject, create_class, create_room,
    create_timetable_slot, _make_user,
)

def test_get_today_substitutions_empty(db_session):
    # Setup calendar day
    cal = CalendarDay(date=date(2026, 6, 12), day_type=DayType.working, day_order=1)
    db_session.add(cal)
    db_session.commit()

    res = service.get_today_substitutions(db_session, date(2026, 6, 12))
    assert res["date"] == "2026-06-12"
    assert res["day_order"] == "DO1"
    assert res["day_type"] == "working"
    assert res["summary"]["total_leaves"] == 0
    assert res["summary"]["total_substitutions"] == 0
    assert res["summary"]["unassigned_periods"] == 0
    assert res["summary"]["coverage_percentage"] == 100.0
    assert len(res["substitutions"]) == 0

def test_get_today_substitutions_with_data(db_session):
    # Setup metadata
    dept = create_department(db_session)
    cls = create_class(db_session, department_id=dept.id)
    room = create_room(db_session)
    subj = create_subject(db_session, department_id=dept.id)
    
    t1 = _make_user(db_session, email="t1@test.com")
    t2 = _make_user(db_session, email="t2@test.com")
    t3 = _make_user(db_session, email="t3@test.com")
    
    # Calendar
    cal = CalendarDay(date=date(2026, 6, 15), day_type=DayType.working, day_order=2)
    db_session.add(cal)
    
    # Timetable for original teachers
    slot1 = create_timetable_slot(db_session, t1.id, subj.id, cls.id, room_id=room.id, day_order=2, period_number=1)
    slot2 = create_timetable_slot(db_session, t2.id, subj.id, cls.id, room_id=room.id, day_order=2, period_number=2)
    
    # Leaves
    leave1 = LeaveRequest(
        teacher_id=t1.id, date=date(2026, 6, 15), day_order=2, period_number=1,
        status=LeaveStatus.approved, reason="Sick", is_emergency=False
    )
    leave2 = LeaveRequest(
        teacher_id=t2.id, date=date(2026, 6, 15), day_order=2, period_number=2,
        status=LeaveStatus.approved, reason="Casual", is_emergency=False
    )
    db_session.add_all([leave1, leave2])
    db_session.commit()
    
    # Assign t3 to leave1
    alter1 = AlterAssignment(
        leave_request_id=leave1.id, substitute_teacher_id=t3.id,
        assignment_type=AssignmentType.admin_assigned, compatibility_score=85.0
    )
    db_session.add(alter1)
    db_session.commit()
    
    res = service.get_today_substitutions(db_session, date(2026, 6, 15))
    
    assert res["summary"]["total_leaves"] == 2
    assert res["summary"]["total_substitutions"] == 1
    assert res["summary"]["unassigned_periods"] == 1
    assert res["summary"]["coverage_percentage"] == 50.0
    
    subs = res["substitutions"]
    assert len(subs) == 2
    
    # Check leave1 details
    sub1 = next(s for s in subs if s["leave_id"] == leave1.id)
    assert sub1["period_number"] == 1
    assert sub1["class_name"] == f"{cls.name} - {cls.section}"
    assert sub1["original_teacher"]["id"] == t1.id
    assert sub1["substitute_teacher"]["id"] == t3.id
    assert sub1["assignment_type"] == "admin_assigned"
    
    # Check leave2 details (unassigned)
    sub2 = next(s for s in subs if s["leave_id"] == leave2.id)
    assert sub2["period_number"] == 2
    assert sub2["class_name"] == f"{cls.name} - {cls.section}"
    assert sub2["original_teacher"]["id"] == t2.id
    assert sub2["substitute_teacher"] is None
    assert sub2["assignment_type"] is None

def test_get_today_substitutions_cross_department_class(db_session):
    # Department A (CS) and Department B (BCA)
    dept_cs = create_department(db_session, name="Computer Science", code="CS")
    dept_bca = create_department(db_session, name="BCA Department", code="BCA")
    
    # Teacher in CS
    t_cs = _make_user(db_session, email="t_cs@test.com", department="CS")
    # Class in BCA
    cls_bca = create_class(db_session, department_id=dept_bca.id, name="I BCA", section="A")
    subj_bca = create_subject(db_session, department_id=dept_bca.id)
    room = create_room(db_session)
    
    # Calendar DO1
    cal = CalendarDay(date=date(2026, 6, 22), day_type=DayType.working, day_order=1)
    db_session.add(cal)
    
    # CS Teacher teaches BCA Class on period 2
    create_timetable_slot(db_session, t_cs.id, subj_bca.id, cls_bca.id, room_id=room.id, day_order=1, period_number=2)
    
    # CS Teacher applies for leave on that period
    leave = LeaveRequest(
        teacher_id=t_cs.id, date=date(2026, 6, 22), day_order=1, period_number=2,
        status=LeaveStatus.approved, reason="Medical", is_emergency=False
    )
    db_session.add(leave)
    db_session.commit()
    
    # CS HOD queries dashboard with tenant_department_id = dept_cs.id
    res = service.get_today_substitutions(db_session, date(2026, 6, 22), tenant_department_id=dept_cs.id)
    
    assert len(res["substitutions"]) == 1
    sub = res["substitutions"][0]
    assert sub["period_number"] == 2
    assert sub["original_teacher"]["id"] == t_cs.id
    assert sub["class_name"] == "I BCA - A"
    assert sub["class_name"] != "General Duty"

class TestSubstitutionsRoute:
    def test_get_today_substitutions_unauthorized(self, client):
        response = client.get("/substitutions/today")
        assert response.status_code == 401

    def test_get_today_substitutions_authorized(self, client, db_session, auth_headers_admin):
        # Setup calendar day
        cal = CalendarDay(date=date(2026, 6, 20), day_type=DayType.working, day_order=3)
        db_session.add(cal)
        db_session.commit()

        response = client.get("/substitutions/today?date=2026-06-20", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-06-20"
        assert data["day_order"] == "DO3"
        assert "summary" in data
        assert "substitutions" in data
