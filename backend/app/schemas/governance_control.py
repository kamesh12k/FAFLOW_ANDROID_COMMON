"""
Governance Control Plane — Pydantic Schemas
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.governance_control import (
    PlanTier, FeatureKey, FeatureStatus, InstitutionStatus, SystemAuditAction
)


# ---------------------------------------------------------------------------
# Institution Schemas
# ---------------------------------------------------------------------------

class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    short_code: str = Field(..., min_length=2, max_length=20)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    plan: PlanTier = PlanTier.basic


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    plan: Optional[PlanTier] = None
    status: Optional[InstitutionStatus] = None


class InstitutionOut(BaseModel):
    id: int
    name: str
    short_code: str
    contact_email: Optional[str]
    contact_phone: Optional[str]
    status: InstitutionStatus
    plan: PlanTier
    plan_assigned_at: Optional[datetime]
    plan_expires_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Feature Entitlement Schemas
# ---------------------------------------------------------------------------

class FeatureEntitlementOut(BaseModel):
    id: int
    institution_id: int
    feature_key: FeatureKey
    status: FeatureStatus
    display_name: Optional[str]
    description: Optional[str]
    activation_date: Optional[datetime]
    expiry_date: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FeatureActionRequest(BaseModel):
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Biometric Policy Schemas
# ---------------------------------------------------------------------------

class BiometricPolicyOut(BaseModel):
    id: int
    institution_id: int
    allow_face_enrollment: bool
    allow_face_enrollment_update: bool
    allow_face_reenrollment: bool
    require_admin_approval_for_enrollment: bool
    require_admin_approval_for_update: bool
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BiometricPolicyUpdate(BaseModel):
    allow_face_enrollment: Optional[bool] = None
    allow_face_enrollment_update: Optional[bool] = None
    allow_face_reenrollment: Optional[bool] = None
    require_admin_approval_for_enrollment: Optional[bool] = None
    require_admin_approval_for_update: Optional[bool] = None


# ---------------------------------------------------------------------------
# Plan Definition Schemas
# ---------------------------------------------------------------------------

class PlanDefinitionOut(BaseModel):
    id: int
    plan_tier: PlanTier
    display_name: str
    description: Optional[str]
    included_features: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# System Audit Log Schemas
# ---------------------------------------------------------------------------

class SystemAuditLogOut(BaseModel):
    id: int
    event_id: str
    timestamp: datetime
    system_admin_id: Optional[int]
    institution_id: Optional[int]
    action: SystemAuditAction
    affected_resource: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    request_id: Optional[str]
    ip_address: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Governance Control Plane Dashboard Schema
# ---------------------------------------------------------------------------

class GovernanceDashboardOut(BaseModel):
    total_institutions: int
    active_institutions: int
    suspended_institutions: int
    trial_institutions: int
    institutions_by_plan: dict
    enabled_features_count: int
    disabled_features_count: int
    locked_features_count: int
    recent_system_changes: List[SystemAuditLogOut]
