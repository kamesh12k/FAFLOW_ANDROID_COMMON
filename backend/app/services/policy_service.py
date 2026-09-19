from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.policy import CurrentPolicyOut, PolicySection

CURRENT_INSTITUTIONAL_POLICY_VERSION = "v1.0.0"
POLICY_EFFECTIVE_DATE = "2026-09-01"

INSTITUTIONAL_POLICY_SECTIONS = [
    PolicySection(
        id="privacy",
        title="Institutional Privacy Policy",
        content=(
            "FAFLOW processes institutional academic, attendance, and scheduling data "
            "strictly for official educational administration. Personal data, including contact details, "
            "credentials, and duty logs, is securely stored, role-isolated, and never transmitted to "
            "unauthorized third parties."
        ),
        required=True
    ),
    PolicySection(
        id="terms",
        title="Terms of Use & Faculty Responsibilities",
        content=(
            "Users must maintain the confidentiality of their credentials and ensure all records entered "
            "(student attendance, leave applications, substitution reports) are accurate and timely. "
            "Unauthorized access or tampering with institutional records is strictly prohibited."
        ),
        required=True
    ),
    PolicySection(
        id="geofence_attendance",
        title="Attendance & Campus Geofencing Notice",
        content=(
            "FAFLOW verifies physical presence for staff check-in/check-out using designated campus geofence "
            "coordinates. Location data is only queried at the moment of attendance validation and is not "
            "used for continuous or background tracking."
        ),
        required=True
    ),
    PolicySection(
        id="biometric",
        title="Biometric & Face Recognition Policy",
        content=(
            "Where enabled by institution governance, facial recognition embeddings are processed on-device "
            "or securely encrypted on institutional servers solely for identity verification during attendance marking. "
            "Raw camera feeds are not retained after verification."
        ),
        required=True
    ),
    PolicySection(
        id="notifications",
        title="Notifications & Timetable Alerts",
        content=(
            "FAFLOW dispatches system alerts, timetable changes, substitution assignments, and leave approval "
            "updates via web and mobile push notifications to keep faculty and administration seamlessly informed."
        ),
        required=True
    ),
]


def get_current_policy() -> CurrentPolicyOut:
    return CurrentPolicyOut(
        version=CURRENT_INSTITUTIONAL_POLICY_VERSION,
        effective_date=POLICY_EFFECTIVE_DATE,
        sections=INSTITUTIONAL_POLICY_SECTIONS
    )


def accept_policy(user: User, version: str, db: Session, client_ip: str | None = None) -> User:
    if not version or version.strip() != CURRENT_INSTITUTIONAL_POLICY_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid policy version. Current version is {CURRENT_INSTITUTIONAL_POLICY_VERSION}"
        )

    now = datetime.now(timezone.utc)
    user.policy_version_accepted = version.strip()
    user.policy_accepted_at = now

    # Audit log
    audit_entry = AuditLog(
        actor_user_id=user.id,
        department_id=user.department_id,
        action="user.policy_accepted",
        target_type="user",
        target_id=user.id,
        details={
            "policy_version": version.strip(),
            "accepted_at": now.isoformat(),
            "client_ip": client_ip,
        }
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(user)
    return user


def complete_onboarding(user: User, db: Session) -> User:
    user.onboarding_completed = True
    now = datetime.now(timezone.utc)

    audit_entry = AuditLog(
        actor_user_id=user.id,
        department_id=user.department_id,
        action="user.onboarding_completed",
        target_type="user",
        target_id=user.id,
        details={
            "completed_at": now.isoformat(),
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        }
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(user)
    return user


def reset_onboarding(user: User, db: Session) -> User:
    user.onboarding_completed = False
    now = datetime.now(timezone.utc)

    audit_entry = AuditLog(
        actor_user_id=user.id,
        department_id=user.department_id,
        action="user.onboarding_reset",
        target_type="user",
        target_id=user.id,
        details={
            "reset_at": now.isoformat(),
        }
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(user)
    return user
