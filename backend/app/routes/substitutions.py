from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional

from app.database import get_db
from app.core.dependencies import require_credentials_set, get_tenant_department_id
from app.models.user import User
from app.services import substitution_dashboard_service as service

router = APIRouter(prefix="/substitutions", tags=["Today's Substitutions"])

@router.get("/today")
def get_today_substitutions(
    date: Optional[date] = Query(None, description="Query date YYYY-MM-DD (defaults to current date)"),
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
    tenant_department_id: int | None = Depends(get_tenant_department_id),
):
    target_date = date or datetime.now().date()
    return service.get_today_substitutions(db, target_date, tenant_department_id)

