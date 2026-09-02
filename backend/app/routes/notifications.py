from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.notification import PushSubscription
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def list_notifications(
    unread_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notes = notification_service.list_notifications(db, current_user.id, unread_only)
    return [
        {
            "id": n.id, "title": n.title, "body": n.body, "event_type": n.event_type,
            "related_leave_id": n.related_leave_id, "is_read": n.is_read, "created_at": n.created_at,
        }
        for n in notes
    ]


@router.get("/unread-count")
def get_unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"count": notification_service.unread_count(db, current_user.id)}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_service.mark_read(db, current_user.id, notification_id)
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_service.mark_all_read(db, current_user.id)
    return {"ok": True}


@router.get("/vapid-public-key")
def vapid_public_key():
    return {"key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(subscription: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid push subscription payload: missing endpoint")
    
    p256dh = subscription.get("keys", {}).get("p256dh", "")
    auth = subscription.get("keys", {}).get("auth", "")

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.user_id = current_user.id
        existing.p256dh_key = p256dh
        existing.auth_key = auth
        db.commit()
        return {"ok": True, "status": "updated"}

    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=endpoint,
        p256dh_key=p256dh,
        auth_key=auth,
    )
    db.add(sub)
    db.commit()
    return {"ok": True, "status": "created"}


@router.post("/unsubscribe")
def unsubscribe(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    endpoint = payload.get("endpoint")
    if endpoint:
        db.query(PushSubscription).filter(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == endpoint
        ).delete(synchronize_session=False)
        db.commit()
    return {"ok": True}


@router.post("/test-push")
def test_push_notification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Triggers an immediate test notification and push delivery to the user's active device."""
    note = notification_service.create_notification(
        db=db,
        user_id=current_user.id,
        title="🔔 FAFLOW Web Push Active",
        body="Congratulations! You are now connected to receive real-time notifications on this device.",
        event_type="system_test",
        send_push=True,
    )
    db.commit()
    return {"ok": True, "notification_id": note.id}

