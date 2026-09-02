from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.room import RoomCreate, RoomUpdate, RoomOut, RoomAvailabilityOut, BulkRoomCreate, BulkRoomCreateOut
from app.services import room_service

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.get("/", response_model=list[RoomOut])
def list_rooms(
    room_type: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return room_service.list_rooms(db, room_type)


@router.post("/", response_model=RoomOut, status_code=201)
def create_room(
    data: RoomCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return room_service.create_room(data, db)


@router.post("/bulk", response_model=BulkRoomCreateOut, status_code=201)
def bulk_create_rooms(
    data: BulkRoomCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return room_service.bulk_create_rooms(data, db)



@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: int,
    data: RoomUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return room_service.update_room(room_id, data, db)


@router.delete("/{room_id}", status_code=204)
def delete_room(
    room_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    room_service.delete_room(room_id, db)


@router.get("/availability/dashboard", response_model=list[RoomAvailabilityOut])
def availability_dashboard(
    day_order: int = Query(...),
    period_number: int = Query(...),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return room_service.availability_dashboard(day_order, period_number, db)


@router.get("/{room_id}/check-availability")
def check_availability(
    room_id: int,
    day_order: int = Query(...),
    period_number: int = Query(...),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_available = room_service.check_room_availability(room_id, day_order, period_number, db)
    return {"room_id": room_id, "day_order": day_order, "period_number": period_number, "is_available": is_available}


@router.get("/occupancy/matrix")
@router.get("/occupancy")
def get_classroom_occupancy(
    day_order: int | None = Query(default=None),
    period_number: int | None = Query(default=None),
    department_id: int | None = Query(default=None),
    room_type: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return room_service.get_classroom_occupancy(
        db,
        day_order=day_order,
        period_number=period_number,
        department_id=department_id,
        room_type=room_type,
    )

