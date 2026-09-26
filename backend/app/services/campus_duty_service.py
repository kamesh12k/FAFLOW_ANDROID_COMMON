import json
import logging
from datetime import date, time, datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple, Set
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, and_

from app.core.exceptions import DomainException
from app.models.user import User, Role
from app.models.department import Department
from app.models.campus_duty import (
    CampusArea, DutyBreakPeriod, CampusDuty, DutyAssignment, DutyAssignmentRun,
    DutyType, DutyStatus, AssignmentStatus
)
from app.models.room import Room
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay, DayOrderCalendar
from app.models.audit_log import AuditLog
from app.services.system_setting_service import get_setting, set_setting
from app.services.notification_service import create_notification
from app.schemas.campus_duty import (
    CampusAreaCreate, CampusAreaUpdate, CampusAreaOut,
    DutyBreakPeriodCreate, DutyBreakPeriodUpdate, DutyBreakPeriodOut,
    CampusDutyCreate, CampusDutyUpdate, CampusDutyOut, DutyAssignmentOut,
    DutyCandidateOut, DutyCandidatesResponse, DutyDashboardMetricsOut,
    DutyTimelineItemOut, DutyRulesOut, DutyRulesUpdate, DutyRulesImpactPreview
)

logger = logging.getLogger(__name__)

# Standard timetable period schedule for preceding period resolution & conflict checks
PERIOD_SCHEDULE = {
    1: (time(9, 20), time(10, 20)),
    2: (time(10, 20), time(11, 15)),
    3: (time(11, 40), time(12, 35)),
    4: (time(13, 35), time(14, 30)),
    5: (time(14, 55), time(15, 50)),
}


class CampusDutyService:

    @staticmethod
    def _log_audit(db: Session, actor_user_id: Optional[int], action: str, details: dict, department_id: Optional[int] = None):
        try:
            audit = AuditLog(
                actor_user_id=actor_user_id,
                department_id=department_id,
                action=action,
                target_type="campus_duty",
                details=details
            )
            db.add(audit)
            db.flush()
        except Exception as e:
            logger.warning("Failed to log campus duty audit: %s", e)

    # ── Bootstrap Defaults ───────────────────────────────────────────────────

    @staticmethod
    def ensure_default_break_periods(db: Session, department_id: Optional[int] = None):
        """Seeds standard break periods if none exist."""
        existing = db.query(DutyBreakPeriod).count()
        if existing > 0:
            return

        defaults = [
            DutyBreakPeriod(
                name="Morning Interval",
                start_time=time(11, 15),
                end_time=time(11, 40),
                duty_type=DutyType.DISCIPLINE_DUTY.value,
                required_teachers=3,
                min_teachers=1,
                max_teachers=10,
                preceding_period_number=2,
                applicable_day_orders="1,2,3,4,5,6",
                department_id=department_id,
                is_active=True
            ),
            DutyBreakPeriod(
                name="Lunch Break",
                start_time=time(12, 35),
                end_time=time(13, 35),
                duty_type=DutyType.DISCIPLINE_DUTY.value,
                required_teachers=5,
                min_teachers=1,
                max_teachers=10,
                preceding_period_number=3,
                applicable_day_orders="1,2,3,4,5,6",
                department_id=department_id,
                is_active=True
            ),
            DutyBreakPeriod(
                name="Afternoon Break",
                start_time=time(14, 30),
                end_time=time(14, 55),
                duty_type=DutyType.DISCIPLINE_DUTY.value,
                required_teachers=2,
                min_teachers=1,
                max_teachers=10,
                preceding_period_number=4,
                applicable_day_orders="1,2,3,4,5,6",
                department_id=department_id,
                is_active=True
            ),
            DutyBreakPeriod(
                name="Campus Dispersal",
                start_time=time(15, 50),
                end_time=time(16, 15),
                duty_type=DutyType.DISCIPLINE_DUTY.value,
                required_teachers=3,
                min_teachers=1,
                max_teachers=10,
                preceding_period_number=5,
                applicable_day_orders="1,2,3,4,5,6",
                department_id=department_id,
                is_active=True
            ),
        ]
        db.add_all(defaults)
        db.commit()

    @staticmethod
    def ensure_default_campus_areas(db: Session, department_id: Optional[int] = None):
        """Seeds standard campus areas if none exist."""
        existing = db.query(CampusArea).count()
        if existing > 0:
            return

        defaults = [
            CampusArea(
                name="Main Block - Ground Floor Corridor",
                code="MB-GF",
                duty_type=DutyType.WING_DUTY.value,
                building_or_block="Main Block",
                floor="Ground Floor",
                required_teachers=1,
                is_active=True
            ),
            CampusArea(
                name="Main Block - First Floor Corridor",
                code="MB-1F",
                duty_type=DutyType.WING_DUTY.value,
                building_or_block="Main Block",
                floor="1st Floor",
                required_teachers=1,
                is_active=True
            ),
            CampusArea(
                name="Science Block - Central Quadrangle",
                code="SB-QD",
                duty_type=DutyType.DISCIPLINE_DUTY.value,
                building_or_block="Science Block",
                floor="Courtyard",
                required_teachers=2,
                is_active=True
            ),
            CampusArea(
                name="Examination Hall 101",
                code="EX-101",
                duty_type=DutyType.EXAM_DUTY.value,
                building_or_block="Academic Block B",
                floor="1st Floor",
                required_teachers=2,
                is_active=True
            ),
        ]
        db.add_all(defaults)
        db.commit()

    # ── Campus Area CRUD ─────────────────────────────────────────────────────

    @staticmethod
    def list_areas(db: Session, is_active_only: bool = True) -> List[CampusArea]:
        CampusDutyService.ensure_default_campus_areas(db)
        q = db.query(CampusArea)
        if is_active_only:
            q = q.filter(CampusArea.is_active == True)
        return q.order_by(CampusArea.name).all()

    @staticmethod
    def create_area(db: Session, data: CampusAreaCreate, user_id: Optional[int] = None) -> CampusArea:
        existing = db.query(CampusArea).filter(CampusArea.code == data.code).first()
        if existing:
            raise DomainException(f"Campus area code '{data.code}' already exists", status_code=409)

        area = CampusArea(
            name=data.name,
            code=data.code,
            duty_type=data.duty_type,
            building_or_block=data.building_or_block,
            floor=data.floor,
            required_teachers=data.required_teachers,
            department_id=data.department_id,
            is_active=data.is_active
        )
        db.add(area)
        db.commit()
        db.refresh(area)
        CampusDutyService._log_audit(db, user_id, "CAMPUS_AREA_CREATED", {"area_id": area.id, "code": area.code})
        return area

    # ── Duty Break Period CRUD ───────────────────────────────────────────────

    @staticmethod
    def list_break_periods(db: Session, is_active_only: bool = True) -> List[DutyBreakPeriod]:
        CampusDutyService.ensure_default_break_periods(db)
        q = db.query(DutyBreakPeriod)
        if is_active_only:
            q = q.filter(DutyBreakPeriod.is_active == True)
        return q.order_by(DutyBreakPeriod.start_time).all()

    @staticmethod
    def create_break_period(db: Session, data: DutyBreakPeriodCreate, user_id: Optional[int] = None) -> DutyBreakPeriod:
        bp = DutyBreakPeriod(
            name=data.name,
            start_time=data.start_time,
            end_time=data.end_time,
            duty_type=data.duty_type,
            required_teachers=data.required_teachers,
            min_teachers=data.min_teachers,
            max_teachers=data.max_teachers,
            preceding_period_number=data.preceding_period_number,
            applicable_day_orders=data.applicable_day_orders,
            department_id=data.department_id,
            is_active=data.is_active
        )
        db.add(bp)
        db.commit()
        db.refresh(bp)
        CampusDutyService._log_audit(db, user_id, "BREAK_PERIOD_CREATED", {"break_period_id": bp.id, "name": bp.name})
        return bp

    @staticmethod
    def update_break_period(db: Session, bp_id: int, data, user_id: Optional[int] = None) -> DutyBreakPeriod:
        bp = db.query(DutyBreakPeriod).filter(DutyBreakPeriod.id == bp_id).first()
        if not bp:
            raise DomainException("Break period not found", status_code=404)
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(bp, field, value)
        db.commit()
        db.refresh(bp)
        CampusDutyService._log_audit(db, user_id, "BREAK_PERIOD_UPDATED", {"break_period_id": bp.id, "changes": update_data})
        return bp

    @staticmethod
    def delete_break_period(db: Session, bp_id: int, user_id: Optional[int] = None) -> DutyBreakPeriod:
        bp = db.query(DutyBreakPeriod).filter(DutyBreakPeriod.id == bp_id).first()
        if not bp:
            raise DomainException("Break period not found", status_code=404)
        bp.is_active = False
        db.commit()
        db.refresh(bp)
        CampusDutyService._log_audit(db, user_id, "BREAK_PERIOD_DELETED", {"break_period_id": bp.id, "name": bp.name})
        return bp

    @staticmethod
    def reset_break_periods(db: Session, user_id: Optional[int] = None) -> List[DutyBreakPeriod]:
        """Delete all existing break periods and re-seed factory defaults."""
        db.query(DutyBreakPeriod).delete()
        db.commit()
        # Force re-seed by calling ensure_defaults (which checks count == 0)
        CampusDutyService.ensure_default_break_periods(db)
        result = db.query(DutyBreakPeriod).order_by(DutyBreakPeriod.start_time).all()
        CampusDutyService._log_audit(db, user_id, "BREAK_PERIODS_RESET", {"count": len(result)})
        return result

    @staticmethod
    def auto_replace_absent_teachers(
        db: Session,
        target_date: Optional[date] = None,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Sweeps all PUBLISHED duties for target_date.
        For each ASSIGNED teacher who hasn't checked in by the cutoff:
          - 9:00 AM cutoff for morning duties
          - 10 minutes before each break's start_time
        Replaces absent teacher with the next eligible candidate.
        Returns a summary of replacements made.
        """
        t_date = target_date or date.today()
        now = datetime.now()
        cutoff_9am = time(9, 0)

        duties = db.query(CampusDuty).options(
            joinedload(CampusDuty.break_period),
            joinedload(CampusDuty.assignments).joinedload(DutyAssignment.teacher)
        ).filter(
            CampusDuty.duty_date == t_date,
            CampusDuty.status == DutyStatus.PUBLISHED
        ).all()

        replacements_made = 0
        unfilled_after = 0
        results = []

        for duty in duties:
            if duty.is_locked:
                continue

            # Determine the cutoff time for this duty:
            # 10 minutes before break start, or 9 AM for morning entries
            bp_start = duty.start_time
            cutoff_dt = datetime.combine(t_date, bp_start) - timedelta(minutes=10)
            nine_am_dt = datetime.combine(t_date, cutoff_9am)
            effective_cutoff = min(cutoff_dt, nine_am_dt)

            # Only act if we've already passed the cutoff
            if now < effective_cutoff:
                logger.debug(
                    "Duty %d (%s) cutoff not reached yet (%s). Skipping.",
                    duty.id, duty.title, effective_cutoff.strftime("%H:%M")
                )
                continue

            active_assignments = [
                a for a in duty.assignments
                if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)
                and not a.is_locked
            ]

            for assignment in active_assignments:
                teacher = assignment.teacher
                # Check if teacher has checked in today
                att = db.query(StaffAttendanceRecord).filter(
                    StaffAttendanceRecord.user_id == teacher.id,
                    StaffAttendanceRecord.attendance_date == t_date
                ).first()

                if att and att.check_in_time is not None and att.check_out_time is None:
                    # Teacher is present and still on campus — no replacement needed
                    continue

                # Teacher is absent or unavailable — determine specific reason
                if att and att.check_out_time is not None:
                    reason = f"Auto: Checked out early at {att.check_out_time.strftime('%H:%M')}"
                else:
                    on_leave = db.query(LeaveRequest).filter(
                        LeaveRequest.teacher_id == teacher.id,
                        LeaveRequest.date == t_date,
                        LeaveRequest.status == LeaveStatus.approved
                    ).first()
                    if on_leave:
                        reason = f"Auto: On approved leave today ({on_leave.reason or 'Leave'})"
                    else:
                        reason = f"Auto: Not checked in by {effective_cutoff.strftime('%H:%M')}"
                old_teacher_name = teacher.name or teacher.username

                assignment.status = AssignmentStatus.REPLACED
                assignment.overridden_reason = reason
                db.flush()

                # Find next eligible candidate (strictly require checked-in for emergency replacement)
                try:
                    cand_resp = CampusDutyService.evaluate_candidates(db, duty.id, require_checked_in=True)
                    eligible = [c for c in cand_resp.candidates if c.is_eligible]
                except Exception as e:
                    logger.warning("Could not evaluate candidates for duty %d: %s", duty.id, e)
                    eligible = []

                if eligible:
                    best = eligible[0]
                    new_assignment = DutyAssignment(
                        duty_id=duty.id,
                        teacher_id=best.teacher_id,
                        status=AssignmentStatus.ASSIGNED,
                        role=assignment.role,
                        assigned_by_user_id=user_id,
                        is_manual=False,
                        selection_reason=best.reasons,
                        score=best.score
                    )
                    db.add(new_assignment)

                    # Notify replacement teacher
                    time_str = f"{duty.start_time.strftime('%H:%M')} – {duty.end_time.strftime('%H:%M')}"
                    create_notification(
                        db=db,
                        user_id=best.teacher_id,
                        title=f"Duty Assignment — {duty.title}",
                        body=f"You have been auto-assigned to {duty.title} on {t_date} ({time_str}) as a replacement.",
                        event_type="campus_duty_auto_replaced"
                    )

                    results.append({
                        "duty_id": duty.id,
                        "duty_title": duty.title,
                        "replaced_teacher_name": old_teacher_name,
                        "new_teacher_name": best.teacher_name,
                        "reason": reason,
                    })
                    replacements_made += 1
                    logger.info(
                        "Auto-replaced %s with %s for duty '%s' (reason: %s)",
                        old_teacher_name, best.teacher_name, duty.title, reason
                    )
                else:
                    logger.warning(
                        "Duty '%s' (id=%d): no eligible replacement found after removing %s.",
                        duty.title, duty.id, old_teacher_name
                    )
                    unfilled_after += 1

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error("Auto-replace commit failed: %s", e)

        if replacements_made > 0:
            CampusDutyService._log_audit(db, user_id, "DUTY_AUTO_REPLACE_RUN", {
                "date": str(t_date),
                "replacements_made": replacements_made,
                "unfilled_after": unfilled_after,
            })

        return {
            "target_date": str(t_date),
            "replacements_made": replacements_made,
            "unfilled_after": unfilled_after,
            "results": results,
            "message": (
                f"{replacements_made} absent teacher(s) auto-replaced"
                + (f", {unfilled_after} slot(s) remain unfilled." if unfilled_after else ".")
            )
        }

    # ── Duty Generation & Listing ────────────────────────────────────────────


    @staticmethod
    def get_day_order_for_date(db: Session, target_date: date) -> Optional[int]:
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        if cal_day and cal_day.day_order:
            return cal_day.day_order
        do_entry = db.query(DayOrderCalendar).filter(DayOrderCalendar.date == target_date).first()
        if do_entry and do_entry.day_order:
            return do_entry.day_order
        # Fallback cyclic Day Order (1..6) if date is weekday
        if target_date.weekday() < 6:
            return (target_date.toordinal() % 6) + 1
        return None

    @staticmethod
    def generate_discipline_duties(db: Session, target_date: date, department_id: Optional[int] = None, user_id: Optional[int] = None) -> List[CampusDuty]:
        CampusDutyService.ensure_default_break_periods(db)
        day_order = CampusDutyService.get_day_order_for_date(db, target_date)
        break_periods = db.query(DutyBreakPeriod).filter(DutyBreakPeriod.is_active == True).all()

        created_duties = []
        for bp in break_periods:
            if day_order is not None:
                orders = [int(x.strip()) for x in bp.applicable_day_orders.split(",") if x.strip().isdigit()]
                if orders and day_order not in orders:
                    continue

            # Check if duty already generated for this break period on this date
            existing = db.query(CampusDuty).filter(
                CampusDuty.duty_date == target_date,
                or_(
                    CampusDuty.break_period_id == bp.id,
                    CampusDuty.title == f"{bp.name} Discipline",
                    CampusDuty.title == bp.name
                )
            ).first()

            if not existing:
                duty = CampusDuty(
                    duty_type=DutyType.DISCIPLINE_DUTY,
                    title=f"{bp.name} Discipline",
                    duty_date=target_date,
                    start_time=bp.start_time,
                    end_time=bp.end_time,
                    break_period_id=bp.id,
                    department_id=department_id,
                    day_order=day_order,
                    required_teachers=bp.required_teachers,
                    status=DutyStatus.PUBLISHED,
                    created_by_user_id=user_id
                )
                db.add(duty)
                created_duties.append(duty)
            else:
                # Update existing duty in-place rather than creating duplicate
                if existing.status == DutyStatus.CANCELLED:
                    existing.status = DutyStatus.PUBLISHED
                existing.required_teachers = bp.required_teachers
                existing.start_time = bp.start_time
                existing.end_time = bp.end_time
                existing.break_period_id = bp.id
                existing.day_order = day_order
                created_duties.append(existing)

        if created_duties:
            db.commit()
            for d in created_duties:
                db.refresh(d)
            CampusDutyService._log_audit(db, user_id, "DISCIPLINE_DUTIES_GENERATED", {
                "date": str(target_date),
                "count": len(created_duties),
                "day_order": day_order
            })

        return db.query(CampusDuty).filter(
            CampusDuty.duty_date == target_date,
            CampusDuty.duty_type == DutyType.DISCIPLINE_DUTY
        ).order_by(CampusDuty.start_time).all()

    @staticmethod
    def generate_wing_duties(
        db: Session,
        target_date: date,
        start_time: time = time(9, 30),
        end_time: time = time(16, 30),
        block_ids: Optional[List[int]] = None,
        department_id: Optional[int] = None,
        required_teachers_per_wing: int = 1,
        user_id: Optional[int] = None
    ) -> List[CampusDuty]:
        """Automatically creates WING_DUTY assignments for each active floor (corridor/wing)
        across specified campus blocks."""
        day_order = CampusDutyService.get_day_order_for_date(db, target_date)
        from app.models.campus_structure import CampusBlock, CampusFloor

        q = db.query(CampusFloor).join(CampusBlock).filter(CampusFloor.is_active == True, CampusBlock.is_active == True)
        if block_ids:
            q = q.filter(CampusFloor.block_id.in_(block_ids))
        if department_id:
            q = q.filter(or_(CampusBlock.department_id == department_id, CampusBlock.department_id == None))
        floors = q.order_by(CampusBlock.name, CampusFloor.display_order).all()

        created_duties = []
        for fl in floors:
            title = f"Wing Duty - {fl.block.name} ({fl.floor_name})"
            existing = db.query(CampusDuty).filter(
                CampusDuty.duty_date == target_date,
                CampusDuty.duty_type == DutyType.WING_DUTY,
                CampusDuty.title == title,
                CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT])
            ).first()

            if not existing:
                area_code = f"WING_{fl.block.code}_{fl.floor_number}".upper()
                area = db.query(CampusArea).filter(CampusArea.code == area_code).first()
                if not area:
                    area = CampusArea(
                        name=f"{fl.block.name} - {fl.floor_name}",
                        code=area_code,
                        duty_type=DutyType.WING_DUTY.value,
                        block_id=fl.block_id,
                        floor_id=fl.id,
                        building_or_block=fl.block.name,
                        floor=fl.floor_name,
                        required_teachers=required_teachers_per_wing,
                        department_id=department_id or fl.block.department_id,
                        is_active=True
                    )
                    db.add(area)
                    db.flush()

                duty = CampusDuty(
                    duty_type=DutyType.WING_DUTY,
                    title=title,
                    duty_date=target_date,
                    start_time=start_time,
                    end_time=end_time,
                    area_id=area.id,
                    department_id=department_id or fl.block.department_id,
                    day_order=day_order,
                    required_teachers=required_teachers_per_wing,
                    status=DutyStatus.PUBLISHED,
                    created_by_user_id=user_id
                )
                db.add(duty)
                created_duties.append(duty)

        if created_duties:
            db.commit()
            for d in created_duties:
                db.refresh(d)
            CampusDutyService._log_audit(db, user_id, "WING_DUTIES_GENERATED", {
                "date": str(target_date),
                "count": len(created_duties)
            })

        return db.query(CampusDuty).filter(
            CampusDuty.duty_date == target_date,
            CampusDuty.duty_type == DutyType.WING_DUTY
        ).order_by(CampusDuty.start_time).all()

    @staticmethod
    def generate_exam_duties(
        db: Session,
        target_date: date,
        start_time: time = time(10, 0),
        end_time: time = time(13, 0),
        title: str = "Semester Examination",
        block_ids: Optional[List[int]] = None,
        floor_ids: Optional[List[int]] = None,
        department_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> List[CampusDuty]:
        """Automatically allocates EXAM_DUTY invigilation duties for all exam-eligible classrooms
        across specified blocks/floors, transforming classrooms into examination halls."""
        day_order = CampusDutyService.get_day_order_for_date(db, target_date)
        from app.models.room import Room

        q = db.query(Room).filter(Room.is_exam_eligible == True, Room.is_active == True)
        if block_ids:
            q = q.filter(Room.block_id.in_(block_ids))
        if floor_ids:
            q = q.filter(Room.floor_id.in_(floor_ids))
        if department_id:
            q = q.filter(or_(Room.department_id == department_id, Room.department_id == None))
        rooms = q.order_by(Room.room_number).all()

        created_duties = []
        for rm in rooms:
            existing = db.query(CampusDuty).filter(
                CampusDuty.room_id == rm.id,
                CampusDuty.duty_date == target_date,
                CampusDuty.duty_type == DutyType.EXAM_DUTY,
                CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT]),
                CampusDuty.start_time < end_time,
                CampusDuty.end_time > start_time
            ).first()

            if not existing:
                duty_title = f"{title} - Room {rm.room_number}"
                duty = CampusDuty(
                    duty_type=DutyType.EXAM_DUTY,
                    title=duty_title,
                    duty_date=target_date,
                    start_time=start_time,
                    end_time=end_time,
                    room_id=rm.id,
                    department_id=rm.department_id or department_id,
                    day_order=day_order,
                    required_teachers=rm.required_invigilators or 1,
                    status=DutyStatus.PUBLISHED,
                    created_by_user_id=user_id
                )
                db.add(duty)
                created_duties.append(duty)

        if created_duties:
            db.commit()
            for d in created_duties:
                db.refresh(d)
            CampusDutyService._log_audit(db, user_id, "EXAM_DUTIES_GENERATED", {
                "date": str(target_date),
                "count": len(created_duties)
            })

        return db.query(CampusDuty).filter(
            CampusDuty.duty_date == target_date,
            CampusDuty.duty_type == DutyType.EXAM_DUTY
        ).order_by(CampusDuty.start_time).all()

    @staticmethod
    def create_duty(db: Session, data: CampusDutyCreate, user_id: Optional[int] = None) -> CampusDuty:
        day_order = data.day_order or CampusDutyService.get_day_order_for_date(db, data.duty_date)
        
        # Check Exam Hall double-booking conflict
        if data.room_id:
            room_conflict = db.query(CampusDuty).filter(
                CampusDuty.room_id == data.room_id,
                CampusDuty.duty_date == data.duty_date,
                CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT]),
                CampusDuty.start_time < data.end_time,
                CampusDuty.end_time > data.start_time
            ).first()
            if room_conflict:
                raise DomainException(f"Examination room is already booked for '{room_conflict.title}' during this time window", status_code=409)

        # Check for existing duplicate duty on same date with same title or break period
        dup_filter = [
            CampusDuty.duty_date == data.duty_date,
            CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT]),
            CampusDuty.title == data.title
        ]
        if data.break_period_id:
            dup_filter = [
                CampusDuty.duty_date == data.duty_date,
                CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT]),
                CampusDuty.break_period_id == data.break_period_id
            ]
        existing_dup = db.query(CampusDuty).filter(*dup_filter).first()
        if existing_dup:
            raise DomainException(f"A duty for '{existing_dup.title}' already exists on {data.duty_date}", status_code=409)

        duty = CampusDuty(
            duty_type=data.duty_type,
            title=data.title,
            duty_date=data.duty_date,
            start_time=data.start_time,
            end_time=data.end_time,
            break_period_id=data.break_period_id,
            area_id=data.area_id,
            room_id=data.room_id,
            department_id=data.department_id,
            day_order=day_order,
            required_teachers=data.required_teachers,
            status=DutyStatus.PUBLISHED,
            created_by_user_id=user_id
        )
        db.add(duty)
        db.commit()
        db.refresh(duty)
        CampusDutyService._log_audit(db, user_id, "CAMPUS_DUTY_CREATED", {"duty_id": duty.id, "title": duty.title, "room_id": data.room_id})
        return duty

    @staticmethod
    def list_duties(
        db: Session,
        target_date: Optional[date] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        day_order: Optional[int] = None,
        duty_type: Optional[str] = None,
        department_id: Optional[int] = None,
        teacher_id: Optional[int] = None
    ) -> List[CampusDuty]:
        q = db.query(CampusDuty).options(
            joinedload(CampusDuty.break_period),
            joinedload(CampusDuty.area),
            joinedload(CampusDuty.room).joinedload(Room.block),
            joinedload(CampusDuty.room).joinedload(Room.floor),
            joinedload(CampusDuty.department),
            joinedload(CampusDuty.locked_by_user),
            joinedload(CampusDuty.assignments).joinedload(DutyAssignment.teacher)
        )

        if target_date:
            q = q.filter(CampusDuty.duty_date == target_date)
        elif date_from and date_to:
            q = q.filter(CampusDuty.duty_date >= date_from, CampusDuty.duty_date <= date_to)
        elif date_from:
            q = q.filter(CampusDuty.duty_date >= date_from)
        elif date_to:
            q = q.filter(CampusDuty.duty_date <= date_to)

        if day_order is not None:
            q = q.filter(CampusDuty.day_order == day_order)
        if duty_type:
            q = q.filter(CampusDuty.duty_type == duty_type)
        if department_id is not None:
            q = q.filter(or_(CampusDuty.department_id == department_id, CampusDuty.department_id == None))
        if teacher_id is not None:
            q = q.join(DutyAssignment).filter(
                DutyAssignment.teacher_id == teacher_id,
                DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED])
            )

        return q.order_by(CampusDuty.duty_date, CampusDuty.start_time).all()

    @staticmethod
    def get_duty(db: Session, duty_id: int) -> CampusDuty:
        duty = db.query(CampusDuty).options(
            joinedload(CampusDuty.break_period),
            joinedload(CampusDuty.area),
            joinedload(CampusDuty.room).joinedload(Room.block),
            joinedload(CampusDuty.room).joinedload(Room.floor),
            joinedload(CampusDuty.department),
            joinedload(CampusDuty.locked_by_user),
            joinedload(CampusDuty.assignments).joinedload(DutyAssignment.teacher)
        ).filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Campus duty not found", status_code=404)
        return duty

    # ── Candidate Scoring & Explainable Engine ────────────────────────────────

    @staticmethod
    def evaluate_candidates(
        db: Session,
        duty_id: int,
        allowed_department_ids: Optional[Set[int]] = None,
        require_checked_in: bool = False
    ) -> DutyCandidatesResponse:
        duty = CampusDutyService.get_duty(db, duty_id)
        rules = CampusDutyService.get_rules(db, duty.department_id)

        # Base teacher query
        teacher_q = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
        if allowed_department_ids:
            teacher_q = teacher_q.filter(User.department_id.in_(list(allowed_department_ids)))
        elif not rules.cross_department_assignment and duty.department_id:
            teacher_q = teacher_q.filter(User.department_id == duty.department_id)
        teachers = teacher_q.all()

        assigned_teacher_ids = {
            a.teacher_id for a in duty.assignments
            if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)
        }

        # Resolve preceding period for the break to check "Free period immediately before break"
        preceding_period = None
        if duty.break_period and duty.break_period.preceding_period_number:
            preceding_period = duty.break_period.preceding_period_number
        else:
            # Infer preceding period based on start time
            for p_num, (p_start, p_end) in PERIOD_SCHEDULE.items():
                if p_end <= duty.start_time:
                    preceding_period = p_num

        week_start = duty.duty_date - timedelta(days=duty.duty_date.weekday())
        week_end = week_start + timedelta(days=6)

        candidates: List[DutyCandidateOut] = []

        for t in teachers:
            # If already assigned to this duty, exclude from selectable candidates
            if t.id in assigned_teacher_ids:
                continue

            is_eligible = True
            exclusion_reason = None
            reasons: List[str] = []
            score = 100.0

            # 1. Attendance Check (Authoritative presence if duty is today)
            present_today = True
            if duty.duty_date == date.today():
                att_record = db.query(StaffAttendanceRecord).filter(
                    StaffAttendanceRecord.user_id == t.id,
                    StaffAttendanceRecord.attendance_date == duty.duty_date
                ).first()
                if not att_record or att_record.check_in_time is None:
                    present_today = False
                    if require_checked_in:
                        is_eligible = False
                        exclusion_reason = "Teacher has not checked in today"
                    else:
                        # Faculty can still be chosen initially!
                        # If absent at duty cutoff, autonomous scheduler will auto-replace them.
                        score -= 10.0
                        reasons.append("Pending check-in (Auto-swaps if absent)")
                elif att_record.check_out_time is not None:
                    present_today = False
                    is_eligible = False
                    exclusion_reason = "Teacher has already checked out"
                else:
                    present_today = True
                    reasons.append("Present & Checked in today")
            else:
                reasons.append("Scheduled date")

            # 2. Approved Leave Check
            if is_eligible:
                on_leave = db.query(LeaveRequest).filter(
                    LeaveRequest.teacher_id == t.id,
                    LeaveRequest.date == duty.duty_date,
                    LeaveRequest.status == LeaveStatus.approved
                ).first()
                if on_leave:
                    is_eligible = False
                    exclusion_reason = "On approved leave today"
                else:
                    reasons.append("Not on leave")

            # 3. Timetable Class Conflict Check
            if is_eligible and duty.day_order:
                # Find classes taught on this day order
                slots = db.query(TimetableSlot).filter(
                    TimetableSlot.teacher_id == t.id,
                    TimetableSlot.day_order == duty.day_order
                ).all()

                for s in slots:
                    p_times = PERIOD_SCHEDULE.get(s.period_number)
                    if p_times:
                        slot_start, slot_end = p_times
                        # Overlap: max(start1, start2) < min(end1, end2)
                        if max(slot_start, duty.start_time) < min(slot_end, duty.end_time):
                            is_eligible = False
                            subj = s.subject.name if s.subject else "Class session"
                            exclusion_reason = f"Teaching Period {s.period_number} ({subj}) at this time"
                            break
                if is_eligible:
                    reasons.append("No timetable class conflict")

            # 4. Overlapping Duty Conflict Check
            if is_eligible:
                conflict_duty = db.query(DutyAssignment).join(CampusDuty).filter(
                    DutyAssignment.teacher_id == t.id,
                    DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED]),
                    CampusDuty.duty_date == duty.duty_date,
                    CampusDuty.id != duty.id
                ).all()

                for a in conflict_duty:
                    if max(a.duty.start_time, duty.start_time) < min(a.duty.end_time, duty.end_time):
                        is_eligible = False
                        exclusion_reason = f"Already assigned to {a.duty.title}"
                        break
                if is_eligible:
                    reasons.append("No overlapping duty conflict")

            # 5. Overlapping Substitution Conflict Check
            if is_eligible:
                sub_conflict = db.query(AlterAssignment).join(LeaveRequest).filter(
                    AlterAssignment.substitute_teacher_id == t.id,
                    LeaveRequest.date == duty.duty_date
                ).all()
                for sub in sub_conflict:
                    p_times = PERIOD_SCHEDULE.get(sub.period_number)
                    if p_times and max(p_times[0], duty.start_time) < min(p_times[1], duty.end_time):
                        is_eligible = False
                        exclusion_reason = f"Assigned to substitute teaching in Period {sub.period_number}"
                        break

            # 6. Current Duty Counts (Daily & Weekly)
            duties_today = db.query(DutyAssignment).join(CampusDuty).filter(
                DutyAssignment.teacher_id == t.id,
                DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED]),
                CampusDuty.duty_date == duty.duty_date
            ).count()

            duties_this_week = db.query(DutyAssignment).join(CampusDuty).filter(
                DutyAssignment.teacher_id == t.id,
                DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED]),
                CampusDuty.duty_date >= week_start,
                CampusDuty.duty_date <= week_end
            ).count()

            # Daily duty cap validation
            if is_eligible and duties_today >= rules.default_daily_duty_limit:
                is_eligible = False
                exclusion_reason = f"Reached maximum daily duty limit ({duties_today}/{rules.default_daily_duty_limit})"

            # 7. PRIMARY PREFERENCE: Free period immediately before break
            free_before_break = False
            if is_eligible and preceding_period is not None and duty.day_order:
                has_preceding_class = db.query(TimetableSlot).filter(
                    TimetableSlot.teacher_id == t.id,
                    TimetableSlot.day_order == duty.day_order,
                    TimetableSlot.period_number == preceding_period
                ).first() is not None

                if not has_preceding_class:
                    free_before_break = True
                    if rules.prefer_free_before_break:
                        score += 50.0
                        reasons.append(f"Free in preceding period P{preceding_period} (+50 pts)")
                else:
                    score -= 10.0

            # Workload balancing penalties
            if is_eligible:
                score -= (duties_today * 30.0)
                score -= (duties_this_week * 10.0)
                if duties_today == 0:
                    reasons.append("0 duties today")

            # Structural Proximity Preference for Exam Duty
            if is_eligible and duty.duty_type == DutyType.EXAM_DUTY and duty.room and duty.room.block_id:
                exam_block_id = duty.room.block_id
                is_same_block = False
                if t.department_id:
                    dept_room_in_block = db.query(Room).filter(
                        Room.block_id == exam_block_id,
                        Room.department_id == t.department_id
                    ).first() is not None
                    is_same_block = dept_room_in_block

                if is_same_block:
                    score += 20.0
                    block_name = duty.room.block.name if duty.room.block else "Block"
                    reasons.append(f"Structural proximity: Faculty department is in same block ({block_name}) (+20 pts)")

            # Respected Block Department preference for Wing & Discipline Duties
            if is_eligible and (duty.area and duty.area.block_id):
                duty_block_id = duty.area.block_id
                is_block_department = False
                if t.department_id:
                    from app.models.campus_structure import CampusBlock
                    blk = db.query(CampusBlock).filter(CampusBlock.id == duty_block_id).first()
                    if blk and blk.department_id == t.department_id:
                        is_block_department = True
                    elif db.query(Room).filter(Room.block_id == duty_block_id, Room.department_id == t.department_id).first():
                        is_block_department = True

                if is_block_department:
                    score += 25.0
                    b_name = duty.area.building_or_block or "Block"
                    reasons.append(f"Respected block department faculty ({b_name}) (+25 pts)")

            final_score = max(0.0, min(100.0, round(score, 1)))

            dept_name = t.department if isinstance(t.department, str) else (t.department.name if t.department else None)
            candidates.append(DutyCandidateOut(
                teacher_id=t.id,
                teacher_name=t.name or t.username,
                department_name=dept_name,
                score=final_score if is_eligible else 0.0,
                is_eligible=is_eligible,
                free_before_break=free_before_break,
                present_today=present_today,
                duties_today=duties_today,
                duties_this_week=duties_this_week,
                reasons=reasons,
                exclusion_reason=exclusion_reason
            ))

        # Sort: eligible first, then present_today, then higher score, then fewer duties today
        candidates.sort(key=lambda c: (c.is_eligible, c.present_today, c.score, -c.duties_today, -c.duties_this_week), reverse=True)

        assigned_count = len(assigned_teacher_ids)
        return DutyCandidatesResponse(
            duty_id=duty.id,
            duty_title=duty.title,
            duty_type=duty.duty_type,
            required_teachers=duty.required_teachers,
            assigned_count=assigned_count,
            candidates=candidates
        )

    # ── Assignment Actions ───────────────────────────────────────────────────

    @staticmethod
    def auto_assign_duty(
        db: Session,
        duty_id: int,
        user_id: Optional[int] = None,
        allowed_department_ids: Optional[Set[int]] = None
    ) -> CampusDuty:
        duty = db.query(CampusDuty).with_for_update().filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        if duty.is_locked:
            raise DomainException(f"Cannot auto-assign: Duty '{duty.title}' is locked by administrator ({duty.lock_reason or 'Protected'})", status_code=409)

        if duty.status == DutyStatus.CANCELLED:
            raise DomainException(f"Cannot auto-assign: Duty '{duty.title}' is deactivated.", status_code=409)

        cand_resp = CampusDutyService.evaluate_candidates(db, duty_id, allowed_department_ids=allowed_department_ids)
        eligible_candidates = [c for c in cand_resp.candidates if c.is_eligible]

        active_assignments = [
            a for a in duty.assignments
            if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)
        ]
        needed_count = max(0, duty.required_teachers - len(active_assignments))

        selected = eligible_candidates[:needed_count]

        new_assignments = []
        for c in selected:
            assignment = DutyAssignment(
                duty_id=duty.id,
                teacher_id=c.teacher_id,
                status=AssignmentStatus.ASSIGNED,
                role="GENERAL",
                assigned_by_user_id=user_id,
                is_manual=False,
                is_locked=False,
                selection_reason=c.reasons,
                score=c.score
            )
            db.add(assignment)
            new_assignments.append(assignment)

            # Send in-app & push notification to assigned faculty
            time_str = f"{duty.start_time.strftime('%H:%M')} – {duty.end_time.strftime('%H:%M')}"
            create_notification(
                db=db,
                user_id=c.teacher_id,
                title=f"{duty.title} Assigned",
                body=f"You have been assigned to {duty.title} on {duty.duty_date} ({time_str}).",
                event_type="campus_duty_assigned"
            )

        db.commit()
        db.refresh(duty)

        # Record assignment run
        unfilled = max(0, duty.required_teachers - (len(active_assignments) + len(new_assignments)))
        run = DutyAssignmentRun(
            run_date=duty.duty_date,
            duty_type=duty.duty_type,
            triggered_by_user_id=user_id,
            total_duties=1,
            total_assigned=len(new_assignments),
            total_unfilled=unfilled,
            details={"duty_id": duty.id, "needed": needed_count, "assigned": len(new_assignments)}
        )
        db.add(run)
        db.commit()

        # If unfilled, alert HOD/Admin
        if unfilled > 0:
            CampusDutyService._log_audit(db, user_id, "DUTY_UNFILLED_ALERT", {
                "duty_id": duty.id,
                "required": duty.required_teachers,
                "assigned": len(active_assignments) + len(new_assignments),
                "unfilled_count": unfilled
            })

        CampusDutyService._log_audit(db, user_id, "DUTY_AUTO_ASSIGNED", {
            "duty_id": duty.id,
            "assigned_teachers": [c.teacher_id for c in selected]
        })

        return CampusDutyService.get_duty(db, duty.id)

    @staticmethod
    def auto_assign_all_for_date(db: Session, target_date: date, department_id: Optional[int] = None, user_id: Optional[int] = None) -> Dict[str, Any]:
        duties = db.query(CampusDuty).filter(
            CampusDuty.duty_date == target_date,
            or_(CampusDuty.department_id == department_id, CampusDuty.department_id == None)
        ).all()

        total_duties = len(duties)
        total_assigned = 0
        total_unfilled = 0

        for d in duties:
            if d.is_locked:
                continue
            active_count = sum(1 for a in d.assignments if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED))
            if active_count < d.required_teachers:
                try:
                    updated = CampusDutyService.auto_assign_duty(db, d.id, user_id)
                    cur_assigned = sum(1 for a in updated.assignments if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED))
                    total_assigned += (cur_assigned - active_count)
                    total_unfilled += max(0, d.required_teachers - cur_assigned)
                except Exception as e:
                    logger.warning("Auto assign failed for duty %d: %s", d.id, e)
                    total_unfilled += (d.required_teachers - active_count)
            else:
                total_assigned += active_count

        return {
            "target_date": str(target_date),
            "total_duties": total_duties,
            "total_assigned": total_assigned,
            "total_unfilled": total_unfilled
        }

    @staticmethod
    def get_next_6_day_orders(
        db: Session,
        start_date: Optional[date] = None,
        num_day_orders: int = 6
    ) -> List[Dict[str, Any]]:
        """Walks forward from start_date to collect `num_day_orders` working calendar days,
        skipping Sundays and blocked calendar days (holidays/events). Returns metadata and duty counts."""
        base_date = start_date or date.today()
        collected_dates: List[date] = []
        cursor = base_date
        max_search = num_day_orders * 4
        for _ in range(max_search):
            if cursor.weekday() < 6:  # Mon-Sat (0-5)
                cal_day = db.query(CalendarDay).filter(CalendarDay.date == cursor).first()
                if not cal_day or not cal_day.blocks_operations:
                    collected_dates.append(cursor)
            if len(collected_dates) == num_day_orders:
                break
            cursor += timedelta(days=1)

        result = []
        for d in collected_dates:
            d_order = CampusDutyService.get_day_order_for_date(db, d)
            duties = db.query(CampusDuty).filter(
                CampusDuty.duty_date == d,
                CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT])
            ).all()

            total_duties = len(duties)
            total_assigned = 0
            total_unfilled = 0
            for duty in duties:
                active_assignments = [
                    a for a in duty.assignments
                    if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)
                ]
                if len(active_assignments) >= duty.required_teachers:
                    total_assigned += 1
                else:
                    total_unfilled += 1

            result.append({
                "date": str(d),
                "day_order": d_order,
                "day_name": d.strftime("%A"),
                "formatted_date": d.strftime("%b %d"),
                "total_duties": total_duties,
                "filled_duties": total_assigned,
                "unfilled_duties": total_unfilled,
                "is_today": d == date.today()
            })
        return result

    @staticmethod
    def autonomous_activate_duties(
        db: Session,
        target_date: Optional[date] = None,
        activate_discipline: bool = True,
        activate_wing: bool = True,
        num_day_orders: int = 6,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        One-click autonomous activation:
        Generates duties for the next `num_day_orders` working day-orders starting from
        `target_date` and auto-assigns available staff for each day.
        Returns a per-day-order summary and overall totals.
        """
        start_date = target_date or date.today()

        # Walk forward from start_date to collect `num_day_orders` working days
        collected_dates: List[date] = []
        cursor = start_date
        max_search = num_day_orders * 4  # guard against infinite loops
        for _ in range(max_search):
            if cursor.weekday() < 6:  # Mon-Sat (0-5)
                cal_day = db.query(CalendarDay).filter(CalendarDay.date == cursor).first()
                if not cal_day or not cal_day.blocks_operations:
                    collected_dates.append(cursor)
            if len(collected_dates) == num_day_orders:
                break
            cursor += timedelta(days=1)

        per_day_order: List[Dict[str, Any]] = []
        total_discipline = 0
        total_wing = 0
        total_assigned = 0
        total_unfilled = 0

        for d_date in collected_dates:
            day_order = CampusDutyService.get_day_order_for_date(db, d_date)
            discipline_duties: List[CampusDuty] = []
            wing_duties: List[CampusDuty] = []

            if activate_discipline:
                discipline_duties = CampusDutyService.generate_discipline_duties(
                    db, target_date=d_date, department_id=None, user_id=user_id
                )

            if activate_wing:
                wing_duties = CampusDutyService.generate_wing_duties(
                    db, target_date=d_date, department_id=None, user_id=user_id
                )

            # Auto-assign faculty for this day
            assign_summary = CampusDutyService.auto_assign_all_for_date(
                db, target_date=d_date, department_id=None, user_id=user_id
            )

            day_assigned = assign_summary.get("total_assigned", 0)
            day_unfilled = assign_summary.get("total_unfilled", 0)

            total_discipline += len(discipline_duties)
            total_wing += len(wing_duties)
            total_assigned += day_assigned
            total_unfilled += day_unfilled

            per_day_order.append({
                "date": str(d_date),
                "day_order": day_order,
                "discipline_duties": len(discipline_duties),
                "wing_duties": len(wing_duties),
                "total_duties": len(discipline_duties) + len(wing_duties),
                "assigned": day_assigned,
                "unfilled": day_unfilled,
            })

        # Collect the full flat duty list across all generated dates
        date_from = collected_dates[0] if collected_dates else start_date
        date_to = collected_dates[-1] if collected_dates else start_date
        all_duties = db.query(CampusDuty).filter(
            CampusDuty.duty_date >= date_from,
            CampusDuty.duty_date <= date_to
        ).order_by(CampusDuty.duty_date, CampusDuty.start_time).all()

        CampusDutyService._log_audit(db, user_id, "AUTONOMOUS_SCHEDULE_ACTIVATED", {
            "start_date": str(start_date),
            "num_day_orders": num_day_orders,
            "activate_discipline": activate_discipline,
            "activate_wing": activate_wing,
            "total_discipline": total_discipline,
            "total_wing": total_wing,
            "total_assigned": total_assigned,
        })
        db.commit()

        return {
            "success": True,
            "start_date": str(start_date),
            "num_day_orders": num_day_orders,
            "schedule_from": str(date_from),
            "schedule_to": str(date_to),
            "discipline_duties_count": total_discipline,
            "wing_duties_count": total_wing,
            "total_duties_active": len(all_duties),
            "total_assigned": total_assigned,
            "total_unfilled": total_unfilled,
            "per_day_order": per_day_order,
            "message": (
                f"6-day-order duty schedule generated: {total_discipline} discipline + "
                f"{total_wing} wing duties across {num_day_orders} day orders. "
                f"{total_assigned} faculty auto-assigned."
            )
        }

    @staticmethod
    def manual_assign(db: Session, duty_id: int, teacher_id: int, user_id: Optional[int] = None, role: str = "GENERAL") -> DutyAssignment:
        duty = CampusDutyService.get_duty(db, duty_id)

        if duty.status == DutyStatus.CANCELLED:
            raise DomainException(f"Cannot assign: Duty '{duty.title}' is deactivated.", status_code=409)

        # Check duty capacity
        active_count = db.query(DutyAssignment).filter(
            DutyAssignment.duty_id == duty_id,
            DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED])
        ).count()
        if active_count >= duty.required_teachers:
            raise DomainException(f"Duty '{duty.title}' is already full ({active_count}/{duty.required_teachers} staff assigned). Remove or replace an existing assignment first.", status_code=409)

        # Check existing active assignment
        existing = db.query(DutyAssignment).filter(
            DutyAssignment.duty_id == duty_id,
            DutyAssignment.teacher_id == teacher_id,
            DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED])
        ).first()
        if existing:
            raise DomainException("This teacher is already assigned to this duty", status_code=409)

        teacher = db.query(User).filter(User.id == teacher_id, User.is_active == True).first()
        if not teacher:
            raise DomainException("Teacher not found", status_code=404)
        if teacher.role != Role.teacher:
            raise DomainException(
                f"'{teacher.name}' is not a teacher and cannot be assigned to campus duties. "
                "Only faculty members with the Teacher role may be assigned.",
                status_code=422
            )

        assignment = DutyAssignment(
            duty_id=duty.id,
            teacher_id=teacher_id,
            status=AssignmentStatus.ASSIGNED,
            role=role,
            assigned_by_user_id=user_id,
            is_manual=True,
            is_locked=False,
            selection_reason=["Manual assignment by HOD / Coordinator"],
            score=100.0
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)

        time_str = f"{duty.start_time.strftime('%H:%M')} – {duty.end_time.strftime('%H:%M')}"
        create_notification(
            db=db,
            user_id=teacher_id,
            title=f"{duty.title} Assigned",
            body=f"You have been assigned to {duty.title} on {duty.duty_date} ({time_str}).",
            event_type="campus_duty_assigned"
        )

        CampusDutyService._log_audit(db, user_id, "DUTY_MANUAL_ASSIGN", {
            "duty_id": duty.id,
            "teacher_id": teacher_id,
            "role": role
        })
        return assignment

    @staticmethod
    def override_assignment(db: Session, assignment_id: int, new_teacher_id: int, user_id: Optional[int] = None, reason: str = "") -> DutyAssignment:
        old_assignment = db.query(DutyAssignment).filter(DutyAssignment.id == assignment_id).first()
        if not old_assignment:
            raise DomainException("Assignment not found", status_code=404)

        duty = old_assignment.duty
        if duty.is_locked:
            raise DomainException("Cannot override assignment on a locked duty. Unlock it first.", status_code=409)

        # Archive old assignment
        old_assignment.status = AssignmentStatus.OVERRIDDEN
        old_assignment.overridden_by_user_id = user_id
        old_assignment.overridden_reason = reason

        # Create new assignment — validate replacement is a teacher
        new_teacher = db.query(User).filter(User.id == new_teacher_id, User.is_active == True).first()
        if not new_teacher:
            raise DomainException("Replacement teacher not found", status_code=404)
        if new_teacher.role != Role.teacher:
            raise DomainException(
                f"'{new_teacher.name}' is not a teacher and cannot be assigned to campus duties. "
                "Only faculty members with the Teacher role may be assigned.",
                status_code=422
            )

        new_assignment = DutyAssignment(
            duty_id=duty.id,
            teacher_id=new_teacher_id,
            status=AssignmentStatus.ASSIGNED,
            role=old_assignment.role,
            assigned_by_user_id=user_id,
            is_manual=True,
            is_locked=False,
            selection_reason=[f"Administrative override: {reason}"],
            score=100.0
        )
        db.add(new_assignment)
        db.commit()
        db.refresh(new_assignment)

        # Notify old teacher & new teacher
        create_notification(
            db=db,
            user_id=old_assignment.teacher_id,
            title=f"Duty Reassigned: {duty.title}",
            body=f"You have been relieved from {duty.title} on {duty.duty_date}. Reason: {reason}",
            event_type="campus_duty_relieved"
        )
        create_notification(
            db=db,
            user_id=new_teacher_id,
            title=f"{duty.title} Assigned",
            body=f"You have been assigned to {duty.title} on {duty.duty_date}.",
            event_type="campus_duty_assigned"
        )

        CampusDutyService._log_audit(db, user_id, "DUTY_ASSIGNMENT_OVERRIDDEN", {
            "duty_id": duty.id,
            "old_teacher_id": old_assignment.teacher_id,
            "new_teacher_id": new_teacher_id,
            "reason": reason
        })
        return new_assignment

    @staticmethod
    def set_lock_duty(db: Session, duty_id: int, lock: bool, user_id: Optional[int] = None, reason: Optional[str] = None) -> CampusDuty:
        duty = db.query(CampusDuty).filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        duty.is_locked = lock
        if lock:
            duty.locked_by_user_id = user_id
            duty.locked_at = datetime.now(timezone.utc)
            duty.lock_reason = reason
        else:
            duty.locked_by_user_id = None
            duty.locked_at = None
            duty.lock_reason = None

        db.commit()
        db.refresh(duty)
        CampusDutyService._log_audit(db, user_id, "DUTY_LOCKED" if lock else "DUTY_UNLOCKED", {
            "duty_id": duty.id,
            "reason": reason
        })
        return CampusDutyService.get_duty(db, duty.id)

    @staticmethod
    def reset_duty(db: Session, duty_id: int, user_id: Optional[int] = None) -> CampusDuty:
        """Clears all faculty assignments and unlocks the duty, resetting staff count to 0."""
        duty = db.query(CampusDuty).filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        # Remove all assignments
        db.query(DutyAssignment).filter(DutyAssignment.duty_id == duty_id).delete(synchronize_session=False)

        # Reset lock & restore status
        duty.is_locked = False
        duty.locked_by_user_id = None
        duty.locked_at = None
        duty.lock_reason = None
        if duty.status == DutyStatus.CANCELLED:
            duty.status = DutyStatus.PUBLISHED

        db.commit()
        db.refresh(duty)
        CampusDutyService._log_audit(db, user_id, "DUTY_RESET", {
            "duty_id": duty.id,
            "title": duty.title
        })
        return CampusDutyService.get_duty(db, duty.id)

    @staticmethod
    def toggle_duty_active(db: Session, duty_id: int, user_id: Optional[int] = None) -> CampusDuty:
        """Toggles a duty's status between PUBLISHED (active) and CANCELLED (deactivated)."""
        duty = db.query(CampusDuty).filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        if duty.status == DutyStatus.CANCELLED:
            duty.status = DutyStatus.PUBLISHED
            action = "DUTY_ACTIVATED"
        else:
            duty.status = DutyStatus.CANCELLED
            action = "DUTY_DEACTIVATED"

        db.commit()
        db.refresh(duty)
        CampusDutyService._log_audit(db, user_id, action, {
            "duty_id": duty.id,
            "title": duty.title,
            "status": duty.status.value if hasattr(duty.status, "value") else str(duty.status)
        })
        return CampusDutyService.get_duty(db, duty.id)

    @staticmethod
    def delete_duty(db: Session, duty_id: int, user_id: Optional[int] = None) -> dict:
        """Permanently deletes a duty and its assignments."""
        duty = db.query(CampusDuty).filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        title = duty.title
        db.query(DutyAssignment).filter(DutyAssignment.duty_id == duty_id).delete(synchronize_session=False)
        db.delete(duty)
        db.commit()

        CampusDutyService._log_audit(db, user_id, "DUTY_DELETED", {
            "duty_id": duty_id,
            "title": title
        })
        return {"success": True, "message": f"Duty '{title}' has been deleted.", "duty_id": duty_id}

    @staticmethod
    def bulk_delete_duties(
        db: Session,
        target_date: Optional[date] = None,
        duty_ids: Optional[List[int]] = None,
        duty_type: Optional[str] = None,
        department_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> dict:
        """Permanently deletes multiple duties (by explicit IDs or by target date/filter)."""
        q = db.query(CampusDuty)
        if duty_ids:
            q = q.filter(CampusDuty.id.in_(duty_ids))
        elif target_date:
            q = q.filter(CampusDuty.duty_date == target_date)
            if duty_type:
                q = q.filter(CampusDuty.duty_type == duty_type)
            if department_id:
                q = q.filter(CampusDuty.department_id == department_id)
        else:
            raise DomainException("Must specify target_date or duty_ids for bulk deletion", status_code=400)

        duties_to_delete = q.all()
        count = len(duties_to_delete)
        if count == 0:
            return {"success": True, "deleted_count": 0, "message": "No duties found matching the criteria."}

        target_ids = [d.id for d in duties_to_delete]
        db.query(DutyAssignment).filter(DutyAssignment.duty_id.in_(target_ids)).delete(synchronize_session=False)
        db.query(CampusDuty).filter(CampusDuty.id.in_(target_ids)).delete(synchronize_session=False)
        db.commit()

        CampusDutyService._log_audit(db, user_id, "DUTIES_BULK_DELETED", {
            "target_date": str(target_date) if target_date else None,
            "deleted_count": count,
            "duty_ids": target_ids
        })
        return {
            "success": True,
            "deleted_count": count,
            "message": f"Successfully deleted {count} duty schedule(s)."
        }

    @staticmethod
    def bulk_reset_duties(
        db: Session,
        target_date: Optional[date] = None,
        duty_ids: Optional[List[int]] = None,
        duty_type: Optional[str] = None,
        department_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> dict:
        """Clears faculty assignments and unlocks multiple duties (by IDs or by target date)."""
        q = db.query(CampusDuty)
        if duty_ids:
            q = q.filter(CampusDuty.id.in_(duty_ids))
        elif target_date:
            q = q.filter(CampusDuty.duty_date == target_date)
            if duty_type:
                q = q.filter(CampusDuty.duty_type == duty_type)
            if department_id:
                q = q.filter(CampusDuty.department_id == department_id)
        else:
            raise DomainException("Must specify target_date or duty_ids for bulk reset", status_code=400)

        duties = q.all()
        count = len(duties)
        if count == 0:
            return {"success": True, "reset_count": 0, "message": "No duties found matching the criteria."}

        target_ids = [d.id for d in duties]
        db.query(DutyAssignment).filter(DutyAssignment.duty_id.in_(target_ids)).delete(synchronize_session=False)

        for d in duties:
            d.is_locked = False
            d.locked_by_user_id = None
            d.locked_at = None
            d.lock_reason = None
            if d.status == DutyStatus.CANCELLED:
                d.status = DutyStatus.PUBLISHED

        db.commit()
        CampusDutyService._log_audit(db, user_id, "DUTIES_BULK_RESET", {
            "target_date": str(target_date) if target_date else None,
            "reset_count": count
        })
        return {
            "success": True,
            "reset_count": count,
            "message": f"Successfully reset assignments for {count} duty schedule(s)."
        }

    @staticmethod
    def replace_unavailable_teacher(db: Session, assignment_id: int, user_id: Optional[int] = None, reason: str = "") -> DutyAssignment:
        assignment = db.query(DutyAssignment).filter(DutyAssignment.id == assignment_id).first()
        if not assignment:
            raise DomainException("Assignment not found", status_code=404)

        duty = assignment.duty
        cand_resp = CampusDutyService.evaluate_candidates(db, duty.id)
        eligible = [c for c in cand_resp.candidates if c.is_eligible and c.teacher_id != assignment.teacher_id]

        if not eligible:
            assignment.status = AssignmentStatus.REPLACED
            assignment.replacement_reason = f"Marked unavailable ({reason}), no replacement candidate found."
            db.commit()
            raise DomainException(f"No eligible replacement candidates available for {duty.title}. Duty is now unfilled.", status_code=409)

        best_cand = eligible[0]
        assignment.status = AssignmentStatus.REPLACED
        assignment.replacement_reason = reason

        replacement = DutyAssignment(
            duty_id=duty.id,
            teacher_id=best_cand.teacher_id,
            status=AssignmentStatus.ASSIGNED,
            role=assignment.role,
            assigned_by_user_id=user_id,
            is_manual=False,
            is_locked=False,
            replaced_assignment_id=assignment.id,
            selection_reason=best_cand.reasons + [f"Replacement for unavailable staff: {reason}"],
            score=best_cand.score
        )
        db.add(replacement)
        db.commit()
        db.refresh(replacement)

        # Notifications
        create_notification(
            db=db,
            user_id=best_cand.teacher_id,
            title=f"Replacement Duty Assigned: {duty.title}",
            body=f"You have been assigned as replacement for {duty.title} on {duty.duty_date}.",
            event_type="campus_duty_assigned"
        )

        CampusDutyService._log_audit(db, user_id, "DUTY_TEACHER_REPLACED", {
            "duty_id": duty.id,
            "old_teacher_id": assignment.teacher_id,
            "new_teacher_id": best_cand.teacher_id,
            "reason": reason
        })
        return replacement

    # ── Dashboard & Metrics ──────────────────────────────────────────────────

    @staticmethod
    def get_dashboard_metrics(db: Session, target_date: date, department_id: Optional[int] = None) -> DutyDashboardMetricsOut:
        q = db.query(CampusDuty).filter(CampusDuty.duty_date == target_date)
        if department_id:
            q = q.filter(or_(CampusDuty.department_id == department_id, CampusDuty.department_id == None))
        duties = q.all()

        total = len(duties)
        filled = 0
        unfilled = 0
        assigned_teachers_set = set()
        locked = 0
        replacements_needed = 0

        disc_total, disc_filled = 0, 0
        wing_total, wing_filled = 0, 0
        exam_total, exam_filled = 0, 0

        for d in duties:
            if d.is_locked:
                locked += 1

            active_assignments = [
                a for a in d.assignments
                if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)
            ]
            for a in active_assignments:
                assigned_teachers_set.add(a.teacher_id)

            is_full = len(active_assignments) >= d.required_teachers
            if is_full:
                filled += 1
            else:
                unfilled += 1

            # Category coverage
            dtype = d.duty_type.value if hasattr(d.duty_type, "value") else str(d.duty_type)
            if dtype == DutyType.DISCIPLINE_DUTY.value:
                disc_total += d.required_teachers
                disc_filled += len(active_assignments)
            elif dtype == DutyType.WING_DUTY.value:
                wing_total += d.required_teachers
                wing_filled += len(active_assignments)
            elif dtype == DutyType.EXAM_DUTY.value:
                exam_total += d.required_teachers
                exam_filled += len(active_assignments)

        disc_pct = 100.0 if disc_total == 0 else round((disc_filled / disc_total) * 100, 1)
        wing_pct = 100.0 if wing_total == 0 else round((wing_filled / wing_total) * 100, 1)
        exam_pct = 100.0 if exam_total == 0 else round((exam_filled / exam_total) * 100, 1)

        return DutyDashboardMetricsOut(
            total_duties_today=total,
            filled_duties_today=filled,
            unfilled_duties_today=unfilled,
            teachers_assigned_today=len(assigned_teachers_set),
            locked_duties_today=locked,
            replacements_needed_today=replacements_needed,
            discipline_coverage_pct=disc_pct,
            wing_coverage_pct=wing_pct,
            exam_coverage_pct=exam_pct
        )

    # ── Rules & Configuration ────────────────────────────────────────────────

    @staticmethod
    def get_rules(db: Session, department_id: Optional[int] = None) -> DutyRulesOut:
        max_disc = int(get_setting(db, "duty_max_discipline_teachers", "3", department_id))
        daily_lim = int(get_setting(db, "duty_daily_limit", "1", department_id))
        weekly_lim = int(get_setting(db, "duty_weekly_limit", "3", department_id))
        free_before = get_setting(db, "duty_prefer_free_before_break", "true", department_id).lower() == "true"
        auto_assign = get_setting(db, "duty_auto_assignment_enabled", "true", department_id).lower() == "true"
        auto_rep = get_setting(db, "duty_auto_replacement_enabled", "true", department_id).lower() == "true"
        cross_dept = get_setting(db, "duty_cross_department_enabled", "false", department_id).lower() == "true"
        max_exam = int(get_setting(db, "duty_max_exam_duties", "5", department_id))

        return DutyRulesOut(
            max_discipline_teachers=max_disc,
            default_daily_duty_limit=daily_lim,
            default_weekly_duty_limit=weekly_lim,
            prefer_free_before_break=free_before,
            auto_assignment_enabled=auto_assign,
            auto_replacement_enabled=auto_rep,
            cross_department_assignment=cross_dept,
            max_exam_duties=max_exam
        )

    @staticmethod
    def update_rules(db: Session, data: DutyRulesUpdate, user_id: Optional[int] = None, department_id: Optional[int] = None) -> Tuple[DutyRulesOut, List[DutyRulesImpactPreview]]:
        current = CampusDutyService.get_rules(db, department_id)
        previews: List[DutyRulesImpactPreview] = []

        if data.max_discipline_teachers is not None:
            old_val = current.max_discipline_teachers
            new_val = max(1, min(10, data.max_discipline_teachers))
            set_setting(db, "duty_max_discipline_teachers", str(new_val), department_id)
            previews.append(DutyRulesImpactPreview(
                rule_name="Max Discipline Teachers",
                old_value=old_val,
                new_value=new_val,
                impact_explanation=f"Future discipline duties will require {new_val} teachers. Existing locked assignments remain unchanged.",
                affects_future=True,
                affects_existing_unlocked=True,
                affects_existing_locked=False
            ))

        if data.default_daily_duty_limit is not None:
            old_val = current.default_daily_duty_limit
            new_val = max(1, min(3, data.default_daily_duty_limit))
            set_setting(db, "duty_daily_limit", str(new_val), department_id)
            previews.append(DutyRulesImpactPreview(
                rule_name="Daily Duty Limit",
                old_value=old_val,
                new_value=new_val,
                impact_explanation=f"Teachers may be assigned up to {new_val} duty per day.",
                affects_future=True,
                affects_existing_unlocked=False,
                affects_existing_locked=False
            ))

        if data.default_weekly_duty_limit is not None:
            old_val = current.default_weekly_duty_limit
            new_val = max(1, min(10, data.default_weekly_duty_limit))
            set_setting(db, "duty_weekly_limit", str(new_val), department_id)
            previews.append(DutyRulesImpactPreview(
                rule_name="Weekly Duty Limit",
                old_value=old_val,
                new_value=new_val,
                impact_explanation=f"Teachers will not be auto-assigned more than {new_val} duties in a single week.",
                affects_future=True,
                affects_existing_unlocked=False,
                affects_existing_locked=False
            ))

        if data.prefer_free_before_break is not None:
            set_setting(db, "duty_prefer_free_before_break", "true" if data.prefer_free_before_break else "false", department_id)
            previews.append(DutyRulesImpactPreview(
                rule_name="Prefer Free Period Before Break",
                old_value=current.prefer_free_before_break,
                new_value=data.prefer_free_before_break,
                impact_explanation="When enabled, faculty members with a free timetable slot immediately preceding the break receive highest assignment priority (+50 pts).",
                affects_future=True,
                affects_existing_unlocked=True,
                affects_existing_locked=False
            ))

        if data.auto_assignment_enabled is not None:
            set_setting(db, "duty_auto_assignment_enabled", "true" if data.auto_assignment_enabled else "false", department_id)
        if data.auto_replacement_enabled is not None:
            set_setting(db, "duty_auto_replacement_enabled", "true" if data.auto_replacement_enabled else "false", department_id)
        if data.cross_department_assignment is not None:
            set_setting(db, "duty_cross_department_enabled", "true" if data.cross_department_assignment else "false", department_id)
        if data.max_exam_duties is not None:
            set_setting(db, "duty_max_exam_duties", str(data.max_exam_duties), department_id)

        db.commit()
        CampusDutyService._log_audit(db, user_id, "CAMPUS_DUTY_RULES_UPDATED", {
            "changes": [p.model_dump() for p in previews]
        })
        return CampusDutyService.get_rules(db, department_id), previews

    @staticmethod
    def to_duty_out(duty: CampusDuty) -> CampusDutyOut:
        assignments_out = []
        seen_teacher_ids = set()
        for a in duty.assignments:
            status_val = a.status.value if hasattr(a.status, "value") else str(a.status)
            if status_val not in (AssignmentStatus.ASSIGNED.value, AssignmentStatus.PROPOSED.value):
                continue
            if a.teacher_id in seen_teacher_ids:
                continue
            seen_teacher_ids.add(a.teacher_id)

            teacher_name = getattr(a.teacher, "name", None) or getattr(a.teacher, "username", "Unknown")
            teacher_dept = a.teacher.department if isinstance(a.teacher.department, str) else (a.teacher.department.name if a.teacher and a.teacher.department else None)
            raw_reason = a.selection_reason
            reason_str = None
            reasons_list = None
            if raw_reason:
                if isinstance(raw_reason, list):
                    reasons_list = [str(r) for r in raw_reason if r]
                    reason_str = " · ".join(reasons_list)
                else:
                    reason_str = str(raw_reason)
                    reasons_list = [reason_str]

            assignments_out.append(DutyAssignmentOut(
                id=a.id,
                duty_id=a.duty_id,
                teacher_id=a.teacher_id,
                teacher_name=teacher_name,
                teacher_department=teacher_dept,
                status=a.status.value if hasattr(a.status, "value") else str(a.status),
                role=a.role,
                is_manual=a.is_manual,
                is_locked=a.is_locked,
                selection_reason=reason_str,
                selection_reasons=reasons_list,
                score=a.score,
                overridden_by_user_id=a.overridden_by_user_id,
                overridden_reason=a.overridden_reason,
                replacement_reason=a.replacement_reason,
                created_at=a.created_at
            ))

        active_count = sum(1 for a in assignments_out if a.status in (AssignmentStatus.ASSIGNED.value, AssignmentStatus.PROPOSED.value))
        locked_by = None
        if duty.locked_by_user:
            locked_by = getattr(duty.locked_by_user, "name", None) or getattr(duty.locked_by_user, "username", None)

        room_number = None
        room_name = None
        loc_hierarchy = None
        if duty.room:
            room_number = duty.room.room_number
            room_name = duty.room.room_name or duty.room.room_number
            parts = []
            if duty.room.block:
                parts.append(duty.room.block.name)
            if duty.room.floor:
                parts.append(duty.room.floor.floor_name)
            parts.append(room_name)
            loc_hierarchy = " · ".join(parts)
        elif duty.area:
            loc_hierarchy = duty.area.name

        return CampusDutyOut(
            id=duty.id,
            duty_type=duty.duty_type.value if hasattr(duty.duty_type, "value") else str(duty.duty_type),
            title=duty.title,
            duty_date=duty.duty_date,
            start_time=duty.start_time,
            end_time=duty.end_time,
            break_period_id=duty.break_period_id,
            break_period_name=duty.break_period.name if duty.break_period else None,
            area_id=duty.area_id,
            area_name=duty.area.name if duty.area else None,
            area_code=duty.area.code if duty.area else None,
            room_id=duty.room_id,
            room_number=room_number,
            room_name=room_name,
            location_hierarchy=loc_hierarchy,
            department_id=duty.department_id,
            department_name=duty.department.name if duty.department else None,
            day_order=duty.day_order,
            required_teachers=duty.required_teachers,
            assigned_teachers_count=active_count,
            status=duty.status.value if hasattr(duty.status, "value") else str(duty.status),
            is_locked=duty.is_locked,
            locked_by_name=locked_by,
            locked_at=duty.locked_at,
            lock_reason=duty.lock_reason,
            assignments=assignments_out,
            created_at=duty.created_at
        )

    # ── Block Duties Configuration & Auto-Assignment ─────────────────────────

    @staticmethod
    def configure_and_assign_block_duties(
        db: Session,
        block_id: int,
        data: Any,
        current_user: User
    ) -> Any:
        """Configures discipline and wing duties for a campus block and automatically assigns
        teachers belonging to that block's respected department(s) according to preset rules.
        Exclusively controlled by Principal and System Admin."""
        from app.models.campus_structure import CampusBlock, CampusFloor
        from app.schemas.campus_structure import BlockDutyConfigResultOut, BlockDutyAssignmentItem

        block = db.query(CampusBlock).options(
            joinedload(CampusBlock.department),
            joinedload(CampusBlock.floors).joinedload(CampusFloor.rooms).joinedload(Room.department)
        ).filter(CampusBlock.id == block_id).first()

        if not block:
            raise DomainException(f"Campus block with ID {block_id} not found", status_code=404)

        # 1. Determine all respected department(s) for this block
        respected_depts: Dict[int, str] = {}
        if block.department_id and block.department:
            respected_depts[block.department_id] = block.department.name

        for fl in block.floors:
            for rm in fl.rooms:
                if rm.department_id and rm.department:
                    respected_depts[rm.department_id] = rm.department.name

        allowed_dept_ids: Optional[Set[int]] = None
        if getattr(data, "enforce_block_department_only", True) and respected_depts:
            allowed_dept_ids = set(respected_depts.keys())

        primary_dept_id = block.department_id or (list(respected_depts.keys())[0] if respected_depts else None)

        # 2. Determine target dates and day orders
        target_dates: List[Tuple[date, Optional[int]]] = []
        if getattr(data, "scope", "SPECIFIC_DATE") == "NEXT_6_DAY_ORDERS":
            next_6 = CampusDutyService.get_next_6_day_orders(db)
            target_dates = [(item.calendar_date, item.day_order) for item in next_6]
        else:
            t_date = data.target_date or date.today()
            d_order = CampusDutyService.get_day_order_for_date(db, t_date)
            target_dates = [(t_date, d_order)]

        # 3. Break periods for discipline duties
        break_periods = []
        if data.discipline_duty_enabled:
            bp_q = db.query(DutyBreakPeriod).filter(DutyBreakPeriod.is_active == True)
            if data.break_period_ids:
                bp_q = bp_q.filter(DutyBreakPeriod.id.in_(data.break_period_ids))
            break_periods = bp_q.all()
            if not break_periods:
                CampusDutyService.ensure_default_break_periods(db, primary_dept_id)
                break_periods = db.query(DutyBreakPeriod).filter(DutyBreakPeriod.is_active == True).all()

        target_duties: List[CampusDuty] = []

        # 4. Generate / Configure Duties for each date
        for d_date, d_order in target_dates:
            # A. Wing Duties (Floor / Corridor)
            if data.wing_duty_enabled:
                for fl in sorted(block.floors, key=lambda f: f.display_order):
                    area_code = f"WING_{block.code}_{fl.floor_number}".upper()
                    area = db.query(CampusArea).filter(CampusArea.code == area_code).first()
                    if not area:
                        area = CampusArea(
                            name=f"{block.name} - {fl.floor_name}",
                            code=area_code,
                            duty_type=DutyType.WING_DUTY.value,
                            block_id=block.id,
                            floor_id=fl.id,
                            building_or_block=block.name,
                            floor=fl.floor_name,
                            required_teachers=data.teachers_per_wing,
                            department_id=primary_dept_id,
                            is_active=True
                        )
                        db.add(area)
                        db.flush()

                    title = f"Wing Duty - {block.name} ({fl.floor_name})"
                    duty = db.query(CampusDuty).filter(
                        CampusDuty.duty_date == d_date,
                        CampusDuty.duty_type == DutyType.WING_DUTY,
                        CampusDuty.title == title,
                        CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT])
                    ).first()

                    if duty:
                        duty.required_teachers = data.teachers_per_wing
                        duty.day_order = d_order
                        if not duty.department_id and primary_dept_id:
                            duty.department_id = primary_dept_id
                    else:
                        duty = CampusDuty(
                            duty_type=DutyType.WING_DUTY,
                            title=title,
                            duty_date=d_date,
                            start_time=time(9, 20),
                            end_time=time(16, 15),
                            area_id=area.id,
                            department_id=primary_dept_id,
                            day_order=d_order,
                            required_teachers=data.teachers_per_wing,
                            status=DutyStatus.PUBLISHED,
                            created_by_user_id=current_user.id
                        )
                        db.add(duty)
                        db.flush()

                    target_duties.append(duty)

            # B. Discipline Duties
            if data.discipline_duty_enabled:
                for bp in break_periods:
                    area_code = f"DISC_{block.code}_{bp.id}".upper()
                    area = db.query(CampusArea).filter(CampusArea.code == area_code).first()
                    if not area:
                        area = CampusArea(
                            name=f"Discipline Zone - {block.name} ({bp.name})",
                            code=area_code,
                            duty_type=DutyType.DISCIPLINE_DUTY.value,
                            block_id=block.id,
                            building_or_block=block.name,
                            required_teachers=data.teachers_per_discipline,
                            department_id=primary_dept_id,
                            is_active=True
                        )
                        db.add(area)
                        db.flush()

                    title = f"Discipline Duty - {block.name} ({bp.name})"
                    duty = db.query(CampusDuty).filter(
                        CampusDuty.duty_date == d_date,
                        CampusDuty.duty_type == DutyType.DISCIPLINE_DUTY,
                        CampusDuty.title == title,
                        CampusDuty.status.in_([DutyStatus.PUBLISHED, DutyStatus.DRAFT])
                    ).first()

                    if duty:
                        duty.required_teachers = data.teachers_per_discipline
                        duty.day_order = d_order
                        if not duty.department_id and primary_dept_id:
                            duty.department_id = primary_dept_id
                    else:
                        duty = CampusDuty(
                            duty_type=DutyType.DISCIPLINE_DUTY,
                            title=title,
                            duty_date=d_date,
                            start_time=bp.start_time,
                            end_time=bp.end_time,
                            break_period_id=bp.id,
                            area_id=area.id,
                            department_id=primary_dept_id,
                            day_order=d_order,
                            required_teachers=data.teachers_per_discipline,
                            status=DutyStatus.PUBLISHED,
                            created_by_user_id=current_user.id
                        )
                        db.add(duty)
                        db.flush()

                    target_duties.append(duty)

        db.commit()

        # 5. Execute Auto-Assignment on each configured duty
        assigned_items: List[BlockDutyAssignmentItem] = []
        for d in target_duties:
            db.refresh(d)
            if not d.is_locked:
                updated_duty = CampusDutyService.auto_assign_duty(
                    db, d.id, user_id=current_user.id, allowed_department_ids=allowed_dept_ids
                )
                for a in updated_duty.assignments:
                    if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED):
                        t_dept = a.teacher.department if isinstance(a.teacher.department, str) else (a.teacher.department_rel.name if getattr(a.teacher, "department_rel", None) else "General")
                        fl_name = updated_duty.area.floor if updated_duty.area else ""
                        assigned_items.append(BlockDutyAssignmentItem(
                            duty_id=updated_duty.id,
                            duty_title=updated_duty.title,
                            duty_type=updated_duty.duty_type.value if hasattr(updated_duty.duty_type, 'value') else str(updated_duty.duty_type),
                            area_or_floor=fl_name or (updated_duty.area.name if updated_duty.area else block.name),
                            duty_date=updated_duty.duty_date,
                            day_order=updated_duty.day_order,
                            teacher_id=a.teacher_id,
                            teacher_name=a.teacher.name or a.teacher.username,
                            teacher_email=a.teacher.email or "",
                            department_name=t_dept,
                            reasons=a.selection_reason or [],
                            score=a.score or 0.0
                        ))

        unfilled_total = sum(
            max(0, d.required_teachers - len([a for a in d.assignments if a.status in (AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED)]))
            for d in target_duties
        )

        dept_names_list = list(respected_depts.values()) if respected_depts else ["General"]
        CampusDutyService._log_audit(db, current_user.id, "BLOCK_DUTIES_CONFIGURED_AND_ASSIGNED", {
            "block_id": block.id,
            "block_name": block.name,
            "duties_count": len(target_duties),
            "teachers_assigned": len(assigned_items),
            "unfilled": unfilled_total
        }, department_id=primary_dept_id)

        return BlockDutyConfigResultOut(
            block_id=block.id,
            block_name=block.name,
            block_code=block.code,
            departments=dept_names_list,
            total_duties_configured=len(target_duties),
            total_teachers_assigned=len(assigned_items),
            unfilled_slots=unfilled_total,
            assignments=assigned_items,
            message=f"Configured {len(target_duties)} duties for {block.name}. Assigned {len(assigned_items)} teachers from respected department(s) ({', '.join(dept_names_list)})."
        )

