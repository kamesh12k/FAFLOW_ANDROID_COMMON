"""
Governance Control Plane — FastAPI Router
SYSTEM_ADMIN-only endpoints. All mutation operations require Role.system_admin.
GET operations return 200 for system_admin; 403 for all other roles.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_system_admin, get_current_user
from app.models.user import User
from app.models.governance_control import FeatureKey, PlanTier
from app.schemas.governance_control import (
    InstitutionCreate, InstitutionUpdate, InstitutionOut,
    FeatureEntitlementOut, FeatureActionRequest,
    BiometricPolicyOut, BiometricPolicyUpdate,
    SystemAuditLogOut, GovernanceDashboardOut,
)
from app.services import governance_control_service as svc

router = APIRouter(prefix="/system", tags=["Governance Control Plane"])


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=GovernanceDashboardOut)
def get_control_panel_dashboard(
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Governance Control Plane KPI dashboard. SYSTEM_ADMIN only."""
    return svc.get_control_panel_dashboard(db)


# ─────────────────────────────────────────────────────────────────────────────
# Institution Management
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/institutions", response_model=List[InstitutionOut])
def list_institutions(
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Lists all registered institutions. SYSTEM_ADMIN only."""
    return svc.list_institutions(db)


@router.post("/institutions", response_model=InstitutionOut, status_code=status.HTTP_201_CREATED)
def create_institution(
    data: InstitutionCreate,
    request: Request,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Creates a new institution with default feature entitlements and biometric policy. SYSTEM_ADMIN only."""
    return svc.create_institution(db, data, current_user, request)


@router.get("/institutions/{institution_id}", response_model=InstitutionOut)
def get_institution(
    institution_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Retrieves institution details. SYSTEM_ADMIN only."""
    return svc.get_institution(db, institution_id)


@router.put("/institutions/{institution_id}", response_model=InstitutionOut)
def update_institution(
    institution_id: int,
    data: InstitutionUpdate,
    request: Request,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Updates institution metadata, status, or plan assignment. SYSTEM_ADMIN only."""
    return svc.update_institution(db, institution_id, data, current_user, request)


@router.post("/institutions/{institution_id}/assign-plan", response_model=InstitutionOut)
def assign_plan(
    institution_id: int,
    plan: PlanTier = Query(...),
    request: Request = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Assigns or changes a subscription plan for an institution. SYSTEM_ADMIN only."""
    return svc.assign_plan(db, institution_id, plan, current_user, request)


# ─────────────────────────────────────────────────────────────────────────────
# Feature Entitlements
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/institutions/{institution_id}/features", response_model=List[FeatureEntitlementOut])
def list_features(
    institution_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Lists all feature entitlements for an institution. SYSTEM_ADMIN only."""
    return svc.list_institution_features(db, institution_id)


@router.post("/institutions/{institution_id}/features/{feature_key}/enable",
             response_model=FeatureEntitlementOut)
def enable_feature(
    institution_id: int,
    feature_key: FeatureKey,
    data: FeatureActionRequest = FeatureActionRequest(),
    request: Request = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Enables a feature for an institution. SYSTEM_ADMIN only."""
    return svc.enable_feature(db, institution_id, feature_key, current_user, request, data.notes)


@router.post("/institutions/{institution_id}/features/{feature_key}/disable",
             response_model=FeatureEntitlementOut)
def disable_feature(
    institution_id: int,
    feature_key: FeatureKey,
    data: FeatureActionRequest = FeatureActionRequest(),
    request: Request = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Disables a feature for an institution. SYSTEM_ADMIN only."""
    return svc.disable_feature(db, institution_id, feature_key, current_user, request, data.notes)


@router.post("/institutions/{institution_id}/features/{feature_key}/lock",
             response_model=FeatureEntitlementOut)
def lock_feature(
    institution_id: int,
    feature_key: FeatureKey,
    data: FeatureActionRequest = FeatureActionRequest(),
    request: Request = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Locks a feature, preventing any client-side override. SYSTEM_ADMIN only."""
    return svc.lock_feature(db, institution_id, feature_key, current_user, request, data.notes)


@router.post("/institutions/{institution_id}/features/{feature_key}/unlock",
             response_model=FeatureEntitlementOut)
def unlock_feature(
    institution_id: int,
    feature_key: FeatureKey,
    data: FeatureActionRequest = FeatureActionRequest(),
    request: Request = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Unlocks a locked feature. SYSTEM_ADMIN only."""
    return svc.unlock_feature(db, institution_id, feature_key, current_user, request, data.notes)


# ─────────────────────────────────────────────────────────────────────────────
# Biometric Policy
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/institutions/{institution_id}/biometric-policy", response_model=BiometricPolicyOut)
def get_biometric_policy(
    institution_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Returns the institution biometric policy. SYSTEM_ADMIN only."""
    return svc.get_biometric_policy(db, institution_id)


@router.put("/institutions/{institution_id}/biometric-policy", response_model=BiometricPolicyOut)
def update_biometric_policy(
    institution_id: int,
    data: BiometricPolicyUpdate,
    request: Request,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Updates the institution biometric policy. SYSTEM_ADMIN only. Every change is audit logged."""
    return svc.update_biometric_policy(db, institution_id, data, current_user, request)


# ─────────────────────────────────────────────────────────────────────────────
# Authoritative Policy Endpoint (used by Android & Web at runtime)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/institutions/{institution_id}/policy")
def get_institution_policy(
    institution_id: int,
    current_user: User = Depends(get_current_user),  # Any authenticated user
    db: Session = Depends(get_db),
):
    """
    Returns the authoritative server-side policy for this institution.
    Android and Web MUST call this endpoint before allowing sensitive operations.
    Client-side cached flags MUST NOT override the response from this endpoint.
    """
    from app.models.governance_control import FeatureKey as FK
    policy = svc.get_biometric_policy(db, institution_id)

    face_enrollment_status = svc.get_effective_feature_status(db, institution_id, FK.FACE_ENROLLMENT)
    face_update_status = svc.get_effective_feature_status(db, institution_id, FK.FACE_UPDATE)
    biometric_status = svc.get_effective_feature_status(db, institution_id, FK.BIOMETRIC_ATTENDANCE)
    geofence_status = svc.get_effective_feature_status(db, institution_id, FK.GEOFENCING)
    liveness_status = svc.get_effective_feature_status(db, institution_id, FK.LIVENESS)

    return {
        "institution_id": institution_id,
        "face_enrollment_allowed": (
            policy.allow_face_enrollment
            and face_enrollment_status.value == "ENABLED"
        ),
        "face_enrollment_update_allowed": (
            policy.allow_face_enrollment_update
            and face_update_status.value == "ENABLED"
        ),
        "face_reenrollment_allowed": (
            policy.allow_face_reenrollment
            and face_enrollment_status.value == "ENABLED"
        ),
        "biometric_attendance_enabled": biometric_status.value == "ENABLED",
        "geofencing_enabled": geofence_status.value == "ENABLED",
        "liveness_enabled": liveness_status.value == "ENABLED",
        "face_enrollment_feature_status": face_enrollment_status.value,
        "face_update_feature_status": face_update_status.value,
    }


# ─────────────────────────────────────────────────────────────────────────────
# System Audit Logs
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[SystemAuditLogOut])
def list_audit_logs(
    institution_id: Optional[int] = Query(None, description="Filter by institution"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Returns immutable system audit log entries. SYSTEM_ADMIN only."""
    return svc.list_system_audit_logs(db, institution_id, limit, offset)
