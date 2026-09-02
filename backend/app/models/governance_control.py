"""
Governance Control Plane — Database Models
Institutions, Feature Entitlements, Biometric Policy, Plans, System Audit Log
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text,
    func, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class PlanTier(str, enum.Enum):
    free = "free"
    basic = "basic"
    pro = "pro"
    enterprise = "enterprise"
    custom = "custom"


class FeatureKey(str, enum.Enum):
    ATTENDANCE = "ATTENDANCE"
    GEOFENCING = "GEOFENCING"
    FACE_DETECTION = "FACE_DETECTION"
    FACE_ENROLLMENT = "FACE_ENROLLMENT"
    FACE_UPDATE = "FACE_UPDATE"
    BIOMETRIC_ATTENDANCE = "BIOMETRIC_ATTENDANCE"
    LIVENESS = "LIVENESS"
    OFFLINE_SYNC = "OFFLINE_SYNC"
    SUPERVISOR_DASHBOARD = "SUPERVISOR_DASHBOARD"
    REPORTS = "REPORTS"
    ADVANCED_ANALYTICS = "ADVANCED_ANALYTICS"
    API_ACCESS = "API_ACCESS"
    MULTI_CAMPUS = "MULTI_CAMPUS"
    ADVANCED_GEOFENCING = "ADVANCED_GEOFENCING"


class FeatureStatus(str, enum.Enum):
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"
    LOCKED = "LOCKED"
    TRIAL = "TRIAL"
    EXPIRED = "EXPIRED"


class InstitutionStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"
    deactivated = "deactivated"


class SystemAuditAction(str, enum.Enum):
    SYSTEM_GEOFENCE_CREATED = "SYSTEM_GEOFENCE_CREATED"
    SYSTEM_GEOFENCE_UPDATED = "SYSTEM_GEOFENCE_UPDATED"
    SYSTEM_GEOFENCE_DELETED = "SYSTEM_GEOFENCE_DELETED"
    SYSTEM_GEOFENCE_ENABLED = "SYSTEM_GEOFENCE_ENABLED"
    SYSTEM_GEOFENCE_DISABLED = "SYSTEM_GEOFENCE_DISABLED"
    FACE_ENROLLMENT_ENABLED = "FACE_ENROLLMENT_ENABLED"
    FACE_ENROLLMENT_DISABLED = "FACE_ENROLLMENT_DISABLED"
    FACE_UPDATE_ENABLED = "FACE_UPDATE_ENABLED"
    FACE_UPDATE_DISABLED = "FACE_UPDATE_DISABLED"
    FACE_REENROLLMENT_ENABLED = "FACE_REENROLLMENT_ENABLED"
    FACE_REENROLLMENT_DISABLED = "FACE_REENROLLMENT_DISABLED"
    FEATURE_ENABLED = "FEATURE_ENABLED"
    FEATURE_DISABLED = "FEATURE_DISABLED"
    FEATURE_LOCKED = "FEATURE_LOCKED"
    FEATURE_UNLOCKED = "FEATURE_UNLOCKED"
    PLAN_ASSIGNED = "PLAN_ASSIGNED"
    PLAN_CHANGED = "PLAN_CHANGED"
    INSTITUTION_CREATED = "INSTITUTION_CREATED"
    INSTITUTION_UPDATED = "INSTITUTION_UPDATED"
    INSTITUTION_ACTIVATED = "INSTITUTION_ACTIVATED"
    INSTITUTION_SUSPENDED = "INSTITUTION_SUSPENDED"


# ---------------------------------------------------------------------------
# Institution / Tenant
# ---------------------------------------------------------------------------

class Institution(Base):
    """Top-level tenant entity. Every policy is scoped to an institution."""
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    short_code = Column(String(20), nullable=False, unique=True)
    contact_email = Column(String(150), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    status = Column(
        Enum(InstitutionStatus, name="institution_status", create_type=False),
        default=InstitutionStatus.active,
        nullable=False,
    )
    plan = Column(
        Enum(PlanTier, name="plan_tier", create_type=False),
        default=PlanTier.basic,
        nullable=False,
    )
    plan_assigned_at = Column(DateTime(timezone=True), nullable=True)
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    feature_entitlements = relationship("FeatureEntitlement", back_populates="institution", cascade="all, delete-orphan")
    biometric_policy = relationship("BiometricPolicy", back_populates="institution", uselist=False, cascade="all, delete-orphan")
    system_audit_logs = relationship("SystemAuditLog", back_populates="institution", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Plan Definition
# ---------------------------------------------------------------------------

class PlanDefinition(Base):
    """Defines what features are included in each plan tier."""
    __tablename__ = "plan_definitions"

    id = Column(Integer, primary_key=True, index=True)
    plan_tier = Column(
        Enum(PlanTier, name="plan_tier", create_type=False),
        nullable=False,
        unique=True,
    )
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    included_features = Column(Text, nullable=True)  # JSON array of FeatureKey values
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Feature Entitlement (per Institution × Feature)
# ---------------------------------------------------------------------------

class FeatureEntitlement(Base):
    """Controls feature availability for a specific institution."""
    __tablename__ = "feature_entitlements"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key = Column(
        Enum(FeatureKey, name="feature_key", create_type=False),
        nullable=False,
    )
    status = Column(
        Enum(FeatureStatus, name="feature_status", create_type=False),
        default=FeatureStatus.ENABLED,
        nullable=False,
    )
    display_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    activation_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    locked_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    institution = relationship("Institution", back_populates="feature_entitlements")

    __table_args__ = (
        UniqueConstraint("institution_id", "feature_key", name="uq_institution_feature"),
    )


# ---------------------------------------------------------------------------
# Biometric Policy (per Institution)
# ---------------------------------------------------------------------------

class BiometricPolicy(Base):
    """Institution-scoped biometric and face enrollment policy."""
    __tablename__ = "biometric_policies"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    allow_face_enrollment = Column(Boolean, default=True, nullable=False)
    allow_face_enrollment_update = Column(Boolean, default=True, nullable=False)
    allow_face_reenrollment = Column(Boolean, default=False, nullable=False)
    require_admin_approval_for_enrollment = Column(Boolean, default=False, nullable=False)
    require_admin_approval_for_update = Column(Boolean, default=False, nullable=False)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    institution = relationship("Institution", back_populates="biometric_policy")


# ---------------------------------------------------------------------------
# Immutable System Audit Log
# ---------------------------------------------------------------------------

class SystemAuditLog(Base):
    """Append-only record of every Governance Control Plane configuration change."""
    __tablename__ = "system_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(36), nullable=False, unique=True, index=True)  # UUID
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    system_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(
        Enum(SystemAuditAction, name="system_audit_action", create_type=False),
        nullable=False,
    )
    affected_resource = Column(String(200), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True)
    ip_address = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    system_admin = relationship("User", foreign_keys=[system_admin_id])
    institution = relationship("Institution", back_populates="system_audit_logs")
