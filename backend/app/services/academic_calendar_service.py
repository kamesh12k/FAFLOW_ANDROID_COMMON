from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.academic_calendar import AcademicYear, Semester
from app.models.user import User
from app.schemas.academic_calendar import AcademicYearCreate, SemesterCreate
from app.services.admin_service import log_audit_event


def list_academic_years(db: Session) -> list[AcademicYear]:
    return db.query(AcademicYear).order_by(AcademicYear.start_date.desc()).all()


def create_academic_year(data: AcademicYearCreate, actor: User, db: Session) -> AcademicYear:
    if db.query(AcademicYear).filter(AcademicYear.name == data.name).first():
        raise HTTPException(status_code=400, detail="An academic year with that name already exists")

    overlap = (
        db.query(AcademicYear)
        .filter(AcademicYear.start_date <= data.end_date, AcademicYear.end_date >= data.start_date)
        .first()
    )
    if overlap:
        raise HTTPException(status_code=400, detail=f"Date range overlaps existing academic year '{overlap.name}'")

    year = AcademicYear(name=data.name, start_date=data.start_date, end_date=data.end_date)
    db.add(year)
    db.flush()
    log_audit_event(db, actor.id, "academic_year.create", "academic_year", year.id, {"name": year.name})
    db.commit()
    db.refresh(year)
    return year


def list_semesters(db: Session, academic_year_id: int | None = None) -> list[Semester]:
    q = db.query(Semester)
    if academic_year_id:
        q = q.filter(Semester.academic_year_id == academic_year_id)
    return q.order_by(Semester.start_date.desc()).all()


def create_semester(data: SemesterCreate, actor: User, db: Session) -> Semester:
    year = db.query(AcademicYear).filter(AcademicYear.id == data.academic_year_id).first()
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")

    if data.start_date < year.start_date or data.end_date > year.end_date:
        raise HTTPException(status_code=400, detail="Semester dates must fall within the academic year's date range")

    overlap = (
        db.query(Semester)
        .filter(
            Semester.academic_year_id == data.academic_year_id,
            Semester.start_date <= data.end_date,
            Semester.end_date >= data.start_date,
        )
        .first()
    )
    if overlap:
        raise HTTPException(status_code=400, detail=f"Date range overlaps existing semester '{overlap.name}'")

    semester = Semester(
        academic_year_id=data.academic_year_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(semester)
    db.flush()
    log_audit_event(db, actor.id, "semester.create", "semester", semester.id, {"name": semester.name})
    db.commit()
    db.refresh(semester)
    return semester
