from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserOut


class PolicySection(BaseModel):
    id: str
    title: str
    content: str
    required: bool = True


class CurrentPolicyOut(BaseModel):
    version: str
    effective_date: str
    sections: list[PolicySection]


class PolicyAcceptRequest(BaseModel):
    version: str


class PolicyAcceptResponse(BaseModel):
    success: bool
    version_accepted: str
    accepted_at: datetime
    user: UserOut


class OnboardingStatusResponse(BaseModel):
    success: bool
    onboarding_completed: bool
    user: UserOut
