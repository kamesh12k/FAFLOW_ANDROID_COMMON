import logging
from datetime import date, datetime, timezone
from threading import Thread
from typing import Optional, List, Dict, Any
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.academic_intelligence import (
    AcademicIntelligenceEvent,
    IntelligenceEventType,
    IntelligenceEventState,
    IntelligenceSeverity,
)
from app.models.student_attendance import (
    AttendanceSession,
    StudentAttendance,
    SessionStatus,
    AttendanceType,
    StudentAttendanceStatus,
)
from app.models.class_ import Class
from app.models.department import Department
from app.models.timetable import TimetableSlot
from app.models.user import User, Role
from app.models.system_setting import SystemSetting, DEFAULT_SYSTEM_SETTINGS
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)


class AcademicIntelligenceService:
    @staticmethod
    def get_setting(db: Session, key: str, default: Any = None) -> Any:
        """Legacy SystemSetting reader — used as inner fallback. Prefer get_threshold for numeric rules."""
        try:
            row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if row and row.value is not None:
                return row.value
        except Exception as e:
            logger.warning(f"Error reading system setting {key}: {e}")
        return DEFAULT_SYSTEM_SETTINGS.get(key, default)

    @staticmethod
    def get_threshold(db: Session, key: str, default_val: float) -> float:
        """Returns a float threshold, reading first from governance_rule_service (TTL-cached),
        then SystemSetting, then the supplied default_val."""
        try:
            from app.services import governance_rule_service
            val = governance_rule_service.get_rule_value(db, key)
            if val:
                return float(val)
        except Exception as e:
            logger.debug(f"governance_rule_service miss for '{key}': {e}")
        # Fallback: legacy SystemSetting
        raw = AcademicIntelligenceService.get_setting(db, key, str(default_val))
        try:
            return float(raw)
        except (ValueError, TypeError):
            return default_val

    @classmethod
    def evaluate_session(cls, db: Session, session_id: int) -> List[AcademicIntelligenceEvent]:
        """Evaluates a single attendance session against deterministic academic intelligence rules,

        updating/creating persistent AcademicIntelligenceEvents and notifying users on state changes.
        """
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            return []

        # Only evaluate submitted or locked sessions
        if session.status not in (SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked):
            return []

        cls_obj = session.class_ or db.query(Class).filter(Class.id == session.class_id).first()
        if not cls_obj:
            return []

        dept_id = cls_obj.department_id
        cls_name = f"{cls_obj.name} {cls_obj.section or ''}".strip()
        teacher_name = session.actual_teacher.name if session.actual_teacher else "Faculty"
        now_utc = datetime.now(timezone.utc)

        # Thresholds
        high_absent_thresh = cls.get_threshold(db, "intelligence_high_absenteeism_threshold", 25.0)
        crit_absent_thresh = cls.get_threshold(db, "intelligence_critical_absenteeism_threshold", 40.0)
        drop_thresh = cls.get_threshold(db, "intelligence_attendance_drop_threshold", 15.0)

        # Calculate session attendance statistics
        records = session.records
        total_count = len(records)
        absent_count = sum(1 for r in records if r.status == StudentAttendanceStatus.absent)
        present_count = sum(
            1 for r in records
            if r.status in (StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late)
        )
        attendance_pct = round((present_count / total_count * 100.0), 1) if total_count > 0 else 100.0
        absent_pct = round((absent_count / total_count * 100.0), 1) if total_count > 0 else 0.0

        events_evaluated: List[AcademicIntelligenceEvent] = []
        new_notifications_to_send: List[tuple[AcademicIntelligenceEvent, str, str]] = []

        # Helper to upsert an event
        def upsert_event(
            ev_type: IntelligenceEventType,
            src_key: str,
            sev: IntelligenceSeverity,
            title: str,
            detail: str,
            is_active_condition: bool,
            att_pct: Optional[float] = None,
            abs_cnt: Optional[int] = None,
            tot_cnt: Optional[int] = None,
        ) -> Optional[AcademicIntelligenceEvent]:
            ev = db.query(AcademicIntelligenceEvent).filter(AcademicIntelligenceEvent.source_key == src_key).first()
            if is_active_condition:
                if not ev:
                    ev = AcademicIntelligenceEvent(
                        department_id=dept_id,
                        class_id=session.class_id,
                        attendance_session_id=session.id,
                        timetable_slot_id=session.timetable_slot_id,
                        event_type=ev_type,
                        severity=sev,
                        state=IntelligenceEventState.active,
                        source_key=src_key,
                        title=title,
                        detail=detail,
                        attendance_percentage=att_pct,
                        absent_count=abs_cnt,
                        total_count=tot_cnt,
                        relevant_date=session.attendance_date,
                        period_number=session.period_number,
                        detected_at=now_utc,
                        last_evaluated_at=now_utc,
                    )
                    db.add(ev)
                    db.flush()
                    new_notifications_to_send.append((ev, title, detail))
                else:
                    # Update metrics
                    ev.severity = sev
                    ev.title = title
                    ev.detail = detail
                    ev.attendance_percentage = att_pct
                    ev.absent_count = abs_cnt
                    ev.total_count = tot_cnt
                    ev.last_evaluated_at = now_utc
                    if ev.state == IntelligenceEventState.resolved:
                        # Reactivated condition
                        ev.state = IntelligenceEventState.active
                        ev.resolved_at = None
                        new_notifications_to_send.append((ev, f"[Reactivated] {title}", detail))
                events_evaluated.append(ev)
                return ev
            else:
                # Condition no longer holds
                if ev and ev.state == IntelligenceEventState.active:
                    ev.state = IntelligenceEventState.resolved
                    ev.resolved_at = now_utc
                    ev.last_evaluated_at = now_utc
                    ev.detail = f"{ev.detail or ''} (Auto-resolved: condition cleared)"
                    events_evaluated.append(ev)
                return ev

        # -------------------------------------------------------------------------
        # Rule 1: Group Absenteeism
        # -------------------------------------------------------------------------
        ga_key = f"group_absenteeism:{session.attendance_date}:{session.class_id}:{session.period_number}"
        is_ga = (total_count > 0 and absent_pct >= high_absent_thresh)
        ga_sev = IntelligenceSeverity.critical if absent_pct >= crit_absent_thresh else IntelligenceSeverity.high
        ga_title = f"High Absenteeism in {cls_name} (Period {session.period_number})"
        ga_detail = f"{absent_count} of {total_count} students absent ({absent_pct}% absenteeism, {attendance_pct}% attendance)."
        upsert_event(
            ev_type=IntelligenceEventType.group_absenteeism,
            src_key=ga_key,
            sev=ga_sev,
            title=ga_title,
            detail=ga_detail,
            is_active_condition=is_ga,
            att_pct=attendance_pct,
            abs_cnt=absent_count,
            tot_cnt=total_count,
        )

        # -------------------------------------------------------------------------
        # Rule 2: Attendance Drop vs Earlier Periods Today
        # -------------------------------------------------------------------------
        ad_key = f"attendance_drop:{session.attendance_date}:{session.class_id}:{session.period_number}"
        is_ad = False
        ad_sev = IntelligenceSeverity.high
        ad_title = ""
        ad_detail = ""

        if session.period_number > 1 and total_count > 0:
            # Query earlier sessions for same class and date
            earlier_sessions = (
                db.query(AttendanceSession)
                .filter(
                    AttendanceSession.class_id == session.class_id,
                    AttendanceSession.attendance_date == session.attendance_date,
                    AttendanceSession.period_number < session.period_number,
                    AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked]),
                )
                .order_by(desc(AttendanceSession.period_number))
                .all()
            )
            if earlier_sessions:
                # Look at immediate previous session first, or average of earlier
                prev_session = earlier_sessions[0]
                prev_recs = prev_session.records
                if prev_recs:
                    prev_tot = len(prev_recs)
                    prev_pres = sum(
                        1 for r in prev_recs
                        if r.status in (StudentAttendanceStatus.present, StudentAttendanceStatus.on_duty, StudentAttendanceStatus.late)
                    )
                    prev_pct = round((prev_pres / prev_tot * 100.0), 1) if prev_tot > 0 else 100.0
                    drop_val = round(prev_pct - attendance_pct, 1)

                    if drop_val >= drop_thresh:
                        is_ad = True
                        ad_sev = IntelligenceSeverity.critical if drop_val >= 25.0 else IntelligenceSeverity.high
                        ad_title = f"Attendance Drop in {cls_name} (Period {session.period_number})"
                        ad_detail = (
                            f"Attendance dropped by {drop_val}% from Period {prev_session.period_number} "
                            f"({prev_pct}%) to Period {session.period_number} ({attendance_pct}%)."
                        )

        upsert_event(
            ev_type=IntelligenceEventType.attendance_drop,
            src_key=ad_key,
            sev=ad_sev,
            title=ad_title,
            detail=ad_detail,
            is_active_condition=is_ad,
            att_pct=attendance_pct,
            abs_cnt=absent_count,
            tot_cnt=total_count,
        )

        # -------------------------------------------------------------------------
        # Rule 3: Late Submission
        # -------------------------------------------------------------------------
        ls_key = f"late_submission:{session.attendance_date}:{session.class_id}:{session.period_number}"
        is_ls = (session.status == SessionStatus.submitted_late)
        time_str = session.submitted_at.strftime("%H:%M") if session.submitted_at else "N/A"
        ls_title = f"Late Submission: {cls_name} Period {session.period_number}"
        ls_detail = f"Attendance submitted past threshold at {time_str} by {teacher_name}."
        upsert_event(
            ev_type=IntelligenceEventType.late_submission,
            src_key=ls_key,
            sev=IntelligenceSeverity.medium,
            title=ls_title,
            detail=ls_detail,
            is_active_condition=is_ls,
            att_pct=attendance_pct,
            abs_cnt=absent_count,
            tot_cnt=total_count,
        )

        # -------------------------------------------------------------------------
        # Rule 4: Substitution / Emergency Coverage Issue
        # -------------------------------------------------------------------------
        cov_key = f"substitution_coverage:{session.attendance_date}:{session.class_id}:{session.period_number}"
        is_cov = (session.attendance_type == AttendanceType.emergency)
        cov_title = f"Emergency Class Coverage: {cls_name} Period {session.period_number}"
        cov_detail = f"Emergency substitution handled by {teacher_name}."
        upsert_event(
            ev_type=IntelligenceEventType.substitution_coverage,
            src_key=cov_key,
            sev=IntelligenceSeverity.medium,
            title=cov_title,
            detail=cov_detail,
            is_active_condition=is_cov,
            att_pct=attendance_pct,
            abs_cnt=absent_count,
            tot_cnt=total_count,
        )

        db.commit()

        # -------------------------------------------------------------------------
        # Deduplicated Notifications: Notify HOD and Principal on new/reactivated alerts
        # -------------------------------------------------------------------------
        if new_notifications_to_send:
            cls._dispatch_event_notifications(db, dept_id, new_notifications_to_send)

        return events_evaluated

    @classmethod
    def _dispatch_event_notifications(
        cls,
        db: Session,
        dept_id: int,
        notifications: List[tuple[AcademicIntelligenceEvent, str, str]],
    ) -> None:
        """Sends notifications to HOD of department and Principal/Governance without spamming."""
        recipients = db.query(User).filter(
            User.is_active == True,
            (
                ((User.role == Role.admin) & (User.department_id == dept_id))
                | (User.role.in_([Role.principal, Role.governance]))
            )
        ).all()

        for ev, title, detail in notifications:
            # Check if notification was already sent recently for this event
            if ev.notified_at is not None:
                continue

            for u in recipients:
                try:
                    create_notification(
                        db=db,
                        user_id=u.id,
                        title=title,
                        body=detail,
                        event_type=f"intelligence_{ev.event_type.value}",
                        send_push=True,
                    )
                except Exception as e:
                    logger.warning(f"Failed to create intelligence notification for user {u.id}: {e}")

            ev.notified_at = datetime.now(timezone.utc)
            db.commit()

    @classmethod
    def evaluate_session_async(cls, session_id: int) -> None:
        """Launches evaluation in a daemon thread to not block HTTP response."""
        def _worker():
            db = SessionLocal()
            try:
                cls.evaluate_session(db, session_id)
            except Exception as e:
                logger.exception(f"Error during async intelligence evaluation of session {session_id}: {e}")
            finally:
                db.close()

        t = Thread(target=_worker, daemon=True)
        t.start()

    @staticmethod
    def get_live_summary(
        db: Session,
        target_date: date,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Calculates live campus / department intelligence stats for dashboard banners."""
        # 1. Timetable scheduled slots for target date
        # If we know day_order for target_date from DayOrderCalendar
        from app.models.day_order_calendar import CalendarDay, DayType
        cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
        day_order = cal_day.day_order if cal_day and cal_day.day_type == DayType.instructional else None

        tt_query = db.query(TimetableSlot)
        if department_id:
            tt_query = tt_query.join(Class, TimetableSlot.class_id == Class.id).filter(Class.department_id == department_id)
        if day_order:
            tt_query = tt_query.filter(TimetableSlot.day_order == day_order)
        scheduled_count = tt_query.count()

        # 2. Conducted sessions today
        sess_query = db.query(AttendanceSession).filter(
            AttendanceSession.attendance_date == target_date,
            AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked])
        )
        if department_id:
            sess_query = sess_query.join(Class, AttendanceSession.class_id == Class.id).filter(Class.department_id == department_id)
        conducted_count = sess_query.count()

        # In case timetable is empty or dynamic, ensure scheduled >= conducted for display sanity
        effective_scheduled = max(scheduled_count, conducted_count)
        captured_pct = round((conducted_count / effective_scheduled * 100.0), 1) if effective_scheduled > 0 else 100.0

        # 3. Active intelligence events
        ev_query = db.query(AcademicIntelligenceEvent).filter(
            AcademicIntelligenceEvent.relevant_date == target_date,
            AcademicIntelligenceEvent.state.in_([IntelligenceEventState.active, IntelligenceEventState.acknowledged]),
        )
        if department_id:
            ev_query = ev_query.filter(AcademicIntelligenceEvent.department_id == department_id)

        active_events = ev_query.all()
        critical_cnt = sum(1 for e in active_events if e.severity == IntelligenceSeverity.critical)
        high_cnt = sum(1 for e in active_events if e.severity == IntelligenceSeverity.high)
        medium_cnt = sum(1 for e in active_events if e.severity == IntelligenceSeverity.medium)
        info_cnt = sum(1 for e in active_events if e.severity == IntelligenceSeverity.info)

        # 4. Department breakdown (for principal overview)
        dept_breakdown = []
        departments = db.query(Department).all()
        for dept in departments:
            if department_id and dept.id != department_id:
                continue

            dept_evs = [e for e in active_events if e.department_id == dept.id]
            dept_sess_cnt = (
                db.query(AttendanceSession)
                .join(Class, AttendanceSession.class_id == Class.id)
                .filter(
                    AttendanceSession.attendance_date == target_date,
                    Class.department_id == dept.id,
                    AttendanceSession.status.in_([SessionStatus.submitted, SessionStatus.submitted_late, SessionStatus.locked]),
                )
                .count()
            )
            dept_breakdown.append({
                "department_id": dept.id,
                "department_name": dept.name,
                "conducted_sessions": dept_sess_cnt,
                "active_alerts_count": len(dept_evs),
                "critical_count": sum(1 for e in dept_evs if e.severity == IntelligenceSeverity.critical),
                "high_count": sum(1 for e in dept_evs if e.severity == IntelligenceSeverity.high),
            })

        return {
            "date": target_date.isoformat(),
            "scheduled_count": effective_scheduled,
            "conducted_count": conducted_count,
            "captured_percentage": captured_pct,
            "needs_attention_count": len(active_events),
            "critical_count": critical_cnt,
            "high_count": high_cnt,
            "medium_count": medium_cnt,
            "info_count": info_cnt,
            "departments": dept_breakdown,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def get_events(
        db: Session,
        target_date: Optional[date] = None,
        department_id: Optional[int] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        state: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Retrieves intelligence events with relational metadata for display in Principal and HOD UI."""
        query = db.query(AcademicIntelligenceEvent)

        if target_date:
            query = query.filter(AcademicIntelligenceEvent.relevant_date == target_date)
        if department_id:
            query = query.filter(AcademicIntelligenceEvent.department_id == department_id)
        if event_type:
            query = query.filter(AcademicIntelligenceEvent.event_type == event_type)
        if severity:
            query = query.filter(AcademicIntelligenceEvent.severity == severity)
        if state:
            query = query.filter(AcademicIntelligenceEvent.state == state)
        else:
            # By default show active and acknowledged, not resolved
            query = query.filter(
                AcademicIntelligenceEvent.state.in_([IntelligenceEventState.active, IntelligenceEventState.acknowledged])
            )

        events = (
            query.order_by(
                desc(AcademicIntelligenceEvent.detected_at),
                desc(AcademicIntelligenceEvent.severity),
            )
            .offset(offset)
            .limit(limit)
            .all()
        )

        results = []
        for e in events:
            dept_name = e.department.name if e.department else "General"
            cls_name = f"{e.class_.name} {e.class_.section or ''}".strip() if e.class_ else ""
            teacher_name = None
            if e.attendance_session and e.attendance_session.actual_teacher:
                teacher_name = e.attendance_session.actual_teacher.name

            results.append({
                "id": e.id,
                "department_id": e.department_id,
                "department_name": dept_name,
                "class_id": e.class_id,
                "class_name": cls_name,
                "attendance_session_id": e.attendance_session_id,
                "period_number": e.period_number,
                "event_type": e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type),
                "severity": e.severity.value if hasattr(e.severity, "value") else str(e.severity),
                "state": e.state.value if hasattr(e.state, "value") else str(e.state),
                "title": e.title,
                "detail": e.detail,
                "attendance_percentage": e.attendance_percentage,
                "absent_count": e.absent_count,
                "total_count": e.total_count,
                "relevant_date": e.relevant_date.isoformat(),
                "teacher_name": teacher_name,
                "detected_at": e.detected_at.isoformat() if e.detected_at else None,
                "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
            })

        return results

    @staticmethod
    def acknowledge_event(db: Session, event_id: int, user: User) -> Optional[AcademicIntelligenceEvent]:
        """Marks an event as acknowledged by Principal or HOD."""
        ev = db.query(AcademicIntelligenceEvent).filter(AcademicIntelligenceEvent.id == event_id).first()
        if not ev:
            return None

        # Department scoping for HOD
        if user.role == Role.admin and user.department_id:
            if ev.department_id != user.department_id:
                return None

        ev.state = IntelligenceEventState.acknowledged
        ev.acknowledged_at = datetime.now(timezone.utc)
        ev.acknowledged_by_id = user.id
        db.commit()
        db.refresh(ev)
        return ev
