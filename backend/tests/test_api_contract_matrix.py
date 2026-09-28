import pytest
import os
import yaml
import json
import re
from fastapi.testclient import TestClient
from fastapi import status
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User, Role, AdminLevel
from app.models.department import Department
from tests.conftest import _make_user


def test_openapi_spec_structure_and_parity():
    """Validates that openapi.yaml exists, parses as valid YAML, and has all expected root keys."""
    spec_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "openapi.yaml")
    assert os.path.exists(spec_path), "openapi.yaml must exist at the workspace root."
    
    with open(spec_path, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)
        
    assert spec.get("openapi", "").startswith("3."), "Spec must be OpenAPI 3.x"
    assert "info" in spec and "title" in spec["info"]
    assert "paths" in spec and len(spec["paths"]) >= 600, "Spec must expose all registered paths."
    assert "components" in spec and "schemas" in spec["components"]


def test_standardized_error_envelope(client: TestClient):
    """Verifies that all error responses conform to the standardized {'detail': ...} envelope."""
    # 1. 401 Unauthorized
    resp_401 = client.get("/teachers/me")
    assert resp_401.status_code == status.HTTP_401_UNAUTHORIZED
    assert "detail" in resp_401.json()

    # 2. 404 Not Found
    resp_404 = client.get("/non-existent-endpoint-xyz-12345")
    assert resp_404.status_code == status.HTTP_404_NOT_FOUND
    assert "detail" in resp_404.json()

    # 3. 422 Validation Error
    resp_422 = client.post("/auth/login", json={"invalid_field": "bad_data"})
    assert resp_422.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data_422 = resp_422.json()
    assert "detail" in data_422
    assert isinstance(data_422["detail"], list)


def test_client_compatibility_aliases_and_computed_fields(client: TestClient, db_session: Session):
    """Verifies that client compatibility aliases return HTTP 200/201 without breaking client callers."""
    # Create test super admin
    admin_user = _make_user(
        db_session,
        name="Contract Admin",
        username="contract_admin",
        role=Role.system_admin,
        admin_level=None,
        department=None
    )
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. /enforcement-mode root alias
    resp_enf = client.get("/enforcement-mode", headers=headers)
    assert resp_enf.status_code == status.HTTP_200_OK
    assert "mode" in resp_enf.json()

    # 2. /campus-duties/metrics/summary alias
    resp_metrics = client.get("/campus-duties/metrics/summary", headers=headers)
    assert resp_metrics.status_code == status.HTTP_200_OK

    # 3. /campus-structure/rooms/preview alias
    preview_req = {
        "pattern": "10{n}",
        "count": 3,
        "start_number": 1,
        "floor_id": 1,
        "department_id": None
    }
    resp_preview = client.post("/campus-structure/rooms/preview", json=preview_req, headers=headers)
    # Returns 200 with room preview list or 404 if floor does not exist
    assert resp_preview.status_code in (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND)

    # 4. Computed field parity on TeacherTodaySummary
    from app.schemas.academic_calendar import TeacherTodaySummary, DayType
    from datetime import date
    summary = TeacherTodaySummary(
        date=date.today(),
        day_type=DayType.working,
        day_order=1,
        blocks_operations=False,
        is_on_leave_today=True,
        periods_today=4,
        upcoming_non_working_days=[]
    )
    dumped = summary.model_dump()
    assert dumped["is_on_leave_today"] is True
    assert dumped["is_on_leave"] is True, "is_on_leave computed alias must match is_on_leave_today."

    # 5. Computed field parity on PolicyEvaluationResult
    from app.schemas.leave import PolicyEvaluationResult
    eval_res = PolicyEvaluationResult(
        compliant=True,
        mode="STRICT",
        can_submit=True,
        requires_warning=False,
        requires_hod_review=False
    )
    dumped_eval = eval_res.model_dump()
    assert dumped_eval["mode"] == "STRICT"
    assert dumped_eval["enforcement_mode"] == "STRICT", "enforcement_mode computed alias must match mode."


def test_contract_matrix_endpoint_registration():
    """
    Automated regression gate:
    Confirms all registered routes in FastAPI OpenAPI contract cover the critical operational endpoints.
    """
    spec = app.openapi()
    spec_paths = spec.get("paths", {})
    registered_operations = set()
    for path, methods in spec_paths.items():
        for m in methods:
            registered_operations.add((m.upper(), path))

    # Required endpoints that must be present
    required_endpoints = [
        ("GET", "/health"),
        ("POST", "/auth/login"),
        ("POST", "/auth/register"),
        ("GET", "/teachers/me"),
        ("GET", "/leaves/"),
        ("POST", "/leaves/"),
        ("GET", "/student-attendance/today"),
        ("POST", "/student-attendance/sessions/submit"),
        ("POST", "/student-attendance/emergency"),
        ("POST", "/student-attendance/sync"),
        ("GET", "/campus-duties"),
        ("GET", "/campus-duties/metrics"),
        ("GET", "/campus-structure/tree"),
    ]

    for m, p in required_endpoints:
        assert (m, p) in registered_operations, f"Required contract endpoint {m} {p} missing from OpenAPI schema."
