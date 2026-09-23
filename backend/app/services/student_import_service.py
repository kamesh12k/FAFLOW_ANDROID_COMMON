import csv
import io
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_ import Class
from app.models.academic_calendar import AcademicYear
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.class_roll_rule import (
    BulkStudentImportRow, BulkStudentImportPreviewOut, BulkStudentImportResultOut
)


class StudentImportService:
    """Handles bulk student parsing, validation, and atomic import for a class."""

    @staticmethod
    def parse_and_validate(
        db: Session,
        content: str,
        class_id: int,
        academic_year_id: Optional[int] = None
    ) -> BulkStudentImportPreviewOut:
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class ID {class_id} not found")

        # Normalize content lines
        lines = content.strip().splitlines()
        rows_out: List[BulkStudentImportRow] = []
        seen_in_file = set()

        line_num = 0
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Detect delimiter (comma, pipe, tab, semicolon)
            delim = ","
            for d in ["|", "\t", ";", ","]:
                if d in line:
                    delim = d
                    break

            parts = [p.strip() for p in line.split(delim)]
            if len(parts) < 2:
                # Could be single roll number, or header
                continue

            raw_roll = parts[0].strip().upper()
            raw_name = parts[1].strip()

            # Skip header row if matches "roll" or "name"
            if "ROLL" in raw_roll and "NAME" in raw_name.upper():
                continue

            line_num += 1

            if not raw_roll:
                rows_out.append(BulkStudentImportRow(
                    row_number=line_num,
                    roll_number="",
                    name=raw_name,
                    status="INVALID_FORMAT",
                    message="Missing roll number"
                ))
                continue

            if not raw_name:
                rows_out.append(BulkStudentImportRow(
                    row_number=line_num,
                    roll_number=raw_roll,
                    name="",
                    status="INVALID_FORMAT",
                    message="Missing student name"
                ))
                continue

            if raw_roll in seen_in_file:
                rows_out.append(BulkStudentImportRow(
                    row_number=line_num,
                    roll_number=raw_roll,
                    name=raw_name,
                    status="CONFLICT",
                    message="Duplicate roll number in uploaded file"
                ))
                continue

            seen_in_file.add(raw_roll)

            # Check if student exists in database
            existing_student = db.query(Student).filter(Student.roll_number == raw_roll).first()
            if existing_student:
                status_msg = f"Existing student '{existing_student.name}' — will be assigned to this class."
                rows_out.append(BulkStudentImportRow(
                    row_number=line_num,
                    roll_number=raw_roll,
                    name=raw_name or existing_student.name,
                    status="EXISTING_STUDENT",
                    message=status_msg
                ))
            else:
                rows_out.append(BulkStudentImportRow(
                    row_number=line_num,
                    roll_number=raw_roll,
                    name=raw_name,
                    status="VALID",
                    message="New student record will be created"
                ))

        valid_count = sum(1 for r in rows_out if r.status in ["VALID", "EXISTING_STUDENT"])
        warning_count = sum(1 for r in rows_out if r.status == "EXISTING_STUDENT")
        error_count = sum(1 for r in rows_out if r.status in ["INVALID_FORMAT", "CONFLICT"])

        return BulkStudentImportPreviewOut(
            total_rows=len(rows_out),
            valid_count=valid_count,
            warning_count=warning_count,
            error_count=error_count,
            rows=rows_out
        )

    @staticmethod
    def commit_import(
        db: Session,
        class_id: int,
        rows: List[BulkStudentImportRow],
        current_user: User,
        academic_year_id: Optional[int] = None
    ) -> BulkStudentImportResultOut:
        cls = db.query(Class).filter(Class.id == class_id).first()
        if not cls:
            raise HTTPException(status_code=404, detail=f"Class ID {class_id} not found")

        from app.services.effective_membership_service import EffectiveMembershipService
        ay = EffectiveMembershipService.get_or_resolve_academic_year(db, academic_year_id)

        created_students = 0
        created_enrollments = 0
        updated_enrollments = 0
        skipped = 0

        for r in rows:
            if r.status in ["INVALID_FORMAT", "CONFLICT"]:
                skipped += 1
                continue

            roll = r.roll_number.strip().upper()
            name = r.name.strip()

            student = db.query(Student).filter(Student.roll_number == roll).first()
            if not student:
                student = Student(
                    roll_number=roll,
                    name=name,
                    class_id=cls.id,
                    department_id=cls.department_id,
                    is_active=True
                )
                db.add(student)
                db.flush()
                created_students += 1
            else:
                student.class_id = cls.id
                if cls.department_id:
                    student.department_id = cls.department_id
                student.is_active = True
                if name:
                    student.name = name

            # Ensure StudentEnrollment
            enr = (
                db.query(StudentEnrollment)
                .filter(StudentEnrollment.student_id == student.id, StudentEnrollment.academic_year_id == ay.id)
                .first()
            )
            if not enr:
                enr = StudentEnrollment(
                    student_id=student.id,
                    academic_year_id=ay.id,
                    class_id=cls.id,
                    roll_number=roll,
                    status="active"
                )
                db.add(enr)
                created_enrollments += 1
            else:
                enr.class_id = cls.id
                enr.status = "active"
                updated_enrollments += 1

        # Audit
        try:
            audit = AuditLog(
                user_id=current_user.id,
                action="BULK_STUDENT_IMPORT",
                details=f"Imported {created_students} new students, {created_enrollments} enrollments into Class ID {cls.id}."
            )
            db.add(audit)
        except Exception:
            pass

        db.commit()

        total_enrolled = created_enrollments + updated_enrollments
        msg_parts = [f"Successfully enrolled {total_enrolled} students into {cls.name} - {cls.section}."]
        if created_students > 0:
            msg_parts.append(f"{created_students} new student profile(s) created.")
        if updated_enrollments > 0:
            msg_parts.append(f"{updated_enrollments} existing student profile(s) linked.")

        return BulkStudentImportResultOut(
            created_students=created_students,
            created_enrollments=created_enrollments,
            updated_enrollments=updated_enrollments,
            total_enrolled=total_enrolled,
            skipped_count=skipped,
            message=" ".join(msg_parts)
        )
