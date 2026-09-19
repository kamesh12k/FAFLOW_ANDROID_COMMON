from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class StudentEnrollment(Base):
    """Tracks a student's academic placement and membership for a specific academic year."""
    __tablename__ = "student_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True)
    roll_number = Column(String(50), nullable=False, index=True)
    status = Column(String(20), default="active", nullable=False)  # active, promoted, repeated, transferred, withdrawn, graduated
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student = relationship("Student", back_populates="enrollments")
    class_ = relationship("Class")
    academic_year = relationship("AcademicYear")

    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id", name="uq_student_academic_year"),
    )
