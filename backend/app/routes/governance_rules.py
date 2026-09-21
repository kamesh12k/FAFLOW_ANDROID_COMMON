"""
Business Rules & Period Configuration API Router
=================================================
All admin-authenticated endpoints for the Governance Business Rules Control Plane.

Protected by: require_admin (system_admin or admin with full access)
Public endpoint: GET /system/governance/public-config (no auth — for Android & Web sync)
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.governance_rules import (
    BusinessRuleOut,
    BusinessRuleHistoryOut,
    BusinessRuleUpdateRequest,
    ValidateRuleRequest,
    ValidateRuleResponse,
    ResetRuleRequest,
    RollbackRuleRequest,
    PeriodConfigOut,
    PeriodsUpdateRequest,
    PublicGovernanceConfigOut,
)
from app.services import governance_rule_service as svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system/governance", tags=["Business Rules & Governance"])


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — No Auth Required (consumed by Android & Web on startup)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/public-config",
    response_model=PublicGovernanceConfigOut,
    summary="Lightweight runtime config for Android & Web clients",
)
def get_public_config(db: Session = Depends(get_db)):
    """
    Returns period schedule and key suggestion/submission windows.
    No authentication required. Safe to call on app startup.
    Backed by the TTL cache — sub-millisecond reads under normal operation.
    """
    return svc.get_public_config(db)


# ─────────────────────────────────────────────────────────────────────────────
# Business Rules — Admin Only
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/rules",
    response_model=List[BusinessRuleOut],
    summary="List all business rules (with optional category/search filter)",
)
def list_rules(
    category: Optional[str] = Query(None, description="Filter by category slug"),
    search: Optional[str] = Query(None, description="Search key, display_name, or description"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Returns all configurable business rules, optionally filtered by category or search.
    """
    return svc.get_all_rules(db, category=category, search=search)


@router.get(
    "/rules/{key}",
    response_model=BusinessRuleOut,
    summary="Get a single business rule by key",
)
def get_rule(
    key: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = svc.get_rule(db, key)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule '{key}' not found.")
    return rule


@router.put(
    "/rules/{key}",
    response_model=BusinessRuleOut,
    summary="Update a business rule value",
)
def update_rule(
    key: str,
    data: BusinessRuleUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Updates the value of a business rule. Requires a justification reason.
    Increments version, writes immutable audit history, invalidates cache.
    """
    try:
        return svc.update_rule(db, key, data.value, data.reason, actor=current_user)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post(
    "/rules/validate",
    response_model=ValidateRuleResponse,
    summary="Preview validation of a proposed rule change",
)
def validate_rule(
    data: ValidateRuleRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Preview a proposed value change: validates type, range, security gates,
    and returns affected modules + impact summary — without committing.
    """
    return svc.validate_rule_preview(db, data.key, data.value)


@router.post(
    "/rules/reset/{key}",
    response_model=BusinessRuleOut,
    summary="Reset a rule to its factory default value",
)
def reset_rule(
    key: str,
    data: ResetRuleRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Restores the rule to its default_value and logs the reset in history."""
    try:
        return svc.reset_rule(db, key, data.reason, actor=current_user)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Rule History & Rollback
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=List[BusinessRuleHistoryOut],
    summary="Complete governance change history",
)
def get_history(
    key: Optional[str] = Query(None, description="Filter by rule key"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns all rule change history, newest first. Optionally filtered by rule key."""
    entries = svc.get_rule_history(db, key=key, limit=limit, offset=offset)
    result = []
    for e in entries:
        actor_name = e.changed_by.name if e.changed_by else "System"
        result.append(
            BusinessRuleHistoryOut(
                id=e.id,
                rule_key=e.rule_key,
                version=e.version,
                old_value=e.old_value,
                new_value=e.new_value,
                reason=e.reason,
                changed_by_id=e.changed_by_id,
                changed_by_name=actor_name,
                changed_at=e.changed_at,
            )
        )
    return result


@router.get(
    "/rules/{key}/history",
    response_model=List[BusinessRuleHistoryOut],
    summary="Change history for a specific rule",
)
def get_rule_history(
    key: str,
    limit: int = Query(20, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entries = svc.get_rule_history(db, key=key, limit=limit)
    result = []
    for e in entries:
        actor_name = e.changed_by.name if e.changed_by else "System"
        result.append(
            BusinessRuleHistoryOut(
                id=e.id,
                rule_key=e.rule_key,
                version=e.version,
                old_value=e.old_value,
                new_value=e.new_value,
                reason=e.reason,
                changed_by_id=e.changed_by_id,
                changed_by_name=actor_name,
                changed_at=e.changed_at,
            )
        )
    return result


@router.post(
    "/rollback/{history_id}",
    response_model=BusinessRuleOut,
    summary="Roll back a rule to a previous version",
)
def rollback_rule(
    history_id: int,
    data: RollbackRuleRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Restores a rule to the value it held at the given history entry (pre-change snapshot)."""
    try:
        return svc.rollback_rule(db, history_id, data.reason, actor=current_user)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Period Schedule
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/periods",
    response_model=List[PeriodConfigOut],
    summary="Get institutional period schedule",
)
def get_periods(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns all period configurations including disabled periods."""
    return svc.get_all_periods(db)


@router.put(
    "/periods",
    response_model=List[PeriodConfigOut],
    summary="Bulk update institutional period schedule",
)
def update_periods(
    data: PeriodsUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Bulk-upserts all period configurations.
    Validates: no overlap, start < end, time format.
    Immediately invalidates the governance cache so all services reflect the change.
    """
    try:
        periods_dicts = [p.model_dump() for p in data.periods]
        return svc.update_periods(db, periods_dicts, actor=current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
