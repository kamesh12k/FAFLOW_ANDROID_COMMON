from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.operational_staff import OperationalStaff, StaffCategory, EmploymentStatus, ShiftType
from app.models.user import User, Role
from app.models.room import Room, RoomType
from app.models.department import Department
from app.core.security import hash_password
from app.schemas.operational_staff import (
    OperationalStaffCreate,
    OperationalStaffUpdate,
    OperationalStaffOut,
    OperationalStaffStats,
)
from app.services.admin_service import log_audit_event


def list_operational_staff(
    db: Session,
    tenant_dept_id: Optional[int] = None,
    category: Optional[StaffCategory] = None,
    search: Optional[str] = None,
    employment_status: Optional[EmploymentStatus] = None,
    assigned_room_id: Optional[int] = None,
) -> List[OperationalStaff]:
    query = db.query(OperationalStaff)

    if tenant_dept_id is not None:
        query = query.filter(
            or_(
                OperationalStaff.department_id == tenant_dept_id,
                OperationalStaff.department_id.is_(None)
            )
        )

    if category:
        query = query.filter(OperationalStaff.category == category)

    if employment_status:
        query = query.filter(OperationalStaff.employment_status == employment_status)

    if assigned_room_id:
        query = query.filter(OperationalStaff.assigned_room_id == assigned_room_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                OperationalStaff.full_name.ilike(term),
                OperationalStaff.employee_code.ilike(term),
                OperationalStaff.designation.ilike(term),
                OperationalStaff.email.ilike(term),
                OperationalStaff.phone_number.ilike(term),
            )
        )

    return query.order_by(OperationalStaff.full_name.asc()).all()


def get_operational_staff(
    db: Session,
    staff_id: int,
    tenant_dept_id: Optional[int] = None,
) -> OperationalStaff:
    query = db.query(OperationalStaff).filter(OperationalStaff.id == staff_id)
    if tenant_dept_id is not None:
        query = query.filter(
            or_(
                OperationalStaff.department_id == tenant_dept_id,
                OperationalStaff.department_id.is_(None)
            )
        )
    staff = query.first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff record not found")
    return staff


def create_operational_staff(
    db: Session,
    current_user: User,
    data: OperationalStaffCreate,
) -> OperationalStaff:
    # Check duplicate employee code
    existing = db.query(OperationalStaff).filter(
        OperationalStaff.employee_code == data.employee_code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee code '{data.employee_code}' already exists"
        )

    # Validate department if provided
    dept_id = data.department_id
    if current_user.role == Role.manager and current_user.department_id is not None:
        # Department-scoped manager can only assign staff to their own department
        dept_id = current_user.department_id

    if dept_id:
        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")

    # Validate room if assigned (must be a lab room for lab staff)
    if data.assigned_room_id:
        room = db.query(Room).filter(Room.id == data.assigned_room_id).first()
        if not room:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room not found")
        if data.category == StaffCategory.laboratory and room.room_type != RoomType.lab:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room '{room.room_number}' is not marked as a Laboratory"
            )

    # Handle login account creation if password or enable_login is specified
    user_id = None
    if data.password and data.password.strip():
        username = data.username.strip().lower() if data.username and data.username.strip() else data.employee_code.lower()
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Username '{username}' is already in use")

        staff_role = Role.lab_staff if data.category == StaffCategory.laboratory else Role.non_teaching_staff
        login_user = User(
            name=data.full_name,
            username=username,
            email=data.email.strip() if data.email and data.email.strip() else None,
            password_hash=hash_password(data.password),
            role=staff_role,
            admin_level=None,
            department_id=dept_id,
            must_change_credentials=False,
            is_active=True,
            created_by_admin_id=current_user.id,
        )
        db.add(login_user)
        db.flush()
        user_id = login_user.id

    # Determine assigned room IDs
    room_ids = data.assigned_room_ids or []
    if data.assigned_room_id and data.assigned_room_id not in room_ids:
        room_ids.append(data.assigned_room_id)
    primary_room_id = data.assigned_room_id or (room_ids[0] if room_ids else None)

    staff = OperationalStaff(
        employee_code=data.employee_code,
        full_name=data.full_name,
        category=data.category,
        designation=data.designation,
        department_id=dept_id,
        assigned_room_id=primary_room_id,
        assigned_room_ids=room_ids,
        phone_number=data.phone_number,
        email=data.email,
        shift_type=data.shift_type,
        joining_date=data.joining_date,
        user_id=user_id,
        created_by_manager_id=current_user.id,
        notes=data.notes,
    )
    db.add(staff)
    db.flush()

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="CREATE_OPERATIONAL_STAFF",
        target_type="operational_staff",
        target_id=staff.id,
        details={
            "employee_code": staff.employee_code,
            "full_name": staff.full_name,
            "category": staff.category.value,
            "designation": staff.designation,
            "has_login": user_id is not None,
            "assigned_room_ids": room_ids,
        },
    )

    db.commit()
    db.refresh(staff)
    return staff


def update_operational_staff(
    db: Session,
    current_user: User,
    staff_id: int,
    data: OperationalStaffUpdate,
) -> OperationalStaff:
    staff = get_operational_staff(
        db, staff_id,
        tenant_dept_id=current_user.department_id if current_user.role == Role.manager else None
    )

    if data.employee_code and data.employee_code != staff.employee_code:
        dup = db.query(OperationalStaff).filter(
            OperationalStaff.employee_code == data.employee_code,
            OperationalStaff.id != staff_id
        ).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee code '{data.employee_code}' already exists"
            )
        staff.employee_code = data.employee_code

    if data.full_name is not None:
        staff.full_name = data.full_name
    if data.category is not None:
        staff.category = data.category
    if data.designation is not None:
        staff.designation = data.designation
    if data.phone_number is not None:
        staff.phone_number = data.phone_number
    if data.email is not None:
        staff.email = data.email
    if data.employment_status is not None:
        staff.employment_status = data.employment_status
    if data.shift_type is not None:
        staff.shift_type = data.shift_type
    if data.joining_date is not None:
        staff.joining_date = data.joining_date
    if data.notes is not None:
        staff.notes = data.notes

    if data.department_id is not None:
        if current_user.role == Role.manager and current_user.department_id is not None:
            pass  # Keep scoped
        else:
            staff.department_id = data.department_id

    if data.assigned_room_ids is not None:
        staff.assigned_room_ids = data.assigned_room_ids
        if data.assigned_room_ids and not staff.assigned_room_id:
            staff.assigned_room_id = data.assigned_room_ids[0]

    if data.assigned_room_id is not None:
        if data.assigned_room_id == 0:
            staff.assigned_room_id = None
        else:
            room = db.query(Room).filter(Room.id == data.assigned_room_id).first()
            if not room:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room not found")
            staff.assigned_room_id = data.assigned_room_id
            # Also ensure in assigned_room_ids
            current_ids = list(staff.assigned_room_ids or [])
            if data.assigned_room_id not in current_ids:
                current_ids.append(data.assigned_room_id)
                staff.assigned_room_ids = current_ids


    # Handle login account updates / password resets
    if staff.user_id:
        user_account = db.query(User).filter(User.id == staff.user_id).first()
        if user_account:
            if data.full_name:
                user_account.name = data.full_name
            if data.password and data.password.strip():
                user_account.password_hash = hash_password(data.password)
            if data.username and data.username.strip():
                uname = data.username.strip().lower()
                dup_u = db.query(User).filter(User.username == uname, User.id != user_account.id).first()
                if dup_u:
                    raise HTTPException(status_code=400, detail=f"Username '{uname}' already taken")
                user_account.username = uname
            if data.employment_status:
                user_account.is_active = (data.employment_status == EmploymentStatus.active)
    elif data.password and data.password.strip():
        # Create a new login account for an existing staff record
        username = data.username.strip().lower() if data.username and data.username.strip() else staff.employee_code.lower()
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=400, detail=f"Username '{username}' is already in use")

        staff_role = Role.lab_staff if staff.category == StaffCategory.laboratory else Role.non_teaching_staff
        new_user = User(
            name=staff.full_name,
            username=username,
            email=staff.email if staff.email else None,
            password_hash=hash_password(data.password),
            role=staff_role,
            admin_level=None,
            department_id=staff.department_id,
            must_change_credentials=False,
            is_active=(staff.employment_status == EmploymentStatus.active),
            created_by_admin_id=current_user.id,
        )

        db.add(new_user)
        db.flush()
        staff.user_id = new_user.id

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="UPDATE_OPERATIONAL_STAFF",
        target_type="operational_staff",
        target_id=staff.id,
        details={"employee_code": staff.employee_code, "status": staff.employment_status.value},
    )

    db.commit()
    db.refresh(staff)
    return staff


def delete_operational_staff(
    db: Session,
    current_user: User,
    staff_id: int,
) -> None:
    staff = get_operational_staff(
        db, staff_id,
        tenant_dept_id=current_user.department_id if current_user.role == Role.manager else None
    )

    # Delete linked login account if present
    if staff.user_id:
        user_account = db.query(User).filter(User.id == staff.user_id).first()
        if user_account:
            db.delete(user_account)

    log_audit_event(
        db,
        actor_user_id=current_user.id,
        action="DELETE_OPERATIONAL_STAFF",
        target_type="operational_staff",
        target_id=staff.id,
        details={"employee_code": staff.employee_code, "full_name": staff.full_name},
    )

    db.delete(staff)
    db.commit()


def get_operational_stats(
    db: Session,
    tenant_dept_id: Optional[int] = None,
) -> OperationalStaffStats:
    query = db.query(OperationalStaff)
    if tenant_dept_id is not None:
        query = query.filter(
            or_(
                OperationalStaff.department_id == tenant_dept_id,
                OperationalStaff.department_id.is_(None)
            )
        )

    all_staff = query.all()
    total_staff = len(all_staff)
    total_lab_staff = sum(1 for s in all_staff if s.category == StaffCategory.laboratory)
    total_non_teaching = sum(1 for s in all_staff if s.category == StaffCategory.non_teaching)
    active_staff = sum(1 for s in all_staff if s.employment_status == EmploymentStatus.active)
    on_leave_staff = sum(1 for s in all_staff if s.employment_status == EmploymentStatus.on_leave)
    inactive_staff = sum(1 for s in all_staff if s.employment_status in (EmploymentStatus.inactive, EmploymentStatus.transferred))

    # Assigned labs
    assigned_labs = set(s.assigned_room_id for s in all_staff if s.assigned_room_id is not None)

    return OperationalStaffStats(
        total_staff=total_staff,
        total_lab_staff=total_lab_staff,
        total_non_teaching=total_non_teaching,
        active_staff=active_staff,
        on_leave_staff=on_leave_staff,
        inactive_staff=inactive_staff,
        assigned_labs_count=len(assigned_labs),
    )


def format_staff_out(staff: OperationalStaff, db: Optional[Session] = None) -> OperationalStaffOut:
    username = None
    if staff.user_id and db:
        u = db.query(User).filter(User.id == staff.user_id).first()
        if u:
            username = u.username

    room_ids = list(staff.assigned_room_ids or [])
    if staff.assigned_room_id and staff.assigned_room_id not in room_ids:
        room_ids.insert(0, staff.assigned_room_id)

    assigned_rooms = []
    if db and room_ids:
        rooms_list = db.query(Room).filter(Room.id.in_(room_ids)).all()
        for r in rooms_list:
            assigned_rooms.append({
                "id": r.id,
                "room_number": r.room_number,
                "capacity": r.capacity,
                "room_type": r.room_type.value,
                "department_name": r.department.name if r.department else "General",
            })

    return OperationalStaffOut(
        id=staff.id,
        employee_code=staff.employee_code,
        full_name=staff.full_name,
        category=staff.category,
        designation=staff.designation,
        department_id=staff.department_id,
        department_name=staff.department.name if staff.department else "Central / College-wide",
        assigned_room_id=staff.assigned_room_id,
        assigned_room_number=staff.assigned_room.room_number if staff.assigned_room else None,
        assigned_room_type=staff.assigned_room.room_type.value if staff.assigned_room else None,
        assigned_room_ids=room_ids,
        assigned_rooms=assigned_rooms,
        phone_number=staff.phone_number,
        email=staff.email,
        employment_status=staff.employment_status,
        shift_type=staff.shift_type,
        joining_date=staff.joining_date,
        user_id=staff.user_id,
        username=username,
        has_login=staff.user_id is not None,
        created_by_manager_id=staff.created_by_manager_id,
        created_by_manager_name=staff.created_by_manager.name if staff.created_by_manager else None,
        notes=staff.notes,
        created_at=staff.created_at,
        updated_at=staff.updated_at,
    )

