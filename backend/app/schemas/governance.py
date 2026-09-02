from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any


class EmergencyOverrideRequest(BaseModel):
    action_type: str = Field(..., min_length=2, description="Override action type identifier")
    target_id: int | None = Field(None, description="Optional entity ID being targeted")
    reason: str = Field(..., min_length=5, description="Mandatory detailed reason for the override")
    details: dict[str, Any] | None = Field(default_factory=dict)


class GovernanceSubstituteAssignRequest(BaseModel):
    leave_id: int
    substitute_teacher_id: int
    reason: str = Field(..., min_length=3, description="Mandatory reason for manual governance assignment")
    override_weekly_cap: bool = False
    override_5pm_cutoff: bool = False
    is_combined: bool = False
    combined_with_class_id: int | None = None
    combined_room_id: int | None = None

