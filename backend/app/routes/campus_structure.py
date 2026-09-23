from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_principal_or_system_admin
from app.models.user import User
from app.services.campus_structure_service import CampusStructureService
from app.services.campus_duty_service import CampusDutyService
from app.schemas.campus_structure import (
    CampusBlockCreate, CampusBlockUpdate, CampusBlockOut,
    CampusFloorCreate, CampusFloorUpdate, CampusFloorOut,
    CampusRoomCreate, CampusRoomUpdate, CampusRoomOut,
    RoomPatternPreviewRequest, RoomPatternPreviewResponse,
    BulkRoomGenerateRequest, BulkRoomGenerateResponse,
    SmartBlockAutoFillRequest, SmartBlockAutoFillResponse,
    BulkRoomAssignRequest, BulkRoomAssignResponse,
    BulkFloorAssignDepartmentRequest, BulkBlockAssignDepartmentRequest,
    DuplicateBlockRequest, DuplicateBlockResponse,
    CampusStructureTreeOut, CampusStructureMetricsOut,
    CampusSearchResponse,
    CampusStructureImportValidationOut, CampusStructureImportCommitOut,
    BlockDutyConfigIn, BlockDutyConfigResultOut
)

router = APIRouter(prefix="/campus-structure", tags=["Campus Structure Builder"])


# ── Tree & Dashboard Endpoints ────────────────────────────────────────────────

@router.get("/tree", response_model=CampusStructureTreeOut)
def get_campus_structure_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the visual hierarchy of the campus: Blocks -> Floors -> Rooms."""
    return CampusStructureService.get_structure_tree(db)


@router.get("/metrics", response_model=CampusStructureMetricsOut)
def get_structure_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns counts of blocks, floors, rooms, and actionable configuration warnings for the Principal."""
    return CampusStructureService.get_structure_metrics(db)


@router.get("/search", response_model=CampusSearchResponse)
def search_campus(
    q: str = Query(..., min_length=1, description="Search term for rooms, departments, or blocks"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Global campus search across room numbers, names, departments, and blocks."""
    return CampusStructureService.search_campus(db, q)


# ── Block Endpoints ───────────────────────────────────────────────────────────

@router.get("/blocks", response_model=List[CampusBlockOut])
def list_blocks(
    is_active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return CampusStructureService.list_blocks(db, is_active_only=is_active_only)


@router.post("/blocks", response_model=CampusBlockOut, status_code=status.HTTP_201_CREATED)
def create_block(
    data: CampusBlockCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return CampusStructureService.create_block(db, data, user_id=current_user.id)


@router.put("/blocks/{block_id}", response_model=CampusBlockOut)
def update_block(
    block_id: int,
    data: CampusBlockUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return CampusStructureService.update_block(db, block_id, data, user_id=current_user.id)


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    block_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    CampusStructureService.delete_block(db, block_id, user_id=current_user.id)


# ── Floor Endpoints ───────────────────────────────────────────────────────────

@router.get("/blocks/{block_id}/floors", response_model=List[CampusFloorOut])
def list_floors_for_block(
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return CampusStructureService.list_floors_for_block(db, block_id)


@router.post("/floors", response_model=CampusFloorOut, status_code=status.HTTP_201_CREATED)
def create_floor(
    data: CampusFloorCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return CampusStructureService.create_floor(db, data, user_id=current_user.id)


# ── Smart Auto-Fill & Generation ──────────────────────────────────────────────

@router.post("/preview-rooms", response_model=RoomPatternPreviewResponse)
def preview_rooms(
    data: RoomPatternPreviewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Generates a live preview of room numbers with duplicate detection before committing."""
    return CampusStructureService.preview_room_generation(db, data)


@router.post("/generate-rooms", response_model=BulkRoomGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate_rooms_bulk(
    data: BulkRoomGenerateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Bulk generates rooms on a specific floor using custom numbering pattern."""
    return CampusStructureService.generate_rooms_bulk(db, data, user_id=current_user.id)


@router.post("/smart-autofill", response_model=SmartBlockAutoFillResponse, status_code=status.HTTP_201_CREATED)
def smart_autofill_block(
    data: SmartBlockAutoFillRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Atomically constructs an entire Block, its Floors, and all Rooms in one transactional action."""
    return CampusStructureService.smart_autofill_block(db, data, user_id=current_user.id)


@router.post("/blocks/{block_id}/duplicate", response_model=DuplicateBlockResponse, status_code=status.HTTP_201_CREATED)
def duplicate_block_structure(
    block_id: int,
    data: DuplicateBlockRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Duplicates the architectural layout of an existing block without cloning historical duty/student data."""
    return CampusStructureService.duplicate_block_structure(db, block_id, data, user_id=current_user.id)


# ── Bulk Room Assignment ──────────────────────────────────────────────────────

@router.post("/rooms/bulk-assign", response_model=BulkRoomAssignResponse)
def bulk_assign_rooms(
    data: BulkRoomAssignRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Batch updates departments, classes, room types, or exam capacities across multiple rooms."""
    return CampusStructureService.bulk_assign_rooms(db, data, user_id=current_user.id)


@router.post("/floors/{floor_id}/bulk-assign-department")
def bulk_assign_floor_department(
    floor_id: int,
    data: BulkFloorAssignDepartmentRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assigns or clears department for all rooms on the specified floor."""
    count = CampusStructureService.bulk_assign_floor_department(
        db, floor_id=floor_id, department_id=data.department_id, clear_department=data.clear_department, user_id=current_user.id
    )
    return {"updated_count": count, "message": f"Successfully updated {count} room(s) on floor."}


@router.post("/blocks/{block_id}/bulk-assign-department")
def bulk_assign_block_department(
    block_id: int,
    data: BulkBlockAssignDepartmentRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assigns or clears department for all rooms in the specified block."""
    count = CampusStructureService.bulk_assign_block_department(
        db, block_id=block_id, department_id=data.department_id, clear_department=data.clear_department, user_id=current_user.id
    )
    return {"updated_count": count, "message": f"Successfully updated {count} room(s) in block."}


# ── Block Duties: Configure & Auto-Assign ─────────────────────────────────────

@router.post("/blocks/{block_id}/duties/configure-and-assign", response_model=BlockDutyConfigResultOut)
def configure_and_assign_block_duties(
    block_id: int,
    data: BlockDutyConfigIn,
    current_user: User = Depends(require_principal_or_system_admin),
    db: Session = Depends(get_db)
):
    """Configures discipline and wing duties for a campus block with specified teacher count,
    and automatically assigns teachers belonging to that block's respected department(s)
    using preset rules (attendance, preceding free periods, conflict-free timetable, load fairness).
    Strictly restricted to Principal and System Admin only."""
    return CampusDutyService.configure_and_assign_block_duties(
        db=db,
        block_id=block_id,
        data=data,
        current_user=current_user
    )


# ── Import & Export ───────────────────────────────────────────────────────────

@router.get("/export")
def export_campus_structure_csv(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    csv_data = CampusStructureService.export_csv(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=campus_structure.csv"}
    )


@router.post("/import/validate", response_model=CampusStructureImportValidationOut)
async def validate_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    return CampusStructureService.validate_csv_import(db, content)


@router.post("/import/commit", response_model=CampusStructureImportCommitOut)
async def commit_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    return CampusStructureService.commit_csv_import(db, content, user_id=current_user.id)
