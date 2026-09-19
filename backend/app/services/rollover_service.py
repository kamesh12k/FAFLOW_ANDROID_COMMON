from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_roll_rule import ClassRollRule, ClassRollException
from app.models.class_ import Class
from app.models.academic_calendar import AcademicYear
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.class_roll_rule import (
    AcademicYearRolloverPreviewOut, RolloverClassProgression,
    AcademicYearRolloverExecuteRequest, AcademicYearRolloverResultOut
)


class RolloverService:
    """Handles Academic Year Rollover progression without duplicating permanent Student records."""

    @staticmethod
    def preview_rollover(
        db: Session,
        from_year_id: int,
        to_year_id: int,
        department_id: Optional[int] = None
    ) -> AcademicYearRolloverPreviewOut:
        from_year = db.query(AcademicYear).filter(AcademicYear.id == from_year_id).first()
        to_year = db.query(AcademicYear).filter(AcademicYear.id == to_year_id).first()

        if not from_year:
            raise HTTPException(status_code=404, detail=f"Source Academic Year ID {from_year_id} not found")
        if not to_year:
            raise HTTPException(status_code=404, detail=f"Target Academic Year ID {to_year_id} not found")
        if from_year_id == to_year_id:
            raise HTTPException(status_code=400, detail="Source and target academic years cannot be the same")

        # Query all classes for the target department or institution
        class_q = db.query(Class)
        if department_id:
            class_q = class_q.filter(Class.department_id == department_id)
        all_classes = class_q.order_by(Class.department_id, Class.semester, Class.name, Class.section).all()

        # Group classes by department and section to deduce progression (e.g. Year 1 -> Year 2 -> Year 3)
        progressions: List[RolloverClassProgression] = []
        total_eligible = 0
        total_review = 0

        # Build map: (department_id, section, semester) -> Class
        class_by_sem: Dict[tuple, Class] = {
            (c.department_id, c.section, c.semester): c for c in all_classes
        }

        for c in all_classes:
            # Check student count currently in this class
            # Try enrollment first, fallback to student.class_id
            enrolled_count = (
                db.query(StudentEnrollment)
                .filter(StudentEnrollment.class_id == c.id, StudentEnrollment.academic_year_id == from_year_id, StudentEnrollment.status == "active")
                .count()
            )
            if enrolled_count == 0:
                enrolled_count = db.query(Student).filter(Student.class_id == c.id, Student.is_active == True).count()

            # Attempt to find next semester/year class (e.g. sem + 2 or sem + 1)
            # Typically 2 semesters per year (Sem 1/2 -> Sem 3/4)
            next_sem_class = class_by_sem.get((c.department_id, c.section, c.semester + 2)) or class_by_sem.get((c.department_id, c.section, c.semester + 1))

            if next_sem_class:
                action = "PROMOTE"
                to_cid = next_sem_class.id
                to_cname = f"{next_sem_class.name} - {next_sem_class.section}"
            else:
                # Top semester in department: Graduation
                action = "GRADUATE"
                to_cid = None
                to_cname = "Graduated Batch"

            total_eligible += enrolled_count
            progressions.append(
                RolloverClassProgression(
                    from_class_id=c.id,
                    from_class_name=f"{c.name} - {c.section}",
                    to_class_id=to_cid,
                    to_class_name=to_cname,
                    action=action,
                    eligible_count=enrolled_count,
                    review_required_count=0
                )
            )

        return AcademicYearRolloverPreviewOut(
            from_year_id=from_year.id,
            from_year_name=from_year.name,
            to_year_id=to_year.id,
            to_year_name=to_year.name,
            classes=progressions,
            total_eligible=total_eligible,
            total_review_required=total_review,
            warnings=[]
        )

    @staticmethod
    def execute_rollover(
        db: Session,
        request: AcademicYearRolloverExecuteRequest,
        current_user: User
    ) -> AcademicYearRolloverResultOut:
        to_year = db.query(AcademicYear).filter(AcademicYear.id == request.to_year_id).first()
        from_year = db.query(AcademicYear).filter(AcademicYear.id == request.from_year_id).first()
        if not to_year or not from_year:
            raise HTTPException(status_code=404, detail="Academic year not found")

        promoted_count = 0
        graduated_count = 0
        rules_copied = 0

        for prog in request.progressions:
            from_cid = prog.from_class_id
            to_cid = prog.to_class_id
            action = prog.action

            # Fetch active students currently enrolled in from_class
            enrolled_students = (
                db.query(Student)
                .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
                .filter(StudentEnrollment.class_id == from_cid, StudentEnrollment.academic_year_id == request.from_year_id)
                .all()
            )
            if not enrolled_students:
                # Fallback to direct student.class_id
                enrolled_students = db.query(Student).filter(Student.class_id == from_cid, Student.is_active == True).all()

            if action == "PROMOTE" and to_cid:
                for s in enrolled_students:
                    # Check if already enrolled in to_year
                    existing = (
                        db.query(StudentEnrollment)
                        .filter(StudentEnrollment.student_id == s.id, StudentEnrollment.academic_year_id == request.to_year_id)
                        .first()
                    )
                    if not existing:
                        enr = StudentEnrollment(
                            student_id=s.id,
                            academic_year_id=request.to_year_id,
                            class_id=to_cid,
                            roll_number=s.roll_number,
                            status="active"
                        )
                        db.add(enr)
                        promoted_count += 1
                    else:
                        existing.class_id = to_cid
                        existing.status = "active"

                    # Keep legacy column synchronized
                    s.class_id = to_cid

                # Copy and adjust ClassRollRule if present
                from_rule = (
                    db.query(ClassRollRule)
                    .filter(ClassRollRule.class_id == from_cid, ClassRollRule.academic_year_id == request.from_year_id)
                    .first()
                )
                if from_rule:
                    to_rule = (
                        db.query(ClassRollRule)
                        .filter(ClassRollRule.class_id == to_cid, ClassRollRule.academic_year_id == request.to_year_id)
                        .first()
                    )
                    if not to_rule:
                        new_rule = ClassRollRule(
                            class_id=to_cid,
                            academic_year_id=request.to_year_id,
                            prefix=from_rule.prefix,
                            start_number=from_rule.start_number,
                            end_number=from_rule.end_number,
                            padding=from_rule.padding,
                            is_active=True,
                            created_by_id=current_user.id
                        )
                        db.add(new_rule)
                        rules_copied += 1

            elif action == "GRADUATE":
                for s in enrolled_students:
                    existing = (
                        db.query(StudentEnrollment)
                        .filter(StudentEnrollment.student_id == s.id, StudentEnrollment.academic_year_id == request.to_year_id)
                        .first()
                    )
                    if not existing:
                        enr = StudentEnrollment(
                            student_id=s.id,
                            academic_year_id=request.to_year_id,
                            class_id=from_cid,
                            roll_number=s.roll_number,
                            status="graduated"
                        )
                        db.add(enr)
                        graduated_count += 1

        # Audit log
        try:
            audit = AuditLog(
                user_id=current_user.id,
                action="ACADEMIC_YEAR_ROLLOVER",
                details=(
                    f"Rolled over from '{from_year.name}' to '{to_year.name}': "
                    f"{promoted_count} promoted, {graduated_count} graduated, {rules_copied} rules configured."
                )
            )
            db.add(audit)
        except Exception:
            pass

        db.commit()

        return AcademicYearRolloverResultOut(
            promoted_students=promoted_count,
            graduated_students=graduated_count,
            rules_copied=rules_copied,
            message=f"Successfully executed rollover for {to_year.name}."
        )
