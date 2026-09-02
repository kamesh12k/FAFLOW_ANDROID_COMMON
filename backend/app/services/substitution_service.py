"""
Autonomous Substitution Engine.

Three things live here:
  1. Hard eligibility — who CAN be assigned at all (never violated,
     regardless of mode or score).
  2. The recommendation/compatibility scorer — ranks eligible candidates
     so a human (Assisted mode) or the system itself (Autonomous mode)
     can pick the best one.
  3. Mode-aware execution — what actually happens after a leave is
     approved, driven by the campus_operations_mode setting.

Design note on "fairness": rather than a separate running-counter table
that could drift out of sync with reality, fairness is computed on demand
directly from alter_assignments — the substitution record IS the source
of truth, so there's only ever one place that can disagree with itself.
This trades a small amount of query cost for never needing a
reconciliation job.
"""
from datetime import date, datetime, timedelta, timezone
from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.subject import Subject
from app.models.department import Department
from app.models.class_ import Class
from app.models.substitution_preference import SubstitutionPreference
from app.models.system_setting import SystemSetting, CAMPUS_OPERATIONS_MODES
from app.services.credit_service import apply_credit_change
from app.services import notification_service
from app.services.admin_service import log_audit_event
from app.services.system_setting_service import get_setting, set_setting

FAIRNESS_WINDOW_DAYS = 30  # "monthly substitutions" window for fairness scoring
LEAVE_RECOVERY_LOOKBACK_DAYS = 30  # Lookback window for completed approved leave
MAX_LEAVE_RECOVERY_BONUS = 7.0  # Maximum bonus points for leave recovery rebalancing


# ---------- Leave-Aware Fairness / Workload Rebalancing ----------

def _calculate_leave_duration_bonus(days: int) -> float:
    """
    Graduated bonus based on continuous completed approved leave duration:
      0 days    -> +0
      1–2 days  -> +1
      3–4 days  -> +2
      5–6 days  -> +3
      7–9 days  -> +5
      10+ days  -> +7
    """
    if days <= 0:
        return 0.0
    elif days <= 2:
        return 1.0
    elif days <= 4:
        return 2.0
    elif days <= 6:
        return 3.0
    elif days <= 9:
        return 5.0
    else:
        return 7.0


def _calculate_leave_recency_factor(days_since_end: int, lookback_days: int = LEAVE_RECOVERY_LOOKBACK_DAYS) -> float:
    """
    Calculates a linear decay recency factor (0.0 to 1.0) for a completed leave:
      - 1 day ago  -> 1.0 (strongest contribution)
      - 15 days ago -> ~0.53 (moderate contribution)
      - 30 days ago -> ~0.03 (small contribution)
      - >30 days / future (<=0) -> 0.0 (no contribution)
    """
    if days_since_end < 1 or days_since_end > lookback_days:
        return 0.0
    return max(0.0, min(1.0, 1.0 - (days_since_end - 1) / float(lookback_days)))


def calculate_leave_recovery(
    db: Session,
    teacher_id: int,
    target_date: date,
    lookback_days: int = LEAVE_RECOVERY_LOOKBACK_DAYS,
) -> tuple[float, str | None, int, int]:
    """
    Computes leave-aware workload rebalancing / recovery bonus (0.0 to 7.0 pts).
    
    Considers only completed approved leave (dates strictly before target_date)
    ending within the lookback window. Contiguous leave dates are merged into
    continuous durations.
    
    Returns:
        (bonus, explanation_reason, continuous_days, days_since_end)
    """
    earliest_date = target_date - timedelta(days=lookback_days + 90)
    rows = (
        db.query(LeaveRequest.date)
        .filter(
            LeaveRequest.teacher_id == teacher_id,
            LeaveRequest.status == LeaveStatus.approved,
            LeaveRequest.date < target_date,
            LeaveRequest.date >= earliest_date,
        )
        .distinct()
        .order_by(LeaveRequest.date.asc())
        .all()
    )

    if not rows:
        return 0.0, None, 0, 0

    leave_dates = sorted({r[0] for r in rows})
    if not leave_dates:
        return 0.0, None, 0, 0

    # Group into contiguous blocks of calendar dates
    blocks: list[tuple[date, date, int]] = []
    curr_start = leave_dates[0]
    curr_end = leave_dates[0]

    for d in leave_dates[1:]:
        if d == curr_end + timedelta(days=1):
            curr_end = d
        else:
            blocks.append((curr_start, curr_end, (curr_end - curr_start).days + 1))
            curr_start = d
            curr_end = d
    blocks.append((curr_start, curr_end, (curr_end - curr_start).days + 1))

    best_bonus = 0.0
    best_reason = None
    best_dur = 0
    best_days_ago = 0

    for _, end_d, dur in blocks:
        days_since_end = (target_date - end_d).days
        if days_since_end < 1 or days_since_end > lookback_days:
            continue

        dur_bonus = _calculate_leave_duration_bonus(dur)
        recency = _calculate_leave_recency_factor(days_since_end, lookback_days)
        bonus = round(min(MAX_LEAVE_RECOVERY_BONUS, dur_bonus * recency), 1)

        if bonus > best_bonus:
            best_bonus = bonus
            best_dur = dur
            best_days_ago = days_since_end
            best_reason = f"Returned from {dur}-day approved leave ({days_since_end}d ago)"

    return best_bonus, best_reason, best_dur, best_days_ago


# ---------- Hard eligibility ----------

@dataclass
class Candidate:
    teacher: User
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    same_subject: bool = False
    same_department: bool = False
    workload_count: int = 0
    fairness: float = 0.0
    today_workload: int = 0
    projected_today_workload: int = 0
    today_periods: list[int] = field(default_factory=list)
    week_workload: int = 0
    projected_week_workload: int = 0
    substitutions_today: int = 0
    substitutions_week: int = 0
    longest_continuous_periods: int = 0
    projected_longest_continuous_periods: int = 0
    leave_recovery: float = 0.0
    leave_recovery_reason: str | None = None


VALID_MODES = CAMPUS_OPERATIONS_MODES


def get_mode(db: Session, tenant_department_id: int | None = None) -> str:
    # 1. Check global override first
    override = get_setting(db, "campus_operations_mode_override", "none", None)
    if override in {"manual", "assisted", "autonomous"}:
        return override
    # 2. Otherwise fall back to department or global setting
    val = get_setting(db, "campus_operations_mode", "manual", tenant_department_id)
    return val if val in VALID_MODES else "manual"


def get_configured_mode(db: Session, tenant_department_id: int | None = None) -> str:
    val = get_setting(db, "campus_operations_mode", "manual", tenant_department_id)
    return val if val in VALID_MODES else "manual"


def get_global_override(db: Session) -> str:
    val = get_setting(db, "campus_operations_mode_override", "none", None)
    return val if val in {"none", "manual", "assisted", "autonomous"} else "none"


def set_global_override(db: Session, override: str, actor: User) -> str:
    if override not in {"none", "manual", "assisted", "autonomous"}:
        raise HTTPException(status_code=400, detail="override must be one of none, manual, assisted, autonomous")
    set_setting(db, "campus_operations_mode_override", override, None)
    log_audit_event(db, actor.id, "campus_operations.override_change", "system_setting", None, {"override": override})
    db.commit()
    return override


def set_mode(db: Session, mode: str, actor: User, tenant_department_id: int | None = None) -> str:
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(VALID_MODES)}")
    set_setting(db, "campus_operations_mode", mode, tenant_department_id)
    log_audit_event(db, actor.id, "campus_operations.mode_change", "system_setting", None, {"mode": mode})
    db.commit()
    return mode


def get_emergency_window_hours(db: Session, tenant_department_id: int | None = None) -> int:
    val = get_setting(db, "emergency_window_hours", "2", tenant_department_id)
    try:
        return int(val)
    except (ValueError, TypeError):
        return 2


# ---------- Preferences ----------

def get_or_create_preferences(db: Session, teacher_id: int) -> SubstitutionPreference:
    pref = db.query(SubstitutionPreference).filter(SubstitutionPreference.teacher_id == teacher_id).first()
    if not pref:
        pref = SubstitutionPreference(teacher_id=teacher_id)
        db.add(pref)
        db.flush()
    return pref


def update_preferences(db: Session, teacher_id: int, **fields) -> SubstitutionPreference:
    pref = get_or_create_preferences(db, teacher_id)
    for key, value in fields.items():
        if value is not None and hasattr(pref, key):
            setattr(pref, key, value)
    db.commit()
    db.refresh(pref)
    return pref


# ---------- Fairness ----------

def count_recent_substitutions(db: Session, teacher_id: int, since: datetime) -> int:
    return (
        db.query(AlterAssignment)
        .filter(AlterAssignment.substitute_teacher_id == teacher_id, AlterAssignment.assigned_at >= since)
        .count()
    )


def fairness_score(db: Session, teacher_id: int) -> float:
    """0-100, higher = fairer to assign this teacher right now (i.e. they
    have done relatively few substitutions lately). Computed purely
    against this institution's own substitution counts in the fairness
    window — there is no fixed "good" number of substitutions in the
    abstract, only relative load across the current pool of teachers, so
    a teacher with zero recent substitutions and a small institution
    still scores sensibly relative to their peers rather than against an
    arbitrary global constant."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=FAIRNESS_WINDOW_DAYS)

    counts = (
        db.query(AlterAssignment.substitute_teacher_id, func.count(AlterAssignment.id))
        .filter(AlterAssignment.assigned_at >= since)
        .group_by(AlterAssignment.substitute_teacher_id)
        .all()
    )
    count_map = {tid: c for tid, c in counts}
    this_count = count_map.get(teacher_id, 0)

    if not count_map:
        return 100.0  # nobody has substituted recently; everyone starts equal

    max_count = max(count_map.values())
    if max_count == 0:
        return 100.0
    # Linear inverse: 0 substitutions -> 100, max_count substitutions -> 0
    return round(100.0 * (1 - (this_count / max_count)), 1)


# ---------- Hard eligibility ----------

@dataclass
class Candidate:
    teacher: User
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    same_subject: bool = False
    same_department: bool = False
    workload_count: int = 0
    fairness: float = 0.0
    today_workload: int = 0
    projected_today_workload: int = 0
    today_periods: list[int] = field(default_factory=list)
    week_workload: int = 0
    projected_week_workload: int = 0
    substitutions_today: int = 0
    substitutions_week: int = 0
    longest_continuous_periods: int = 0
    projected_longest_continuous_periods: int = 0


def calculate_longest_continuous_block(periods: set[int] | list[int]) -> int:
    """Computes the maximum length of consecutive period numbers.
    e.g. {1, 2, 3} -> 3; {1, 2, 4, 5} -> 2; {1, 3, 5} -> 1; {} -> 0."""
    if not periods:
        return 0
    sorted_periods = sorted(periods)
    max_len = 1
    curr_len = 1
    for i in range(1, len(sorted_periods)):
        if sorted_periods[i] == sorted_periods[i - 1] + 1:
            curr_len += 1
            max_len = max(max_len, curr_len)
        elif sorted_periods[i] != sorted_periods[i - 1]:
            curr_len = 1
    return max_len


def get_teacher_day_periods(
    db: Session,
    teacher_id: int,
    day_order: int,
    leave_date: date,
    in_memory_assignments: list[tuple[date, int, int]] | None = None,
) -> set[int]:
    """Returns all period numbers taught by the teacher on the given Day Order and Date,
    including regular timetable slots and assigned substitutions (DB + in-memory)."""
    slot_periods = {
        row[0] for row in db.query(TimetableSlot.period_number)
        .filter(TimetableSlot.teacher_id == teacher_id, TimetableSlot.day_order == day_order)
        .all()
    }
    sub_periods_db = {
        row[0] for row in db.query(LeaveRequest.period_number)
        .join(AlterAssignment, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(
            AlterAssignment.substitute_teacher_id == teacher_id,
            LeaveRequest.date == leave_date,
            LeaveRequest.status == LeaveStatus.approved,
        )
        .all()
    }
    sub_periods_mem = set()
    if in_memory_assignments:
        sub_periods_mem = {
            p for d, p, tid in in_memory_assignments
            if tid == teacher_id and d == leave_date
        }
    return slot_periods | sub_periods_db | sub_periods_mem


def calculate_weekly_workload(
    db: Session,
    teacher_id: int,
    leave_date: date,
    in_memory_assignments: list[tuple[date, int, int]] | None = None,
) -> int:
    """Computes total weekly teaching periods across the full 1-6 Day Order rotation,
    plus substitutions assigned within the 7-day rolling window."""
    timetable_count = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == teacher_id)
        .count()
    )
    seven_days_ago = leave_date - timedelta(days=7)
    db_subs_count = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(
            AlterAssignment.substitute_teacher_id == teacher_id,
            LeaveRequest.date >= seven_days_ago,
            LeaveRequest.date <= leave_date,
            LeaveRequest.status == LeaveStatus.approved,
        )
        .count()
    )
    mem_subs_count = 0
    if in_memory_assignments:
        mem_subs_count = sum(
            1 for d, p, tid in in_memory_assignments
            if tid == teacher_id and seven_days_ago <= d <= leave_date
        )
    return timetable_count + db_subs_count + mem_subs_count


def get_teacher_substitution_counts(
    db: Session,
    teacher_id: int,
    leave_date: date,
    in_memory_assignments: list[tuple[date, int, int]] | None = None,
) -> tuple[int, int]:
    """Returns (substitutions_today, substitutions_this_week)."""
    today_db = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(
            AlterAssignment.substitute_teacher_id == teacher_id,
            LeaveRequest.date == leave_date,
            LeaveRequest.status == LeaveStatus.approved,
        )
        .count()
    )
    today_mem = 0
    if in_memory_assignments:
        today_mem = sum(
            1 for d, p, tid in in_memory_assignments
            if tid == teacher_id and d == leave_date
        )
    subs_today = today_db + today_mem

    seven_days_ago = leave_date - timedelta(days=7)
    week_db = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(
            AlterAssignment.substitute_teacher_id == teacher_id,
            LeaveRequest.date >= seven_days_ago,
            LeaveRequest.date <= leave_date,
            LeaveRequest.status == LeaveStatus.approved,
        )
        .count()
    )
    week_mem = 0
    if in_memory_assignments:
        week_mem = sum(
            1 for d, p, tid in in_memory_assignments
            if tid == teacher_id and seven_days_ago <= d <= leave_date
        )
    subs_week = week_db + week_mem
    return subs_today, subs_week


def check_7day_substitution_limit(
    db: Session,
    substitute_id: int,
    leave_date: date,
) -> dict:
    """
    Evaluates rolling 7-day substitution allocations against the configured limit.
    Returns metadata with current, max, projected allocations and whether limit is reached.
    """
    seven_days_ago = leave_date - timedelta(days=7)
    current_count = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(
            AlterAssignment.substitute_teacher_id == substitute_id,
            LeaveRequest.date >= seven_days_ago,
            LeaveRequest.date <= leave_date,
            LeaveRequest.status == LeaveStatus.approved,
        )
        .count()
    )

    pref = get_or_create_preferences(db, substitute_id)
    max_limit = pref.max_weekly_substitutions
    if max_limit is None:
        sub = db.query(User).filter(User.id == substitute_id).first()
        dept_id = sub.department_id if sub else None
        dept_setting = get_setting(db, "max_weekly_substitutions", None, dept_id)
        if dept_setting:
            try:
                max_limit = int(dept_setting)
            except (ValueError, TypeError):
                max_limit = None

    limit_reached = False
    if max_limit is not None and current_count >= max_limit:
        limit_reached = True

    return {
        "current_allocations": current_count,
        "max_allocations": max_limit,
        "projected_allocations": current_count + 1,
        "limit_reached": limit_reached,
    }


def _is_hard_eligible(
    db: Session, candidate: User, leave: LeaveRequest, *, require_auto_opt_in: bool,
) -> tuple[bool, str | None]:
    """The rules that NEVER bend, regardless of score or mode. Returns
    (eligible, reason_if_not). require_auto_opt_in is True for
    Autonomous-mode execution and False for the Assisted-mode ranked
    list, where a teacher who hasn't opted into auto-assignment should
    still be visible as a manually-pickable option — only the system's
    own unattended execution path needs to respect that opt-out."""
    if candidate.id == leave.teacher_id:
        return False, "is the teacher requesting leave"

    if not candidate.is_active:
        return False, "account is disabled"

    busy = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == candidate.id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if busy:
        return False, "already teaching this period"

    own_leave = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.teacher_id == candidate.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number, LeaveRequest.status == LeaveStatus.approved)
        .first()
    )
    if own_leave:
        return False, "on approved leave for this period"

    already_subbing = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(AlterAssignment.substitute_teacher_id == candidate.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number)
        .first()
    )
    if already_subbing:
        return False, "already substituting another class this period"

    if require_auto_opt_in:
        already_subbing_today = (
            db.query(AlterAssignment)
            .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
            .filter(AlterAssignment.substitute_teacher_id == candidate.id, LeaveRequest.date == leave.date)
            .first()
        )
        if already_subbing_today:
            return False, "already substituting another class today"

    pref = get_or_create_preferences(db, candidate.id)

    if require_auto_opt_in and not pref.accept_auto_assignments:
        return False, "has opted out of automatic assignment"

    if leave.is_emergency and require_auto_opt_in and not pref.allow_emergency_assignments:
        return False, "has opted out of emergency assignments"

    if require_auto_opt_in and pref.max_weekly_substitutions is not None:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        recent = count_recent_substitutions(db, candidate.id, since)
        if recent >= pref.max_weekly_substitutions:
            return False, f"at weekly substitution cap ({pref.max_weekly_substitutions})"

    # Hard gate: teacher wants to substitute only for their regularly assigned classes.
    # Applies in all modes — the teacher's explicit opt-in to this restriction
    # means they should never appear for a class they don't already teach.
    if pref.only_my_classes:
        affected_slot = (
            db.query(TimetableSlot)
            .filter(
                TimetableSlot.teacher_id == leave.teacher_id,
                TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number,
            )
            .first()
        )
        if not affected_slot:
            return False, "class preference: affected slot not found in timetable"
        teaches_this_class = (
            db.query(TimetableSlot)
            .filter(
                TimetableSlot.teacher_id == candidate.id,
                TimetableSlot.class_id == affected_slot.class_id,
            )
            .first()
        )
        if not teaches_this_class:
            return False, "only substitutes for regularly assigned classes"

    return True, None


def _is_hard_eligible_bulk(
    db: Session, candidate: User, leave: LeaveRequest, *, require_auto_opt_in: bool,
    busy_teacher_ids: set[int], leave_teacher_ids: set[int], subbing_teacher_ids: set[int],
    prefs: dict[int, SubstitutionPreference], recent_sub_counts: dict[int, int],
    subbing_today_teacher_ids: set[int] = None
) -> tuple[bool, str | None]:
    if candidate.id == leave.teacher_id:
        return False, "is the teacher requesting leave"

    if not candidate.is_active:
        return False, "account is disabled"

    if candidate.id in busy_teacher_ids:
        return False, "already teaching this period"

    if candidate.id in leave_teacher_ids:
        return False, "on approved leave for this period"

    if candidate.id in subbing_teacher_ids:
        return False, "already substituting another class this period"

    if require_auto_opt_in and subbing_today_teacher_ids and candidate.id in subbing_today_teacher_ids:
        return False, "already substituting another class today"

    pref = prefs.get(candidate.id)
    if not pref:
        pref = get_or_create_preferences(db, candidate.id)
        prefs[candidate.id] = pref

    if require_auto_opt_in and not pref.accept_auto_assignments:
        return False, "has opted out of automatic assignment"

    if leave.is_emergency and require_auto_opt_in and not pref.allow_emergency_assignments:
        return False, "has opted out of emergency assignments"

    if require_auto_opt_in and pref.max_weekly_substitutions is not None:
        recent = recent_sub_counts.get(candidate.id, 0)
        if recent >= pref.max_weekly_substitutions:
            return False, f"at weekly substitution cap ({pref.max_weekly_substitutions})"

    # Hard gate: teacher wants to substitute only for their regularly assigned classes.
    # Applies in all modes (same logic as _is_hard_eligible).
    if pref.only_my_classes:
        affected_slot = (
            db.query(TimetableSlot)
            .filter(
                TimetableSlot.teacher_id == leave.teacher_id,
                TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number,
            )
            .first()
        )
        if not affected_slot:
            return False, "class preference: affected slot not found in timetable"
        teaches_this_class = (
            db.query(TimetableSlot)
            .filter(
                TimetableSlot.teacher_id == candidate.id,
                TimetableSlot.class_id == affected_slot.class_id,
            )
            .first()
        )
        if not teaches_this_class:
            return False, "only substitutes for regularly assigned classes"

    return True, None


def list_eligible_candidates(
    db: Session, leave: LeaveRequest, *, require_auto_opt_in: bool = False, tenant_department_id: int | None = None,
) -> list[User]:
    """Every teacher who structurally CAN cover this leave, full stop —
    before any scoring or ranking. This is the set Autonomous mode is
    allowed to choose from; Assisted mode scores this same set for the
    ranked list a human picks from."""
    query = db.query(User).filter(User.role == Role.teacher, User.is_active == True)  # noqa: E712
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
    all_teachers = query.all()

    # Bulk pre-fetch eligibility constraints
    busy_teacher_ids = {
        row[0] for row in db.query(TimetableSlot.teacher_id)
        .filter(TimetableSlot.day_order == leave.day_order, TimetableSlot.period_number == leave.period_number)
        .all()
    }
    leave_teacher_ids = {
        row[0] for row in db.query(LeaveRequest.teacher_id)
        .filter(LeaveRequest.date == leave.date, LeaveRequest.period_number == leave.period_number, LeaveRequest.status == LeaveStatus.approved)
        .all()
    }
    subbing_teacher_ids = {
        row[0] for row in db.query(AlterAssignment.substitute_teacher_id)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(LeaveRequest.date == leave.date, LeaveRequest.period_number == leave.period_number)
        .all()
    }
    subbing_today_teacher_ids = set()
    if require_auto_opt_in:
        subbing_today_teacher_ids = {
            row[0] for row in db.query(AlterAssignment.substitute_teacher_id)
            .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
            .filter(LeaveRequest.date == leave.date)
            .all()
        }
    prefs = {
        p.teacher_id: p for p in db.query(SubstitutionPreference).all()
    }
    since = datetime.now(timezone.utc) - timedelta(days=7)
    recent_sub_counts = {
        row[0]: row[1] for row in db.query(AlterAssignment.substitute_teacher_id, func.count(AlterAssignment.id))
        .filter(AlterAssignment.assigned_at >= since)
        .group_by(AlterAssignment.substitute_teacher_id)
        .all()
    }

    eligible = []
    for t in all_teachers:
        ok, _ = _is_hard_eligible_bulk(
            db, t, leave, require_auto_opt_in=require_auto_opt_in,
            busy_teacher_ids=busy_teacher_ids,
            leave_teacher_ids=leave_teacher_ids,
            subbing_teacher_ids=subbing_teacher_ids,
            prefs=prefs,
            recent_sub_counts=recent_sub_counts,
            subbing_today_teacher_ids=subbing_today_teacher_ids
        )
        if ok:
            eligible.append(t)
    return eligible


# ---------- Recommendation scoring ----------

def _subject_and_department_for_leave(db: Session, leave: LeaveRequest) -> tuple[Subject | None, str | None]:
    slot = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == leave.teacher_id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if not slot:
        return None, None
    subject = db.query(Subject).filter(Subject.id == slot.subject_id).first() if slot.subject_id else None
    dept_name = None
    if subject and subject.department_id:
        dept = db.query(Department).filter(Department.id == subject.department_id).first()
        dept_name = dept.name if dept else None
    
    # Fallback to class department if subject department is missing
    if not dept_name and slot.class_id:
        cls = db.query(Class).filter(Class.id == slot.class_id).first()
        if cls and cls.department_id:
            dept = db.query(Department).filter(Department.id == cls.department_id).first()
            dept_name = dept.name if dept else None
            
    return subject, dept_name


def score_candidate(
    db: Session,
    candidate: User,
    leave: LeaveRequest,
    subject: Subject | None,
    dept_name: str | None,
    in_memory_assignments: list[tuple[date, int, int]] | None = None,
) -> Candidate:
    """
    Simulates post-assignment workload in memory and computes a comprehensive,
    multi-dimensional workload and fairness compatibility score (0-100).
    
    Dimensions & Weights:
      1. Projected Daily Workload       (weight: 35) — lower total day periods = higher score
      2. Consecutive Period Block Safety (weight: 30) — avoids continuous teaching fatigue
      3. Projected Weekly Workload      (weight: 20) — balanced rotation distribution
      4. Substitution Fairness          (weight: 10) — balance recent substitution load
      5. Subject / Dept Suitability     (weight: 5)  — tie-breaking bonus
    """
    result = Candidate(teacher=candidate)

    # 1. Daily Workload & Simulation
    current_day_periods = get_teacher_day_periods(
        db, candidate.id, leave.day_order, leave.date, in_memory_assignments
    )
    result.today_workload = len(current_day_periods)
    result.today_periods = sorted(list(current_day_periods))
    
    projected_day_periods = set(current_day_periods) | {leave.period_number}
    result.projected_today_workload = len(projected_day_periods)
    
    # 2. Consecutive Period Analysis
    result.longest_continuous_periods = calculate_longest_continuous_block(current_day_periods)
    result.projected_longest_continuous_periods = calculate_longest_continuous_block(projected_day_periods)

    # 3. Weekly Workload & Simulation
    current_weekly_periods = calculate_weekly_workload(
        db, candidate.id, leave.date, in_memory_assignments
    )
    result.week_workload = current_weekly_periods
    result.workload_count = current_weekly_periods
    result.projected_week_workload = current_weekly_periods + 1

    # 4. Substitution Counts & Fairness
    subs_today, subs_week = get_teacher_substitution_counts(
        db, candidate.id, leave.date, in_memory_assignments
    )
    result.substitutions_today = subs_today
    result.substitutions_week = subs_week
    
    fairness = fairness_score(db, candidate.id)
    result.fairness = fairness

    # --- Scoring Components ---
    # A. Daily Workload Score (35 pts max)
    # 1 period total (free before) -> 35 pts; 2 -> 28; 3 -> 21; 4 -> 14; 5 -> 7; >5 -> 0
    daily_score = max(0.0, 35.0 * (1.0 - min(max(0, result.projected_today_workload - 1), 5) / 5.0))
    result.score += daily_score

    # B. Consecutive Period Safety Score (35 pts max)
    # Continuous block of 1 -> 35 pts; 2 -> 30 pts; 3 -> 22 pts; 4 -> 8 pts; >=5 -> 0 pts
    proj_cont = result.projected_longest_continuous_periods
    if proj_cont <= 1:
        cont_score = 35.0
    elif proj_cont == 2:
        cont_score = 30.0
    elif proj_cont == 3:
        cont_score = 22.0
    elif proj_cont == 4:
        cont_score = 8.0
    else:
        cont_score = 0.0
    result.score += cont_score

    # C. Weekly Workload Score (20 pts max)
    # 30 periods/week benchmark
    weekly_score = max(0.0, 20.0 * (1.0 - min(max(0, result.projected_week_workload - 1), 30) / 30.0))
    result.score += weekly_score

    # D. Fairness Score (10 pts max)
    # Check rolling 7-day limit
    limit_info = check_7day_substitution_limit(db, candidate.id, leave.date)
    if limit_info["limit_reached"]:
        fair_comp = 0.0
    elif subs_week == 0:
        fair_comp = 10.0
    elif subs_week == 1:
        fair_comp = 8.0
    elif subs_week == 2:
        fair_comp = 5.0
    else:
        fair_comp = max(0.0, 10.0 - (subs_week * 2.5))
    result.score += fair_comp

    # E. Same Subject / Class Experience (5 pts max)
    if subject and subject.id:
        has_subject = (
            db.query(TimetableSlot)
            .filter(TimetableSlot.teacher_id == candidate.id, TimetableSlot.subject_id == subject.id)
            .first()
        )
        if has_subject:
            result.same_subject = True
            result.score += 3.0

    # F. Leave Recovery / Workload Rebalancing (up to +7.0 pts bonus)
    leave_bonus, leave_reason, _, _ = calculate_leave_recovery(db, candidate.id, leave.date)
    result.leave_recovery = leave_bonus
    result.leave_recovery_reason = leave_reason
    if leave_bonus > 0:
        result.score += leave_bonus

    # --- Distinct Contextual Badges ---
    if result.same_department:
        result.reasons.append("Same department")
    else:
        result.reasons.append("Cross-department")

    if result.same_subject:
        result.reasons.append("Teaches this subject")

    if result.leave_recovery > 0:
        result.reasons.append(f"Leave recovery (+{result.leave_recovery} pts)")

    if limit_info["limit_reached"]:
        result.reasons.append(f"⚠ 7-day limit reached ({limit_info['current_allocations']}/{limit_info['max_allocations']})")
    elif subs_week == 0:
        result.reasons.append("0 substitutions this week")
    else:
        result.reasons.append(f"{subs_week} sub(s) this week")

    if proj_cont >= 4:
        result.reasons.append(f"⚠ {proj_cont} back-to-back classes without break")

    result.score = round(min(result.score, 100.0), 1)
    return result



def cross_department_substitutions_enabled(db: Session, department_id: int | None) -> bool:
    return get_setting(db, "cross_department_substitutions_enabled", "false", department_id) == "true"


def get_ranked_recommendations(
    db: Session,
    leave_id: int,
    limit: int = 100,
    tenant_department_id: int | None = None,
    include_cross_department: bool = False,
    only_handles_class: bool = False,
    in_memory_assignments: list[tuple[date, int, int]] | None = None,
) -> list[Candidate]:
    leave = _get_leave_or_404(db, leave_id, tenant_department_id)
    if include_cross_department and not cross_department_substitutions_enabled(db, leave.teacher.department_id):
        raise HTTPException(status_code=403, detail="Cross-department substitutions are disabled for this department")
    subject, dept_name = _subject_and_department_for_leave(db, leave)
    eligible = list_eligible_candidates(
        db, leave, require_auto_opt_in=False,
        tenant_department_id=None if include_cross_department else tenant_department_id,
    )
    if only_handles_class:
        affected_slot = db.query(TimetableSlot).filter(
            TimetableSlot.teacher_id == leave.teacher_id,
            TimetableSlot.day_order == leave.day_order,
            TimetableSlot.period_number == leave.period_number,
        ).first()
        if not affected_slot:
            return []
        experienced_ids = {
            row[0] for row in db.query(TimetableSlot.teacher_id)
            .filter(TimetableSlot.class_id == affected_slot.class_id).all()
        }
        eligible = [teacher for teacher in eligible if teacher.id in experienced_ids]

    scored = [score_candidate(db, c, leave, subject, dept_name, in_memory_assignments) for c in eligible]
    # Prefer home department as a tie-breaking bonus
    for candidate in scored:
        if candidate.teacher.department_id == leave.teacher.department_id:
            candidate.same_department = True
            candidate.score = min(100.0, candidate.score + 5)
            candidate.reasons.append("Same department")
        else:
            candidate.reasons.append("Cross-department cover")
    scored.sort(key=lambda c: c.score, reverse=True)
    return scored[:limit]



# ---------- Execution ----------

def create_assignment(
    db: Session, leave: LeaveRequest, substitute: User, assignment_type: AssignmentType,
    score: float | None, actor_id: int | None,
) -> AlterAssignment:
    assignment = AlterAssignment(
        leave_request_id=leave.id,
        substitute_teacher_id=substitute.id,
        assignment_type=assignment_type,
        compatibility_score=score,
    )
    db.add(assignment)

    apply_credit_change(
        teacher_id=leave.teacher_id, change=-1,
        reason=f"Leave on {leave.date} (Day Order {leave.day_order}) period {leave.period_number}",
        leave_id=leave.id, db=db, category="penalty",
    )
    teacher = leave.teacher or db.query(User).filter(User.id == leave.teacher_id).first()
    teacher_name = teacher.name if (teacher and teacher.name) else f"teacher #{leave.teacher_id}"
    apply_credit_change(
        teacher_id=substitute.id, change=+1,
        reason=f"Substitute for {teacher_name} on {leave.date} (Day Order {leave.day_order}) period {leave.period_number}",
        leave_id=leave.id, db=db, category="substitute_class",
    )

    log_audit_event(
        db, actor_id, f"substitution.{assignment_type.value}", "leave_request", leave.id,
        {"substitute_teacher_id": substitute.id, "compatibility_score": score},
    )

    notification_service.create_notification(
        db, substitute.id, title="You've been assigned a substitute class",
        body=f"Cover {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) for a colleague's approved leave.",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )
    notification_service.create_notification(
        db, leave.teacher_id, title="Substitute assigned",
        body=f"{substitute.name} will cover your leave on {leave.date} (Day Order {leave.day_order}, period {leave.period_number}).",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )
    return assignment


def auto_process_approved_leave(db: Session, leave: LeaveRequest) -> AlterAssignment | None:
    """Called right after a leave is approved. Behavior depends on
    campus_operations_mode:
      - manual:     does nothing; admin assigns via the normal flow.
      - assisted:   does nothing here either — the ranked recommendation
                    list is generated on-demand when the admin opens the
                    assign-substitute panel (get_ranked_recommendations),
                    not pushed proactively. Kept simple: one fewer thing
                    that can race against an admin already mid-assignment.
      - autonomous: picks the top-ranked HARD-ELIGIBLE candidate (opted
                    in, under their cap, passing workload safety thresholds)
                    and assigns immediately.
    Returns the created assignment, or None if no eligible candidate
    exists / mode doesn't auto-execute."""
    dept_id = None
    if leave.teacher:
        dept_id = leave.teacher.department_id
    elif leave.teacher_id:
        t = db.query(User).filter(User.id == leave.teacher_id).first()
        if t:
            dept_id = t.department_id

    mode = get_mode(db, dept_id)
    if mode != "autonomous":
        return None

    # Only consider other department staff when cross-department substitutions are enabled
    allow_cross = cross_department_substitutions_enabled(db, dept_id)

    subject, dept_name = _subject_and_department_for_leave(db, leave)
    eligible = list_eligible_candidates(
        db, leave, require_auto_opt_in=True,
        tenant_department_id=None if allow_cross else dept_id,
    )
    if not eligible:
        log_audit_event(db, None, "substitution.autonomous_no_candidate", "leave_request", leave.id, {})
        db.commit()
        return None


    scored = [score_candidate(db, c, leave, subject, dept_name) for c in eligible]
    for candidate in scored:
        if candidate.teacher.department_id == leave.teacher.department_id:
            candidate.same_department = True
            candidate.score = min(100.0, candidate.score + 5)
            candidate.reasons.append("Same department")
        else:
            candidate.reasons.append("Cross-department cover")
    scored.sort(key=lambda c: c.score, reverse=True)

    # Autonomous workload safety check:
    # Avoid auto-assigning if candidate would exceed 4 continuous periods or 5 daily periods,
    # or score is below minimal safe threshold (20.0).
    safe_candidates = [
        c for c in scored
        if c.projected_longest_continuous_periods < 5 and c.projected_today_workload <= 5 and c.score >= 20.0
    ]
    if not safe_candidates:
        log_audit_event(
            db, None, "substitution.autonomous_no_safe_candidate", "leave_request", leave.id,
            {
                "top_candidate_id": scored[0].teacher.id if scored else None,
                "top_candidate_score": scored[0].score if scored else None,
                "reason": "All candidates violate workload safety thresholds",
            },
        )
        db.commit()
        return None

    best = safe_candidates[0]

    assignment_type = AssignmentType.emergency if leave.is_emergency else AssignmentType.auto_assigned
    assignment = create_assignment(db, leave, best.teacher, assignment_type, best.score, actor_id=None)
    db.commit()
    db.refresh(assignment)
    return assignment


def mark_emergency_if_applicable(db: Session, leave: LeaveRequest) -> None:
    """Sets is_emergency=True if the leave's date falls inside the
    emergency window measured from submission time right now. Called once
    at submission (see leave_service.submit_leave) — the flag is a
    point-in-time judgment, not re-evaluated later. Approximates "how far
    away is this period" using the calendar date at midnight, since
    periods don't have wall-clock times in this schema; a same-day leave
    is always emergency regardless of the configured window."""
    hours_until = (datetime.combine(leave.date, datetime.min.time(), tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 3600
    
    dept_id = None
    if leave.teacher:
        dept_id = leave.teacher.department_id
    elif leave.teacher_id:
        t = db.query(User).filter(User.id == leave.teacher_id).first()
        if t:
            dept_id = t.department_id

    window = get_emergency_window_hours(db, dept_id)
    leave.is_emergency = hours_until <= window



def _get_leave_or_404(db: Session, leave_id: int, tenant_department_id: int | None = None) -> LeaveRequest:
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if tenant_department_id is not None:
        if leave.teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied to this leave request")
    return leave


def run_dry_run_simulation(db: Session, start_date, end_date, department_id: int | None = None) -> dict:
    from datetime import date, timedelta
    from app.models.leave import LeaveStatus, AlterAssignment
    from app.models.user import User, Role
    from app.models.timetable import TimetableSlot
    
    # 1. Fetch approved leaves in range
    query = db.query(LeaveRequest).filter(
        LeaveRequest.date >= start_date,
        LeaveRequest.date <= end_date,
        LeaveRequest.status == LeaveStatus.approved
    )
    if department_id is not None:
        query = query.join(User, LeaveRequest.teacher_id == User.id).filter(User.department_id == department_id)
        
    leaves = query.order_by(LeaveRequest.date, LeaveRequest.period_number).all()
    
    simulated_assignments = []
    simulated_successful = 0
    simulated_failed = 0
    estimated_credits = 0
    
    # Track simulated assignments in-memory: list of (date, period_number, substitute_teacher_id)
    in_memory_assignments = []
    
    for leave in leaves:
        # Check if there is already a real substitution in db for this leave
        real_sub = db.query(AlterAssignment).filter(AlterAssignment.leave_request_id == leave.id).first()
        if real_sub:
            simulated_assignments.append({
                "date": leave.date,
                "period_number": leave.period_number,
                "leave_teacher_name": leave.teacher.name if leave.teacher else f"Teacher #{leave.teacher_id}",
                "substitute_teacher_name": real_sub.substitute_teacher.name,
                "compatibility_score": real_sub.compatibility_score,
                "status": "success",
                "reason": "Existing assignment in database"
            })
            simulated_successful += 1
            continue

        # Find eligible candidates using simulated checks
        eligible_candidates = []
        
        leave_dept_id = leave.teacher.department_id if leave.teacher else None
        allow_cross = cross_department_substitutions_enabled(db, leave_dept_id)

        # Fetch active teachers (restricted to same department unless cross-department is enabled)
        t_query = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
        if not allow_cross and leave_dept_id is not None:
            t_query = t_query.filter(User.department_id == leave_dept_id)
        teachers = t_query.all()

        
        for t in teachers:
            # 1. Not the leave teacher
            if t.id == leave.teacher_id:
                continue
                
            # 2. Not busy in timetable
            busy = db.query(TimetableSlot).filter(
                TimetableSlot.teacher_id == t.id,
                TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number
            ).first()
            if busy:
                continue
                
            # 3. Not on approved leave
            on_leave = db.query(LeaveRequest).filter(
                LeaveRequest.teacher_id == t.id,
                LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number,
                LeaveRequest.status == LeaveStatus.approved
            ).first()
            if on_leave:
                continue
                
            # 4. Not already subbing this period (database check + in-memory check)
            already_subbing_db = db.query(AlterAssignment).join(LeaveRequest).filter(
                AlterAssignment.substitute_teacher_id == t.id,
                LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number
            ).first()
            if already_subbing_db:
                continue
                
            already_subbing_mem = any(
                d == leave.date and p == leave.period_number and tid == t.id
                for d, p, tid in in_memory_assignments
            )
            if already_subbing_mem:
                continue

            already_subbing_today_mem = any(
                d == leave.date and tid == t.id
                for d, p, tid in in_memory_assignments
            )
            if already_subbing_today_mem:
                continue
                
            # 5. Check preferences
            pref = get_or_create_preferences(db, t.id)
            if not pref.accept_auto_assignments:
                continue
            if leave.is_emergency and not pref.allow_emergency_assignments:
                continue
                
            # 6. Check weekly cap (database check + in-memory check)
            if pref.max_weekly_substitutions is not None:
                seven_days_ago = leave.date - timedelta(days=7)
                # DB count
                db_count = db.query(AlterAssignment).join(LeaveRequest).filter(
                    AlterAssignment.substitute_teacher_id == t.id,
                    LeaveRequest.date >= seven_days_ago,
                    LeaveRequest.date <= leave.date
                ).count()
                # Mem count
                mem_count = sum(
                    1 for d, p, tid in in_memory_assignments
                    if tid == t.id and seven_days_ago <= d <= leave.date
                )
                if (db_count + mem_count) >= pref.max_weekly_substitutions:
                    continue
            
            eligible_candidates.append(t)
            
        if not eligible_candidates:
            simulated_assignments.append({
                "date": leave.date,
                "period_number": leave.period_number,
                "leave_teacher_name": leave.teacher.name if leave.teacher else f"Teacher #{leave.teacher_id}",
                "substitute_teacher_name": None,
                "compatibility_score": None,
                "status": "failed",
                "reason": "No eligible candidates"
            })
            simulated_failed += 1
            continue
            
        # Score and rank candidates with in-memory simulation awareness
        subject, dept_name = _subject_and_department_for_leave(db, leave)
        scored_candidates = []
        for c in eligible_candidates:
            score_res = score_candidate(db, c, leave, subject, dept_name, in_memory_assignments)
            scored_candidates.append((c, score_res.score))
            
        # Pick the best
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        best_candidate, best_score = scored_candidates[0]
        
        # Record simulated assignment
        in_memory_assignments.append((leave.date, leave.period_number, best_candidate.id))
        simulated_assignments.append({
            "date": leave.date,
            "period_number": leave.period_number,
            "leave_teacher_name": leave.teacher.name if leave.teacher else f"Teacher #{leave.teacher_id}",
            "substitute_teacher_name": best_candidate.name,
            "compatibility_score": best_score,
            "status": "success",
            "reason": f"Simulated assignment (score: {best_score})"
        })
        simulated_successful += 1
        estimated_credits += 1
        
    return {
        "leaves_processed": len(leaves),
        "simulated_successful_assignments": simulated_successful,
        "simulated_failed_assignments": simulated_failed,
        "estimated_credit_transactions": estimated_credits,
        "simulated_assignments": simulated_assignments
    }
