from typing import List, Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.core.dependencies import get_current_user, require_credentials_set
from app.models.user import User, Role
from app.models.operational_staff import OperationalStaff, StaffCategory, EmploymentStatus
from app.models.room import Room, RoomType
from app.models.timetable import TimetableSlot
from app.models.department import Department
from app.models.day_order_calendar import CalendarDay
from app.schemas.operational_staff import OperationalStaffOut
from app.services import operational_staff_service as staff_service
from app.services import day_order_service

router = APIRouter(prefix="/staff", tags=["Staff Portal"])


def require_staff_or_admin(current_user: User = Depends(require_credentials_set)) -> User:
    # Allow staff, manager, admin, system admin, principal to view staff portal
    return current_user


class RoomScheduleSlot(BaseModel):
    id: int
    day_order: int
    period_number: int
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    faculty_name: Optional[str] = None
    class_name: Optional[str] = None
    room_number: Optional[str] = None


class StaffDashboardData(BaseModel):
    profile: Optional[OperationalStaffOut] = None
    assigned_room: Optional[Dict[str, Any]] = None
    my_controlled_labs: List[Dict[str, Any]] = []
    today_day_order: Optional[int] = None
    today_status: Optional[str] = "working"
    today_schedule: List[RoomScheduleSlot] = []
    weekly_schedule: List[RoomScheduleSlot] = []
    colleagues: List[OperationalStaffOut] = []
    all_labs: List[Dict[str, Any]] = []


@router.get("/me", response_model=OperationalStaffOut)
def get_my_staff_profile(
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db),
):
    staff = db.query(OperationalStaff).filter(OperationalStaff.user_id == current_user.id).first()
    if not staff:
        # Fallback search by email or employee code/username
        staff = db.query(OperationalStaff).filter(
            (OperationalStaff.email == current_user.email) |
            (OperationalStaff.employee_code.ilike(current_user.username or ''))
        ).first()

    if not staff:
        # If admin/manager visits without a personal staff record, fallback to first active lab staff or create virtual profile
        first_staff = db.query(OperationalStaff).filter(OperationalStaff.category == StaffCategory.laboratory).first()
        if first_staff:
            return staff_service.format_staff_out(first_staff, db)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No operational staff records found")

    return staff_service.format_staff_out(staff, db)


@router.get("/dashboard", response_model=StaffDashboardData)
def get_staff_dashboard(
    selected_room_id: Optional[int] = Query(None, description="Optional room filter to view specific lab"),
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db),
):
    # 1. Resolve staff profile
    staff = db.query(OperationalStaff).filter(OperationalStaff.user_id == current_user.id).first()
    if not staff:
        staff = db.query(OperationalStaff).filter(
            (OperationalStaff.email == current_user.email) |
            (OperationalStaff.employee_code.ilike(current_user.username or ''))
        ).first()

    if not staff:
        # Fallback for managers/admins inspecting the portal
        staff = db.query(OperationalStaff).filter(OperationalStaff.category == StaffCategory.laboratory).first()

    profile_out = staff_service.format_staff_out(staff, db) if staff else None
    my_controlled_labs = profile_out.assigned_rooms if profile_out else []

    # 2. Determine target room ID
    target_room_id = selected_room_id
    if not target_room_id:
        if staff and staff.assigned_room_id:
            target_room_id = staff.assigned_room_id
        elif my_controlled_labs:
            target_room_id = my_controlled_labs[0]["id"]

    # Fallback to first lab room in database if unassigned
    if not target_room_id:
        first_lab = db.query(Room).filter(Room.room_type == RoomType.lab).first()
        if first_lab:
            target_room_id = first_lab.id

    assigned_room_data = None
    weekly_slots: List[RoomScheduleSlot] = []
    today_slots: List[RoomScheduleSlot] = []

    # 3. Resolve today's Day Order
    today_date = date.today()
    calendar_day = db.query(CalendarDay).filter(CalendarDay.date == today_date).first()
    today_day_order = calendar_day.day_order if calendar_day and calendar_day.day_order else None
    today_status = calendar_day.day_type.value if calendar_day else "working"

    # 4. Fetch Room & Timetable Slots
    if target_room_id:
        room = db.query(Room).filter(Room.id == target_room_id).first()
        if room:
            assigned_room_data = {
                "id": room.id,
                "room_number": room.room_number,
                "capacity": room.capacity,
                "room_type": room.room_type.value,
                "department_id": room.department_id,
                "department_name": room.department.name if room.department else "General / Central",
            }

            slots = db.query(TimetableSlot).filter(TimetableSlot.room_id == target_room_id).all()
            for s in slots:
                slot_obj = RoomScheduleSlot(
                    id=s.id,
                    day_order=s.day_order,
                    period_number=s.period_number,
                    subject_code=s.subject.code if s.subject else None,
                    subject_name=s.subject.name if s.subject else "Practical Lab",
                    faculty_name=s.teacher.name if s.teacher else "Staff Incharge",
                    class_name=s.class_.name if s.class_ else None,
                    room_number=room.room_number,
                )
                weekly_schedule_append = weekly_slots.append(slot_obj)
                if today_day_order and s.day_order == today_day_order:
                    today_slots.append(slot_obj)

    # Sort today slots by period number
    today_slots.sort(key=lambda x: x.period_number)
    weekly_slots.sort(key=lambda x: (x.day_order, x.period_number))

    # 5. Fetch Colleagues
    dept_id = staff.department_id if staff else None
    colleagues_query = db.query(OperationalStaff)
    if dept_id:
        colleagues_query = colleagues_query.filter(OperationalStaff.department_id == dept_id)
    if staff:
        colleagues_query = colleagues_query.filter(OperationalStaff.id != staff.id)
    colleagues = [staff_service.format_staff_out(c, db) for c in colleagues_query.limit(8).all()]

    # 6. Fetch All Lab Rooms for quick switching
    all_labs = [
        {
            "id": r.id,
            "room_number": r.room_number,
            "capacity": r.capacity,
            "room_type": r.room_type.value,
            "department_name": r.department.name if r.department else "General",
        }
        for r in db.query(Room).filter(Room.room_type == RoomType.lab).order_by(Room.room_number.asc()).all()
    ]

    return StaffDashboardData(
        profile=profile_out,
        assigned_room=assigned_room_data,
        my_controlled_labs=my_controlled_labs,
        today_day_order=today_day_order,
        today_status=today_status,
        today_schedule=today_slots,
        weekly_schedule=weekly_slots,
        colleagues=colleagues,
        all_labs=all_labs,
    )


# ── Staff Leaves & Personal Ledger Endpoints ─────────────────────────────────

from app.schemas.staff_leave import StaffLeaveApply, StaffLeaveOut, StaffLedgerSummary
from app.services import staff_leave_service


def _get_staff_for_user_or_404(db: Session, current_user: User) -> OperationalStaff:
    staff = db.query(OperationalStaff).filter(OperationalStaff.user_id == current_user.id).first()
    if not staff:
        staff = db.query(OperationalStaff).filter(
            (OperationalStaff.email == current_user.email) |
            (OperationalStaff.employee_code.ilike(current_user.username or ''))
        ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="No operational staff profile linked to your user account")
    return staff


@router.post("/leaves", response_model=StaffLeaveOut, status_code=status.HTTP_201_CREATED)
def apply_leave(
    data: StaffLeaveApply,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    staff = _get_staff_for_user_or_404(db, current_user)
    leave = staff_leave_service.apply_staff_leave(db, staff, data)
    return staff_leave_service.list_staff_leaves(db, staff_id=staff.id)[0]


@router.get("/leaves", response_model=List[StaffLeaveOut])
def get_my_leaves(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    staff = _get_staff_for_user_or_404(db, current_user)
    return staff_leave_service.list_staff_leaves(db, staff_id=staff.id, status_filter=status_filter)


@router.delete("/leaves/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_leave(
    leave_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    staff = _get_staff_for_user_or_404(db, current_user)
    leave = db.query(StaffLeaveRequest).filter(StaffLeaveRequest.id == leave_id, StaffLeaveRequest.staff_id == staff.id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found or not owned by you")
    staff_leave_service.cancel_staff_leave(db, current_user, leave_id)


@router.get("/ledger", response_model=StaffLedgerSummary)
def get_my_ledger(
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    staff = _get_staff_for_user_or_404(db, current_user)
    return staff_leave_service.get_staff_leave_ledger(db, staff.id)


