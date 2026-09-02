from pydantic import BaseModel
from datetime import datetime


class DepartmentCreate(BaseModel):
    name: str
    code: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
