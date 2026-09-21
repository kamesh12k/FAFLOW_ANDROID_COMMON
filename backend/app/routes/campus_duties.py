from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import (
    get_current_user, require_teacher, require_admin,
    require_super_admin, get_tenant_department_id
)
from app.models.user import User, Role
from app.services.campus_duty_service import CampusDutyService
from app.schemas.campus_duty import (
    CampusAreaCreate, CampusAreaOut,
    DutyBreakPeriodCreate, DutyBreakPeriodOut,
    CampusDutyCreate, CampusDutyUpdate, CampusDutyOut,
    DutyGenerateRequest, DutyAutoAssignRequest, DutyManualAssignRequest,
    DutyOverrideRequest, DutyLockRequest, DutyReplaceRequest,
    DutyCandidateOut, DutyCandidatesResponse, DutyDashboardMetricsOut,
    DutyRulesOut, DutyRulesUpdate, DutyRulesImpactPreview
)

router = APIRouter(prefix="/campus-duties", tags=["Campus Duties"])


# ── Teacher Personal Endpoints ───────────────────────────────────────────────

@router.get("/my", response_model=List[CampusDutyOut])
def get_my_duties(
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    """Returns duties assigned to the authenticated faculty member."""
    duties = CampusDutyService.list_duties(db, target_date=target_date, teacher_id=current_user.id)
    return [CampusDutyService.to_duty_out(d) for d in duties]


# ── Configuration & Metadata ─────────────────────────────────────────────────

@router.get("/areas", response_model=List[CampusAreaOut])
def list_areas(
    is_active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return CampusDutyService.list_areas(db, is_active_only=is_active_only)


@router.post("/areas", response_model=CampusAreaOut, status_code=status.HTTP_201_CREATED)
def create_area(
    data: CampusAreaCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return CampusDutyService.create_area(db, data, user_id=current_user.id)


@router.get("/break-periods", response_model=List[DutyBreakPeriodOut])
def list_break_periods(
    is_active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return CampusDutyService.list_break_periods(db, is_active_only=is_active_only)


@router.post("/break-periods", response_model=DutyBreakPeriodOut, status_code=status.HTTP_201_CREATED)
def create_break_period(
    data: DutyBreakPeriodCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return CampusDutyService.create_break_period(db, data, user_id=current_user.id)


@router.get("/rules", response_model=DutyRulesOut)
def get_duty_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    dept_id = tenant_dept_id if tenant_dept_id is not None else current_user.department_id
    return CampusDutyService.get_rules(db, department_id=dept_id)


@router.put("/rules")
def update_duty_rules(
    data: DutyRulesUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    dept_id = tenant_dept_id if tenant_dept_id is not None else current_user.department_id
    rules, previews = CampusDutyService.update_rules(db, data, user_id=current_user.id, department_id=dept_id)
    return {
        "rules": rules,
        "impact_preview": previews
    }


# ── Dashboard & Duty Queries ─────────────────────────────────────────────────

@router.get("/metrics", response_model=DutyDashboardMetricsOut)
def get_dashboard_metrics(
    target_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    t_date = target_date or date.today()
    dept_id = tenant_dept_id if tenant_dept_id is not None else current_user.department_id
    if current_user.role in (Role.system_admin, Role.principal, Role.governance):
        dept_id = None
    return CampusDutyService.get_dashboard_metrics(db, target_date=t_date, department_id=dept_id)


@router.get("", response_model=List[CampusDutyOut])
def list_duties(
    target_date: Optional[date] = Query(None),
    duty_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    dept_id = tenant_dept_id if tenant_dept_id is not None else current_user.department_id
    if current_user.role in (Role.system_admin, Role.principal, Role.governance):
        dept_id = None
    duties = CampusDutyService.list_duties(db, target_date=target_date, duty_type=duty_type, department_id=dept_id)
    return [CampusDutyService.to_duty_out(d) for d in duties]


@router.post("", response_model=CampusDutyOut, status_code=status.HTTP_201_CREATED)
def create_duty(
    data: CampusDutyCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    if not data.department_id and tenant_dept_id:
        data.department_id = tenant_dept_id
    elif not data.department_id and current_user.department_id:
        data.department_id = current_user.department_id

    duty = CampusDutyService.create_duty(db, data, user_id=current_user.id)
    return CampusDutyService.to_duty_out(duty)


@router.post("/generate-discipline", response_model=List[CampusDutyOut])
def generate_discipline_duties(
    data: DutyGenerateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    dept_id = data.department_id or tenant_dept_id or current_user.department_id
    duties = CampusDutyService.generate_discipline_duties(db, target_date=data.target_date, department_id=dept_id, user_id=current_user.id)
    return [CampusDutyService.to_duty_out(d) for d in duties]


@router.get("/{duty_id}", response_model=CampusDutyOut)
def get_duty_detail(
    duty_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    duty = CampusDutyService.get_duty(db, duty_id)
    return CampusDutyService.to_duty_out(duty)


# ── Assignment & Operational Actions ─────────────────────────────────────────

@router.get("/{duty_id}/candidates", response_model=DutyCandidatesResponse)
def get_candidates(
    duty_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns ranked eligible faculty candidates with explainable score justifications."""
    return CampusDutyService.evaluate_candidates(db, duty_id)


@router.post("/{duty_id}/auto-assign", response_model=CampusDutyOut)
def auto_assign_duty(
    duty_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    duty = CampusDutyService.auto_assign_duty(db, duty_id, user_id=current_user.id)
    return CampusDutyService.to_duty_out(duty)


@router.post("/auto-assign-all")
def auto_assign_all_for_date(
    data: DutyAutoAssignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_dept_id: Optional[int] = Depends(get_tenant_department_id)
):
    target_date = data.target_date or date.today()
    dept_id = data.department_id or tenant_dept_id or current_user.department_id
    return CampusDutyService.auto_assign_all_for_date(db, target_date=target_date, department_id=dept_id, user_id=current_user.id)


@router.post("/{duty_id}/assign")
def manual_assign_teacher(
    duty_id: int,
    data: DutyManualAssignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = CampusDutyService.manual_assign(db, duty_id, teacher_id=data.teacher_id, user_id=current_user.id, role=data.role)
    duty = CampusDutyService.get_duty(db, duty_id)
    return CampusDutyService.to_duty_out(duty)


@router.post("/assignments/{assignment_id}/override")
def override_duty_assignment(
    assignment_id: int,
    data: DutyOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = CampusDutyService.override_assignment(db, assignment_id, new_teacher_id=data.new_teacher_id, user_id=current_user.id, reason=data.reason)
    duty = CampusDutyService.get_duty(db, assignment.duty_id)
    return CampusDutyService.to_duty_out(duty)


@router.post("/{duty_id}/lock", response_model=CampusDutyOut)
def set_duty_lock(
    duty_id: int,
    data: DutyLockRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    duty = CampusDutyService.set_lock_duty(db, duty_id, lock=data.lock, user_id=current_user.id, reason=data.reason)
    return CampusDutyService.to_duty_out(duty)


@router.post("/assignments/{assignment_id}/replace")
def replace_duty_teacher(
    assignment_id: int,
    data: DutyReplaceRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    replacement = CampusDutyService.replace_unavailable_teacher(db, assignment_id, user_id=current_user.id, reason=data.reason)
    duty = CampusDutyService.get_duty(db, replacement.duty_id)
    return CampusDutyService.to_duty_out(duty)
