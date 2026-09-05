from pydantic import BaseModel, EmailStr, model_validator, field_validator
from datetime import datetime
from app.models.user import Role, AdminLevel


class UserRegister(BaseModel):
    """Public self-registration — teachers only."""
    name: str
    email: EmailStr
    password: str
    department: str | None = None
    department_id: int | None = None


class UserLogin(BaseModel):
    """`identifier` accepts either a username (admins) or an email
    (teachers) so the frontend can use a single login field."""
    identifier: str
    password: str

    @field_validator("identifier")
    @classmethod
    def strip_identifier(cls, v: str) -> str:
        return v.strip() if v else v


class UserOut(BaseModel):
    id: int
    name: str
    email: str | None
    username: str | None
    role: Role
    admin_level: AdminLevel | None
    department: str | None
    department_id: int | None = None
    must_change_credentials: bool
    is_active: bool
    has_face_enrolled: bool = False
    face_enrolled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    """Admin creates a teacher account with a preset password."""
    name: str
    email: EmailStr
    password: str
    department: str | None = None
    department_id: int | None = None
    role: Role = Role.teacher

    @model_validator(mode="after")
    def teachers_only(self):
        if self.role != Role.teacher:
            raise ValueError("Use the Secondary Admin endpoint to create admin accounts")
        return self


class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    department: str | None = None
    department_id: int | None = None
    is_active: bool
    password: str | None = None


class TeacherBulkItem(BaseModel):
    name: str
    email: EmailStr
    department_id: int | None = None
    default_password: str | None = "Password123!"


class TeacherBulkCreate(BaseModel):
    teachers: list[TeacherBulkItem]
    department_id: int | None = None


class TeacherBulkCreateOut(BaseModel):
    created_count: int
    skipped_count: int
    errors: list[str] = []
    teachers: list[UserOut]


