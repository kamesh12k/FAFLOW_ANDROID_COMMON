import json
import logging
from datetime import date, time, datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
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
                CampusDuty.break_period_id == bp.id,
                or_(CampusDuty.department_id == department_id, CampusDuty.department_id == None)
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
    def evaluate_candidates(db: Session, duty_id: int) -> DutyCandidatesResponse:
        duty = CampusDutyService.get_duty(db, duty_id)
        rules = CampusDutyService.get_rules(db, duty.department_id)

        # Base teacher query
        teacher_q = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
        if not rules.cross_department_assignment and duty.department_id:
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
                    is_eligible = False
                    exclusion_reason = "Teacher has not checked in today"
                elif att_record.check_out_time is not None:
                    present_today = False
                    is_eligible = False
                    exclusion_reason = "Teacher has already checked out"
            if present_today:
                reasons.append("Present today")

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

        # Sort: eligible first, then higher score, then fewer duties today
        candidates.sort(key=lambda c: (c.is_eligible, c.score, -c.duties_today, -c.duties_this_week), reverse=True)

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
    def auto_assign_duty(db: Session, duty_id: int, user_id: Optional[int] = None) -> CampusDuty:
        duty = db.query(CampusDuty).with_for_update().filter(CampusDuty.id == duty_id).first()
        if not duty:
            raise DomainException("Duty not found", status_code=404)

        if duty.is_locked:
            raise DomainException(f"Cannot auto-assign: Duty '{duty.title}' is locked by administrator ({duty.lock_reason or 'Protected'})", status_code=409)

        cand_resp = CampusDutyService.evaluate_candidates(db, duty_id)
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
    def autonomous_activate_duties(
        db: Session,
        target_date: Optional[date] = None,
        activate_discipline: bool = True,
        activate_wing: bool = True,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """One-click autonomous activation: generates duties and auto-assigns available staff."""
        t_date = target_date or date.today()
        discipline_duties = []
        wing_duties = []

        if activate_discipline:
            discipline_duties = CampusDutyService.generate_discipline_duties(
                db, target_date=t_date, department_id=None, user_id=user_id
            )

        if activate_wing:
            wing_duties = CampusDutyService.generate_wing_duties(
                db, target_date=t_date, department_id=None, user_id=user_id
            )

        # Autonomously match and assign available faculty to all duties for today
        assign_summary = CampusDutyService.auto_assign_all_for_date(
            db, target_date=t_date, department_id=None, user_id=user_id
        )

        all_duties = db.query(CampusDuty).filter(
            CampusDuty.duty_date == t_date
        ).order_by(CampusDuty.start_time).all()

        return {
            "success": True,
            "target_date": t_date,
            "discipline_duties_count": len(discipline_duties),
            "wing_duties_count": len(wing_duties),
            "total_duties_active": len(all_duties),
            "total_assigned": assign_summary.get("total_assigned", 0),
            "total_unfilled": assign_summary.get("total_unfilled", 0),
            "message": f"Autonomous duty activation complete: {assign_summary.get('total_assigned', 0)} faculty assignments made across {len(all_duties)} active duties."
        }

    @staticmethod
    def manual_assign(db: Session, duty_id: int, teacher_id: int, user_id: Optional[int] = None, role: str = "GENERAL") -> DutyAssignment:
        duty = CampusDutyService.get_duty(db, duty_id)

        # Check existing active assignment
        existing = db.query(DutyAssignment).filter(
            DutyAssignment.duty_id == duty_id,
            DutyAssignment.teacher_id == teacher_id,
            DutyAssignment.status.in_([AssignmentStatus.ASSIGNED, AssignmentStatus.PROPOSED])
        ).first()
        if existing:
            raise DomainException("This teacher is already assigned to this duty", status_code=409)

        teacher = db.query(User).filter(User.id == teacher_id).first()
        if not teacher:
            raise DomainException("Teacher not found", status_code=404)

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

        # Create new assignment
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
        for a in duty.assignments:
            teacher_name = getattr(a.teacher, "name", None) or getattr(a.teacher, "username", "Unknown")
            teacher_dept = a.teacher.department if isinstance(a.teacher.department, str) else (a.teacher.department.name if a.teacher and a.teacher.department else None)
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
                selection_reason=a.selection_reason,
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
