from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.schemas.policy import (
    CurrentPolicyOut,
    PolicyAcceptRequest,
    PolicyAcceptResponse,
    OnboardingStatusResponse,
)
from app.services import policy_service

router = APIRouter(prefix="/policy", tags=["Policy & Onboarding"])


@router.get("/current", response_model=CurrentPolicyOut)
def get_current_policy():
    """Retrieve official institutional policies, notices, and version info."""
    return policy_service.get_current_policy()


@router.post("/accept", response_model=PolicyAcceptResponse)
def accept_policy(
    request: Request,
    data: PolicyAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explicitly record user policy consent with version, timestamp, and audit trail."""
    client_ip = request.client.host if request.client else None
    updated_user = policy_service.accept_policy(current_user, data.version, db, client_ip=client_ip)
    return PolicyAcceptResponse(
        success=True,
        version_accepted=updated_user.policy_version_accepted,
        accepted_at=updated_user.policy_accepted_at,
        user=updated_user,
    )


@router.post("/onboarding/complete", response_model=OnboardingStatusResponse)
def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark role-based onboarding walkthrough as completed."""
    updated_user = policy_service.complete_onboarding(current_user, db)
    return OnboardingStatusResponse(
        success=True,
        onboarding_completed=updated_user.onboarding_completed,
        user=updated_user,
    )


@router.post("/onboarding/reset", response_model=OnboardingStatusResponse)
def reset_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reset onboarding state to allow replaying the guided tour from Help."""
    updated_user = policy_service.reset_onboarding(current_user, db)
    return OnboardingStatusResponse(
        success=True,
        onboarding_completed=updated_user.onboarding_completed,
        user=updated_user,
    )
