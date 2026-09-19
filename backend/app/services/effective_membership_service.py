from typing import List, Optional, Tuple, Dict, Set
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.class_roll_rule import ClassRollRule, ClassRollException, RollExceptionType
from app.models.class_ import Class
from app.models.academic_calendar import AcademicYear
from app.schemas.class_roll_rule import (
    EffectiveRosterOut, EffectiveStudentItem, RollValidationPreviewOut
)


class EffectiveMembershipService:
    """Authoritative service for resolving effective class membership from roll rules,

    enrollments, and explicit exceptions.
    """

    @staticmethod
    def get_or_resolve_academic_year(db: Session, academic_year_id: Optional[int] = None) -> AcademicYear:
        if academic_year_id:
            ay = db.query(AcademicYear).filter(AcademicYear.id == academic_year_id).first()
            if not ay:
                raise HTTPException(status_code=404, detail=f"Academic Year ID {academic_year_id} not found")
            return ay

        # Default to current active academic year, or the latest
        ay = db.query(AcademicYear).filter(AcademicYear.is_active == True).order_by(AcademicYear.start_date.desc()).first()
        if not ay:
            ay = db.query(AcademicYear).order_by(AcademicYear.start_date.desc()).first()
        if not ay:
            # Fallback: create default 2026-2027 if none exists
            ay = AcademicYear(name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31), is_active=True)
            db.add(ay)
            db.commit()
            db.refresh(ay)
        return ay

    @classmethod
    def resolve_class_students(
        cls,
        db: Session,
        class_id: int,
        academic_year_id: Optional[int] = None
    ) -> EffectiveRosterOut:
        target_class = db.query(Class).filter(Class.id == class_id).first()
        if not target_class:
            raise HTTPException(status_code=404, detail=f"Class ID {class_id} not found")

        ay = cls.get_or_resolve_academic_year(db, academic_year_id)

        # 1. Fetch active roll rule
        rule = (
            db.query(ClassRollRule)
            .filter(ClassRollRule.class_id == class_id, ClassRollRule.academic_year_id == ay.id, ClassRollRule.is_active == True)
            .first()
        )

        expected_rolls: List[str] = []
        prefix = ""
        start_num = 0
        end_num = 0
        include_exceptions: List[ClassRollException] = []
        exclude_exceptions: List[ClassRollException] = []

        if rule:
            prefix = rule.prefix.strip().upper()
            start_num = rule.start_number
            end_num = rule.end_number
            padding = rule.padding or 3
            for n in range(start_num, end_num + 1):
                expected_rolls.append(f"{prefix}{str(n).zfill(padding)}")

            exceptions = db.query(ClassRollException).filter(ClassRollException.class_roll_rule_id == rule.id).all()
            for ex in exceptions:
                if ex.exception_type == RollExceptionType.INCLUDE.value:
                    include_exceptions.append(ex)
                elif ex.exception_type == RollExceptionType.EXCLUDE.value:
                    exclude_exceptions.append(ex)

        include_rolls_set: Set[str] = {ex.roll_number.strip().upper() for ex in include_exceptions}
        exclude_rolls_set: Set[str] = {ex.roll_number.strip().upper() for ex in exclude_exceptions}

        # Check for include/exclude conflicts
        conflicts: List[str] = []
        overlap_exceptions = include_rolls_set.intersection(exclude_rolls_set)
        for ov in overlap_exceptions:
            conflicts.append(f"Roll {ov} is marked as both INCLUDE and EXCLUDE")

        # Range overlap detection with sibling classes in same academic year
        if rule:
            sibling_rules = (
                db.query(ClassRollRule)
                .join(Class, Class.id == ClassRollRule.class_id)
                .filter(
                    ClassRollRule.academic_year_id == ay.id,
                    ClassRollRule.class_id != class_id,
                    ClassRollRule.prefix == rule.prefix,
                    ClassRollRule.is_active == True,
                    Class.department_id == target_class.department_id
                )
                .all()
            )
            for sr in sibling_rules:
                # Check numeric interval overlap
                if not (rule.end_number < sr.start_number or rule.start_number > sr.end_number):
                    conflicts.append(
                        f"Range {rule.prefix}{rule.start_number:03d}-{rule.end_number:03d} overlaps with "
                        f"Class '{sr.class_.name} - {sr.class_.section}' ({sr.prefix}{sr.start_number:03d}-{sr.end_number:03d})"
                    )

        # 2. Determine target roll numbers: (Primary Range + INCLUDE) - EXCLUDE
        target_roll_set = (set(expected_rolls) | include_rolls_set) - exclude_rolls_set

        # 3. Query existing students in database for these roll numbers
        students_by_roll: Dict[str, Student] = {}
        if target_roll_set:
            matched_students = db.query(Student).filter(Student.roll_number.in_(list(target_roll_set))).all()
            students_by_roll = {s.roll_number.strip().upper(): s for s in matched_students}

        # Also fallback: if no rule exists yet, query direct class_id students for legacy/backward compatibility
        if not rule and not target_roll_set:
            legacy_students = (
                db.query(Student)
                .filter(Student.class_id == class_id, Student.is_active == True)
                .order_by(Student.roll_number)
                .all()
            )
            for s in legacy_students:
                students_by_roll[s.roll_number.strip().upper()] = s
                target_roll_set.add(s.roll_number.strip().upper())

        # 4. Check for missing students (expected in range or included, but not found in DB)
        missing_rolls: List[str] = []
        for r in sorted(list(target_roll_set)):
            if r not in students_by_roll:
                missing_rolls.append(r)

        warnings: List[str] = []
        if missing_rolls:
            warnings.append(f"{len(missing_rolls)} roll numbers in configuration do not have Student records in database.")

        # 5. Build Effective Student Items
        resolved_items: List[EffectiveStudentItem] = []
        for r in sorted(list(target_roll_set)):
            student = students_by_roll.get(r)
            if student and student.is_active:
                src = "ADDITIONAL" if r in include_rolls_set else "PRIMARY_RANGE"
                resolved_items.append(
                    EffectiveStudentItem(
                        id=student.id,
                        roll_number=student.roll_number,
                        roll_suffix=student.roll_suffix,
                        name=student.name,
                        is_active=student.is_active,
                        source=src
                    )
                )

        validation = RollValidationPreviewOut(
            class_id=target_class.id,
            class_name=target_class.name,
            academic_year_id=ay.id,
            academic_year_name=ay.name,
            prefix=prefix,
            start_number=start_num,
            end_number=end_num,
            expected_count=len(expected_rolls),
            found_count=len(students_by_roll),
            missing_rolls=missing_rolls,
            additional_rolls=sorted(list(include_rolls_set)),
            excluded_rolls=sorted(list(exclude_rolls_set)),
            effective_count=len(resolved_items),
            warnings=warnings,
            conflicts=conflicts
        )

        return EffectiveRosterOut(
            class_id=target_class.id,
            class_name=target_class.name,
            section=target_class.section,
            department_id=target_class.department_id,
            academic_year_id=ay.id,
            academic_year_name=ay.name,
            total_effective=len(resolved_items),
            students=resolved_items,
            validation=validation
        )
