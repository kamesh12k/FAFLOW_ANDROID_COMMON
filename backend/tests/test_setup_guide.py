import pytest
from fastapi.testclient import TestClient


def test_setup_readiness_endpoint(client: TestClient, auth_headers_admin: dict):
    """Test retrieving setup readiness calculation."""
    response = client.get("/admin/setup-readiness", headers=auth_headers_admin)
    assert response.status_code == 200
    data = response.json()

    assert "total_steps" in data
    assert "completed_steps" in data
    assert "progress_percent" in data
    assert "steps" in data
    assert "module_readiness" in data
    assert "data_flow" in data

    assert len(data["steps"]) == 10
    assert len(data["module_readiness"]) >= 5
    assert len(data["data_flow"]["nodes"]) > 0
    assert len(data["data_flow"]["edges"]) > 0

    # Verify first step is Departments
    first_step = data["steps"][0]
    assert first_step["id"] == "departments"
    assert first_step["step_number"] == 1
    assert "what_depends_on_it" in first_step
    assert "required_fields" in first_step


def test_setup_readiness_unauthorized(client: TestClient, auth_headers_teacher: dict):
    """Teacher role should be forbidden from accessing admin setup readiness."""
    response = client.get("/admin/setup-readiness", headers=auth_headers_teacher)
    assert response.status_code in [401, 403]
