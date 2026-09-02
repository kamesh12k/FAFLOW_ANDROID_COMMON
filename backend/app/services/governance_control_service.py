"""
Governance Control Plane — Service Layer
Authoritative business logic for institutions, feature entitlements, biometric policies,
and system audit logging. All mutation operations create immutable audit log entries.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.governance_control import (
    Institution, FeatureEntitlement, BiometricPolicy, SystemAuditLog,
    PlanDefinition, FeatureKey, FeatureStatus, InstitutionStatus,
    SystemAuditAction, PlanTier,
)
from app.schemas.governance_control import (
    InstitutionCreate, InstitutionUpdate,
    BiometricPolicyUpdate, FeatureActionRequest,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _write_system_audit(
    db: Session,
    *,
    admin: User,
    institution: Optional[Institution],
    action: SystemAuditAction,
    affected_resource: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    request: Optional[Request] = None,
    notes: Optional[str] = None,
) -> SystemAuditLog:
    log = SystemAuditLog(
        event_id=str(uuid.uuid4()),
        system_admin_id=admin.id,
        institution_id=institution.id if institution else None,
        action=action,
        affected_resource=affected_resource,
        old_value=old_value,
        new_value=new_value,
        request_id=getattr(getattr(request, "state", None), "request_id", None) if request else None,
        ip_address=(request.client.host if request and request.client else None),
        notes=notes,
    )
    db.add(log)
    return log


def _ensure_biometric_policy(db: Session, institution: Institution) -> BiometricPolicy:
    """Return the biometric policy for the institution, creating defaults if absent."""
    if institution.biometric_policy:
        return institution.biometric_policy
    policy = BiometricPolicy(institution_id=institution.id)
    db.add(policy)
    db.flush()
    return policy


def _get_institution_or_404(db: Session, institution_id: int) -> Institution:
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail=f"Institution #{institution_id} not found")
    return inst


# ---------------------------------------------------------------------------
# Institution CRUD
# ---------------------------------------------------------------------------

def list_institutions(db: Session) -> List[Institution]:
    return db.query(Institution).order_by(Institution.name).all()


def get_institution(db: Session, institution_id: int) -> Institution:
    return _get_institution_or_404(db, institution_id)


def create_institution(
    db: Session, data: InstitutionCreate, admin: User, request: Optional[Request] = None
) -> Institution:
    existing = db.query(Institution).filter(
        (Institution.name == data.name) | (Institution.short_code == data.short_code)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Institution name or short code already exists")

    inst = Institution(
        name=data.name,
        short_code=data.short_code.upper(),
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        plan=data.plan,
        plan_assigned_at=datetime.utcnow(),
        created_by_id=admin.id,
    )
    db.add(inst)
    db.flush()

    # Seed default biometric policy and feature entitlements
    _seed_institution_defaults(db, inst)

    _write_system_audit(
        db, admin=admin, institution=inst,
        action=SystemAuditAction.INSTITUTION_CREATED,
        affected_resource=f"institution:{inst.id}",
        new_value=inst.name,
        request=request,
    )
    db.commit()
    db.refresh(inst)
    return inst


def update_institution(
    db: Session, institution_id: int, data: InstitutionUpdate, admin: User,
    request: Optional[Request] = None
) -> Institution:
    inst = _get_institution_or_404(db, institution_id)
    old_plan = inst.plan
    old_status = inst.status

    if data.name is not None:
        inst.name = data.name
    if data.contact_email is not None:
        inst.contact_email = data.contact_email
    if data.contact_phone is not None:
        inst.contact_phone = data.contact_phone
    if data.plan is not None and data.plan != inst.plan:
        inst.plan = data.plan
        inst.plan_assigned_at = datetime.utcnow()
        _write_system_audit(
            db, admin=admin, institution=inst,
            action=SystemAuditAction.PLAN_CHANGED,
            affected_resource=f"institution:{inst.id}",
            old_value=old_plan.value,
            new_value=data.plan.value,
            request=request,
        )
    if data.status is not None and data.status != inst.status:
        inst.status = data.status
        action = (SystemAuditAction.INSTITUTION_SUSPENDED
                  if data.status == InstitutionStatus.suspended
                  else SystemAuditAction.INSTITUTION_ACTIVATED)
        _write_system_audit(
            db, admin=admin, institution=inst,
            action=action,
            affected_resource=f"institution:{inst.id}",
            old_value=old_status.value,
            new_value=data.status.value,
            request=request,
        )

    _write_system_audit(
        db, admin=admin, institution=inst,
        action=SystemAuditAction.INSTITUTION_UPDATED,
        affected_resource=f"institution:{inst.id}",
        request=request,
    )
    db.commit()
    db.refresh(inst)
    return inst


def assign_plan(
    db: Session, institution_id: int, plan: PlanTier, admin: User,
    request: Optional[Request] = None
) -> Institution:
    inst = _get_institution_or_404(db, institution_id)
    old_plan = inst.plan
    inst.plan = plan
    inst.plan_assigned_at = datetime.utcnow()
    _write_system_audit(
        db, admin=admin, institution=inst,
        action=SystemAuditAction.PLAN_ASSIGNED,
        affected_resource=f"institution:{inst.id}",
        old_value=old_plan.value,
        new_value=plan.value,
        request=request,
    )
    db.commit()
    db.refresh(inst)
    return inst


# ---------------------------------------------------------------------------
# Feature Entitlement Operations
# ---------------------------------------------------------------------------

def _get_or_create_entitlement(db: Session, institution_id: int, feature_key: FeatureKey) -> FeatureEntitlement:
    ent = db.query(FeatureEntitlement).filter(
        FeatureEntitlement.institution_id == institution_id,
        FeatureEntitlement.feature_key == feature_key,
    ).first()
    if not ent:
        ent = FeatureEntitlement(
            institution_id=institution_id,
            feature_key=feature_key,
            status=FeatureStatus.ENABLED,
        )
        db.add(ent)
        db.flush()
    return ent


def list_institution_features(db: Session, institution_id: int) -> List[FeatureEntitlement]:
    _get_institution_or_404(db, institution_id)
    return db.query(FeatureEntitlement).filter(
        FeatureEntitlement.institution_id == institution_id
    ).all()


def _set_feature_status(
    db: Session,
    institution_id: int,
    feature_key: FeatureKey,
    new_status: FeatureStatus,
    audit_action: SystemAuditAction,
    admin: User,
    request: Optional[Request] = None,
    notes: Optional[str] = None,
) -> FeatureEntitlement:
    inst = _get_institution_or_404(db, institution_id)
    ent = _get_or_create_entitlement(db, institution_id, feature_key)
    old_status = ent.status
    ent.status = new_status
    if new_status == FeatureStatus.LOCKED:
        ent.locked_by_id = admin.id

    _write_system_audit(
        db, admin=admin, institution=inst,
        action=audit_action,
        affected_resource=f"feature:{feature_key.value}@institution:{institution_id}",
        old_value=old_status.value,
        new_value=new_status.value,
        request=request,
        notes=notes,
    )
    db.commit()
    db.refresh(ent)
    return ent


def enable_feature(db, institution_id, feature_key, admin, request=None, notes=None):
    return _set_feature_status(db, institution_id, feature_key, FeatureStatus.ENABLED,
                               SystemAuditAction.FEATURE_ENABLED, admin, request, notes)


def disable_feature(db, institution_id, feature_key, admin, request=None, notes=None):
    return _set_feature_status(db, institution_id, feature_key, FeatureStatus.DISABLED,
                               SystemAuditAction.FEATURE_DISABLED, admin, request, notes)


def lock_feature(db, institution_id, feature_key, admin, request=None, notes=None):
    return _set_feature_status(db, institution_id, feature_key, FeatureStatus.LOCKED,
                               SystemAuditAction.FEATURE_LOCKED, admin, request, notes)


def unlock_feature(db, institution_id, feature_key, admin, request=None, notes=None):
    return _set_feature_status(db, institution_id, feature_key, FeatureStatus.ENABLED,
                               SystemAuditAction.FEATURE_UNLOCKED, admin, request, notes)


def get_effective_feature_status(db: Session, institution_id: int, feature_key: FeatureKey) -> FeatureStatus:
    """Returns the server-authoritative feature status. Client flags must never override this."""
    ent = db.query(FeatureEntitlement).filter(
        FeatureEntitlement.institution_id == institution_id,
        FeatureEntitlement.feature_key == feature_key,
    ).first()
    if not ent:
        return FeatureStatus.ENABLED  # Default if not yet configured
    # Locked and Expired always override
    if ent.status in (FeatureStatus.LOCKED, FeatureStatus.EXPIRED):
        return ent.status
    if ent.expiry_date and ent.expiry_date < datetime.utcnow():
        return FeatureStatus.EXPIRED
    return ent.status


# ---------------------------------------------------------------------------
# Biometric Policy Operations
# ---------------------------------------------------------------------------

def get_biometric_policy(db: Session, institution_id: int) -> BiometricPolicy:
    inst = _get_institution_or_404(db, institution_id)
    return _ensure_biometric_policy(db, inst)


def update_biometric_policy(
    db: Session, institution_id: int, data: BiometricPolicyUpdate,
    admin: User, request: Optional[Request] = None
) -> BiometricPolicy:
    inst = _get_institution_or_404(db, institution_id)
    policy = _ensure_biometric_policy(db, inst)
    old_snapshot = {
        "allow_face_enrollment": policy.allow_face_enrollment,
        "allow_face_enrollment_update": policy.allow_face_enrollment_update,
        "allow_face_reenrollment": policy.allow_face_reenrollment,
        "require_admin_approval_for_enrollment": policy.require_admin_approval_for_enrollment,
        "require_admin_approval_for_update": policy.require_admin_approval_for_update,
    }

    if data.allow_face_enrollment is not None:
        policy.allow_face_enrollment = data.allow_face_enrollment
        action = (SystemAuditAction.FACE_ENROLLMENT_ENABLED if data.allow_face_enrollment
                  else SystemAuditAction.FACE_ENROLLMENT_DISABLED)
        _write_system_audit(db, admin=admin, institution=inst, action=action,
                            affected_resource=f"biometric_policy@institution:{institution_id}",
                            old_value=str(old_snapshot["allow_face_enrollment"]),
                            new_value=str(data.allow_face_enrollment), request=request)

    if data.allow_face_enrollment_update is not None:
        policy.allow_face_enrollment_update = data.allow_face_enrollment_update
        action = (SystemAuditAction.FACE_UPDATE_ENABLED if data.allow_face_enrollment_update
                  else SystemAuditAction.FACE_UPDATE_DISABLED)
        _write_system_audit(db, admin=admin, institution=inst, action=action,
                            affected_resource=f"biometric_policy@institution:{institution_id}",
                            old_value=str(old_snapshot["allow_face_enrollment_update"]),
                            new_value=str(data.allow_face_enrollment_update), request=request)

    if data.allow_face_reenrollment is not None:
        policy.allow_face_reenrollment = data.allow_face_reenrollment
        action = (SystemAuditAction.FACE_REENROLLMENT_ENABLED if data.allow_face_reenrollment
                  else SystemAuditAction.FACE_REENROLLMENT_DISABLED)
        _write_system_audit(db, admin=admin, institution=inst, action=action,
                            affected_resource=f"biometric_policy@institution:{institution_id}",
                            old_value=str(old_snapshot["allow_face_reenrollment"]),
                            new_value=str(data.allow_face_reenrollment), request=request)

    if data.require_admin_approval_for_enrollment is not None:
        policy.require_admin_approval_for_enrollment = data.require_admin_approval_for_enrollment
    if data.require_admin_approval_for_update is not None:
        policy.require_admin_approval_for_update = data.require_admin_approval_for_update

    policy.updated_by_id = admin.id
    db.commit()
    db.refresh(policy)
    return policy


# ---------------------------------------------------------------------------
# System Audit Log Query
# ---------------------------------------------------------------------------

def list_system_audit_logs(
    db: Session,
    institution_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[SystemAuditLog]:
    q = db.query(SystemAuditLog).order_by(SystemAuditLog.timestamp.desc())
    if institution_id:
        q = q.filter(SystemAuditLog.institution_id == institution_id)
    return q.limit(limit).offset(offset).all()


# ---------------------------------------------------------------------------
# Governance Control Panel Dashboard
# ---------------------------------------------------------------------------

def get_control_panel_dashboard(db: Session) -> dict:
    from sqlalchemy import func as sqlfunc

    institutions = db.query(Institution).all()
    total = len(institutions)
    active = sum(1 for i in institutions if i.status == InstitutionStatus.active)
    suspended = sum(1 for i in institutions if i.status == InstitutionStatus.suspended)
    trial = sum(1 for i in institutions if i.status == InstitutionStatus.trial)

    plan_counts: dict[str, int] = {}
    for i in institutions:
        plan_counts[i.plan.value] = plan_counts.get(i.plan.value, 0) + 1

    feature_counts = {}
    for status_val in FeatureStatus:
        feature_counts[status_val.value] = db.query(FeatureEntitlement).filter(
            FeatureEntitlement.status == status_val
        ).count()

    recent_logs = db.query(SystemAuditLog).order_by(SystemAuditLog.timestamp.desc()).limit(10).all()

    return {
        "total_institutions": total,
        "active_institutions": active,
        "suspended_institutions": suspended,
        "trial_institutions": trial,
        "institutions_by_plan": plan_counts,
        "enabled_features_count": feature_counts.get("ENABLED", 0),
        "disabled_features_count": feature_counts.get("DISABLED", 0),
        "locked_features_count": feature_counts.get("LOCKED", 0),
        "recent_system_changes": recent_logs,
    }


# ---------------------------------------------------------------------------
# Internal bootstrap
# ---------------------------------------------------------------------------

def _seed_institution_defaults(db: Session, inst: Institution) -> None:
    """Seed BiometricPolicy and default FeatureEntitlements when a new institution is created."""
    # Biometric policy
    policy = BiometricPolicy(institution_id=inst.id)
    db.add(policy)

    # Core features enabled by default
    default_enabled = [
        FeatureKey.ATTENDANCE,
        FeatureKey.GEOFENCING,
        FeatureKey.FACE_DETECTION,
        FeatureKey.FACE_ENROLLMENT,
        FeatureKey.FACE_UPDATE,
        FeatureKey.BIOMETRIC_ATTENDANCE,
        FeatureKey.LIVENESS,
        FeatureKey.OFFLINE_SYNC,
        FeatureKey.SUPERVISOR_DASHBOARD,
        FeatureKey.REPORTS,
    ]
    for fk in default_enabled:
        db.add(FeatureEntitlement(
            institution_id=inst.id,
            feature_key=fk,
            status=FeatureStatus.ENABLED,
        ))
    db.flush()
