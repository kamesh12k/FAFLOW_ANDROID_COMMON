import pytest
from datetime import date
from fastapi.testclient import TestClient
from fastapi import status
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from app.models.class_ import Class
from app.models.day_order_calendar import CalendarDay, DayType
from app.services import summary_service, credit_service
from app.services.student_attendance_service import StudentAttendanceService
from tests.conftest import _make_user


def test_health_check_enhanced(client: TestClient):
    """Verifies that /health returns database readiness, latency, uptime, and version."""
    resp = client.get("/health")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "FAFLOW API"
    assert data["database"] == "connected"
    assert "db_latency_ms" in data
    assert isinstance(data["db_latency_ms"], (int, float))
    assert "uptime_seconds" in data
    assert data["version"] == "3.1.0-ENTERPRISE"


def test_prometheus_metrics_endpoint(client: TestClient):
    """Verifies that /metrics returns Prometheus exposition format text."""
    resp = client.get("/metrics")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.headers["content-type"].startswith("text/plain")
    text = resp.text
    assert "faflow_uptime_seconds" in text
    assert "faflow_http_requests_total" in text
    assert "faflow_avg_response_time_ms" in text
    assert "faflow_db_pool_size" in text


def test_security_headers_middleware(client: TestClient):
    """Verifies that responses include standard enterprise defensive security headers."""
    resp = client.get("/health")
    headers = resp.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "X-Request-ID" in headers


def test_summary_service_optimizations(db_session: Session):
    """Tests that summary_service functions run cleanly with pre-aggregated batch queries."""
    dept = Department(name="Computer Science & Engineering", code="CSE")
    db_session.add(dept)
    db_session.flush()

    teacher = _make_user(
        db_session,
        name="Opt Teacher",
        email="opt_teacher@example.com",
        role=Role.teacher,
        department=dept.name
    )
    teacher.department_id = dept.id
    db_session.flush()

    today = date.today()
    cal_day = CalendarDay(
        date=today,
        day_type=DayType.working,
        day_order=1,
    )
    db_session.add(cal_day)
    db_session.flush()

    # 1. Test get_today_summary
    today_sum = summary_service.get_today_summary(db_session, today)
    assert today_sum.day_type == DayType.working
    assert today_sum.day_order == 1

    # 2. Test get_principal_overview
    inst_sum = summary_service.get_principal_overview(db_session)
    assert "total_departments" in inst_sum
    assert "departments" in inst_sum
    assert any(d["id"] == dept.id for d in inst_sum["departments"])


def test_credit_service_report_optimization(db_session: Session):
    """Verifies that get_credit_report executes cleanly with joinedload on department."""
    dept = Department(name="Electronics Engineering", code="ECE")
    db_session.add(dept)
    db_session.flush()

    teacher = _make_user(
        db_session,
        name="Credit Opt Teacher",
        email="credit_opt_teacher@example.com",
        role=Role.teacher,
        department=dept.name
    )
    teacher.department_id = dept.id
    db_session.flush()

    report = credit_service.get_credit_report(db_session, tenant_department_id=dept.id)
    assert isinstance(report, list)
    assert any(r.teacher_id == teacher.id for r in report)
