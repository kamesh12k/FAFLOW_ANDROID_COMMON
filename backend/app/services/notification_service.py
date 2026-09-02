import re
import json
import logging
from threading import Thread
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import Notification, PushSubscription
from app.models.day_order_calendar import CalendarDay, DayType

logger = logging.getLogger(__name__)

HOLIDAY_REMINDER_LOOKAHEAD_DAYS = 3
_REMINDER_DATE_RE = re.compile(r"on (\d{4}-\d{2}-\d{2}) \(")


def _get_target_url_for_event(event_type: str) -> str:
    if "substitut" in event_type:
        return "/today-substitutions"
    elif "leave" in event_type:
        return "/leaves"
    elif "timetable" in event_type:
        return "/timetable"
    return "/"


def _dispatch_web_push_raw(subscription_info: dict, payload: dict, vapid_private_key: str, vapid_claims: dict) -> bool:
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_private_key,
            vapid_claims=vapid_claims,
            ttl=86400,
        )
        return True
    except Exception as ex:
        # Check if exception indicates expired / unregistered subscription
        status_code = getattr(getattr(ex, "response", None), "status_code", None)
        if status_code in (404, 410):
            logger.info(f"Web push subscription expired or unregistered ({status_code}). Removing.")
            return False
        logger.warning(f"Web push dispatch warning: {ex}")
        return True


def send_push_to_user_async(user_id: int, title: str, body: str, event_type: str, url: str = "/") -> None:
    """Asynchronous worker to dispatch web push notifications to all registered devices of a user."""
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        return

    try:
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
            if not subs:
                return

            payload = {
                "title": title,
                "body": body,
                "event_type": event_type,
                "url": url,
                "tag": f"faflow-{event_type}-{user_id}",
            }
            vapid_claims = {"sub": settings.VAPID_CLAIM_EMAIL}
            dead_sub_ids = []

            for sub in subs:
                sub_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key,
                    },
                }
                alive = _dispatch_web_push_raw(sub_info, payload, settings.VAPID_PRIVATE_KEY, vapid_claims)
                if not alive:
                    dead_sub_ids.append(sub.id)

            if dead_sub_ids:
                db.query(PushSubscription).filter(PushSubscription.id.in_(dead_sub_ids)).delete(synchronize_session=False)
                db.commit()
        finally:
            db.close()
    except Exception as err:
        logger.error(f"Error in send_push_to_user_async: {err}")


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    event_type: str,
    related_leave_id: int | None = None,
    send_push: bool = True,
) -> Notification:
    note = Notification(
        user_id=user_id,
        title=title,
        body=body,
        event_type=event_type,
        related_leave_id=related_leave_id,
    )
    db.add(note)
    db.flush()

    if send_push:
        url = _get_target_url_for_event(event_type)
        Thread(
            target=send_push_to_user_async,
            args=(user_id, title, body, event_type, url),
            daemon=True,
        ).start()

    return note


def list_notifications(db: Session, user_id: int, unread_only: bool = False) -> list[Notification]:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    return q.order_by(Notification.created_at.desc()).all()


def unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).count()  # noqa: E712


def mark_read(db: Session, user_id: int, notification_id: int) -> None:
    note = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if note:
        note.is_read = True
        db.commit()


def mark_all_read(db: Session, user_id: int) -> None:
    db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()


def generate_holiday_reminders(db: Session, user_id: int, today: date) -> None:
    """Disabled: Holiday and non-working day reminders are no longer generated."""
    return

