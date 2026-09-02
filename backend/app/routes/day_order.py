from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.models.day_order_calendar import DayType
from app.schemas.academic_calendar import CalendarDayOut, DayOrderResolveResult
from app.services import day_order_service

router = APIRouter(prefix="/day-order-calendar", tags=["Day Order Calendar"])


def _serialize_day(day) -> dict:
    return {
        "id": day.id, "date": day.date, "day_type": day.day_type, "day_order": day.day_order,
        "academic_year_id": day.academic_year_id, "semester_id": day.semester_id,
        "is_manual_override": day.is_manual_override, "label": day.label, "notes": day.notes,
        "blocks_operations": day.blocks_operations, "created_at": day.created_at, "updated_at": day.updated_at,
    }


@router.get("/", response_model=list[CalendarDayOut])
def get_range(
    start: date = Query(...),
    end: date = Query(...),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    days = day_order_service.get_range(db, start, end)
    return [CalendarDayOut(**_serialize_day(d)) for d in days]


@router.post("/bulk-set", response_model=list[CalendarDayOut])
def bulk_set(
    entries: list[dict],
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Legacy bulk-set shape: [{date, day_order}, ...] — assigns Day Order
    to a batch of working dates in one call (thin wrapper over
    day_order_service.reassign_day_order, which handles resequencing)."""
    results = []
    for entry in entries:
        d = date.fromisoformat(entry["date"]) if isinstance(entry["date"], str) else entry["date"]
        day = day_order_service.reassign_day_order(db, admin, d, int(entry["day_order"]))
        results.append(day)
    return [CalendarDayOut(**_serialize_day(d)) for d in results]


@router.get("/resolve", response_model=DayOrderResolveResult)
def resolve(
    date_: date | None = Query(default=None, alias="date"),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if date_ is None:
        raise HTTPException(status_code=400, detail="Provide a 'date' query parameter")
    day = day_order_service.resolve_by_date(db, date_)
    if not day:
        return DayOrderResolveResult(date=date_, day_order=None, day_type=DayType.non_working, blocks_operations=True)
    return DayOrderResolveResult(date=day.date, day_order=day.day_order, day_type=day.day_type, blocks_operations=day.blocks_operations)
