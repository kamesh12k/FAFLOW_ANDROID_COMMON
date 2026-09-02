from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.database import get_db
from app.core.dependencies import require_admin, require_super_admin, require_teacher, get_current_user, get_tenant_department_id
from app.models.user import User, Role
from app.models.department import Department
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.services.system_setting_service import get_setting, set_setting
from app.services.admin_service import log_audit_event
from app.schemas.substitution import (
    CampusOperationsModeOut, CampusOperationsModeSet,
    SubstitutionPreferenceOut, SubstitutionPreferenceUpdate,
    SystemAnalyticsOut, DepartmentAnalyticsSummary,
    DryRunRequest, DryRunResponse, BulkConfigSet,
)
from app.services import substitution_service

router = APIRouter(prefix="/campus-operations", tags=["Campus Operations"])


@router.get("/cross-department-substitutions")
def get_cross_department_substitutions(admin: User = Depends(require_admin), db: Session = Depends(get_db), tenant_department_id: int | None = Depends(get_tenant_department_id)):
    dept_id = tenant_department_id if tenant_department_id is not None else admin.department_id
    return {"enabled": substitution_service.cross_department_substitutions_enabled(db, dept_id)}


@router.put("/cross-department-substitutions")
def set_cross_department_substitutions(enabled: bool, admin: User = Depends(require_super_admin), db: Session = Depends(get_db), tenant_department_id: int | None = Depends(get_tenant_department_id)):
    dept_id = tenant_department_id if tenant_department_id is not None else admin.department_id
    if dept_id is None and not admin.is_system_admin:
        raise HTTPException(400, "A department context is required")
    set_setting(db, "cross_department_substitutions_enabled", "true" if enabled else "false", dept_id)
    log_audit_event(db, admin.id, "substitution.cross_department_policy_changed", "system_setting", None, {"enabled": enabled, "department_id": dept_id})
    db.commit()
    return {"enabled": enabled}


@router.get("/mode", response_model=CampusOperationsModeOut)
def get_mode(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    effective_mode = substitution_service.get_mode(db, tenant_department_id)
    configured_mode = substitution_service.get_configured_mode(db, tenant_department_id)
    global_override = substitution_service.get_global_override(db)
    is_overridden = global_override in {"manual", "assisted", "autonomous"}
    
    return CampusOperationsModeOut(
        mode=effective_mode,
        configured_mode=configured_mode,
        global_override=global_override,
        is_overridden=is_overridden,
    )


@router.put("/mode", response_model=CampusOperationsModeOut)
def set_mode(
    data: CampusOperationsModeSet,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Switching modes or overriding them system-wide."""
    is_sys_admin = admin.is_system_admin
    
    if data.global_override is not None:
        if not is_sys_admin:
            raise HTTPException(status_code=403, detail="Only System Admin can set global override")
        substitution_service.set_global_override(db, data.global_override, admin)
        
    if data.mode is not None:
        substitution_service.set_mode(db, data.mode, admin, tenant_department_id)
        
    db.commit()
    
    effective_mode = substitution_service.get_mode(db, tenant_department_id)
    configured_mode = substitution_service.get_configured_mode(db, tenant_department_id)
    global_override = substitution_service.get_global_override(db)
    is_overridden = global_override in {"manual", "assisted", "autonomous"}
    
    return CampusOperationsModeOut(
        mode=effective_mode,
        configured_mode=configured_mode,
        global_override=global_override,
        is_overridden=is_overridden,
    )



@router.get("/preferences/me", response_model=SubstitutionPreferenceOut)
def get_my_preferences(
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return substitution_service.get_or_create_preferences(db, teacher.id)


@router.put("/preferences/me", response_model=SubstitutionPreferenceOut)
def update_my_preferences(
    data: SubstitutionPreferenceUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return substitution_service.update_preferences(db, teacher.id, **data.model_dump(exclude_unset=True))


@router.get("/preferences/{teacher_id}", response_model=SubstitutionPreferenceOut)
def get_teacher_preferences(
    teacher_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Admin view of any teacher's preferences — read-only; a teacher's
    own preferences belong to them, admins can see but not edit them
    here. Disabling/adjusting a teacher's auto-assignment eligibility as
    an admin action goes through the Teachers screen, not this endpoint."""
    if tenant_department_id is not None:
        teacher = db.query(User).filter(User.id == teacher_id).first()
        if not teacher or teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied: teacher belongs to another department")
    return substitution_service.get_or_create_preferences(db, teacher_id)


@router.get("/system-analytics", response_model=SystemAnalyticsOut)
def get_system_analytics(
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if not super_admin.is_system_admin:
        raise HTTPException(status_code=403, detail="Only System Admin can access system analytics")
        
    total_depts = db.query(Department).count()
    total_users = db.query(User).filter(User.is_active == True).count()
    
    today_date = date.today()
    
    # Active leaves count today = approved leaves count today (representing Leave Periods)
    active_leaves_today_query = db.query(LeaveRequest).filter(LeaveRequest.date == today_date, LeaveRequest.status == LeaveStatus.approved)
    active_leaves_today = active_leaves_today_query.count()
    
    # Distinct teachers on leave today
    teachers_on_leave_today = db.query(LeaveRequest.teacher_id).filter(
        LeaveRequest.date == today_date, LeaveRequest.status == LeaveStatus.approved
    ).distinct().count()
    
    # Covered leaves count today = approved leaves with AlterAssignment
    covered_leaves_today = db.query(LeaveRequest).join(AlterAssignment).filter(
        LeaveRequest.date == today_date, LeaveRequest.status == LeaveStatus.approved
    ).count()
    
    pending_leaves_today = db.query(LeaveRequest).filter(
        LeaveRequest.date == today_date, LeaveRequest.status == LeaveStatus.pending
    ).count()
    
    overall_coverage_rate = 100.0
    if active_leaves_today > 0:
        overall_coverage_rate = round((covered_leaves_today / active_leaves_today) * 100.0, 1)
        
    thirty_days_ago = today_date - timedelta(days=30)
    recent_transactions_count = db.query(AlterAssignment).filter(AlterAssignment.assigned_at >= thirty_days_ago).count()
    
    total_assignments = db.query(AlterAssignment).count()
    auto_assigned_count = db.query(AlterAssignment).filter(AlterAssignment.assignment_type.in_([AssignmentType.auto_assigned, AssignmentType.emergency])).count()
    auto_assigned_percentage = 0.0
    if total_assignments > 0:
        auto_assigned_percentage = round((auto_assigned_count / total_assignments) * 100.0, 1)
        
    depts = db.query(Department).all()
    dept_summaries = []
    for dept in depts:
        mode = substitution_service.get_mode(db, dept.id)
        teacher_self_mgmt = get_setting(db, "teacher_self_management_enabled", "false", dept.id) == "true"
        
        # Dept active leaves = approved leaves today in dept
        dept_active_leaves = db.query(LeaveRequest).join(User).filter(
            LeaveRequest.date == today_date,
            LeaveRequest.status == LeaveStatus.approved,
            User.department_id == dept.id
        ).count()
        
        # Dept covered leaves = approved leaves with AlterAssignment today in dept
        dept_covered_leaves = db.query(LeaveRequest).join(AlterAssignment).join(User, LeaveRequest.teacher_id == User.id).filter(
            LeaveRequest.date == today_date,
            LeaveRequest.status == LeaveStatus.approved,
            User.department_id == dept.id
        ).count()
        
        # Dept teachers on leave = unique teachers on approved leave today in dept
        dept_teachers_on_leave = db.query(LeaveRequest.teacher_id).join(User).filter(
            LeaveRequest.date == today_date,
            LeaveRequest.status == LeaveStatus.approved,
            User.department_id == dept.id
        ).distinct().count()
        
        dept_summaries.append(
            DepartmentAnalyticsSummary(
                department_id=dept.id,
                department_name=dept.name,
                department_code=dept.code or "",
                mode=mode,
                teacher_self_management_enabled=teacher_self_mgmt,
                active_leaves_count=dept_active_leaves,
                covered_leaves_count=dept_covered_leaves,
                teachers_on_leave_today_count=dept_teachers_on_leave,
                leave_periods_today_count=dept_active_leaves,
                covered_periods_today_count=dept_covered_leaves,
                pending_coverage_today_count=max(0, dept_active_leaves - dept_covered_leaves)
            )
        )
        
    return SystemAnalyticsOut(
        total_departments=total_depts,
        total_registered_users=total_users,
        active_leaves_today=active_leaves_today,
        covered_leaves_today=covered_leaves_today,
        pending_leaves_today=pending_leaves_today,
        overall_coverage_rate=overall_coverage_rate,
        recent_transactions_count=recent_transactions_count,
        auto_assigned_percentage=auto_assigned_percentage,
        department_summaries=dept_summaries,
        teachers_on_leave_today=teachers_on_leave_today,
        leave_periods_today=active_leaves_today,
        covered_periods_today=covered_leaves_today,
        pending_coverage_today=max(0, active_leaves_today - covered_leaves_today)
    )


@router.post("/dry-run", response_model=DryRunResponse)
def run_dry_run(
    data: DryRunRequest,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if not super_admin.is_system_admin:
        raise HTTPException(status_code=403, detail="Only System Admin can run simulations")
    res = substitution_service.run_dry_run_simulation(db, data.start_date, data.end_date, data.department_id)
    return res


@router.post("/bulk-config")
def bulk_config(
    data: BulkConfigSet,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if not super_admin.is_system_admin:
        raise HTTPException(status_code=403, detail="Only System Admin can bulk configure departments")
        
    for dept_id in data.department_ids:
        dept = db.query(Department).filter(Department.id == dept_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail=f"Department with ID {dept_id} not found")
            
        if data.mode is not None:
            set_setting(db, "campus_operations_mode", data.mode, dept_id)
            log_audit_event(db, super_admin.id, "campus_operations.mode_change", "system_setting", None, {"mode": data.mode, "department_id": dept_id})
            
        if data.teacher_self_management_enabled is not None:
            val_str = "true" if data.teacher_self_management_enabled else "false"
            set_setting(db, "teacher_self_management_enabled", val_str, dept_id)
            log_audit_event(db, super_admin.id, "campus_operations.teacher_self_mgmt_change", "system_setting", None, {"enabled": val_str, "department_id": dept_id})
            
    db.commit()
    return {"message": f"Successfully updated settings for {len(data.department_ids)} departments"}


@router.put("/preferences/bulk-override")
def bulk_override_preferences(
    data: SubstitutionPreferenceUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Override preferences for all teachers in the admin's designated department (or all teachers if system admin with no X-Department-ID)."""
    query = db.query(User).filter(User.role == Role.teacher, User.is_active == True)
    if tenant_department_id is not None:
        query = query.filter(User.department_id == tenant_department_id)
        
    teachers = query.all()
    for teacher in teachers:
        substitution_service.update_preferences(db, teacher.id, **data.model_dump(exclude_unset=True))
        
    log_audit_event(db, admin.id, "preferences.bulk_override", "department", tenant_department_id, data.model_dump(exclude_unset=True))
    db.commit()
    return {"message": f"Successfully updated preferences for {len(teachers)} teachers"}


@router.put("/preferences/{teacher_id}", response_model=SubstitutionPreferenceOut)
def update_teacher_preferences(
    teacher_id: int,
    data: SubstitutionPreferenceUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    """Admin overrides a specific teacher's preferences."""
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    if tenant_department_id is not None:
        if teacher.department_id != tenant_department_id:
            raise HTTPException(status_code=403, detail="Access denied: teacher belongs to another department")
            
    res = substitution_service.update_preferences(db, teacher_id, **data.model_dump(exclude_unset=True))
    log_audit_event(db, admin.id, "preferences.override", "user", teacher_id, data.model_dump(exclude_unset=True))
    return res
