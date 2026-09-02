from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class SubjectType(str, enum.Enum):
    theory = "theory"
    lab = "lab"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False)
    name = Column(String(150), nullable=False)
    subject_type = Column(Enum(SubjectType, name="subject_type", create_type=False), default=SubjectType.theory, nullable=False)
    credits = Column(Integer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    semester = Column(Integer, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department")

    __table_args__ = (UniqueConstraint("department_id", "code", name="uq_subject_dept_code"),)

