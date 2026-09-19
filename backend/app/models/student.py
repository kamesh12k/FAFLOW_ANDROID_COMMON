from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Student(Base):
    """Student master entity integrated with classes and departments."""
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    admission_year = Column(Integer, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    class_ = relationship("Class")
    department = relationship("Department")
    attendance_records = relationship("StudentAttendance", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="student", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("class_id", "roll_number", name="uq_class_roll_number"),
    )

    @property
    def roll_suffix(self) -> str:
        """Returns the last 3 characters/digits of roll number for teacher quick-entry."""
        return self.roll_number[-3:] if len(self.roll_number) >= 3 else self.roll_number
