from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User, Role
from app.models.class_ import Class
from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_roll_rule import ClassRollRule, ClassRollException, RollExceptionType
from app.models.audit_log import AuditLog
from app.schemas.class_roll_rule import (
    ClassRollRuleCreate, ClassRollRuleUpdate, ClassRollRuleOut,
    ClassRollExceptionCreate, ClassRollExceptionOut,
    EffectiveRosterOut, RollValidationPreviewOut, EffectiveStudentItem,
    BulkStudentImportPreviewOut, BulkStudentImportCommitRequest, BulkStudentImportResultOut,
    AcademicYearRolloverPreviewOut, AcademicYearRolloverExecuteRequest, AcademicYearRolloverResultOut,
    StudentUpdateInClass, ClearRosterOut
)
from app.services.effective_membership_service import EffectiveMembershipService
from app.services.rollover_service import RolloverService
from app.services.student_import_service import StudentImportService

router = APIRouter(prefix="", tags=["Class Roll Configuration & Rollover"])


def verify_class_access(current_user: User, target_class: Class):
    """Enforces that System Admins can manage any class, while Department Admins (HODs) are restricted
    strictly to classes belonging to their own department. Teachers have no management rights.
    """
    if current_user.is_system_admin:
        return
    if current_user.role == Role.admin:
        if current_user.department_id and current_user.department_id != target_class.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only configure classes within your own department."
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: Only System Administrators and Department Admins can configure class roll numbers."
    )


# 1. Roll Rule Endpoints
@router.get("/classes/{class_id}/roll-rule", response_model=Optional[ClassRollRuleOut])
def get_class_roll_rule(
    class_id: int,
    academic_year_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    ay = EffectiveMembershipService.get_or_resolve_academic_year(db, academic_year_id)
    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id, ClassRollRule.is_active == True)
        .first()
    )
    if not rule:
        return None

    # Load exceptions with student names if mapped
    exceptions = db.query(ClassRollException).filter(ClassRollException.class_roll_rule_id == rule.id).all()
    ex_outs = []
    for ex in exceptions:
        st_name = ex.student.name if ex.student else None
        if not st_name:
            st = db.query(Student).filter(Student.roll_number == ex.roll_number).first()
            if st:
                st_name = st.name
        ex_outs.append(
            ClassRollExceptionOut(
                id=ex.id,
                class_roll_rule_id=ex.class_roll_rule_id,
                roll_number=ex.roll_number,
                exception_type=ex.exception_type,
                reason=ex.reason,
                student_id=ex.student_id,
                student_name=st_name,
                created_at=ex.created_at
            )
        )

    return ClassRollRuleOut(
        id=rule.id,
        class_id=rule.class_id,
        academic_year_id=rule.academic_year_id,
        academic_year_name=ay.name,
        prefix=rule.prefix,
        start_number=rule.start_number,
        end_number=rule.end_number,
        padding=rule.padding,
        is_active=rule.is_active,
        created_by_id=rule.created_by_id,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        exceptions=ex_outs
    )


@router.post("/classes/{class_id}/roll-rule", response_model=ClassRollRuleOut, status_code=status.HTTP_200_OK)
def create_or_update_roll_rule(
    class_id: int,
    payload: ClassRollRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    verify_class_access(current_user, target_class)

    ay = EffectiveMembershipService.get_or_resolve_academic_year(db, payload.academic_year_id)

    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id)
        .first()
    )

    clean_prefix = payload.prefix.strip().upper()
    if not rule:
        rule = ClassRollRule(
            class_id=class_id,
            academic_year_id=ay.id,
            prefix=clean_prefix,
            start_number=payload.start_number,
            end_number=payload.end_number,
            padding=payload.padding,
            is_active=payload.is_active,
            created_by_id=current_user.id
        )
        db.add(rule)
    else:
        rule.prefix = clean_prefix
        rule.start_number = payload.start_number
        rule.end_number = payload.end_number
        rule.padding = payload.padding
        rule.is_active = payload.is_active

    # Audit log
    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="CONFIGURE_CLASS_ROLL_RULE",
            details=f"Configured roll rule for Class '{target_class.name}': {clean_prefix}{payload.start_number:03d}-{payload.end_number:03d}"
        )
        db.add(audit)
    except Exception:
        pass

    db.commit()
    db.refresh(rule)

    return ClassRollRuleOut(
        id=rule.id,
        class_id=rule.class_id,
        academic_year_id=rule.academic_year_id,
        academic_year_name=ay.name,
        prefix=rule.prefix,
        start_number=rule.start_number,
        end_number=rule.end_number,
        padding=rule.padding,
        is_active=rule.is_active,
        created_by_id=rule.created_by_id,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        exceptions=[]
    )


# 2. Exceptions Endpoints ('Others' INCLUDE / EXCLUDE)
@router.post("/classes/{class_id}/roll-exceptions", response_model=ClassRollExceptionOut, status_code=status.HTTP_201_CREATED)
def add_roll_exception(
    class_id: int,
    payload: ClassRollExceptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    verify_class_access(current_user, target_class)

    ay = EffectiveMembershipService.get_or_resolve_academic_year(db)
    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id)
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=400,
            detail="Cannot add exceptions before configuring a primary roll rule for this class."
        )

    clean_roll = payload.roll_number.strip().upper()

    # Find student if exists
    student = db.query(Student).filter(Student.roll_number == clean_roll).first()

    # Check for existing exception on this rule
    existing = (
        db.query(ClassRollException)
        .filter(ClassRollException.class_roll_rule_id == rule.id, ClassRollException.roll_number == clean_roll)
        .first()
    )
    if existing:
        existing.exception_type = payload.exception_type
        existing.reason = payload.reason
        existing.student_id = student.id if student else None
        db.commit()
        db.refresh(existing)
        return ClassRollExceptionOut(
            id=existing.id,
            class_roll_rule_id=existing.class_roll_rule_id,
            roll_number=existing.roll_number,
            exception_type=existing.exception_type,
            reason=existing.reason,
            student_id=existing.student_id,
            student_name=student.name if student else None,
            created_at=existing.created_at
        )

    new_ex = ClassRollException(
        class_roll_rule_id=rule.id,
        roll_number=clean_roll,
        exception_type=payload.exception_type,
        reason=payload.reason,
        student_id=student.id if student else None,
        created_by_id=current_user.id
    )
    db.add(new_ex)

    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="ADD_ROLL_EXCEPTION",
            details=f"Added {payload.exception_type} exception for roll '{clean_roll}' in Class '{target_class.name}'. Reason: {payload.reason}"
        )
        db.add(audit)
    except Exception:
        pass

    db.commit()
    db.refresh(new_ex)

    return ClassRollExceptionOut(
        id=new_ex.id,
        class_roll_rule_id=new_ex.class_roll_rule_id,
        roll_number=new_ex.roll_number,
        exception_type=new_ex.exception_type,
        reason=new_ex.reason,
        student_id=new_ex.student_id,
        student_name=student.name if student else None,
        created_at=new_ex.created_at
    )


@router.delete("/classes/{class_id}/roll-exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roll_exception(
    class_id: int,
    exception_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    verify_class_access(current_user, target_class)

    ex = db.query(ClassRollException).filter(ClassRollException.id == exception_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exception not found")

    db.delete(ex)
    db.commit()


# 3. Effective Class Membership & Validation Roster
@router.get("/classes/{class_id}/effective-roster", response_model=EffectiveRosterOut)
def get_effective_class_roster(
    class_id: int,
    academic_year_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns authoritative resolved class students from primary range, includes, and excludes."""
    return EffectiveMembershipService.resolve_class_students(db, class_id, academic_year_id)


@router.patch("/classes/{class_id}/students/{student_id}", response_model=EffectiveStudentItem)
def update_student_in_class(
    class_id: int,
    student_id: int,
    payload: StudentUpdateInClass,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    verify_class_access(current_user, target_class)

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    old_roll = student.roll_number

    if payload.roll_number:
        new_roll = payload.roll_number.strip().upper()
        if new_roll != old_roll:
            existing = db.query(Student).filter(Student.roll_number == new_roll, Student.id != student_id).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Roll number '{new_roll}' is already in use by student '{existing.name}'."
                )
            student.roll_number = new_roll
            # Update associated student enrollments
            db.query(StudentEnrollment).filter(StudentEnrollment.student_id == student.id).update({"roll_number": new_roll})
            # Update any exceptions referencing the old roll
            db.query(ClassRollException).filter(ClassRollException.roll_number == old_roll).update({"roll_number": new_roll})

    if payload.name:
        student.name = payload.name.strip()

    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="UPDATE_STUDENT_IN_CLASS",
            details=f"Updated student {student_id} ({student.roll_number}, {student.name}) in Class '{target_class.name}'"
        )
        db.add(audit)
    except Exception:
        pass

    db.commit()
    db.refresh(student)

    # Determine source tag
    ay = EffectiveMembershipService.get_or_resolve_academic_year(db)
    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id, ClassRollRule.is_active == True)
        .first()
    )
    src = "PRIMARY_RANGE"
    if rule:
        padding = rule.padding or 3
        expected = {f"{rule.prefix.strip().upper()}{str(n).zfill(padding)}" for n in range(rule.start_number, rule.end_number + 1)}
        if student.roll_number not in expected:
            src = "ADDITIONAL"

    return EffectiveStudentItem(
        id=student.id,
        roll_number=student.roll_number,
        roll_suffix=student.roll_suffix,
        name=student.name,
        is_active=student.is_active,
        source=src
    )


@router.delete("/classes/{class_id}/students/{student_id}", status_code=status.HTTP_200_OK)
def delete_student_from_class(
    class_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    verify_class_access(current_user, target_class)

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    ay = EffectiveMembershipService.get_or_resolve_academic_year(db)
    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id, ClassRollRule.is_active == True)
        .first()
    )

    roll = student.roll_number.strip().upper()

    # If student is part of the primary roll range, add an EXCLUDE exception so the range generator ignores it
    if rule:
        padding = rule.padding or 3
        expected = {f"{rule.prefix.strip().upper()}{str(n).zfill(padding)}" for n in range(rule.start_number, rule.end_number + 1)}
        if roll in expected:
            ex = (
                db.query(ClassRollException)
                .filter(ClassRollException.class_roll_rule_id == rule.id, ClassRollException.roll_number == roll)
                .first()
            )
            if not ex:
                ex = ClassRollException(
                    class_roll_rule_id=rule.id,
                    roll_number=roll,
                    exception_type="EXCLUDE",
                    reason="Removed from class roster",
                    student_id=student.id,
                    created_by_id=current_user.id
                )
                db.add(ex)
            else:
                ex.exception_type = "EXCLUDE"
                ex.reason = "Removed from class roster"

        # Also remove any INCLUDE exception for this roll
        db.query(ClassRollException).filter(
            ClassRollException.class_roll_rule_id == rule.id,
            ClassRollException.roll_number == roll,
            ClassRollException.exception_type == "INCLUDE"
        ).delete()

    # Deactivate or delete student record
    has_attendance = False
    try:
        from app.models.student_attendance import StudentAttendance
        att_count = db.query(StudentAttendance).filter(StudentAttendance.student_id == student.id).count()
        has_attendance = att_count > 0
    except Exception:
        pass

    if has_attendance:
        student.is_active = False
    else:
        db.delete(student)

    # Delete enrollments for this class
    db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == student_id,
        StudentEnrollment.class_id == class_id
    ).delete()

    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="DELETE_STUDENT_FROM_CLASS",
            details=f"Removed student '{roll}' ({student.name}) from Class '{target_class.name}'"
        )
        db.add(audit)
    except Exception:
        pass

    db.commit()
    return {"message": f"Student '{roll}' removed successfully from class."}


@router.post("/classes/{class_id}/roster/clear-all", response_model=ClearRosterOut, status_code=status.HTTP_200_OK)
def clear_all_class_students(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    verify_class_access(current_user, target_class)

    # 1. Clear all roll rules and exceptions for this class
    rules = db.query(ClassRollRule).filter(ClassRollRule.class_id == class_id).all()
    for rule in rules:
        db.query(ClassRollException).filter(ClassRollException.class_roll_rule_id == rule.id).delete()
        db.delete(rule)

    # 2. Clear all students assigned to this class
    class_students = db.query(Student).filter(Student.class_id == class_id).all()
    cleared_count = len(class_students)

    from app.models.student_attendance import StudentAttendance
    for s in class_students:
        att_count = db.query(StudentAttendance).filter(StudentAttendance.student_id == s.id).count()
        if att_count > 0:
            s.is_active = False
        else:
            db.delete(s)

    # 3. Delete student enrollments for this class
    db.query(StudentEnrollment).filter(StudentEnrollment.class_id == class_id).delete()

    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="CLEAR_ALL_CLASS_STUDENTS",
            details=f"Cleared roll rules, exceptions, and {cleared_count} students for Class '{target_class.name}'"
        )
        db.add(audit)
    except Exception:
        pass

    db.commit()
    return ClearRosterOut(
        message=f"Successfully cleared all roll rules, exceptions, and {cleared_count} students from class.",
        cleared_count=cleared_count
    )


@router.delete("/classes/{class_id}/roll-rule", status_code=status.HTTP_200_OK)
def delete_class_roll_rule(
    class_id: int,
    academic_year_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    verify_class_access(current_user, target_class)

    ay = EffectiveMembershipService.get_or_resolve_academic_year(db, academic_year_id)
    rule = (
        db.query(ClassRollRule)
        .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id)
        .first()
    )
    if rule:
        db.query(ClassRollException).filter(ClassRollException.class_roll_rule_id == rule.id).delete()
        db.delete(rule)
        db.commit()

    return {"message": "Roll rule and exceptions deleted successfully."}



# 4. Bulk Student Import Endpoints
@router.post("/classes/{class_id}/students/import/preview", response_model=BulkStudentImportPreviewOut)
def preview_student_import(
    class_id: int,
    content: str = Body(..., embed=True),
    academic_year_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    verify_class_access(current_user, target_class)

    return StudentImportService.parse_and_validate(db, content, class_id, academic_year_id)


@router.post("/classes/{class_id}/students/import/commit", response_model=BulkStudentImportResultOut)
def commit_student_import(
    class_id: int,
    payload: BulkStudentImportCommitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_class = db.query(Class).filter(Class.id == class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    verify_class_access(current_user, target_class)

    return StudentImportService.commit_import(
        db, class_id, payload.rows, current_user, payload.academic_year_id
    )


# 5. Academic Year Rollover Endpoints
@router.post("/academic-years/rollover/preview", response_model=AcademicYearRolloverPreviewOut)
def preview_academic_year_rollover(
    from_year_id: int = Query(...),
    to_year_id: int = Query(...),
    department_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # If Department Admin, enforce their department
    if current_user.role == Role.admin:
        department_id = current_user.department_id
    elif not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="Only System Admins and Department Admins can preview academic rollover.")

    return RolloverService.preview_rollover(db, from_year_id, to_year_id, department_id)


@router.post("/academic-years/rollover/execute", response_model=AcademicYearRolloverResultOut)
def execute_academic_year_rollover(
    payload: AcademicYearRolloverExecuteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return RolloverService.execute_rollover(db, payload, current_user)
