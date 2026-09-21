import csv
import io
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from fastapi import HTTPException, status

from app.models.student import Student
from app.models.student_attendance import (
    AttendanceSession, StudentAttendance, AttendanceCorrectionAudit,
    AttendanceType, SessionStatus, StudentAttendanceStatus
)
from app.models.class_ import Class
from app.models.subject import Subject
from app.models.department import Department
from app.models.user import User, Role
from app.models.timetable import TimetableSlot
from app.models.leave import LeaveRequest, AlterAssignment, LeaveStatus
from app.models.day_order_calendar import CalendarDay, DayType, BLOCKING_DAY_TYPES
from app.models.system_setting import SystemSetting
from app.schemas.student_attendance import (
    CreateAttendanceSessionRequest, SubmitAttendanceRequest, EmergencyAttendanceRequest, AttendanceCorrectionRequest,
    StudentOut, ClassRosterOut, StudentAttendanceRecordOut, AttendanceSessionOut,
    TeacherClassSlotOut, TeacherTodayAttendanceOut, HodAttendanceOverviewOut,
    HodClassAttendanceSummaryOut, HodAttendanceExceptionOut, HodSessionItemOut, OfflineSyncBatchRequest,
    OfflineSyncBatchResponse, SyncOperationResult, StudentStatusException,
    PrincipalDepartmentSummaryOut, PrincipalAttendanceOverviewOut, PrincipalSessionItemOut,
    ClassPeriodSlotInfo, ClassStudentMatrixRowOut, ClassPeriodMatrixOut,
    StudentSubjectAttendanceOut, StudentSessionHistoryItemOut, StudentProfileAttendanceOut,
    TeacherComplianceItemOut, PrincipalExceptionItemOut,
    AdminAttendanceOverrideRequest, AdminSessionLockRequest
)

logger = logging.getLogger(__name__)

# Standard institutional period schedule times (IST)
PERIOD_SCHEDULE = {
    1: (time(9, 20), time(10, 20), "09:20–10:20"),
    2: (time(10, 20), time(11, 15), "10:20–11:15"),
    3: (time(11, 40), time(12, 35), "11:40–12:35"),
    4: (time(13, 35), time(14, 30), "13:35–14:30"),
    5: (time(14, 55), time(15, 50), "14:55–15:50"),
}


class StudentAttendanceService:

    @staticmethod
    def get_setting(db: Session, key: str, default: str) -> str:
        s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        return s.value if s else default

    @staticmethod
    def get_submission_window_minutes(db: Session) -> int:
        try:
            return int(StudentAttendanceService.get_setting(db, "student_attendance_submission_window_minutes", "15"))
        except ValueError:
            return 15

    @staticmethod
    def get_correction_window_hours(db: Session) -> int:
        try:
            return int(StudentAttendanceService.get_setting(db, "student_attendance_correction_window_hours", "24"))
        except ValueError:
            return 24

    @staticmethod
    def determine_current_period(now_time: time) -> Optional[int]:
        for period, (start_t, end_t, _) in PERIOD_SCHEDULE.items():
            if start_t <= now_time <= end_t:
                return period
        minutes = now_time.hour * 60 + now_time.minute
        if minutes < 10 * 60 + 20:
            return 1
        elif minutes < 11 * 60 + 40:
            return 2
        elif minutes < 13 * 60 + 35:
            return 3
        elif minutes < 14 * 60 + 55:
            return 4
        else:
            return 5

    @staticmethod
    def get_scheduled_times(attendance_date: date, period_number: int) -> Tuple[datetime, datetime]:
        if period_number in PERIOD_SCHEDULE:
            start_t, end_t, _ = PERIOD_SCHEDULE[period_number]
        else:
            start_t, end_t = time(8, 0), time(9, 0)
        start_dt = datetime.combine(attendance_date, start_t).replace(tzinfo=timezone.utc)
        end_dt = datetime.combine(attendance_date, end_t).replace(tzinfo=timezone.utc)
        return start_dt, end_dt

    @staticmethod
    def normalize_roll_suffixes(raw_suffixes: List[str]) -> List[str]:
        """Normalizes and extracts unique 3-digit roll suffixes from diverse inputs."""
        normalized = []
        seen = set()
        for item in raw_suffixes:
            if not item:
                continue
            # Support space, comma, or newline-separated values inside individual strings
            tokens = item.replace(",", " ").replace("\n", " ").split()
            for token in tokens:
                clean = token.strip()
                if clean:
                    # Take last 3 digits/characters if longer than 3
                    suffix = clean[-3:].zfill(3) if clean.isdigit() else clean[-3:]
                    if suffix not in seen:
                        seen.add(suffix)
                        normalized.append(suffix)
        return normalized

    @staticmethod
    def resolve_class_roster(db: Session, class_id: int) -> ClassRosterOut:
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class ID {class_id} not found")

        from app.services.effective_membership_service import EffectiveMembershipService
        effective_roster = EffectiveMembershipService.resolve_class_students(db, class_id)

        students_out = [
            StudentOut(
                id=s.id,
                roll_number=s.roll_number,
                roll_suffix=s.roll_suffix,
                name=s.name,
                class_id=cls.id,
                department_id=cls.department_id,
                is_active=s.is_active
            )
            for s in effective_roster.students
        ]
        return ClassRosterOut(
            class_id=cls.id,
            class_name=cls.name,
            section=cls.section,
            department_id=cls.department_id,
            department_name=cls.department.name if cls.department else None,
            total_students=len(students_out),
            students=students_out
        )

    @staticmethod
    def get_today_teacher_schedule(db: Session, teacher: User, today: date) -> TeacherTodayAttendanceOut:
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == today).first()
        is_blocked = cal_day.day_type in BLOCKING_DAY_TYPES if cal_day else False
        block_reason = cal_day.day_type.value if is_blocked and cal_day else None
        day_order = cal_day.day_order if cal_day and not is_blocked else None

        try:
            from zoneinfo import ZoneInfo
            now_local = datetime.now(ZoneInfo("Asia/Kolkata"))
        except Exception:
            now_local = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        current_period = StudentAttendanceService.determine_current_period(now_local.time())

        scheduled_slots: List[TeacherClassSlotOut] = []
        if day_order:
            slots = (
                db.query(TimetableSlot)
                .filter(TimetableSlot.teacher_id == teacher.id, TimetableSlot.day_order == day_order)
                .order_by(TimetableSlot.period_number)
                .all()
            )
            for slot in slots:
                session = (
                    db.query(AttendanceSession)
                    .filter(
                        AttendanceSession.attendance_date == today,
                        AttendanceSession.class_id == slot.class_id,
                        AttendanceSession.period_number == slot.period_number
                    )
                    .first()
                )
                _, _, p_time = PERIOD_SCHEDULE.get(slot.period_number, (None, None, f"Period {slot.period_number}"))
                scheduled_slots.append(
                    TeacherClassSlotOut(
                        timetable_slot_id=slot.id,
                        period_number=slot.period_number,
                        period_time=p_time,
                        class_id=slot.class_id,
                        class_name=slot.class_.name if slot.class_ else "",
                        section=slot.class_.section if slot.class_ else "",
                        subject_id=slot.subject_id,
                        subject_name=slot.subject.name if slot.subject else "",
                        room_number=slot.room.room_number if slot.room else None,
                        is_substitution=False,
                        session_id=session.id if session else None,
                        session_status=session.status if session else None
                    )
                )

        # Registered Substitutions for this teacher today
        substitutions: List[TeacherClassSlotOut] = []
        sub_assignments = (
            db.query(AlterAssignment)
            .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
            .filter(
                AlterAssignment.substitute_teacher_id == teacher.id,
                LeaveRequest.date == today,
                LeaveRequest.status == LeaveStatus.approved
            )
            .all()
        )
        for sub in sub_assignments:
            leave = sub.leave_request
            # find original timetable slot
            orig_slot = (
                db.query(TimetableSlot)
                .filter(
                    TimetableSlot.teacher_id == leave.teacher_id,
                    TimetableSlot.day_order == leave.day_order,
                    TimetableSlot.period_number == leave.period_number
                )
                .first()
            )
            if orig_slot:
                session = (
                    db.query(AttendanceSession)
                    .filter(
                        AttendanceSession.attendance_date == today,
                        AttendanceSession.class_id == orig_slot.class_id,
                        AttendanceSession.period_number == orig_slot.period_number
                    )
                    .first()
                )
                _, _, p_time = PERIOD_SCHEDULE.get(orig_slot.period_number, (None, None, f"Period {orig_slot.period_number}"))
                substitutions.append(
                    TeacherClassSlotOut(
                        timetable_slot_id=orig_slot.id,
                        period_number=orig_slot.period_number,
                        period_time=p_time,
                        class_id=orig_slot.class_id,
                        class_name=orig_slot.class_.name if orig_slot.class_ else "",
                        section=orig_slot.class_.section if orig_slot.class_ else "",
                        subject_id=orig_slot.subject_id,
                        subject_name=orig_slot.subject.name if orig_slot.subject else "",
                        room_number=orig_slot.room.room_number if orig_slot.room else None,
                        is_substitution=True,
                        scheduled_teacher_name=leave.teacher.name if leave.teacher else "Colleague",
                        substitution_id=sub.id,
                        session_id=session.id if session else None,
                        session_status=session.status if session else None
                    )
                )

        # Active classes across institution for Emergency Attendance picker
        classes = db.query(Class).order_by(Class.name, Class.section).all()
        all_classes = [
            {"id": c.id, "name": c.name, "section": c.section, "department_code": c.department.code if c.department else ""}
            for c in classes
        ]

        return TeacherTodayAttendanceOut(
            date=today,
            day_order=day_order,
            is_blocked_date=is_blocked,
            block_reason=block_reason,
            current_period=current_period,
            scheduled_classes=scheduled_slots,
            substitutions=substitutions,
            all_active_classes=all_classes
        )

    @staticmethod
    def create_or_get_session(
        db: Session,
        current_user: User,
        data: CreateAttendanceSessionRequest
    ) -> AttendanceSessionOut:
        att_date = data.attendance_date or date.today()
        class_id = data.class_id
        period_number = data.period_number
        subject_id = data.subject_id
        timetable_slot_id = data.timetable_slot_id
        substitution_id = data.substitution_id
        
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == att_date).first()
        day_order = cal_day.day_order if cal_day else None
        
        if timetable_slot_id and not period_number:
            slot = db.query(TimetableSlot).filter(TimetableSlot.id == timetable_slot_id).first()
            if slot:
                period_number = slot.period_number
                if not subject_id:
                    subject_id = slot.subject_id
                if not class_id:
                    class_id = slot.class_id

        if not class_id:
            raise HTTPException(status_code=400, detail="class_id is required")
        if not period_number:
            period_number = 1

        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class {class_id} not found")

        existing = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.attendance_date == att_date,
                AttendanceSession.class_id == class_id,
                AttendanceSession.period_number == period_number
            )
            .first()
        )
        if existing:
            return StudentAttendanceService.get_session_details(db, existing.id)

        start_time, end_time = StudentAttendanceService.get_scheduled_times(att_date, period_number)
        
        att_type = data.attendance_type or AttendanceType.normal
        scheduled_teacher_id = current_user.id
        if substitution_id:
            sub = db.query(AlterAssignment).filter(AlterAssignment.id == substitution_id).first()
            if sub and sub.leave_request:
                scheduled_teacher_id = sub.leave_request.teacher_id
                att_type = AttendanceType.registered_substitution

        session = AttendanceSession(
            attendance_date=att_date,
            calendar_day_id=cal_day.id if cal_day else None,
            timetable_slot_id=timetable_slot_id,
            class_id=class_id,
            subject_id=subject_id,
            day_order=day_order,
            scheduled_teacher_id=scheduled_teacher_id,
            actual_teacher_id=current_user.id,
            substitution_id=substitution_id,
            attendance_type=att_type,
            status=SessionStatus.open,
            scheduled_start_time=start_time,
            scheduled_end_time=end_time,
            submitted_by_id=current_user.id
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return StudentAttendanceService.get_session_details(db, session.id)

    @staticmethod
    def submit_attendance_by_session_id(
        db: Session,
        session_id: int,
        current_user: User,
        data: SubmitAttendanceRequest
    ) -> AttendanceSessionOut:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail=f"Attendance session {session_id} not found")
        
        if not data.class_id:
            data.class_id = session.class_id
        if not data.period_number:
            data.period_number = session.period_number
        if not data.attendance_date:
            data.attendance_date = session.attendance_date
        if not data.timetable_slot_id:
            data.timetable_slot_id = session.timetable_slot_id
        if not data.substitution_id:
            data.substitution_id = session.substitution_id

        return StudentAttendanceService.submit_attendance(
            db=db,
            current_user=current_user,
            data=data,
            is_emergency=(session.attendance_type == AttendanceType.emergency),
            subject_id=session.subject_id
        )

    @staticmethod
    def submit_attendance(
        db: Session,
        current_user: User,
        data: SubmitAttendanceRequest,
        is_emergency: bool = False,
        subject_id: Optional[int] = None,
        notes: Optional[str] = None
    ) -> AttendanceSessionOut:
        # 1. Idempotency Check
        if data.idempotency_key:
            existing = db.query(AttendanceSession).filter(AttendanceSession.idempotency_key == data.idempotency_key).first()
            if existing:
                logger.info("Idempotent hit for key %s, returning session %d", data.idempotency_key, existing.id)
                return StudentAttendanceService.get_session_details(db, existing.id)

        att_date = data.attendance_date or date.today()

        # If class_id or period_number missing, try timetable_slot_id
        if (not data.class_id or not data.period_number) and data.timetable_slot_id:
            slot = db.query(TimetableSlot).filter(TimetableSlot.id == data.timetable_slot_id).first()
            if slot:
                if not data.class_id:
                    data.class_id = slot.class_id
                if not data.period_number:
                    data.period_number = slot.period_number
                if not subject_id:
                    subject_id = slot.subject_id

        if not data.class_id:
            raise HTTPException(status_code=400, detail="class_id is required")
        if not data.period_number:
            data.period_number = 1

        # 2. Resolve Class and Active Students
        cls = db.query(Class).filter(Class.id == data.class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class ID {data.class_id} does not exist")

        from app.services.effective_membership_service import EffectiveMembershipService
        effective_roster = EffectiveMembershipService.resolve_class_students(db, data.class_id)
        if effective_roster and effective_roster.students:
            student_ids = [s.id for s in effective_roster.students]
            all_students = db.query(Student).filter(Student.id.in_(student_ids), Student.is_active == True).all()
        else:
            all_students = (
                db.query(Student)
                .filter(Student.class_id == data.class_id, Student.is_active == True)
                .all()
            )
        if not all_students:
            raise HTTPException(status_code=400, detail=f"No active students found in {cls.name} {cls.section}")

        students_by_suffix: Dict[str, Student] = {}
        students_by_full_roll: Dict[str, Student] = {}
        students_by_id: Dict[int, Student] = {}
        for s in all_students:
            suffix = s.roll_suffix.lower()
            students_by_suffix[suffix] = s
            students_by_full_roll[s.roll_number.lower()] = s
            students_by_id[s.id] = s

        # 3. Check for existing session for (date, class_id, period_number)
        existing_session = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.attendance_date == att_date,
                AttendanceSession.class_id == data.class_id,
                AttendanceSession.period_number == data.period_number
            )
            .first()
        )

        if existing_session and existing_session.status in {SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked}:
            raise HTTPException(
                status_code=409,
                detail=f"Attendance for {cls.name} {cls.section} (Period {data.period_number}) on {att_date} has already been submitted by {existing_session.actual_teacher.name if existing_session.actual_teacher else 'another teacher'}."
            )

        # 4. Resolve Day Order and Blocked Date
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == att_date).first()
        if cal_day and cal_day.day_type in BLOCKING_DAY_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot submit attendance on a non-working calendar date ({cal_day.day_type.value})."
            )
        day_order = cal_day.day_order if cal_day else None

        # 5. Determine Attendance Type & Scheduled Teacher
        scheduled_teacher_id = None
        attendance_type = AttendanceType.normal
        substitution_id = data.substitution_id

        # Check registered substitution
        if substitution_id:
            sub = db.query(AlterAssignment).filter(AlterAssignment.id == substitution_id).first()
            if sub and sub.substitute_teacher_id == current_user.id:
                attendance_type = AttendanceType.registered_substitution
                scheduled_teacher_id = sub.leave_request.teacher_id
        elif is_emergency:
            attendance_type = AttendanceType.emergency
            # Find if there was a scheduled teacher for this slot
            if day_order:
                slot = (
                    db.query(TimetableSlot)
                    .filter(
                        TimetableSlot.class_id == data.class_id,
                        TimetableSlot.day_order == day_order,
                        TimetableSlot.period_number == data.period_number
                    )
                    .first()
                )
                if slot:
                    scheduled_teacher_id = slot.teacher_id
                    if not subject_id:
                        subject_id = slot.subject_id
        else:
            # Normal attendance: verify teacher has scheduled slot
            if day_order:
                slot = (
                    db.query(TimetableSlot)
                    .filter(
                        TimetableSlot.teacher_id == current_user.id,
                        TimetableSlot.class_id == data.class_id,
                        TimetableSlot.day_order == day_order,
                        TimetableSlot.period_number == data.period_number
                    )
                    .first()
                )
                if slot:
                    scheduled_teacher_id = current_user.id
                    if not subject_id:
                        subject_id = slot.subject_id

        # 6. Validate Roll Suffixes
        normalized_absent_suffixes = StudentAttendanceService.normalize_roll_suffixes(data.absent_roll_suffixes)
        absent_student_ids = set()
        for suffix in normalized_absent_suffixes:
            s_match = students_by_suffix.get(suffix.lower()) or students_by_full_roll.get(suffix.lower())
            if not s_match:
                raise HTTPException(
                    status_code=400,
                    detail=f"Roll number or suffix '{suffix}' does not match any active student in {cls.name} {cls.section}."
                )
            absent_student_ids.add(s_match.id)

        # Handle specific exceptions (late, on_duty, leave, medical)
        student_exceptions: Dict[int, StudentAttendanceStatus] = {}
        if data.exceptions:
            for exc in data.exceptions:
                tokens = StudentAttendanceService.normalize_roll_suffixes([exc.roll_suffix])
                for token in tokens:
                    s_match = students_by_suffix.get(token.lower()) or students_by_full_roll.get(token.lower())
                    if not s_match:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Exception roll suffix '{token}' does not match any active student in {cls.name} {cls.section}."
                        )
                    student_exceptions[s_match.id] = exc.status

        if getattr(data, 'student_exceptions', None):
            for se in data.student_exceptions:
                s_id = se.get('student_id') if isinstance(se, dict) else getattr(se, 'student_id', None)
                st_val = se.get('status') if isinstance(se, dict) else getattr(se, 'status', None)
                if s_id and s_id in students_by_id and st_val:
                    try:
                        student_exceptions[s_id] = StudentAttendanceStatus(st_val.lower())
                    except ValueError:
                        pass

        # 7. Evaluate 15-Minute Submission Timing Rule
        start_time, end_time = StudentAttendanceService.get_scheduled_times(att_date, data.period_number)
        now_utc = datetime.now(timezone.utc)
        sub_time = data.client_timestamp if data.client_timestamp else now_utc
        if sub_time.tzinfo is None:
            sub_time = sub_time.replace(tzinfo=timezone.utc)

        window_mins = StudentAttendanceService.get_submission_window_minutes(db)
        submission_cutoff = start_time + timedelta(minutes=window_mins)
        if submission_cutoff.tzinfo is None:
            submission_cutoff = submission_cutoff.replace(tzinfo=timezone.utc)

        if sub_time > submission_cutoff:
            session_status = SessionStatus.submitted_late
        else:
            session_status = SessionStatus.submitted

        correction_hours = StudentAttendanceService.get_correction_window_hours(db)
        correction_deadline = now_utc + timedelta(hours=correction_hours)

        # 8. Create or Update AttendanceSession
        session = existing_session if existing_session else AttendanceSession(
            attendance_date=att_date,
            class_id=data.class_id,
            period_number=data.period_number
        )

        session.calendar_day_id = cal_day.id if cal_day else None
        session.timetable_slot_id = data.timetable_slot_id
        session.subject_id = subject_id
        session.day_order = day_order
        session.scheduled_teacher_id = scheduled_teacher_id
        session.actual_teacher_id = current_user.id
        session.substitution_id = substitution_id
        session.attendance_type = attendance_type
        session.status = session_status
        session.scheduled_start_time = start_time
        session.scheduled_end_time = end_time
        session.submitted_at = now_utc
        session.submitted_by_id = current_user.id
        session.correction_deadline = correction_deadline
        session.idempotency_key = data.idempotency_key
        session.notes = notes

        if not existing_session:
            db.add(session)
        db.flush()

        # 9. Create StudentAttendance Records (Default: PRESENT, unless in absent_suffixes or exceptions)
        db.query(StudentAttendance).filter(StudentAttendance.attendance_session_id == session.id).delete()

        for s in all_students:
            if s.id in absent_student_ids:
                st = StudentAttendanceStatus.absent
            elif s.id in student_exceptions:
                st = student_exceptions[s.id]
            else:
                st = StudentAttendanceStatus.present

            mark = StudentAttendance(
                attendance_session_id=session.id,
                student_id=s.id,
                status=st,
                marked_at=now_utc
            )
            db.add(mark)

        db.commit()
        db.refresh(session)

        # Trigger academic intelligence evaluation asynchronously
        try:
            from app.services.academic_intelligence_service import AcademicIntelligenceService
            AcademicIntelligenceService.evaluate_session_async(session.id)
        except Exception:
            pass

        return StudentAttendanceService.get_session_details(db, session.id)

    @staticmethod
    def emergency_attendance(
        db: Session,
        current_user: User,
        data: EmergencyAttendanceRequest
    ) -> AttendanceSessionOut:
        submit_req = SubmitAttendanceRequest(
            class_id=data.class_id,
            period_number=data.period_number,
            attendance_date=data.attendance_date or date.today(),
            absent_roll_suffixes=data.absent_roll_suffixes,
            exceptions=data.exceptions,
            student_exceptions=data.student_exceptions,
            idempotency_key=data.idempotency_key,
            device_id=data.device_id
        )
        return StudentAttendanceService.submit_attendance(
            db=db,
            current_user=current_user,
            data=submit_req,
            is_emergency=True,
            subject_id=data.subject_id,
            notes=data.notes
        )

    @staticmethod
    def get_session_details(db: Session, session_id: int) -> AttendanceSessionOut:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail=f"Attendance Session {session_id} not found")

        records = (
            db.query(StudentAttendance)
            .join(Student, StudentAttendance.student_id == Student.id)
            .filter(StudentAttendance.attendance_session_id == session.id)
            .order_by(Student.roll_number)
            .all()
        )

        counts = {
            StudentAttendanceStatus.present: 0,
            StudentAttendanceStatus.absent: 0,
            StudentAttendanceStatus.late: 0,
            StudentAttendanceStatus.on_duty: 0,
            StudentAttendanceStatus.leave: 0,
            StudentAttendanceStatus.medical: 0,
        }
        record_outs = []
        for r in records:
            counts[r.status] = counts.get(r.status, 0) + 1
            record_outs.append(
                StudentAttendanceRecordOut(
                    id=r.id,
                    student_id=r.student_id,
                    student_roll=r.student.roll_number,
                    student_suffix=r.student.roll_suffix,
                    student_name=r.student.name,
                    status=r.status,
                    marked_at=r.marked_at
                )
            )

        return AttendanceSessionOut(
            id=session.id,
            attendance_date=session.attendance_date,
            period_number=session.period_number,
            day_order=session.day_order,
            class_id=session.class_id,
            class_name=session.class_.name if session.class_ else "",
            section=session.class_.section if session.class_ else "",
            subject_id=session.subject_id,
            subject_name=session.subject.name if session.subject else None,
            scheduled_teacher_id=session.scheduled_teacher_id,
            scheduled_teacher_name=session.scheduled_teacher.name if session.scheduled_teacher else None,
            actual_teacher_id=session.actual_teacher_id,
            actual_teacher_name=session.actual_teacher.name if session.actual_teacher else "",
            attendance_type=session.attendance_type,
            status=session.status,
            scheduled_start_time=session.scheduled_start_time,
            scheduled_end_time=session.scheduled_end_time,
            submitted_at=session.submitted_at,
            correction_deadline=session.correction_deadline,
            total_students=len(records),
            present_count=counts[StudentAttendanceStatus.present],
            absent_count=counts[StudentAttendanceStatus.absent],
            late_count=counts[StudentAttendanceStatus.late],
            on_duty_count=counts[StudentAttendanceStatus.on_duty],
            leave_count=counts[StudentAttendanceStatus.leave],
            medical_count=counts[StudentAttendanceStatus.medical],
            records=record_outs
        )

    @staticmethod
    def correct_student_attendance(
        db: Session,
        session_id: int,
        student_id: int,
        current_user: User,
        data: AttendanceCorrectionRequest
    ) -> AttendanceSessionOut:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found")

        # Check authorization: user must be actual teacher or HOD/admin
        is_admin = current_user.role in {Role.system_admin, Role.admin, Role.governance, Role.principal}
        if session.actual_teacher_id != current_user.id and not is_admin:
            raise HTTPException(status_code=403, detail="You are not authorized to correct this attendance session.")

        # Check correction window (unless admin)
        now_utc = datetime.now(timezone.utc)
        if not is_admin:
            if session.status == SessionStatus.locked:
                raise HTTPException(status_code=400, detail="This session is locked and cannot be edited.")
            if session.correction_deadline:
                deadline = session.correction_deadline
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                if now_utc > deadline:
                    raise HTTPException(status_code=400, detail="The correction window for this session has expired.")

        record = (
            db.query(StudentAttendance)
            .filter(
                StudentAttendance.attendance_session_id == session.id,
                StudentAttendance.student_id == student_id
            )
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="Student attendance record not found in this session")

        old_status = record.status.value
        record.status = data.new_status
        record.updated_at = now_utc

        # Write immutable audit trail
        audit = AttendanceCorrectionAudit(
            attendance_session_id=session.id,
            student_id=student_id,
            old_status=old_status,
            new_status=data.new_status.value,
            changed_by_id=current_user.id,
            reason=data.reason,
            device_id=data.device_id,
            changed_at=now_utc
        )
        db.add(audit)
        db.commit()

        # Trigger academic intelligence evaluation asynchronously (updates / resolves alerts)
        try:
            from app.services.academic_intelligence_service import AcademicIntelligenceService
            AcademicIntelligenceService.evaluate_session_async(session.id)
        except Exception:
            pass

        return StudentAttendanceService.get_session_details(db, session.id)

    @staticmethod
    def process_sync_batch(
        db: Session,
        current_user: User,
        batch: OfflineSyncBatchRequest
    ) -> OfflineSyncBatchResponse:
        results: List[SyncOperationResult] = []
        synced = 0
        failed = 0

        for op in batch.operations:
            try:
                op_type = op.operation_type.upper() if op.operation_type else ""
                if op_type in ("SUBMIT_ATTENDANCE", "SUBMIT"):
                    raw_sess_id = op.payload.get("session_id")
                    session_id = None
                    if raw_sess_id is not None:
                        try:
                            s_int = int(raw_sess_id)
                            if s_int > 0:
                                session_id = s_int
                        except (ValueError, TypeError):
                            session_id = None

                    payload_clean = {k: v for k, v in op.payload.items() if k != "session_id"}
                    req = SubmitAttendanceRequest(**payload_clean)
                    req.idempotency_key = op.idempotency_key
                    req.device_id = op.device_id
                    if op.client_timestamp:
                        req.client_timestamp = op.client_timestamp

                    # If session_id was negative (e.g. -406), it was synthesized offline from -slotId or -classId
                    if not req.timetable_slot_id and raw_sess_id is not None:
                        try:
                            neg_val = int(raw_sess_id)
                            if neg_val < 0:
                                cand_slot_id = abs(neg_val)
                                slot_check = db.query(TimetableSlot).filter(TimetableSlot.id == cand_slot_id).first()
                                if slot_check:
                                    req.timetable_slot_id = slot_check.id
                                    if not req.class_id:
                                        req.class_id = slot_check.class_id
                                    if not req.period_number:
                                        req.period_number = slot_check.period_number
                        except Exception:
                            pass

                    session_out = None
                    if session_id:
                        try:
                            session_out = StudentAttendanceService.submit_attendance_by_session_id(
                                db=db,
                                session_id=session_id,
                                current_user=current_user,
                                data=req
                            )
                        except HTTPException as he:
                            if he.status_code == 404:
                                session_out = StudentAttendanceService.submit_attendance(
                                    db=db,
                                    current_user=current_user,
                                    data=req
                                )
                            elif he.status_code == 409:
                                existing_sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
                                if existing_sess:
                                    session_out = StudentAttendanceService.get_session_details(db, existing_sess.id)
                                else:
                                    raise he
                            else:
                                raise he
                    else:
                        try:
                            session_out = StudentAttendanceService.submit_attendance(
                                db=db,
                                current_user=current_user,
                                data=req
                            )
                        except HTTPException as he:
                            if he.status_code == 409:
                                att_d = req.attendance_date or date.today()
                                p_num = req.period_number or 1
                                existing_sess = (
                                    db.query(AttendanceSession)
                                    .filter(
                                        AttendanceSession.attendance_date == att_d,
                                        AttendanceSession.class_id == req.class_id,
                                        AttendanceSession.period_number == p_num
                                    )
                                    .first()
                                )
                                if existing_sess:
                                    session_out = StudentAttendanceService.get_session_details(db, existing_sess.id)
                                else:
                                    raise he
                            else:
                                raise he

                    results.append(
                        SyncOperationResult(
                            operation_id=op.operation_id,
                            idempotency_key=op.idempotency_key,
                            success=True,
                            session_id=session_out.id,
                            message="Attendance synced successfully",
                            status=session_out.status.value if hasattr(session_out.status, "value") else str(session_out.status)
                        )
                    )
                    synced += 1

                elif op_type in ("EMERGENCY_ATTENDANCE", "EMERGENCY"):
                    req = EmergencyAttendanceRequest(**op.payload)
                    req.idempotency_key = op.idempotency_key
                    req.device_id = op.device_id
                    session_out = None
                    try:
                        session_out = StudentAttendanceService.emergency_attendance(db, current_user, req)
                    except HTTPException as he:
                        if he.status_code == 409:
                            existing_sess = (
                                db.query(AttendanceSession)
                                .filter(
                                    AttendanceSession.attendance_date == (req.attendance_date or date.today()),
                                    AttendanceSession.class_id == req.class_id,
                                    AttendanceSession.period_number == req.period_number
                                )
                                .first()
                            )
                            if existing_sess:
                                session_out = StudentAttendanceService.get_session_details(db, existing_sess.id)
                            else:
                                raise he
                        else:
                            raise he

                    results.append(
                        SyncOperationResult(
                            operation_id=op.operation_id,
                            idempotency_key=op.idempotency_key,
                            success=True,
                            session_id=session_out.id,
                            message="Emergency attendance synced successfully",
                            status=session_out.status.value if hasattr(session_out.status, "value") else str(session_out.status)
                        )
                    )
                    synced += 1

                elif op_type == "CORRECTION":
                    session_id = op.payload.get("session_id")
                    student_id = op.payload.get("student_id")
                    corr_req = AttendanceCorrectionRequest(
                        new_status=op.payload.get("new_status"),
                        reason=op.payload.get("reason"),
                        device_id=op.device_id
                    )
                    session_out = StudentAttendanceService.correct_student_attendance(
                        db, session_id, student_id, current_user, corr_req
                    )
                    results.append(
                        SyncOperationResult(
                            operation_id=op.operation_id,
                            idempotency_key=op.idempotency_key,
                            success=True,
                            session_id=session_out.id,
                            message="Correction synced successfully",
                            status="corrected"
                        )
                    )
                    synced += 1
                else:
                    results.append(
                        SyncOperationResult(
                            operation_id=op.operation_id,
                            idempotency_key=op.idempotency_key,
                            success=False,
                            message=f"Unknown operation type: {op.operation_type}"
                        )
                    )
                    failed += 1
            except Exception as e:
                db.rollback()
                logger.error("Error processing sync operation %s: %s", op.operation_id, e)
                error_msg = getattr(e, "detail", str(e))
                results.append(
                    SyncOperationResult(
                        operation_id=op.operation_id,
                        idempotency_key=op.idempotency_key,
                        success=False,
                        message=str(error_msg)
                    )
                )
                failed += 1

        return OfflineSyncBatchResponse(
            synced_count=synced,
            failed_count=failed,
            results=results
        )

    @staticmethod
    def get_hod_overview(
        db: Session,
        current_user: User,
        target_date: date,
        department_id: Optional[int] = None
    ) -> HodAttendanceOverviewOut:
        # Department scoping: if department_id passed and caller is privileged, honor it; else use caller's dept_id
        if department_id and current_user.role in {Role.system_admin, Role.governance, Role.principal}:
            dept_id = department_id
        else:
            dept_id = current_user.department_id

        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day else None

        # Classes in this department
        class_query = db.query(Class)
        if dept_id:
            class_query = class_query.filter(Class.department_id == dept_id)
        elif current_user.role not in {Role.system_admin, Role.governance, Role.principal}:
            class_query = class_query.filter(Class.department_id == -1)
        classes = class_query.all()
        class_ids = [c.id for c in classes]

        sessions = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.attendance_date == target_date,
                AttendanceSession.class_id.in_(class_ids)
            )
            .all()
        )
        session_map: Dict[Tuple[int, int], AttendanceSession] = {
            (s.class_id, s.period_number): s for s in sessions
        }

        # Timetable expected slots
        expected_slots = []
        if day_order:
            slot_query = db.query(TimetableSlot).filter(TimetableSlot.day_order == day_order, TimetableSlot.class_id.in_(class_ids))
            expected_slots = slot_query.all()

        total_classes = len(expected_slots)
        submitted_count = sum(1 for s in sessions if s.status in {SessionStatus.submitted, SessionStatus.submitted_late})
        late_count = sum(1 for s in sessions if s.status == SessionStatus.submitted_late)
        emergency_count = sum(1 for s in sessions if s.attendance_type == AttendanceType.emergency)
        pending_count = max(0, total_classes - submitted_count)

        # Build combined pairs of (class_id, period_number)
        combined_pairs: Dict[Tuple[int, int], Dict[str, Any]] = {}
        for slot in expected_slots:
            pair = (slot.class_id, slot.period_number)
            combined_pairs[pair] = {
                "slot": slot,
                "session": session_map.get(pair)
            }

        for sess in sessions:
            pair = (sess.class_id, sess.period_number)
            if pair not in combined_pairs:
                combined_pairs[pair] = {
                    "slot": None,
                    "session": sess
                }

        class_student_counts = {}
        if class_ids:
            class_student_counts = dict(
                db.query(Student.class_id, func.count(Student.id))
                .filter(Student.class_id.in_(class_ids), Student.is_active == True)
                .group_by(Student.class_id)
                .all()
            )

        summaries: List[HodClassAttendanceSummaryOut] = []
        hod_sessions: List[HodSessionItemOut] = []
        total_present = 0
        total_marked = 0

        # Sort pairs by period_number, then class_id
        for (c_id, p_num), info in sorted(combined_pairs.items(), key=lambda item: (item[0][1], item[0][0])):
            slot = info["slot"]
            sess = info["session"]

            cls = (sess.class_ if sess else None) or (slot.class_ if slot else None)
            if not cls:
                continue

            dept_name = cls.department.name if cls.department else ""
            subj = (sess.subject if sess else None) or (slot.subject if slot else None)
            subj_name = subj.name if subj else ("Emergency Session" if (sess and sess.attendance_type == AttendanceType.emergency) else None)
            p_time = PERIOD_SCHEDULE.get(p_num, (time(8, 0), time(9, 0), f"P{p_num}"))[2]

            sched_teacher_name = (
                (sess.scheduled_teacher.name if sess and sess.scheduled_teacher else None) or
                (slot.teacher.name if slot and slot.teacher else None)
            )
            sched_teacher_id = (
                (sess.scheduled_teacher_id if sess else None) or
                (slot.teacher_id if slot else None)
            )
            act_teacher_name = sess.actual_teacher.name if sess and sess.actual_teacher else (
                "Emergency Faculty" if (sess and sess.attendance_type == AttendanceType.emergency) else None
            )
            act_teacher_id = sess.actual_teacher_id if sess else None

            is_emerg = bool(sess and sess.attendance_type == AttendanceType.emergency)
            is_late_sub = bool(sess and sess.status == SessionStatus.submitted_late)

            att_type_str = sess.attendance_type.value.upper() if (sess and sess.attendance_type) else ("EMERGENCY" if is_emerg else "NORMAL")
            status_str = sess.status.value.upper() if (sess and sess.status) else "NOT_OPEN"

            p_count = 0
            a_count = 0
            tot = 0
            pct = 0.0
            absent_rolls: List[str] = []

            if sess:
                recs = sess.records
                tot = len(recs)
                p_count = sum(1 for r in recs if r.status in {StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late})
                a_count = tot - p_count
                pct = round((p_count / tot * 100), 1) if tot > 0 else 0.0
                absent_rolls = [
                    (r.student.roll_number or r.student.roll_suffix or str(r.student_id))
                    for r in recs if r.status == StudentAttendanceStatus.absent and r.student
                ]
                total_present += p_count
                total_marked += tot
            elif cls.id in class_student_counts:
                tot = class_student_counts[cls.id]

            summaries.append(
                HodClassAttendanceSummaryOut(
                    class_id=cls.id,
                    class_name=cls.name or "",
                    section=cls.section or "",
                    department_name=dept_name,
                    period_number=p_num,
                    id=sess.id if sess else None,
                    session_id=sess.id if sess else None,
                    session_status=sess.status if sess else SessionStatus.not_open,
                    status=status_str,
                    attendance_type=sess.attendance_type if sess else None,
                    scheduled_teacher=sched_teacher_name,
                    scheduled_teacher_name=sched_teacher_name,
                    actual_teacher=act_teacher_name,
                    actual_teacher_name=act_teacher_name,
                    subject_name=subj_name,
                    submitted_at=sess.submitted_at if sess else None,
                    present_count=p_count,
                    absent_count=a_count,
                    total_students=tot,
                    percentage=pct,
                    is_late_submission=is_late_sub,
                    is_emergency=is_emerg,
                    absent_rolls=absent_rolls
                )
            )

            hod_sessions.append(
                HodSessionItemOut(
                    id=sess.id if sess else None,
                    session_id=sess.id if sess else None,
                    attendance_date=target_date,
                    period_number=p_num,
                    period_time=p_time,
                    day_order=day_order,
                    class_id=cls.id,
                    class_name=cls.name or "",
                    section=cls.section or "",
                    department_id=cls.department_id,
                    department_name=dept_name,
                    subject_id=subj.id if subj else None,
                    subject_name=subj_name,
                    scheduled_teacher_id=sched_teacher_id,
                    scheduled_teacher_name=sched_teacher_name,
                    actual_teacher_id=act_teacher_id,
                    actual_teacher_name=act_teacher_name,
                    attendance_type=att_type_str,
                    status=status_str,
                    scheduled_start_time=sess.scheduled_start_time if sess else None,
                    scheduled_end_time=sess.scheduled_end_time if sess else None,
                    submitted_at=sess.submitted_at if sess else None,
                    is_late_submission=is_late_sub,
                    is_emergency=is_emerg,
                    total_students=tot,
                    present_count=p_count,
                    absent_count=a_count,
                    late_count=sum(1 for r in sess.records if r.status == StudentAttendanceStatus.late) if sess else 0,
                    on_duty_count=sum(1 for r in sess.records if r.status == StudentAttendanceStatus.on_duty) if sess else 0,
                    leave_count=sum(1 for r in sess.records if r.status == StudentAttendanceStatus.leave) if sess else 0,
                    medical_count=sum(1 for r in sess.records if r.status == StudentAttendanceStatus.medical) if sess else 0,
                    attendance_percentage=pct,
                    absent_rolls=absent_rolls
                )
            )

        # Exceptions: late submissions, missed, and emergencies
        exceptions: List[HodAttendanceExceptionOut] = []
        for s in sessions:
            if s.status == SessionStatus.submitted_late:
                exceptions.append(
                    HodAttendanceExceptionOut(
                        session_id=s.id,
                        attendance_date=s.attendance_date,
                        period_number=s.period_number,
                        class_name=s.class_.name if s.class_ else "",
                        section=s.class_.section if s.class_ else "",
                        scheduled_teacher=s.scheduled_teacher.name if s.scheduled_teacher else None,
                        actual_teacher=s.actual_teacher.name if s.actual_teacher else "Unknown",
                        exception_type="LATE_SUBMISSION",
                        details=f"Submitted late at {s.submitted_at.strftime('%H:%M') if s.submitted_at else 'N/A'}",
                        timestamp=s.submitted_at or s.created_at
                    )
                )
            if s.attendance_type == AttendanceType.emergency:
                exceptions.append(
                    HodAttendanceExceptionOut(
                        session_id=s.id,
                        attendance_date=s.attendance_date,
                        period_number=s.period_number,
                        class_name=s.class_.name if s.class_ else "",
                        section=s.class_.section if s.class_ else "",
                        scheduled_teacher=s.scheduled_teacher.name if s.scheduled_teacher else None,
                        actual_teacher=s.actual_teacher.name if s.actual_teacher else "Unknown",
                        exception_type="EMERGENCY",
                        details=f"Emergency substitution handled by {s.actual_teacher.name if s.actual_teacher else 'faculty'}",
                        timestamp=s.created_at
                    )
                )

        overall_pct = round((total_present / total_marked * 100), 1) if total_marked > 0 else 0.0

        return HodAttendanceOverviewOut(
            date=target_date,
            day_order=day_order,
            total_classes=total_classes,
            total_scheduled_sessions=total_classes,
            submitted_count=submitted_count,
            pending_count=pending_count,
            late_count=late_count,
            late_submission_count=late_count,
            emergency_count=emergency_count,
            student_attendance_percentage=overall_pct,
            overall_attendance_percentage=overall_pct,
            classes=summaries,
            sessions=hod_sessions,
            exceptions=exceptions
        )

    # =========================================================================
    # PRINCIPAL MONITORING & GOVERNANCE METHODS
    # =========================================================================

    @staticmethod
    def get_principal_overview(
        db: Session,
        target_date: date
    ) -> PrincipalAttendanceOverviewOut:
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day else None
        is_blocked = cal_day.day_type in BLOCKING_DAY_TYPES if cal_day else False
        block_reason = cal_day.description if is_blocked else None

        departments = db.query(Department).order_by(Department.name).all()
        classes = db.query(Class).all()
        classes_by_dept: Dict[int, List[Class]] = {}
        for c in classes:
            classes_by_dept.setdefault(c.department_id, []).append(c)

        expected_slots = []
        if day_order:
            expected_slots = db.query(TimetableSlot).filter(TimetableSlot.day_order == day_order).all()
        
        slots_by_dept: Dict[int, List[TimetableSlot]] = {}
        for slot in expected_slots:
            if slot.class_ and slot.class_.department_id:
                slots_by_dept.setdefault(slot.class_.department_id, []).append(slot)

        sessions = (
            db.query(AttendanceSession)
            .filter(AttendanceSession.attendance_date == target_date)
            .all()
        )
        sessions_by_dept: Dict[int, List[AttendanceSession]] = {}
        for sess in sessions:
            if sess.class_ and sess.class_.department_id:
                sessions_by_dept.setdefault(sess.class_.department_id, []).append(sess)

        # HODs by department
        hod_users = db.query(User).filter(User.role == Role.admin, User.department_id != None).all()
        hod_by_dept = {u.department_id: u.name for u in hod_users}

        dept_summaries: List[PrincipalDepartmentSummaryOut] = []
        inst_total_students_enrolled = 0
        inst_present = 0
        inst_absent = 0
        inst_late = 0
        inst_od = 0
        inst_leave = 0
        inst_med = 0

        for dept in departments:
            dept_classes = classes_by_dept.get(dept.id, [])
            dept_slots = slots_by_dept.get(dept.id, [])
            dept_sessions = sessions_by_dept.get(dept.id, [])

            dept_class_ids = [c.id for c in dept_classes]
            dept_student_count = (
                db.query(func.count(Student.id))
                .filter(Student.class_id.in_(dept_class_ids), Student.is_active == True)
                .scalar() or 0
            ) if dept_class_ids else 0
            inst_total_students_enrolled += dept_student_count

            sched_count = len(dept_slots)
            sub_count = sum(1 for s in dept_sessions if s.status in {SessionStatus.submitted, SessionStatus.submitted_late})
            late_count = sum(1 for s in dept_sessions if s.status == SessionStatus.submitted_late)
            emerg_count = sum(1 for s in dept_sessions if s.attendance_type == AttendanceType.emergency)
            pending_count = max(0, sched_count - sub_count)

            p_cnt = 0
            tot_marks = 0
            for s in dept_sessions:
                if s.status in {SessionStatus.submitted, SessionStatus.submitted_late}:
                    for r in s.records:
                        tot_marks += 1
                        if r.status in {StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late}:
                            p_cnt += 1
                        if r.status == StudentAttendanceStatus.present:
                            inst_present += 1
                        elif r.status == StudentAttendanceStatus.absent:
                            inst_absent += 1
                        elif r.status == StudentAttendanceStatus.late:
                            inst_late += 1
                        elif r.status == StudentAttendanceStatus.on_duty:
                            inst_od += 1
                        elif r.status == StudentAttendanceStatus.leave:
                            inst_leave += 1
                        elif r.status == StudentAttendanceStatus.medical:
                            inst_med += 1

            dept_pct = round((p_cnt / tot_marks * 100), 1) if tot_marks > 0 else 0.0

            dept_summaries.append(
                PrincipalDepartmentSummaryOut(
                    department_id=dept.id,
                    department_name=dept.name,
                    department_code=dept.code or "",
                    classes_count=len(dept_classes),
                    total_scheduled_sessions=sched_count,
                    submitted_sessions=sub_count,
                    pending_sessions=pending_count,
                    late_sessions=late_count,
                    emergency_sessions=emerg_count,
                    student_attendance_percentage=dept_pct,
                    total_students=dept_student_count,
                    hod_name=hod_by_dept.get(dept.id, "Not Assigned")
                )
            )

        inst_sched = len(expected_slots)
        inst_submitted = sum(1 for s in sessions if s.status in {SessionStatus.submitted, SessionStatus.submitted_late})
        inst_pending = max(0, inst_sched - inst_submitted)
        inst_late_sub = sum(1 for s in sessions if s.status == SessionStatus.submitted_late)
        inst_emergency = sum(1 for s in sessions if s.attendance_type == AttendanceType.emergency)
        inst_missed = sum(1 for s in sessions if s.status == SessionStatus.missed)
        inst_cancelled = sum(1 for s in sessions if s.status in {SessionStatus.cancelled, SessionStatus.not_conducted})

        total_inst_marks = inst_present + inst_absent + inst_late + inst_od + inst_leave + inst_med
        inst_overall_pct = (
            round(((inst_present + inst_od + inst_late) / total_inst_marks * 100), 1)
            if total_inst_marks > 0 else 0.0
        )

        return PrincipalAttendanceOverviewOut(
            date=target_date,
            day_order=day_order,
            is_blocked_date=is_blocked,
            block_reason=block_reason,
            total_scheduled_sessions=inst_sched,
            submitted_sessions=inst_submitted,
            pending_sessions=inst_pending,
            late_sessions=inst_late_sub,
            emergency_sessions=inst_emergency,
            missed_sessions=inst_missed,
            cancelled_sessions=inst_cancelled,
            overall_attendance_percentage=inst_overall_pct,
            total_students_enrolled=inst_total_students_enrolled,
            present_students_count=inst_present,
            absent_students_count=inst_absent,
            on_duty_students_count=inst_od,
            leave_students_count=inst_leave,
            medical_students_count=inst_med,
            late_students_count=inst_late,
            departments=dept_summaries
        )

    @staticmethod
    def get_principal_sessions(
        db: Session,
        target_date: date,
        department_id: Optional[int] = None,
        class_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        is_late: Optional[bool] = None,
        is_emergency: Optional[bool] = None
    ) -> List[PrincipalSessionItemOut]:
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day else None

        sess_query = db.query(AttendanceSession).filter(AttendanceSession.attendance_date == target_date)
        if class_id:
            sess_query = sess_query.filter(AttendanceSession.class_id == class_id)
        elif department_id:
            sess_query = sess_query.join(Class, AttendanceSession.class_id == Class.id).filter(Class.department_id == department_id)

        all_sessions = sess_query.all()
        session_by_class_period: Dict[Tuple[int, int], AttendanceSession] = {
            (s.class_id, s.period_number): s for s in all_sessions
        }

        expected_slots: List[TimetableSlot] = []
        if day_order:
            slot_query = db.query(TimetableSlot).filter(TimetableSlot.day_order == day_order)
            if class_id:
                slot_query = slot_query.filter(TimetableSlot.class_id == class_id)
            elif department_id:
                slot_query = slot_query.join(Class, TimetableSlot.class_id == Class.id).filter(Class.department_id == department_id)
            expected_slots = slot_query.all()

        combined_pairs: Dict[Tuple[int, int], Dict[str, Any]] = {}
        for slot in expected_slots:
            pair = (slot.class_id, slot.period_number)
            combined_pairs[pair] = {
                "slot": slot,
                "session": session_by_class_period.get(pair)
            }

        for sess in all_sessions:
            pair = (sess.class_id, sess.period_number)
            if pair not in combined_pairs:
                combined_pairs[pair] = {
                    "slot": None,
                    "session": sess
                }

        results: List[PrincipalSessionItemOut] = []
        for (c_id, p_num), info in combined_pairs.items():
            slot = info["slot"]
            sess = info["session"]

            cls = (sess.class_ if sess else None) or (slot.class_ if slot else None)
            if not cls:
                continue

            dept = cls.department
            subj = (sess.subject if sess else None) or (slot.subject if slot else None)
            p_time = PERIOD_SCHEDULE.get(p_num, (time(8, 0), time(9, 0), f"P{p_num}"))[2]

            session_id = sess.id if sess else None
            sess_status = sess.status if sess else SessionStatus.not_open
            att_type = sess.attendance_type if sess else None

            sched_teacher_name = (
                (sess.scheduled_teacher.name if sess and sess.scheduled_teacher else None) or
                (slot.teacher.name if slot and slot.teacher else None)
            )
            sched_teacher_id = (
                (sess.scheduled_teacher_id if sess else None) or
                (slot.teacher_id if slot else None)
            )
            act_teacher_name = sess.actual_teacher.name if sess and sess.actual_teacher else None
            act_teacher_id = sess.actual_teacher_id if sess else None
            is_sub = bool((att_type == AttendanceType.registered_substitution) or (bool(slot) and bool(sess) and sess.substitution_id is not None))
            is_emerg = (att_type == AttendanceType.emergency)
            is_late_sub = (sess_status == SessionStatus.submitted_late)

            # Filtering
            if status_filter and sess_status.value != status_filter.lower():
                continue
            if type_filter and (not att_type or att_type.value != type_filter.lower()):
                continue
            if is_late is not None and is_late_sub != is_late:
                continue
            if is_emergency is not None and is_emerg != is_emergency:
                continue

            p_cnt = 0
            a_cnt = 0
            l_cnt = 0
            od_cnt = 0
            lv_cnt = 0
            med_cnt = 0
            tot_students = 0
            pct = 0.0

            if sess and sess.records:
                recs = sess.records
                tot_students = len(recs)
                for r in recs:
                    if r.status == StudentAttendanceStatus.present:
                        p_cnt += 1
                    elif r.status == StudentAttendanceStatus.absent:
                        a_cnt += 1
                    elif r.status == StudentAttendanceStatus.late:
                        l_cnt += 1
                    elif r.status == StudentAttendanceStatus.on_duty:
                        od_cnt += 1
                    elif r.status == StudentAttendanceStatus.leave:
                        lv_cnt += 1
                    elif r.status == StudentAttendanceStatus.medical:
                        med_cnt += 1
                effective_present = p_cnt + od_cnt + l_cnt
                pct = round((effective_present / tot_students * 100), 1) if tot_students > 0 else 0.0
            else:
                tot_students = db.query(func.count(Student.id)).filter(Student.class_id == cls.id, Student.is_active == True).scalar() or 0

            results.append(
                PrincipalSessionItemOut(
                    session_id=session_id,
                    attendance_date=target_date,
                    period_number=p_num,
                    period_time=p_time,
                    day_order=day_order,
                    class_id=cls.id,
                    class_name=cls.name,
                    section=cls.section,
                    department_id=dept.id if dept else 0,
                    department_name=dept.name if dept else "",
                    department_code=dept.code if dept and dept.code else "",
                    subject_id=subj.id if subj else None,
                    subject_name=subj.name if subj else "Class Subject",
                    subject_code=subj.code if subj else None,
                    scheduled_teacher_id=sched_teacher_id,
                    scheduled_teacher_name=sched_teacher_name,
                    actual_teacher_id=act_teacher_id,
                    actual_teacher_name=act_teacher_name,
                    is_substitution=is_sub,
                    substitution_id=sess.substitution_id if sess else None,
                    attendance_type=att_type,
                    status=sess_status,
                    scheduled_start_time=sess.scheduled_start_time if sess else None,
                    scheduled_end_time=sess.scheduled_end_time if sess else None,
                    submitted_at=sess.submitted_at if sess else None,
                    is_late_submission=is_late_sub,
                    is_emergency=is_emerg,
                    total_students=tot_students,
                    present_count=p_cnt,
                    absent_count=a_cnt,
                    late_count=l_cnt,
                    on_duty_count=od_cnt,
                    leave_count=lv_cnt,
                    medical_count=med_cnt,
                    attendance_percentage=pct
                )
            )

        results.sort(key=lambda x: (x.department_name, x.class_name, x.section, x.period_number))
        return results

    @staticmethod
    def get_class_period_matrix(
        db: Session,
        class_id: int,
        target_date: date
    ) -> ClassPeriodMatrixOut:
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class {class_id} not found")

        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day else None

        from app.services.effective_membership_service import EffectiveMembershipService
        effective_roster = EffectiveMembershipService.resolve_class_students(db, class_id)
        if effective_roster and effective_roster.students:
            student_ids = [s.id for s in effective_roster.students]
            students = (
                db.query(Student)
                .filter(Student.id.in_(student_ids), Student.is_active == True)
                .order_by(Student.roll_number)
                .all()
            )
        else:
            students = (
                db.query(Student)
                .filter(Student.class_id == class_id, Student.is_active == True)
                .order_by(Student.roll_number)
                .all()
            )

        slots = []
        if day_order:
            slots = (
                db.query(TimetableSlot)
                .filter(TimetableSlot.class_id == class_id, TimetableSlot.day_order == day_order)
                .order_by(TimetableSlot.period_number)
                .all()
            )

        sessions = (
            db.query(AttendanceSession)
            .filter(AttendanceSession.class_id == class_id, AttendanceSession.attendance_date == target_date)
            .all()
        )
        session_by_period = {s.period_number: s for s in sessions}

        period_numbers = sorted(list(set([slot.period_number for slot in slots] + [s.period_number for s in sessions])))
        if not period_numbers:
            period_numbers = [1, 2, 3, 4, 5]

        period_slot_infos: List[ClassPeriodSlotInfo] = []
        slot_map = {s.period_number: s for s in slots}
        for p in period_numbers:
            sl = slot_map.get(p)
            sess = session_by_period.get(p)
            p_time = PERIOD_SCHEDULE.get(p, (time(8, 0), time(9, 0), f"P{p}"))[2]
            subj_name = (sess.subject.name if sess and sess.subject else None) or (sl.subject.name if sl and sl.subject else None)
            sched_t = (sess.scheduled_teacher.name if sess and sess.scheduled_teacher else None) or (sl.teacher.name if sl and sl.teacher else None)
            act_t = sess.actual_teacher.name if sess and sess.actual_teacher else None
            st = sess.status if sess else SessionStatus.not_open
            period_slot_infos.append(
                ClassPeriodSlotInfo(
                    period_number=p,
                    period_time=p_time,
                    subject_name=subj_name,
                    scheduled_teacher=sched_t,
                    actual_teacher=act_t,
                    status=st,
                    attendance_type=sess.attendance_type if sess else None
                )
            )

        all_class_sessions = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.class_id == class_id,
                AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked])
            )
            .all()
        )
        conducted_session_ids = [s.id for s in all_class_sessions]
        total_conducted = len(conducted_session_ids)

        cum_attended_by_student: Dict[int, int] = {}
        if conducted_session_ids:
            marks = (
                db.query(StudentAttendance.student_id, func.count(StudentAttendance.id))
                .filter(
                    StudentAttendance.attendance_session_id.in_(conducted_session_ids),
                    StudentAttendance.status.in_([StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late])
                )
                .group_by(StudentAttendance.student_id)
                .all()
            )
            cum_attended_by_student = {s_id: cnt for s_id, cnt in marks}

        today_marks_by_student_period: Dict[Tuple[int, int], str] = {}
        for sess in sessions:
            for rec in sess.records:
                today_marks_by_student_period[(rec.student_id, sess.period_number)] = rec.status.value.upper()

        student_rows: List[ClassStudentMatrixRowOut] = []
        for s in students:
            p_marks: Dict[str, str] = {}
            day_att = 0
            day_elig = 0
            for p in period_numbers:
                sess = session_by_period.get(p)
                if sess and sess.status in {SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked}:
                    day_elig += 1
                    val = today_marks_by_student_period.get((s.id, p), "PRESENT")
                    p_marks[str(p)] = val
                    if val in {"PRESENT", "ON_DUTY", "LATE"}:
                        day_att += 1
                elif sess and sess.status in {SessionStatus.cancelled, SessionStatus.not_conducted}:
                    p_marks[str(p)] = sess.status.value.upper()
                else:
                    p_marks[str(p)] = "NOT_CONDUCTED" if (sess and sess.status == SessionStatus.not_conducted) else "—"

            day_pct = round((day_att / day_elig * 100), 1) if day_elig > 0 else 0.0
            cum_att = cum_attended_by_student.get(s.id, 0)
            cum_pct = round((cum_att / total_conducted * 100), 1) if total_conducted > 0 else 0.0
            is_short = (cum_pct < 75.0) if total_conducted >= 1 else False

            student_rows.append(
                ClassStudentMatrixRowOut(
                    student_id=s.id,
                    roll_number=s.roll_number,
                    roll_suffix=s.roll_suffix,
                    name=s.name,
                    period_marks=p_marks,
                    day_attended=day_att,
                    day_eligible=day_elig,
                    day_percentage=day_pct,
                    cumulative_attended=cum_att,
                    cumulative_eligible=total_conducted,
                    cumulative_percentage=cum_pct,
                    is_shortage=is_short
                )
            )

        return ClassPeriodMatrixOut(
            class_id=cls.id,
            class_name=cls.name,
            section=cls.section,
            department_id=cls.department_id,
            department_name=cls.department.name if cls.department else "",
            date=target_date,
            day_order=day_order,
            total_students=len(students),
            scheduled_periods=period_slot_infos,
            students=student_rows
        )

    @staticmethod
    def get_student_attendance_profile(
        db: Session,
        student_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> StudentProfileAttendanceOut:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail=f"Student {student_id} not found")

        q = (
            db.query(StudentAttendance)
            .join(AttendanceSession, StudentAttendance.attendance_session_id == AttendanceSession.id)
            .filter(StudentAttendance.student_id == student_id)
            .filter(AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked]))
        )
        if start_date:
            q = q.filter(AttendanceSession.attendance_date >= start_date)
        if end_date:
            q = q.filter(AttendanceSession.attendance_date <= end_date)

        records = q.order_by(AttendanceSession.attendance_date.desc(), AttendanceSession.period_number.desc()).all()

        total_eligible = len(records)
        attended_cnt = 0
        absent_cnt = 0
        late_cnt = 0
        od_cnt = 0
        leave_cnt = 0
        med_cnt = 0

        subj_stats: Dict[int, Dict[str, Any]] = {}
        history_items: List[StudentSessionHistoryItemOut] = []

        for r in records:
            sess = r.session
            st = r.status
            if st in {StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late}:
                attended_cnt += 1
            if st == StudentAttendanceStatus.absent:
                absent_cnt += 1
            elif st == StudentAttendanceStatus.late:
                late_cnt += 1
            elif st == StudentAttendanceStatus.on_duty:
                od_cnt += 1
            elif st == StudentAttendanceStatus.leave:
                leave_cnt += 1
            elif st == StudentAttendanceStatus.medical:
                med_cnt += 1

            s_id = sess.subject_id or 0
            if s_id not in subj_stats:
                subj_stats[s_id] = {
                    "id": s_id,
                    "name": sess.subject.name if sess.subject else "General Academic",
                    "code": sess.subject.code if sess.subject else "",
                    "eligible": 0,
                    "attended": 0,
                    "absent": 0,
                    "late": 0,
                    "od": 0
                }
            subj_stats[s_id]["eligible"] += 1
            if st in {StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late}:
                subj_stats[s_id]["attended"] += 1
            if st == StudentAttendanceStatus.absent:
                subj_stats[s_id]["absent"] += 1
            elif st == StudentAttendanceStatus.late:
                subj_stats[s_id]["late"] += 1
            elif st == StudentAttendanceStatus.on_duty:
                subj_stats[s_id]["od"] += 1

            history_items.append(
                StudentSessionHistoryItemOut(
                    session_id=sess.id,
                    date=sess.attendance_date,
                    period_number=sess.period_number,
                    subject_name=sess.subject.name if sess.subject else "Class Subject",
                    teacher_name=sess.actual_teacher.name if sess.actual_teacher else "Faculty",
                    status=st,
                    marked_at=r.marked_at
                )
            )

        overall_pct = round((attended_cnt / total_eligible * 100), 1) if total_eligible > 0 else 0.0
        is_short = (overall_pct < 75.0) if total_eligible >= 1 else False

        subject_list: List[StudentSubjectAttendanceOut] = []
        for s_id, d in subj_stats.items():
            pct = round((d["attended"] / d["eligible"] * 100), 1) if d["eligible"] > 0 else 0.0
            subject_list.append(
                StudentSubjectAttendanceOut(
                    subject_id=s_id if s_id != 0 else None,
                    subject_name=d["name"],
                    subject_code=d["code"],
                    eligible_sessions=d["eligible"],
                    attended_sessions=d["attended"],
                    absent_sessions=d["absent"],
                    late_sessions=d["late"],
                    od_sessions=d["od"],
                    percentage=pct,
                    is_shortage=(pct < 75.0)
                )
            )

        return StudentProfileAttendanceOut(
            student_id=student.id,
            roll_number=student.roll_number,
            roll_suffix=student.roll_suffix,
            name=student.name,
            class_id=student.class_id,
            class_name=student.class_.name if student.class_ else "",
            section=student.class_.section if student.class_ else "",
            department_id=student.department_id,
            department_name=student.department.name if student.department else "",
            total_eligible_sessions=total_eligible,
            attended_sessions=attended_cnt,
            absent_sessions=absent_cnt,
            late_sessions=late_cnt,
            on_duty_sessions=od_cnt,
            leave_sessions=leave_cnt,
            medical_sessions=med_cnt,
            overall_percentage=overall_pct,
            is_shortage=is_short,
            subjects=subject_list,
            history=history_items
        )

    @staticmethod
    def get_teacher_compliance(
        db: Session,
        target_date: date,
        department_id: Optional[int] = None
    ) -> List[TeacherComplianceItemOut]:
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day else None

        teacher_query = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
        if department_id:
            teacher_query = teacher_query.filter(User.department_id == department_id)
        teachers = teacher_query.order_by(User.name).all()

        slots_by_teacher: Dict[int, List[TimetableSlot]] = {}
        if day_order:
            slots = db.query(TimetableSlot).filter(TimetableSlot.day_order == day_order).all()
            for s in slots:
                slots_by_teacher.setdefault(s.teacher_id, []).append(s)

        sessions = db.query(AttendanceSession).filter(AttendanceSession.attendance_date == target_date).all()
        sessions_by_actual_teacher: Dict[int, List[AttendanceSession]] = {}
        for s in sessions:
            sessions_by_actual_teacher.setdefault(s.actual_teacher_id, []).append(s)

        compliance_items: List[TeacherComplianceItemOut] = []
        for t in teachers:
            sched_slots = slots_by_teacher.get(t.id, [])
            sched_count = len(sched_slots)
            actual_sessions = sessions_by_actual_teacher.get(t.id, [])

            on_time_cnt = 0
            late_cnt = 0
            emerg_cnt = 0
            session_details = []

            for sess in actual_sessions:
                if sess.attendance_type == AttendanceType.emergency:
                    emerg_cnt += 1
                if sess.status == SessionStatus.submitted:
                    on_time_cnt += 1
                elif sess.status == SessionStatus.submitted_late:
                    late_cnt += 1

                session_details.append({
                    "session_id": sess.id,
                    "class_name": sess.class_.name if sess.class_ else "",
                    "section": sess.class_.section if sess.class_ else "",
                    "period_number": sess.period_number,
                    "subject_name": sess.subject.name if sess.subject else "",
                    "status": sess.status.value,
                    "attendance_type": sess.attendance_type.value,
                    "submitted_at": sess.submitted_at.isoformat() if sess.submitted_at else None
                })

            submitted_cnt = on_time_cnt + late_cnt
            missed_cnt = max(0, sched_count - submitted_cnt)
            comp_pct = round((on_time_cnt / sched_count * 100), 1) if sched_count > 0 else (100.0 if submitted_cnt > 0 else 100.0)

            compliance_items.append(
                TeacherComplianceItemOut(
                    teacher_id=t.id,
                    teacher_name=t.name,
                    department_id=t.department_id or 0,
                    department_name=t.department or "",
                    scheduled_sessions_today=sched_count,
                    submitted_on_time_count=on_time_cnt,
                    submitted_late_count=late_cnt,
                    missed_count=missed_cnt,
                    emergency_count=emerg_cnt,
                    compliance_percentage=comp_pct,
                    sessions=session_details
                )
            )

        return compliance_items

    @staticmethod
    def get_principal_exceptions(
        db: Session,
        target_date: date,
        exception_type: Optional[str] = None,
        department_id: Optional[int] = None
    ) -> List[PrincipalExceptionItemOut]:
        exceptions: List[PrincipalExceptionItemOut] = []
        now_utc = datetime.now(timezone.utc)

        q = db.query(AttendanceSession).filter(AttendanceSession.attendance_date == target_date)
        if department_id:
            q = q.join(Class, AttendanceSession.class_id == Class.id).filter(Class.department_id == department_id)
        sessions = q.all()

        for s in sessions:
            cls_name = s.class_.name if s.class_ else ""
            sec = s.class_.section if s.class_ else ""
            dept_name = s.class_.department.name if s.class_ and s.class_.department else ""
            sched_t = s.scheduled_teacher.name if s.scheduled_teacher else None
            act_t = s.actual_teacher.name if s.actual_teacher else "Faculty"

            if s.status == SessionStatus.submitted_late:
                if not exception_type or exception_type == "LATE_SUBMISSION":
                    exceptions.append(
                        PrincipalExceptionItemOut(
                            session_id=s.id,
                            attendance_date=s.attendance_date,
                            period_number=s.period_number,
                            class_id=s.class_id,
                            class_name=cls_name,
                            section=sec,
                            department_name=dept_name,
                            scheduled_teacher=sched_t,
                            actual_teacher=act_t,
                            exception_type="LATE_SUBMISSION",
                            details=f"Attendance submitted past 15-min threshold at {s.submitted_at.strftime('%H:%M') if s.submitted_at else 'N/A'}",
                            timestamp=s.submitted_at or s.created_at
                        )
                    )

            if s.attendance_type == AttendanceType.emergency:
                if not exception_type or exception_type == "EMERGENCY":
                    exceptions.append(
                        PrincipalExceptionItemOut(
                            session_id=s.id,
                            attendance_date=s.attendance_date,
                            period_number=s.period_number,
                            class_id=s.class_id,
                            class_name=cls_name,
                            section=sec,
                            department_name=dept_name,
                            scheduled_teacher=sched_t,
                            actual_teacher=act_t,
                            exception_type="EMERGENCY",
                            details=f"Emergency substitution handled by {act_t}",
                            timestamp=s.created_at
                        )
                    )

            if s.records:
                tot = len(s.records)
                abs_cnt = sum(1 for r in s.records if r.status == StudentAttendanceStatus.absent)
                if tot > 0 and (abs_cnt / tot) >= 0.25:
                    if not exception_type or exception_type == "HIGH_ABSENTEEISM":
                        pct = round((tot - abs_cnt) / tot * 100, 1)
                        exceptions.append(
                            PrincipalExceptionItemOut(
                                session_id=s.id,
                                attendance_date=s.attendance_date,
                                period_number=s.period_number,
                                class_id=s.class_id,
                                class_name=cls_name,
                                section=sec,
                                department_name=dept_name,
                                scheduled_teacher=sched_t,
                                actual_teacher=act_t,
                                exception_type="HIGH_ABSENTEEISM",
                                details=f"{abs_cnt} of {tot} students absent ({pct}% attendance)",
                                attendance_percentage=pct,
                                timestamp=s.submitted_at or s.created_at
                            )
                        )

        if not exception_type or exception_type == "STUDENT_SHORTAGE":
            stud_q = db.query(Student).filter(Student.is_active == True)
            if department_id:
                stud_q = stud_q.filter(Student.department_id == department_id)
            all_students = stud_q.all()

            for st in all_students:
                marks = (
                    db.query(StudentAttendance.status)
                    .join(AttendanceSession, StudentAttendance.attendance_session_id == AttendanceSession.id)
                    .filter(
                        StudentAttendance.student_id == st.id,
                        AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked])
                    )
                    .all()
                )
                if len(marks) >= 1:
                    attended = sum(1 for m in marks if m[0] in {StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late})
                    pct = round(attended / len(marks) * 100, 1)
                    if pct < 75.0:
                        exceptions.append(
                            PrincipalExceptionItemOut(
                                student_id=st.id,
                                attendance_date=target_date,
                                class_id=st.class_id,
                                class_name=st.class_.name if st.class_ else "",
                                section=st.class_.section if st.class_ else "",
                                department_name=st.department.name if st.department else "",
                                student_name=st.name,
                                student_roll=st.roll_number,
                                exception_type="STUDENT_SHORTAGE",
                                details=f"Attendance at {pct}% ({attended}/{len(marks)} sessions) below 75% threshold",
                                attendance_percentage=pct,
                                timestamp=now_utc
                            )
                        )

        return exceptions

    @staticmethod
    def admin_toggle_session_lock(
        db: Session,
        session_id: int,
        current_user: User,
        data: AdminSessionLockRequest
    ) -> AttendanceSessionOut:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail=f"Attendance session {session_id} not found")

        old_status = session.status.value
        if data.locked:
            session.status = SessionStatus.locked
        else:
            session.status = SessionStatus.submitted
            session.correction_deadline = datetime.now(timezone.utc) + timedelta(hours=24)

        audit = AttendanceCorrectionAudit(
            attendance_session_id=session.id,
            old_status=old_status,
            new_status=session.status.value,
            changed_by_id=current_user.id,
            reason=data.reason or ("Admin locked session" if data.locked else "Admin unlocked session"),
            changed_at=datetime.now(timezone.utc)
        )
        db.add(audit)
        db.commit()
        db.refresh(session)
        return StudentAttendanceService.get_session_details(db, session.id)

    @staticmethod
    def admin_override_student_attendance(
        db: Session,
        session_id: int,
        student_id: int,
        current_user: User,
        data: AdminAttendanceOverrideRequest
    ) -> AttendanceSessionOut:
        corr_req = AttendanceCorrectionRequest(
            new_status=data.new_status,
            reason=data.reason,
            device_id=data.device_id
        )
        return StudentAttendanceService.correct_student_attendance(
            db=db,
            session_id=session_id,
            student_id=student_id,
            current_user=current_user,
            data=corr_req
        )

    @staticmethod
    def export_attendance_report_csv(
        db: Session,
        report_type: str,
        target_date: date,
        department_id: Optional[int] = None
    ) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == "daily_summary":
            overview = StudentAttendanceService.get_principal_overview(db, target_date)
            writer.writerow(["FAFLOW INSTITUTIONAL STUDENT ATTENDANCE REPORT"])
            writer.writerow(["Date", str(overview.date), "Day Order", str(overview.day_order or "N/A")])
            writer.writerow(["Overall Attendance %", f"{overview.overall_attendance_percentage}%"])
            writer.writerow(["Scheduled Sessions", overview.total_scheduled_sessions, "Submitted", overview.submitted_sessions, "Pending", overview.pending_sessions])
            writer.writerow(["Late Submissions", overview.late_sessions, "Emergency Sessions", overview.emergency_sessions])
            writer.writerow([])
            writer.writerow(["Department", "Code", "Classes", "Scheduled", "Submitted", "Pending", "Late", "Emergency", "Attendance %", "HOD"])
            for d in overview.departments:
                writer.writerow([
                    d.department_name, d.department_code, d.classes_count,
                    d.total_scheduled_sessions, d.submitted_sessions, d.pending_sessions,
                    d.late_sessions, d.emergency_sessions, f"{d.student_attendance_percentage}%",
                    d.hod_name or ""
                ])

        elif report_type == "shortage_list":
            exceptions = StudentAttendanceService.get_principal_exceptions(
                db, target_date, exception_type="STUDENT_SHORTAGE", department_id=department_id
            )
            writer.writerow(["ATTENDANCE SHORTAGE REPORT (< 75%)", f"Generated: {target_date}"])
            writer.writerow(["Roll Number", "Student Name", "Department", "Class", "Section", "Attendance %", "Details"])
            for ex in exceptions:
                writer.writerow([
                    ex.student_roll or "", ex.student_name or "", ex.department_name,
                    ex.class_name, ex.section, f"{ex.attendance_percentage}%", ex.details
                ])

        elif report_type == "teacher_compliance":
            compliance = StudentAttendanceService.get_teacher_compliance(db, target_date, department_id=department_id)
            writer.writerow(["TEACHER ATTENDANCE SUBMISSION COMPLIANCE REPORT", f"Date: {target_date}"])
            writer.writerow(["Teacher Name", "Department", "Scheduled Today", "On Time", "Late", "Missed", "Emergency", "Compliance %"])
            for tc in compliance:
                writer.writerow([
                    tc.teacher_name, tc.department_name, tc.scheduled_sessions_today,
                    tc.submitted_on_time_count, tc.submitted_late_count, tc.missed_count,
                    tc.emergency_count, f"{tc.compliance_percentage}%"
                ])

        else:
            sessions = StudentAttendanceService.get_principal_sessions(
                db, target_date, department_id=department_id
            )
            writer.writerow(["CLASS ATTENDANCE SESSIONS", f"Date: {target_date}"])
            writer.writerow(["Period", "Time", "Department", "Class", "Section", "Subject", "Scheduled Teacher", "Actual Teacher", "Type", "Status", "Total", "Present", "Absent", "Attendance %"])
            for s in sessions:
                writer.writerow([
                    s.period_number, s.period_time, s.department_name, s.class_name, s.section,
                    s.subject_name, s.scheduled_teacher_name or "", s.actual_teacher_name or "",
                    s.attendance_type.value if s.attendance_type else "", s.status.value,
                    s.total_students, s.present_count, s.absent_count, f"{s.attendance_percentage}%"
                ])

        return output.getvalue()
