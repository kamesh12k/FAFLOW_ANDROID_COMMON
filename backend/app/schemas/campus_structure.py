from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.models.room import RoomType


# ── Block Schemas ─────────────────────────────────────────────────────────────

class CampusBlockBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    floors_count: int = Field(default=1, ge=1, le=20)
    description: Optional[str] = None
    department_id: Optional[int] = None
    is_active: bool = True


class CampusBlockCreate(CampusBlockBase):
    pass


class CampusBlockUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    floors_count: Optional[int] = None
    description: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class CampusBlockOut(CampusBlockBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Floor Schemas ─────────────────────────────────────────────────────────────

class CampusFloorBase(BaseModel):
    block_id: int
    floor_number: int  # -1=Basement, 0=Ground, 1=1st, etc.
    floor_name: str = Field(..., min_length=1, max_length=100)
    display_order: int = 0
    is_active: bool = True


class CampusFloorCreate(CampusFloorBase):
    pass


class CampusFloorUpdate(BaseModel):
    floor_name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class CampusFloorOut(CampusFloorBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Room Schemas ──────────────────────────────────────────────────────────────

class CampusRoomBase(BaseModel):
    room_number: str = Field(..., min_length=1, max_length=50)
    room_name: Optional[str] = None
    room_type: RoomType = RoomType.classroom
    capacity: int = Field(default=60, ge=1)
    block_id: Optional[int] = None
    floor_id: Optional[int] = None
    area_id: Optional[int] = None
    department_id: Optional[int] = None
    primary_class_id: Optional[int] = None
    is_exam_eligible: bool = False
    exam_capacity: Optional[int] = None
    required_invigilators: int = Field(default=1, ge=1)
    lab_type: Optional[str] = None
    equipment_category: Optional[str] = None
    is_timetable_eligible: bool = True
    is_active: bool = True
    notes: Optional[str] = None


class CampusRoomCreate(CampusRoomBase):
    pass


class CampusRoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_name: Optional[str] = None
    room_type: Optional[RoomType] = None
    capacity: Optional[int] = None
    block_id: Optional[int] = None
    floor_id: Optional[int] = None
    area_id: Optional[int] = None
    department_id: Optional[int] = None
    primary_class_id: Optional[int] = None
    is_exam_eligible: Optional[bool] = None
    exam_capacity: Optional[int] = None
    required_invigilators: Optional[int] = None
    lab_type: Optional[str] = None
    equipment_category: Optional[str] = None
    is_timetable_eligible: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CampusRoomOut(CampusRoomBase):
    id: int
    block_name: Optional[str] = None
    floor_name: Optional[str] = None
    department_name: Optional[str] = None
    primary_class_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Pattern Preview & Generation Schemas ───────────────────────────────────────

class RoomPatternPreviewRequest(BaseModel):
    pattern: str = "{floor_code}{number:02d}"
    start_num: int = 1
    count: int = 10
    pad_digits: int = 2
    room_type: RoomType = RoomType.classroom
    capacity: int = 60
    block_id: Optional[int] = None
    floor_id: Optional[int] = None
    room_type_overrides: Optional[Dict[str, RoomType]] = None


class RoomPatternPreviewItem(BaseModel):
    room_number: str
    room_name: str
    room_type: RoomType
    capacity: int
    is_existing_conflict: bool = False
    conflict_message: Optional[str] = None


class RoomPatternPreviewResponse(BaseModel):
    total_requested: int
    valid_count: int
    conflict_count: int
    items: List[RoomPatternPreviewItem]


class BulkRoomGenerateRequest(BaseModel):
    block_id: int
    floor_id: int
    pattern: str = "{floor_code}{number:02d}"
    start_num: int = 1
    count: int = 10
    pad_digits: int = 2
    room_type: RoomType = RoomType.classroom
    capacity: int = 60
    department_id: Optional[int] = None
    primary_class_id: Optional[int] = None
    is_exam_eligible: bool = False
    exam_capacity: Optional[int] = None
    required_invigilators: int = 1
    room_type_overrides: Optional[Dict[str, RoomType]] = None  # e.g. {"103": "lab", "104": "seminar_hall", "003": "lab"}


class BulkRoomGenerateResponse(BaseModel):
    created_count: int
    skipped_count: int
    created_rooms: List[CampusRoomOut]
    message: str


# ── Smart Block Auto-Fill ─────────────────────────────────────────────────────

class SmartFloorConfig(BaseModel):
    floor_number: int  # 0=Ground, 1=1st, 2=2nd, -1=Basement
    floor_name: str    # "Ground Floor", "First Floor"
    room_count: int = 10
    start_num: int = 1
    pattern: str = "{floor_code}{number:02d}"  # e.g. "001" or "101"
    room_type: RoomType = RoomType.classroom
    capacity: int = 60
    department_id: Optional[int] = None
    room_type_overrides: Optional[Dict[str, RoomType]] = None  # e.g. {"103": "lab", "104": "seminar_hall"}


class SmartBlockAutoFillRequest(BaseModel):
    block_name: str = Field(..., min_length=1)
    block_code: str = Field(..., min_length=1)
    description: Optional[str] = None
    department_id: Optional[int] = None
    floors: List[SmartFloorConfig]


class SmartBlockAutoFillResponse(BaseModel):
    block: CampusBlockOut
    total_floors_created: int
    total_rooms_created: int
    message: str


# ── Bulk Assignment ───────────────────────────────────────────────────────────

class BulkRoomAssignRequest(BaseModel):
    room_ids: List[int] = Field(..., min_length=1)
    room_type: Optional[RoomType] = None
    department_id: Optional[int] = None
    clear_department: bool = False
    primary_class_id: Optional[int] = None
    clear_class: bool = False
    is_exam_eligible: Optional[bool] = None
    exam_capacity: Optional[int] = None
    required_invigilators: Optional[int] = None
    is_active: Optional[bool] = None


class BulkRoomAssignResponse(BaseModel):
    updated_count: int
    message: str


class BulkFloorAssignDepartmentRequest(BaseModel):
    department_id: Optional[int] = None
    clear_department: bool = False


class BulkBlockAssignDepartmentRequest(BaseModel):
    department_id: Optional[int] = None
    clear_department: bool = False


# ── Duplicate Structure ───────────────────────────────────────────────────────

class DuplicateBlockRequest(BaseModel):
    new_block_name: str
    new_block_code: str
    prefix_replace_from: Optional[str] = None  # e.g., "A-"
    prefix_replace_to: Optional[str] = None    # e.g., "B-"
    copy_department_mappings: bool = True
    copy_exam_configs: bool = True


class DuplicateBlockResponse(BaseModel):
    new_block: CampusBlockOut
    cloned_floors_count: int
    cloned_rooms_count: int
    message: str


# ── Hierarchy Tree & Dashboard Metrics ────────────────────────────────────────

class CampusStructureTreeFloorOut(BaseModel):
    id: int
    floor_number: int
    floor_name: str
    display_order: int
    is_active: bool
    rooms: List[CampusRoomOut]


class CampusStructureTreeBlockOut(BaseModel):
    id: int
    name: str
    code: str
    floors_count: int
    department_id: Optional[int]
    department_name: Optional[str]
    is_active: bool
    floors: List[CampusStructureTreeFloorOut]
    associated_departments: Optional[List[Dict[str, Any]]] = None


class CampusStructureTreeOut(BaseModel):
    institution_name: Optional[str] = "Campus Physical Infrastructure"
    blocks: List[CampusStructureTreeBlockOut]
    unassigned_rooms: List[CampusRoomOut] = []  # Legacy rooms not yet bound to block/floor


class CampusStructureMetricsOut(BaseModel):
    total_blocks: int
    total_floors: int
    total_rooms: int
    total_classrooms: int
    total_labs: int
    total_exam_halls: int
    total_other_rooms: int
    unmapped_departments_count: int
    unassigned_classrooms_count: int
    classes_without_room_count: int
    warnings: List[str] = []


# ── Global Campus Search ──────────────────────────────────────────────────────

class CampusSearchItemOut(BaseModel):
    category: str  # "ROOM", "DEPARTMENT", "BLOCK", "CLASS"
    title: str
    subtitle: str
    block_name: Optional[str] = None
    floor_name: Optional[str] = None
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    target_id: int


class CampusSearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[CampusSearchItemOut]


# ── Import & Export ───────────────────────────────────────────────────────────

class CampusStructureImportValidationOut(BaseModel):
    total_rows: int
    valid_count: int
    warning_count: int
    error_count: int
    can_commit: bool
    details: List[str] = []
    preview_rows: List[Dict[str, Any]] = []


class CampusStructureImportCommitOut(BaseModel):
    blocks_created: int
    floors_created: int
    rooms_created: int
    rooms_updated: int
    message: str
