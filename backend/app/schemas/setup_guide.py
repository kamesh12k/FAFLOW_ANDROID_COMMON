from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SetupStepPrerequisite(BaseModel):
    id: str
    title: str
    is_satisfied: bool
    required_count: int = 1
    current_count: int = 0
    message: Optional[str] = None


class SetupStepOut(BaseModel):
    id: str
    step_number: int
    title: str
    category: str  # foundation, structure, curriculum, scheduling, operations
    why_required: str
    what_depends_on_it: List[str]
    required_fields: List[str]
    config_url: str
    action_text: str
    current_count: int
    unit_label: str
    status: str  # ready, in_progress, not_started, blocked
    is_complete: bool
    is_blocked: bool
    prerequisites: List[SetupStepPrerequisite] = []
    block_reason: Optional[str] = None


class ModuleReadinessOut(BaseModel):
    id: str
    name: str
    description: str
    status: str  # READY, PARTIALLY_READY, NOT_READY
    status_label: str
    route_url: str
    action_text: str
    requirements: List[SetupStepPrerequisite] = []
    missing_prerequisites: List[str] = []


class DataFlowNodeOut(BaseModel):
    id: str
    label: str
    category: str
    purpose: str
    used_by: List[str]
    current_count: int
    config_url: str


class DataFlowEdgeOut(BaseModel):
    from_node: str
    to_node: str
    relationship: str
    is_hard_dependency: bool


class DataFlowGraphOut(BaseModel):
    nodes: List[DataFlowNodeOut]
    edges: List[DataFlowEdgeOut]


class SetupReadinessResponse(BaseModel):
    total_steps: int
    completed_steps: int
    progress_percent: int
    overall_status: str  # ready, in_progress, setup_required
    next_recommended_step: Optional[SetupStepOut] = None
    steps: List[SetupStepOut]
    module_readiness: List[ModuleReadinessOut]
    data_flow: DataFlowGraphOut
