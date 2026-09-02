"""Integration tests for FastAPI routes/endpoints."""
import pytest
from datetime import date
from fastapi.testclient import TestClient

from app.models.user import Role, AdminLevel
from app.models.day_order_calendar import DayType
from app.models.leave import AlterAssignment
from tests.conftest import (
    create_department, create_subject, create_class, create_room,
    create_calendar_day, create_leave_request, create_timetable_slot,
)


class TestAuthRoutes:
    def test_register_teacher(self, client, db_session):
        dept = create_department(db_session)
        payload = {
            "name": "Register Route Teacher",
            "email": "route_teacher@test.com",
            "password": "Password123",
            "department": "CS",
            "department_id": dept.id,
        }
        response = client.post("/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "route_teacher@test.com"

    def test_login(self, client, test_teacher):
        payload = {
            "identifier": "teacher@test.com",
            "password": "Testpass1",
        }
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_case_insensitive_and_whitespace_trimmed(self, client, test_teacher):
        payload = {
            "identifier": "  TEACHER@TEST.COM  ",
            "password": "Testpass1",
        }
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "teacher@test.com"


class TestAdminRoutes:
    def test_list_secondary_admins(self, client, auth_headers_admin):
        response = client.get("/admin/secondary-admins", headers=auth_headers_admin)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_secondary_admin(self, client, auth_headers_system_admin, db_session):
        dept = create_department(db_session)
        headers = {**auth_headers_system_admin, "X-Department-ID": str(dept.id)}
        payload = {
            "name": "Sec Admin",
            "username": "newsecadmin",
            "password": "Password123",
        }
        response = client.post("/admin/secondary-admins", json=payload, headers=headers)
        assert response.status_code == 201
        assert response.json()["username"] == "newsecadmin"

    def test_toggle_secondary_admin(self, client, auth_headers_system_admin, test_secondary_admin):
        response = client.patch(
            f"/admin/secondary-admins/{test_secondary_admin.id}/disable",
            headers=auth_headers_system_admin,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    def test_clear_credits_history(self, client, auth_headers_admin, db_session, test_teacher):
        from app.models.credit import TeacherCredit, CreditTransaction
        tc = TeacherCredit(teacher_id=test_teacher.id, balance=5)
        db_session.add(tc)
        tx = CreditTransaction(teacher_id=test_teacher.id, change=5, reason="Initial adjust", category="manual_adjustment")
        db_session.add(tx)
        db_session.commit()

        assert db_session.query(TeacherCredit).count() > 0
        assert db_session.query(CreditTransaction).count() > 0

        response = client.post("/admin/clear-credits-history", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() == {"ok": True}

        assert db_session.query(TeacherCredit).count() == 0
        assert db_session.query(CreditTransaction).count() == 0

    def test_clear_leaves_history(self, client, auth_headers_admin, db_session, test_teacher, test_teacher2):
        from app.models.leave import LeaveRequest, AlterAssignment
        leave = create_leave_request(db_session, test_teacher.id)
        assignment = AlterAssignment(leave_request_id=leave.id, substitute_teacher_id=test_teacher2.id)
        db_session.add(assignment)
        db_session.commit()

        assert db_session.query(LeaveRequest).count() > 0
        assert db_session.query(AlterAssignment).count() > 0

        response = client.post("/admin/clear-leaves-history", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() == {"ok": True}

        assert db_session.query(LeaveRequest).count() == 0
        assert db_session.query(AlterAssignment).count() == 0

    def test_clear_history_unauthorized(self, client, auth_headers_teacher):
        response1 = client.post("/admin/clear-credits-history", headers=auth_headers_teacher)
        assert response1.status_code == 403

        response2 = client.post("/admin/clear-leaves-history", headers=auth_headers_teacher)
        assert response2.status_code == 403

    def test_get_system_metrics_system_admin(self, client, auth_headers_system_admin):
        response = client.get("/admin/system-metrics", headers=auth_headers_system_admin)
        assert response.status_code == 200
        data = response.json()
        assert "performance" in data
        assert "traffic" in data
        assert "cpu_usage" in data["performance"]
        assert "total_requests" in data["traffic"]

    def test_get_system_metrics_unauthorized_for_dept_admin(self, client, auth_headers_admin):
        response = client.get("/admin/system-metrics", headers=auth_headers_admin)
        assert response.status_code == 403

    def test_clear_traffic_logs(self, client, auth_headers_system_admin):
        response = client.post("/admin/system-metrics/clear-traffic", headers=auth_headers_system_admin)
        assert response.status_code == 200
        assert response.json() == {"ok": True}


class TestLeavesRoutes:
    def test_apply_leave(self, client, auth_headers_teacher, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        payload = {
            "date": "2026-07-01",
            "period_number": 2,
            "reason": "Appointment",
        }
        response = client.post("/leaves/", json=payload, headers=auth_headers_teacher)
        assert response.status_code == 201
        assert response.json()["period_number"] == 2

    def test_list_all_leaves(self, client, auth_headers_admin, test_teacher, db_session):
        create_leave_request(db_session, test_teacher.id)
        response = client.get("/leaves/", headers=auth_headers_admin)
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_admin_create_leave_success(self, client, auth_headers_admin, test_teacher, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        payload = {
            "teacher_id": test_teacher.id,
            "date": "2026-07-01",
            "whole_day": False,
            "period_numbers": [3],
            "reason": "Family emergency",
            "notes": "Direct admin entry"
        }
        response = client.post("/leaves/admin-create", json=payload, headers=auth_headers_admin)
        assert response.status_code == 201
        assert len(response.json()) == 1
        assert response.json()[0]["period_number"] == 3
        assert response.json()[0]["status"] == "approved"

    def test_admin_create_leave_unauthorized(self, client, auth_headers_teacher, test_teacher, db_session):
        payload = {
            "teacher_id": test_teacher.id,
            "date": "2026-07-01",
            "whole_day": False,
            "period_numbers": [3],
            "reason": "Teacher attempting admin privilege"
        }
        response = client.post("/leaves/admin-create", json=payload, headers=auth_headers_teacher)
        assert response.status_code == 403


class TestTimetableRoutes:
    def test_create_timetable_slot(self, client, auth_headers_admin, test_teacher, db_session):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        room = create_room(db_session)

        payload = {
            "teacher_id": test_teacher.id,
            "subject_id": subj.id,
            "class_id": cls.id,
            "room_id": room.id,
            "day_order": 1,
            "period_number": 1,
        }
        response = client.post("/timetable/slot", json=payload, headers=auth_headers_admin)
        assert response.status_code == 201
        assert response.json()["period_number"] == 1


class TestDepartmentsRoutes:
    def test_update_department_route_success(self, client, auth_headers_admin, db_session):
        dept = create_department(db_session, name="CS", code="CS")
        payload = {"name": "Computer Science", "code": "CS_UPDATED"}
        response = client.patch(f"/departments/{dept.id}", json=payload, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Computer Science"
        assert data["code"] == "CS_UPDATED"

    def test_update_department_route_duplicate(self, client, auth_headers_system_admin, db_session):
        create_department(db_session, name="CS", code="CS")
        dept2 = create_department(db_session, name="IT", code="IT")
        payload = {"name": "CS"}
        response = client.patch(f"/departments/{dept2.id}", json=payload, headers=auth_headers_system_admin)
        assert response.status_code == 400

    def test_delete_department_route_success(self, client, auth_headers_system_admin, db_session):
        dept = create_department(db_session, name="CS", code="CS")
        response = client.delete(f"/departments/{dept.id}", headers=auth_headers_system_admin)
        assert response.status_code == 204

    def test_delete_department_route_in_use(self, client, auth_headers_system_admin, db_session):
        dept = create_department(db_session, name="CS", code="CS")
        create_subject(db_session, code="CS101", department_id=dept.id)
        response = client.delete(f"/departments/{dept.id}", headers=auth_headers_system_admin)
        assert response.status_code == 204


class TestTeachersRoutes:
    def test_delete_teacher_route_success(self, client, auth_headers_admin, test_teacher):
        response = client.delete(f"/teachers/{test_teacher.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_teacher_route_blocked_timetable(
        self, client, auth_headers_admin, test_teacher, db_session
    ):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        room = create_room(db_session)
        create_timetable_slot(db_session, teacher_id=test_teacher.id, subject_id=subj.id, class_id=cls.id, room_id=room.id)
        
        response = client.delete(f"/teachers/{test_teacher.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_teacher_route_blocked_leave(
        self, client, auth_headers_admin, test_teacher, db_session
    ):
        create_leave_request(db_session, teacher_id=test_teacher.id)
        response = client.delete(f"/teachers/{test_teacher.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_teacher_route_blocked_substitution(
        self, client, auth_headers_admin, test_teacher, test_teacher2, db_session
    ):
        leave = create_leave_request(db_session, teacher_id=test_teacher2.id)
        assignment = AlterAssignment(leave_request_id=leave.id, substitute_teacher_id=test_teacher.id)
        db_session.add(assignment)
        db_session.commit()
        
        response = client.delete(f"/teachers/{test_teacher.id}", headers=auth_headers_admin)
        assert response.status_code == 204


class TestTeacherPreferencesOverrideRoutes:
    def test_override_single_teacher_preferences(self, client, auth_headers_admin, test_teacher, db_session):
        headers = {**auth_headers_admin, "X-Department-ID": str(test_teacher.department_id)}
        payload = {
            "accept_auto_assignments": False,
            "max_weekly_substitutions": 4
        }
        response = client.put(f"/campus-operations/preferences/{test_teacher.id}", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["accept_auto_assignments"] is False
        assert data["max_weekly_substitutions"] == 4

    def test_bulk_override_preferences(self, client, auth_headers_admin, test_teacher, db_session):
        headers = {**auth_headers_admin, "X-Department-ID": str(test_teacher.department_id)}
        payload = {
            "accept_auto_assignments": False,
            "max_weekly_substitutions": 1
        }
        response = client.put("/campus-operations/preferences/bulk-override", json=payload, headers=headers)
        assert response.status_code == 200
        assert "Successfully updated" in response.json()["message"]


