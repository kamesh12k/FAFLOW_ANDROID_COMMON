from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_principal
from app.models.user import User
from app.schemas.admin import PrincipalOverviewOut
from app.services import summary_service

router = APIRouter(prefix="/principal", tags=["Principal Dashboard"])


@router.get("/overview", response_model=PrincipalOverviewOut)
def get_principal_overview(
    _principal: User = Depends(require_principal),
    db: Session = Depends(get_db),
):
    """
    Returns aggregate stats and department metrics for the Principal dashboard.
    Only callable by the Principal.
    """
    return summary_service.get_principal_overview(db)
