from sqlalchemy import Column, Integer, String, Enum, Boolean, ForeignKey, DateTime, func, CheckConstraint
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class Role(str, enum.Enum):
    system_admin = "system_admin"
    admin = "admin"
    teacher = "teacher"
    principal = "principal"
    manager = "manager"
    lab_staff = "lab_staff"
    non_teaching_staff = "non_teaching_staff"
    governance = "governance"



class AdminLevel(str, enum.Enum):
    super_admin = "super_admin"
    secondary_admin = "secondary_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    # Teachers authenticate with email; admins authenticate with username.
    # Exactly one of the two is required (enforced by chk_user_identity at
    # the DB layer, mirrored by validation in the service layer).
    email = Column(String(150), unique=True, nullable=True, index=True)
    username = Column(String(50), unique=True, nullable=True, index=True)

    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role, name="user_role", create_type=False), default=Role.teacher, nullable=False)
    admin_level = Column(Enum(AdminLevel, name="admin_level", create_type=False), nullable=True)
    department_old = Column("department", String(100), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=True)

    department_rel = relationship("Department", foreign_keys=[department_id])

    @property
    def department(self) -> str | None:
        return self.department_rel.name if self.department_rel else self.department_old

    @department.setter
    def department(self, value: str | None) -> None:
        self.department_old = value



    # First-login security: set True whenever an admin account's credentials
    # are still at a default/bootstrap value. Backend blocks all routes
    # except the first-login-setup endpoint until this is cleared.
    must_change_credentials = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    timetable_slots = relationship("TimetableSlot", back_populates="teacher")
    leave_requests = relationship("LeaveRequest", back_populates="teacher", foreign_keys="LeaveRequest.teacher_id", cascade="all, delete-orphan")
    alter_assignments = relationship("AlterAssignment", back_populates="substitute", foreign_keys="AlterAssignment.substitute_teacher_id")
    credit_transactions = relationship("CreditTransaction", back_populates="teacher", cascade="all, delete-orphan")
    credit_balance = relationship("TeacherCredit", back_populates="teacher", uselist=False, cascade="all, delete-orphan")

    # Back-references to the audit logs this user produced
    audit_logs = relationship("AuditLog", back_populates="actor", foreign_keys="AuditLog.actor_user_id")

    # Table-level constraints: enforce mutual exclusivity of email vs username,
    # and require department_id ONLY for teachers and department admins.
    __table_args__ = (
        CheckConstraint(
            "(role = 'teacher' AND email IS NOT NULL) OR "
            "(role IN ('admin', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND username IS NOT NULL)",
            name="chk_user_identity",
        ),
        CheckConstraint(
            "(role = 'admin' AND admin_level IS NOT NULL) OR "
            "(role IN ('teacher', 'system_admin', 'principal', 'manager', 'lab_staff', 'non_teaching_staff', 'governance') AND admin_level IS NULL)",
            name="chk_admin_level",
        ),
        CheckConstraint(
            "(role IN ('admin', 'teacher') AND department_id IS NOT NULL) OR "
            "(role IN ('manager', 'lab_staff', 'non_teaching_staff')) OR "
            "(role IN ('system_admin', 'principal', 'governance') AND department_id IS NULL)",
            name="chk_user_department_role",
        ),
    )




    @property
    def is_system_admin(self) -> bool:
        return self.role == Role.system_admin

    @property
    def is_governance(self) -> bool:
        return self.role == Role.governance

    @property
    def is_department_admin(self) -> bool:
        return self.role == Role.admin

    @property
    def is_super_admin(self) -> bool:
        return self.role == Role.admin and self.admin_level == AdminLevel.super_admin

    @property
    def is_secondary_admin(self) -> bool:
        return self.role == Role.admin and self.admin_level == AdminLevel.secondary_admin
