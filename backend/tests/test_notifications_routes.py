"""Tests for /notifications HTTP routes."""
import pytest
from app.models.user import Role
from app.services.notification_service import create_notification, list_notifications
from tests.conftest import _make_user, make_auth_headers


def test_notifications_route_lifecycle(client, db_session):
    u1 = _make_user(db_session, name="User One", role=Role.teacher, email="u1@college.edu", department="CS")
    u2 = _make_user(db_session, name="User Two", role=Role.teacher, email="u2@college.edu", department="EE")

    h1 = make_auth_headers(u1)
    h2 = make_auth_headers(u2)

    # Seed notifications for u1 and u2
    n1 = create_notification(db_session, u1.id, "Note 1", "Body 1", "leave_approved")
    n2 = create_notification(db_session, u1.id, "Note 2", "Body 2", "timetable_assigned")
    n_other = create_notification(db_session, u2.id, "Other Note", "Other Body", "announcement")
    db_session.commit()

    # 1. Fetch notifications for u1
    resp = client.get("/notifications/", headers=h1)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    assert {it["title"] for it in items} == {"Note 1", "Note 2"}

    # 2. Check unread count
    resp = client.get("/notifications/unread-count", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["count"] == 2

    # 3. Mark single notification as read
    resp = client.patch(f"/notifications/{n1.id}/read", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/notifications/unread-count", headers=h1)
    assert resp.json()["count"] == 1

    # 4. Mark all as read
    resp = client.patch("/notifications/read-all", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/notifications/unread-count", headers=h1)
    assert resp.json()["count"] == 0

    # 5. Delete single notification
    resp = client.delete(f"/notifications/{n1.id}", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/notifications/", headers=h1)
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == n2.id

    # 6. Attempt deleting other user's notification -> 404 Not Found
    resp = client.delete(f"/notifications/{n_other.id}", headers=h1)
    assert resp.status_code == 404

    # 7. Clear all notifications via DELETE /notifications/
    resp = client.delete("/notifications/", headers=h1)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["message"] == "All notifications cleared"

    # Reload / re-fetch -> verify database persistence (0 notifications)
    resp = client.get("/notifications/", headers=h1)
    assert resp.status_code == 200
    assert resp.json() == []

    # 8. Verify u2's notification was untouched
    resp = client.get("/notifications/", headers=h2)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Other Note"

    # 9. Verify DELETE /notifications (bare URL without trailing slash)
    resp = client.delete("/notifications", headers=h2)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/notifications/", headers=h2)
    assert resp.status_code == 200
    assert resp.json() == []
