import pytest
from app.services import governance_rule_service as svc
from app.models.governance_rule import BusinessRule, PeriodConfig

def test_public_config_endpoint(client):
    response = client.get("/api/system/governance/public-config")
    if response.status_code == 404:
        response = client.get("/system/governance/public-config")
    
    assert response.status_code == 200
    data = response.json()
    assert "period_schedule" in data
    assert len(data["period_schedule"]) >= 5
    assert data["suggestion_lead_time_minutes"] == 15
    assert data["student_attendance_submission_window_minutes"] == 15
    assert data["period_schedule"][0]["period_number"] == 1
    assert data["period_schedule"][0]["start_time"] == "09:20"
    assert data["period_schedule"][0]["end_time"] == "10:20"

def test_governance_service_fallback_and_seeded(db_session):
    # Test zero-regression baseline fallback when table is unseeded
    cfg = svc.get_public_config(db_session)
    assert len(cfg["period_schedule"]) >= 5
    assert cfg["suggestion_lead_time_minutes"] == 15

    # Seed a custom rule and period
    p = PeriodConfig(
        period_number=1,
        name="Custom P1",
        start_time="08:30",
        end_time="09:30",
        is_break=False,
        is_enabled=True,
        sort_order=1
    )
    r = BusinessRule(
        key="suggestion_lead_time_minutes",
        category="class_suggestion",
        display_name="Class Suggestion Lead Time",
        description="Advance lead time before a period begins",
        value="20",
        data_type="integer",
        unit="minutes",
        minimum=0,
        maximum=60,
        default_value="15",
        is_enabled=True,
        affected_modules="[]",
        severity="normal"
    )
    db_session.add_all([p, r])
    db_session.commit()

    # Invalidate cache and verify dynamic reading
    svc._invalidate_cache()
    cfg_updated = svc.get_public_config(db_session)
    assert cfg_updated["suggestion_lead_time_minutes"] == 20
    assert cfg_updated["period_schedule"][0]["start_time"] == "08:30"
    assert cfg_updated["period_schedule"][0]["end_time"] == "09:30"
