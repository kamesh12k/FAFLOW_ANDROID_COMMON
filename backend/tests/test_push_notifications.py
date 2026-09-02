"""Unit tests for Web Push Notification endpoints and service logic."""
from unittest.mock import patch, MagicMock
from app.models.notification import PushSubscription, Notification
from app.services.notification_service import (
    _get_target_url_for_event,
    _dispatch_web_push_raw,
    create_notification,
)


def test_target_url_mapping():
    assert _get_target_url_for_event("substitute_assigned") == "/today-substitutions"
    assert _get_target_url_for_event("leave_approved") == "/leaves"
    assert _get_target_url_for_event("leave_rejected") == "/leaves"
    assert _get_target_url_for_event("timetable_published") == "/timetable"
    assert _get_target_url_for_event("general_alert") == "/"


def test_subscribe_endpoint(client, test_teacher, auth_headers_teacher, db_session):
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/fake-test-endpoint-1",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u",
            "auth": "5sdbF_k1p40zM3q5B4U1yw",
        },
    }
    response = client.post("/notifications/subscribe", json=payload, headers=auth_headers_teacher)
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True

    # Verify record in DB
    sub = db_session.query(PushSubscription).filter_by(endpoint=payload["endpoint"]).first()
    assert sub is not None
    assert sub.user_id == test_teacher.id
    assert sub.auth_key == "5sdbF_k1p40zM3q5B4U1yw"


def test_unsubscribe_endpoint(client, test_teacher, auth_headers_teacher, db_session):
    sub = PushSubscription(
        user_id=test_teacher.id,
        endpoint="https://fcm.googleapis.com/fcm/send/to-delete",
        p256dh_key="key123",
        auth_key="auth123",
    )
    db_session.add(sub)
    db_session.commit()

    response = client.post(
        "/notifications/unsubscribe",
        json={"endpoint": "https://fcm.googleapis.com/fcm/send/to-delete"},
        headers=auth_headers_teacher,
    )
    assert response.status_code == 200

    deleted = db_session.query(PushSubscription).filter_by(endpoint="https://fcm.googleapis.com/fcm/send/to-delete").first()
    assert deleted is None


def test_test_push_endpoint(client, test_teacher, auth_headers_teacher, db_session):
    response = client.post("/notifications/test-push", headers=auth_headers_teacher)
    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify notification created in DB
    note = db_session.query(Notification).filter_by(user_id=test_teacher.id, event_type="system_test").first()
    assert note is not None
    assert "Active" in note.title


def test_vapid_public_key_endpoint(client, test_teacher, auth_headers_teacher):
    response = client.get("/notifications/vapid-public-key", headers=auth_headers_teacher)
    assert response.status_code == 200
    assert "key" in response.json()


@patch("pywebpush.webpush")
def test_dispatch_web_push_success(mock_webpush):
    mock_webpush.return_value = MagicMock(status_code=201)
    sub_info = {
        "endpoint": "https://example.com/push",
        "keys": {"p256dh": "k", "auth": "a"},
    }
    res = _dispatch_web_push_raw(sub_info, {"title": "T"}, "priv_key", {"sub": "mailto:a@b.com"})
    assert res is True
