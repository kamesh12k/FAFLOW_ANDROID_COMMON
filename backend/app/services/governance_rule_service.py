"""
Governance Rule Service — Business Rules & Period Configuration Control Plane
=============================================================================
The single authoritative source of truth for all configurable thresholds,
timings, limits, and period schedules across the FAFLOW platform.

Architecture:
- In-memory TTL cache (sub-millisecond reads) invalidated on every mutation.
- Strict validation engine: type safety, range constraints, security gates.
- Immutable audit history written on every mutation.
- Hardcoded baseline fallbacks guarantee zero service disruption on DB miss.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.governance_rule import BusinessRule, BusinessRuleHistory, PeriodConfig
from app.models.user import User

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Baseline Defaults (zero-regression fallback if DB not yet seeded)
# ─────────────────────────────────────────────────────────────────────────────
BASELINE_PERIOD_SCHEDULE: Dict[int, Tuple[str, str]] = {
    1: ("09:20", "10:20"),
    2: ("10:20", "11:15"),
    3: ("11:40", "12:35"),
    4: ("13:35", "14:30"),
    5: ("14:55", "15:50"),
}

BASELINE_RULES: Dict[str, str] = {
    "suggestion_lead_time_minutes": "15",
    "suggestion_start_window_minutes": "15",
    "suggestion_expiration_window_minutes": "15",
    "current_period_tolerance_minutes": "0",
    "student_attendance_submission_window_minutes": "15",
    "student_attendance_correction_window_hours": "24",
    "intelligence_student_shortage_threshold": "75.0",
    "staff_biometric_face_similarity_threshold": "0.60",
    "staff_geofence_gps_accuracy_threshold": "50.0",
    "leave_same_day_cancellation_cutoff_hour": "10",
    "substitution_action_cutoff_hour": "17",
    "emergency_window_hours": "2",
    "credit_penalty_on_leave": "-1",
    "credit_award_on_substitution": "1",
    "intelligence_high_absenteeism_threshold": "25.0",
    "intelligence_critical_absenteeism_threshold": "40.0",
    "intelligence_attendance_drop_threshold": "15.0",
    "intelligence_min_sample_sessions": "3",
    "periods_per_day": "5",
    "day_order_max": "6",
}

# Security hard limits — enforced regardless of DB values
SECURITY_GATES: Dict[str, Tuple[float, float]] = {
    "staff_biometric_face_similarity_threshold": (0.40, 0.95),
    "staff_geofence_gps_accuracy_threshold": (10.0, 150.0),
}

# ─────────────────────────────────────────────────────────────────────────────
# In-Memory TTL Cache
# ─────────────────────────────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 300  # 5 minutes; invalidated immediately on any write

_lock = threading.Lock()
_rules_cache: Optional[Dict[str, str]] = None
_periods_cache: Optional[Dict[int, Tuple[str, str]]] = None
_rules_cache_at: float = 0.0
_periods_cache_at: float = 0.0


def _invalidate_cache() -> None:
    global _rules_cache, _periods_cache, _rules_cache_at, _periods_cache_at
    with _lock:
        _rules_cache = None
        _periods_cache = None
        _rules_cache_at = 0.0
        _periods_cache_at = 0.0
    logger.debug("Governance rule cache invalidated.")


def _is_cache_fresh(cache_at: float) -> bool:
    return (time.monotonic() - cache_at) < _CACHE_TTL_SECONDS


# ─────────────────────────────────────────────────────────────────────────────
# Period Schedule
# ─────────────────────────────────────────────────────────────────────────────

def get_period_schedule(db: Session) -> Dict[int, Tuple[str, str]]:
    """
    Returns a mapping of period_number → (start_time, end_time) as strings ("HH:MM").
    Cache-backed; falls back to hardcoded baseline if DB unreachable.
    """
    global _periods_cache, _periods_cache_at
    with _lock:
        if _periods_cache is not None and _is_cache_fresh(_periods_cache_at):
            return _periods_cache.copy()

    try:
        rows = (
            db.query(PeriodConfig)
            .filter(PeriodConfig.is_enabled == True)
            .order_by(PeriodConfig.sort_order)
            .all()
        )
        if rows:
            schedule = {r.period_number: (r.start_time, r.end_time) for r in rows}
        else:
            logger.warning("period_configs table empty — using baseline defaults.")
            schedule = BASELINE_PERIOD_SCHEDULE.copy()
    except Exception as exc:
        logger.error("Failed to load period schedule from DB (%s) — using baseline.", exc)
        schedule = BASELINE_PERIOD_SCHEDULE.copy()

    with _lock:
        _periods_cache = schedule
        _periods_cache_at = time.monotonic()

    return schedule.copy()


def get_all_periods(db: Session) -> List[PeriodConfig]:
    """Returns all period config rows (including disabled) for admin UI."""
    try:
        return db.query(PeriodConfig).order_by(PeriodConfig.sort_order).all()
    except Exception as exc:
        logger.error("Failed to load all periods: %s", exc)
        return []


def update_periods(
    db: Session,
    periods: List[Dict[str, Any]],
    actor: Optional[User] = None,
) -> List[PeriodConfig]:
    """
    Bulk-upsert period configs. Validates no overlap, then commits.
    Each period dict: {period_number, name, start_time, end_time, is_break, is_enabled, sort_order}
    """
    # Validate: parse times and check no overlapping non-break periods
    parsed: List[Tuple[int, int, int, int]] = []  # (period_number, start_m, end_m, is_break)
    for p in periods:
        try:
            sh, sm = (int(x) for x in p["start_time"].split(":"))
            eh, em = (int(x) for x in p["end_time"].split(":"))
        except Exception:
            raise ValueError(f"Invalid time format for period {p.get('period_number')}: use HH:MM")
        start_m = sh * 60 + sm
        end_m = eh * 60 + em
        if start_m >= end_m:
            raise ValueError(f"Period {p.get('period_number')}: start_time must be before end_time")
        parsed.append((p["period_number"], start_m, end_m, p.get("is_break", False)))

    # Check overlaps among non-break periods
    active = [(n, s, e) for n, s, e, brk in parsed if not brk]
    for i in range(len(active)):
        for j in range(i + 1, len(active)):
            n1, s1, e1 = active[i]
            n2, s2, e2 = active[j]
            if s1 < e2 and s2 < e1:
                raise ValueError(f"Period {n1} and Period {n2} time ranges overlap")

    rows = []
    for p in periods:
        row = db.query(PeriodConfig).filter(PeriodConfig.period_number == p["period_number"]).first()
        if row is None:
            row = PeriodConfig(period_number=p["period_number"])
            db.add(row)
        row.name = p.get("name", f"Period {p['period_number']}")
        row.start_time = p["start_time"]
        row.end_time = p["end_time"]
        row.is_break = p.get("is_break", False)
        row.is_enabled = p.get("is_enabled", True)
        row.sort_order = p.get("sort_order", p["period_number"])
        rows.append(row)

    db.commit()
    _invalidate_cache()
    logger.info(
        "Period schedule updated by %s — %d periods saved.",
        actor.name if actor else "System",
        len(rows),
    )
    for row in rows:
        db.refresh(row)
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Business Rules
# ─────────────────────────────────────────────────────────────────────────────

def _load_rules_cache(db: Session) -> Dict[str, str]:
    """Load all rules into cache, refreshing if stale."""
    global _rules_cache, _rules_cache_at
    with _lock:
        if _rules_cache is not None and _is_cache_fresh(_rules_cache_at):
            return _rules_cache.copy()

    try:
        rows = db.query(BusinessRule).all()
        if rows:
            cache = {r.key: r.value for r in rows}
        else:
            logger.warning("business_rules table empty — using baseline defaults.")
            cache = BASELINE_RULES.copy()
    except Exception as exc:
        logger.error("Failed to load business rules from DB (%s) — using baseline.", exc)
        cache = BASELINE_RULES.copy()

    with _lock:
        _rules_cache = cache
        _rules_cache_at = time.monotonic()

    return cache.copy()


def get_rule_value(db: Session, key: str) -> str:
    """Returns the raw string value for a rule. Falls back to BASELINE_RULES."""
    cache = _load_rules_cache(db)
    return cache.get(key, BASELINE_RULES.get(key, ""))


def get_rule_int(db: Session, key: str) -> int:
    """Returns a rule as an integer. Falls back gracefully."""
    try:
        return int(get_rule_value(db, key))
    except (ValueError, TypeError):
        baseline = BASELINE_RULES.get(key, "0")
        try:
            return int(baseline)
        except ValueError:
            return 0


def get_rule_float(db: Session, key: str) -> float:
    """Returns a rule as a float. Falls back gracefully."""
    try:
        return float(get_rule_value(db, key))
    except (ValueError, TypeError):
        baseline = BASELINE_RULES.get(key, "0.0")
        try:
            return float(baseline)
        except ValueError:
            return 0.0


def get_rule_bool(db: Session, key: str) -> bool:
    val = get_rule_value(db, key).lower()
    return val in ("true", "1", "yes", "on")


def get_all_rules(
    db: Session,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[BusinessRule]:
    """Returns all business rules, optionally filtered by category or search term."""
    try:
        q = db.query(BusinessRule)
        if category:
            q = q.filter(BusinessRule.category == category)
        if search:
            term = f"%{search}%"
            q = q.filter(
                BusinessRule.key.ilike(term)
                | BusinessRule.display_name.ilike(term)
                | BusinessRule.description.ilike(term)
            )
        return q.order_by(BusinessRule.category, BusinessRule.key).all()
    except Exception as exc:
        logger.error("Failed to list business rules: %s", exc)
        return []


def get_rule(db: Session, key: str) -> Optional[BusinessRule]:
    """Returns a single BusinessRule model, or None if not found."""
    try:
        return db.query(BusinessRule).filter(BusinessRule.key == key).first()
    except Exception as exc:
        logger.error("Failed to get rule '%s': %s", key, exc)
        return None


def _validate_rule_value(rule: BusinessRule, new_value: str) -> str:
    """
    Validate new_value against type constraints, min/max, and security gates.
    Returns the validated, normalized string value or raises ValueError.
    """
    key = rule.key
    dtype = rule.data_type

    # Parse according to declared type
    if dtype in ("integer",):
        try:
            iv = int(new_value)
        except ValueError:
            raise ValueError(f"Rule '{key}' expects an integer value, got: {new_value!r}")
        if rule.minimum is not None and iv < rule.minimum:
            raise ValueError(f"Rule '{key}': value {iv} is below minimum {rule.minimum}")
        if rule.maximum is not None and iv > rule.maximum:
            raise ValueError(f"Rule '{key}': value {iv} exceeds maximum {rule.maximum}")
        # Security gate override for integer types
        if key in SECURITY_GATES:
            lo, hi = SECURITY_GATES[key]
            if not (lo <= iv <= hi):
                raise ValueError(f"Security gate: '{key}' must be between {lo} and {hi} (got {iv})")
        return str(iv)

    elif dtype in ("float", "percentage"):
        try:
            fv = float(new_value)
        except ValueError:
            raise ValueError(f"Rule '{key}' expects a float value, got: {new_value!r}")
        if dtype == "percentage" and not (0.0 <= fv <= 100.0):
            raise ValueError(f"Rule '{key}': percentage value must be between 0.0 and 100.0 (got {fv})")
        if rule.minimum is not None and fv < rule.minimum:
            raise ValueError(f"Rule '{key}': value {fv} is below minimum {rule.minimum}")
        if rule.maximum is not None and fv > rule.maximum:
            raise ValueError(f"Rule '{key}': value {fv} exceeds maximum {rule.maximum}")
        if key in SECURITY_GATES:
            lo, hi = SECURITY_GATES[key]
            if not (lo <= fv <= hi):
                raise ValueError(f"Security gate: '{key}' must be between {lo} and {hi} (got {fv})")
        return str(fv)

    elif dtype == "boolean":
        if new_value.lower() not in ("true", "false", "1", "0", "yes", "no"):
            raise ValueError(f"Rule '{key}' expects a boolean value (true/false), got: {new_value!r}")
        return "true" if new_value.lower() in ("true", "1", "yes") else "false"

    elif dtype == "string":
        if not new_value.strip():
            raise ValueError(f"Rule '{key}': string value cannot be empty")
        return new_value.strip()

    elif dtype == "json":
        try:
            json.loads(new_value)
        except json.JSONDecodeError as e:
            raise ValueError(f"Rule '{key}': invalid JSON — {e}")
        return new_value

    else:
        return new_value


def update_rule(
    db: Session,
    key: str,
    new_value: str,
    reason: str,
    actor: Optional[User] = None,
) -> BusinessRule:
    """
    Update a business rule value with full validation, version increment, and audit logging.
    Raises ValueError on validation failure, LookupError if rule not found.
    """
    clean_reason = (reason or "").strip()
    if not clean_reason or len(clean_reason) < 5:
        raise ValueError("A reason of at least 5 characters is required when changing a business rule.")

    rule = db.query(BusinessRule).filter(BusinessRule.key == key).with_for_update().first()
    if not rule:
        raise LookupError(f"Business rule '{key}' not found.")

    validated_value = _validate_rule_value(rule, new_value)

    old_value = rule.value

    # Write history record
    history = BusinessRuleHistory(
        rule_key=key,
        version=rule.version,
        old_value=old_value,
        new_value=validated_value,
        reason=clean_reason,
        changed_by_id=actor.id if actor else None,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(history)

    # Apply mutation
    rule.value = validated_value
    rule.version = rule.version + 1
    rule.updated_at = datetime.now(timezone.utc)
    rule.updated_by_id = actor.id if actor else None

    db.commit()
    db.refresh(rule)

    _invalidate_cache()

    logger.info(
        "Business rule '%s' updated: %r → %r (v%d) by %s — reason: %s",
        key, old_value, validated_value, rule.version,
        actor.name if actor else "System",
        clean_reason,
    )
    return rule


def reset_rule(
    db: Session,
    key: str,
    reason: str,
    actor: Optional[User] = None,
) -> BusinessRule:
    """Resets a rule to its default_value with audit logging."""
    rule = db.query(BusinessRule).filter(BusinessRule.key == key).with_for_update().first()
    if not rule:
        raise LookupError(f"Business rule '{key}' not found.")
    return update_rule(db, key, rule.default_value, reason or "Reset to factory default", actor)


def get_rule_history(
    db: Session,
    key: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[BusinessRuleHistory]:
    """Returns change history, optionally filtered by rule key."""
    try:
        q = db.query(BusinessRuleHistory)
        if key:
            q = q.filter(BusinessRuleHistory.rule_key == key)
        return q.order_by(BusinessRuleHistory.changed_at.desc()).limit(limit).offset(offset).all()
    except Exception as exc:
        logger.error("Failed to load rule history: %s", exc)
        return []


def rollback_rule(
    db: Session,
    history_id: int,
    reason: str,
    actor: Optional[User] = None,
) -> BusinessRule:
    """Restores a rule to the value recorded in a specific history entry."""
    entry = db.query(BusinessRuleHistory).filter(BusinessRuleHistory.id == history_id).first()
    if not entry:
        raise LookupError(f"History entry #{history_id} not found.")
    target_value = entry.old_value
    if target_value is None:
        raise ValueError(f"History entry #{history_id} has no prior value to roll back to.")
    rollback_reason = reason or f"Rollback to version {entry.version} (history #{history_id})"
    return update_rule(db, entry.rule_key, target_value, rollback_reason, actor)


def validate_rule_preview(
    db: Session,
    key: str,
    new_value: str,
) -> Dict[str, Any]:
    """
    Previews what a rule change would do without committing.
    Returns affected modules, current value, new value, and any validation errors.
    """
    rule = get_rule(db, key)
    if not rule:
        return {"valid": False, "error": f"Rule '{key}' not found."}
    try:
        validated = _validate_rule_value(rule, new_value)
        return {
            "valid": True,
            "key": key,
            "display_name": rule.display_name,
            "current_value": rule.value,
            "new_value": validated,
            "data_type": rule.data_type,
            "unit": rule.unit,
            "affected_modules": json.loads(rule.affected_modules) if rule.affected_modules else [],
            "severity": rule.severity,
            "security_critical": rule.security_critical,
            "requires_restart": rule.requires_restart,
            "is_modified_from_default": validated != rule.default_value,
        }
    except ValueError as e:
        return {"valid": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Public Config (lightweight endpoint for Android & Web clients)
# ─────────────────────────────────────────────────────────────────────────────

def get_public_config(db: Session) -> Dict[str, Any]:
    """
    Returns a lightweight, unauthenticated runtime config for Android and Web.
    Consumed on startup/background sync by mobile clients.
    """
    schedule = get_period_schedule(db)
    periods_list = [
        {
            "period_number": pn,
            "start_time": st,
            "end_time": et,
            "label": f"{st}–{et}",
        }
        for pn, (st, et) in sorted(schedule.items())
    ]

    return {
        "period_schedule": periods_list,
        "suggestion_lead_time_minutes": get_rule_int(db, "suggestion_lead_time_minutes"),
        "suggestion_start_window_minutes": get_rule_int(db, "suggestion_start_window_minutes"),
        "suggestion_expiration_window_minutes": get_rule_int(db, "suggestion_expiration_window_minutes"),
        "current_period_tolerance_minutes": get_rule_int(db, "current_period_tolerance_minutes"),
        "student_attendance_submission_window_minutes": get_rule_int(db, "student_attendance_submission_window_minutes"),
        "periods_per_day": get_rule_int(db, "periods_per_day"),
        "day_order_max": get_rule_int(db, "day_order_max"),
    }
