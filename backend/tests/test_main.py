from app.main import health, public_settings


def test_health_endpoint():
    assert health() == {"status": "ok"}


def test_public_settings_returns_branding(client):
    response = client.get("/settings/public")
    assert response.status_code == 200
    settings = response.json()
    assert "app_name" in settings
    assert "periods_per_day" in settings
    assert "day_order_max" in settings
