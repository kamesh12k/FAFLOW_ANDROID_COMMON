import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class RollExceptionType(str, enum.Enum):
    INCLUDE = "INCLUDE"
    EXCLUDE = "EXCLUDE"


class ClassRollRule(Base):
    """Defines the default primary roll range for a class in an academic year (e.g. 25UCS001-060)."""
    __tablename__ = "class_roll_rules"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True)
    prefix = Column(String(20), nullable=False)
    start_number = Column(Integer, nullable=False)
    end_number = Column(Integer, nullable=False)
    padding = Column(Integer, default=3, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    class_ = relationship("Class")
    academic_year = relationship("AcademicYear")
    created_by = relationship("User", foreign_keys=[created_by_id])
    exceptions = relationship("ClassRollException", back_populates="rule", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("class_id", "academic_year_id", name="uq_class_academic_year_rule"),
    )


class ClassRollException(Base):
    """Explicit inclusion ('Others' / Additional Students) or exclusion from a primary roll range."""
    __tablename__ = "class_roll_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    class_roll_rule_id = Column(Integer, ForeignKey("class_roll_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    roll_number = Column(String(50), nullable=False, index=True)
    exception_type = Column(String(20), nullable=False)  # 'INCLUDE' or 'EXCLUDE'
    reason = Column(String(255), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rule = relationship("ClassRollRule", back_populates="exceptions")
    student = relationship("Student")
    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        UniqueConstraint("class_roll_rule_id", "roll_number", name="uq_rule_roll_exception"),
    )
