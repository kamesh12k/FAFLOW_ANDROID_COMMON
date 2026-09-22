import csv
import io
import re
import logging
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from fastapi import HTTPException

from app.models.campus_structure import CampusBlock, CampusFloor
from app.models.room import Room, RoomType
from app.models.department import Department
from app.models.class_ import Class
from app.models.audit_log import AuditLog
from app.schemas.campus_structure import (
    CampusBlockCreate, CampusBlockUpdate, CampusBlockOut,
    CampusFloorCreate, CampusFloorUpdate, CampusFloorOut,
    CampusRoomCreate, CampusRoomUpdate, CampusRoomOut,
    RoomPatternPreviewRequest, RoomPatternPreviewItem, RoomPatternPreviewResponse,
    BulkRoomGenerateRequest, BulkRoomGenerateResponse,
    SmartBlockAutoFillRequest, SmartBlockAutoFillResponse,
    BulkRoomAssignRequest, BulkRoomAssignResponse,
    DuplicateBlockRequest, DuplicateBlockResponse,
    CampusStructureTreeOut, CampusStructureTreeBlockOut, CampusStructureTreeFloorOut,
    CampusStructureMetricsOut,
    CampusSearchResponse, CampusSearchItemOut,
    CampusStructureImportValidationOut, CampusStructureImportCommitOut
)

logger = logging.getLogger(__name__)


class CampusStructureService:

    @staticmethod
    def _log_audit(db: Session, actor_user_id: Optional[int], action: str, details: dict, department_id: Optional[int] = None):
        try:
            audit = AuditLog(
                actor_user_id=actor_user_id,
                department_id=department_id,
                action=action,
                target_type="campus_structure",
                details=details
            )
            db.add(audit)
            db.flush()
        except Exception as e:
            logger.warning("Failed to log campus structure audit: %s", e)

    # ── Formatting Helper ─────────────────────────────────────────────────────

    @staticmethod
    def format_room_number(pattern: str, num: int, pad_digits: int = 0, floor_code: str = "", block_prefix: str = "") -> str:
        """Formats a room number safely based on given pattern and replacements."""
        # 1. Custom string format tokens: {number}, {num}, {number:02d}, {floor_code}, {block_prefix}
        formatted = pattern
        if "{block_prefix}" in formatted:
            formatted = formatted.replace("{block_prefix}", block_prefix)
        if "{floor_code}" in formatted:
            formatted = formatted.replace("{floor_code}", floor_code)

        # 2. Check for python format style
        try:
            if "{number" in formatted:
                # e.g., {number:02d} or {number}
                formatted = formatted.format(number=num)
            elif "{num" in formatted:
                formatted = formatted.format(num=num)
            else:
                # Basic token replacement
                num_str = f"{num:0{pad_digits}d}" if pad_digits > 0 else str(num)
                if "{n}" in formatted:
                    formatted = formatted.replace("{n}", num_str)
                elif "-" in formatted and formatted.endswith("-"):
                    formatted = f"{formatted}{num_str}"
                elif not any(c.isdigit() for c in formatted):
                    formatted = f"{formatted}{num_str}"
        except Exception:
            num_str = f"{num:0{pad_digits}d}" if pad_digits > 0 else str(num)
            formatted = f"{pattern}-{num_str}"

        return formatted.strip()

    # ── Block CRUD ────────────────────────────────────────────────────────────

    @staticmethod
    def list_blocks(db: Session, is_active_only: bool = True) -> List[CampusBlockOut]:
        q = db.query(CampusBlock)
        if is_active_only:
            q = q.filter(CampusBlock.is_active == True)
        blocks = q.order_by(CampusBlock.name).all()
        return [CampusBlockOut.model_validate(b) for b in blocks]

    @staticmethod
    def get_block(db: Session, block_id: int) -> CampusBlock:
        block = db.query(CampusBlock).filter(CampusBlock.id == block_id).first()
        if not block:
            raise HTTPException(status_code=404, detail=f"Campus block with ID {block_id} not found")
        return block

    @staticmethod
    def create_block(db: Session, data: CampusBlockCreate, user_id: Optional[int] = None) -> CampusBlockOut:
        existing = db.query(CampusBlock).filter(CampusBlock.code == data.code.strip().upper()).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Block with code '{data.code}' already exists")

        block = CampusBlock(
            name=data.name.strip(),
            code=data.code.strip().upper(),
            floors_count=data.floors_count,
            description=data.description,
            department_id=data.department_id,
            is_active=data.is_active
        )
        db.add(block)
        db.commit()
        db.refresh(block)

        CampusStructureService._log_audit(db, user_id, "CAMPUS_BLOCK_CREATED", {"block_id": block.id, "name": block.name, "code": block.code})
        return CampusBlockOut.model_validate(block)

    @staticmethod
    def update_block(db: Session, block_id: int, data: CampusBlockUpdate, user_id: Optional[int] = None) -> CampusBlockOut:
        block = CampusStructureService.get_block(db, block_id)
        if data.code and data.code.strip().upper() != block.code:
            existing = db.query(CampusBlock).filter(CampusBlock.code == data.code.strip().upper()).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Block with code '{data.code}' already exists")
            block.code = data.code.strip().upper()

        if data.name is not None:
            block.name = data.name.strip()
        if data.floors_count is not None:
            block.floors_count = data.floors_count
        if data.description is not None:
            block.description = data.description
        if data.department_id is not None:
            block.department_id = data.department_id
        if data.is_active is not None:
            block.is_active = data.is_active

        db.commit()
        db.refresh(block)
        CampusStructureService._log_audit(db, user_id, "CAMPUS_BLOCK_UPDATED", {"block_id": block.id, "name": block.name})
        return CampusBlockOut.model_validate(block)

    @staticmethod
    def delete_block(db: Session, block_id: int, user_id: Optional[int] = None):
        block = CampusStructureService.get_block(db, block_id)
        # Detach rooms rather than deleting room history
        db.query(Room).filter(Room.block_id == block_id).update({"block_id": None, "floor_id": None}, synchronize_session=False)
        db.delete(block)
        db.commit()
        CampusStructureService._log_audit(db, user_id, "CAMPUS_BLOCK_DELETED", {"block_id": block_id})

    # ── Floor CRUD ────────────────────────────────────────────────────────────

    @staticmethod
    def list_floors_for_block(db: Session, block_id: int) -> List[CampusFloorOut]:
        floors = db.query(CampusFloor).filter(CampusFloor.block_id == block_id).order_by(CampusFloor.display_order).all()
        return [CampusFloorOut.model_validate(f) for f in floors]

    @staticmethod
    def create_floor(db: Session, data: CampusFloorCreate, user_id: Optional[int] = None) -> CampusFloorOut:
        CampusStructureService.get_block(db, data.block_id)
        existing = db.query(CampusFloor).filter(
            CampusFloor.block_id == data.block_id,
            CampusFloor.floor_number == data.floor_number
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Floor number {data.floor_number} already exists in this block")

        floor = CampusFloor(
            block_id=data.block_id,
            floor_number=data.floor_number,
            floor_name=data.floor_name.strip(),
            display_order=data.display_order if data.display_order != 0 else (data.floor_number + 1),
            is_active=data.is_active
        )
        db.add(floor)
        db.commit()
        db.refresh(floor)

        CampusStructureService._log_audit(db, user_id, "CAMPUS_FLOOR_CREATED", {"floor_id": floor.id, "name": floor.floor_name})
        return CampusFloorOut.model_validate(floor)

    # ── Pattern Preview & Generation ──────────────────────────────────────────

    @staticmethod
    def preview_room_generation(db: Session, data: RoomPatternPreviewRequest) -> RoomPatternPreviewResponse:
        existing_numbers = {
            r_num for (r_num,) in db.query(Room.room_number).all()
        }

        items: List[RoomPatternPreviewItem] = []
        conflicts = 0

        for idx in range(data.count):
            cur_num = data.start_num + idx
            room_no = CampusStructureService.format_room_number(
                pattern=data.pattern,
                num=cur_num,
                pad_digits=data.pad_digits
            )
            has_conflict = room_no in existing_numbers
            if has_conflict:
                conflicts += 1

            # Check for room type override
            room_type = data.room_type
            if data.room_type_overrides:
                if room_no in data.room_type_overrides:
                    room_type = data.room_type_overrides[room_no]
                elif str(cur_num) in data.room_type_overrides:
                    room_type = data.room_type_overrides[str(cur_num)]

            items.append(RoomPatternPreviewItem(
                room_number=room_no,
                room_name=room_no,
                room_type=room_type,
                capacity=data.capacity,
                is_existing_conflict=has_conflict,
                conflict_message="A room with this code already exists in FAFLOW" if has_conflict else None
            ))

        return RoomPatternPreviewResponse(
            total_requested=data.count,
            valid_count=data.count - conflicts,
            conflict_count=conflicts,
            items=items
        )

    @staticmethod
    def generate_rooms_bulk(db: Session, data: BulkRoomGenerateRequest, user_id: Optional[int] = None) -> BulkRoomGenerateResponse:
        CampusStructureService.get_block(db, data.block_id)
        floor = db.query(CampusFloor).filter(CampusFloor.id == data.floor_id, CampusFloor.block_id == data.block_id).first()
        if not floor:
            raise HTTPException(status_code=400, detail="Floor does not belong to specified block")

        existing_numbers = {
            r_num for (r_num,) in db.query(Room.room_number).all()
        }

        created_rooms: List[Room] = []
        skipped_count = 0

        for idx in range(data.count):
            cur_num = data.start_num + idx
            # Floor 0 -> "0" yielding 001, 002... Floor 1 -> "1" yielding 101, 102...
            floor_code_str = "0" if floor.floor_number == 0 else (f"B{abs(floor.floor_number)}" if floor.floor_number < 0 else str(floor.floor_number))
            room_no = CampusStructureService.format_room_number(
                pattern=data.pattern,
                num=cur_num,
                pad_digits=data.pad_digits,
                floor_code=floor_code_str
            )

            if room_no in existing_numbers:
                skipped_count += 1
                continue

            # Determine room_type with potential override
            cur_room_type = data.room_type
            if data.room_type_overrides:
                if room_no in data.room_type_overrides:
                    cur_room_type = data.room_type_overrides[room_no]
                elif str(cur_num) in data.room_type_overrides:
                    cur_room_type = data.room_type_overrides[str(cur_num)]
                elif f"{cur_num:0{data.pad_digits}d}" in data.room_type_overrides:
                    cur_room_type = data.room_type_overrides[f"{cur_num:0{data.pad_digits}d}"]

            room = Room(
                room_number=room_no,
                room_name=room_no,
                room_type=cur_room_type,
                capacity=data.capacity,
                block_id=data.block_id,
                floor_id=data.floor_id,
                department_id=data.department_id,
                primary_class_id=data.primary_class_id,
                is_exam_eligible=data.is_exam_eligible,
                exam_capacity=data.exam_capacity,
                required_invigilators=data.required_invigilators,
                is_timetable_eligible=True,
                is_active=True
            )
            db.add(room)
            existing_numbers.add(room_no)
            created_rooms.append(room)

        db.commit()
        for r in created_rooms:
            db.refresh(r)

        CampusStructureService._log_audit(db, user_id, "ROOMS_BULK_GENERATED", {
            "block_id": data.block_id,
            "floor_id": data.floor_id,
            "created_count": len(created_rooms),
            "skipped_count": skipped_count
        })

        out_list = [CampusStructureService._to_room_out(r) for r in created_rooms]
        return BulkRoomGenerateResponse(
            created_count=len(created_rooms),
            skipped_count=skipped_count,
            created_rooms=out_list,
            message=f"Successfully generated {len(created_rooms)} rooms. Skipped {skipped_count} existing."
        )

    # ── Smart Block Auto-Fill (End-to-End Hierarchy) ──────────────────────────

    @staticmethod
    def smart_autofill_block(db: Session, data: SmartBlockAutoFillRequest, user_id: Optional[int] = None) -> SmartBlockAutoFillResponse:
        """Atomically generates a CampusBlock, all requested Floors, and all Rooms."""
        existing = db.query(CampusBlock).filter(CampusBlock.code == data.block_code.strip().upper()).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Block with code '{data.block_code}' already exists")

        # 1. Create Block
        block = CampusBlock(
            name=data.block_name.strip(),
            code=data.block_code.strip().upper(),
            floors_count=len(data.floors),
            description=data.description,
            department_id=data.department_id,
            is_active=True
        )
        db.add(block)
        db.flush()

        existing_room_numbers = {
            r_num for (r_num,) in db.query(Room.room_number).all()
        }

        total_floors = 0
        total_rooms = 0

        # 2. Iterate Floors and generate Rooms
        for f_idx, f_cfg in enumerate(data.floors):
            floor = CampusFloor(
                block_id=block.id,
                floor_number=f_cfg.floor_number,
                floor_name=f_cfg.floor_name.strip(),
                display_order=f_idx,
                is_active=True
            )
            db.add(floor)
            db.flush()
            total_floors += 1

            floor_code_str = "0" if f_cfg.floor_number == 0 else (f"B{abs(f_cfg.floor_number)}" if f_cfg.floor_number < 0 else str(f_cfg.floor_number))
            block_prefix = f"{block.code}-"

            for r_idx in range(f_cfg.room_count):
                cur_num = f_cfg.start_num + r_idx
                room_no = CampusStructureService.format_room_number(
                    pattern=f_cfg.pattern,
                    num=cur_num,
                    pad_digits=2,
                    floor_code=floor_code_str,
                    block_prefix=block_prefix
                )

                if room_no in existing_room_numbers:
                    # Append unique discriminator if needed
                    room_no = f"{room_no}_{total_rooms+1}"

                # Determine room_type with potential override
                cur_room_type = f_cfg.room_type
                if f_cfg.room_type_overrides:
                    if room_no in f_cfg.room_type_overrides:
                        cur_room_type = f_cfg.room_type_overrides[room_no]
                    elif str(cur_num) in f_cfg.room_type_overrides:
                        cur_room_type = f_cfg.room_type_overrides[str(cur_num)]
                    elif f"{cur_num:02d}" in f_cfg.room_type_overrides:
                        cur_room_type = f_cfg.room_type_overrides[f"{cur_num:02d}"]

                room = Room(
                    room_number=room_no,
                    room_name=room_no,
                    room_type=cur_room_type,
                    capacity=f_cfg.capacity,
                    block_id=block.id,
                    floor_id=floor.id,
                    department_id=f_cfg.department_id or data.department_id,
                    is_timetable_eligible=True,
                    is_active=True
                )
                db.add(room)
                existing_room_numbers.add(room_no)
                total_rooms += 1

        db.commit()
        db.refresh(block)

        CampusStructureService._log_audit(db, user_id, "CAMPUS_BLOCK_SMART_AUTOFILL", {
            "block_id": block.id,
            "floors_created": total_floors,
            "rooms_created": total_rooms
        })

        return SmartBlockAutoFillResponse(
            block=CampusBlockOut.model_validate(block),
            total_floors_created=total_floors,
            total_rooms_created=total_rooms,
            message=f"Smart Auto-Fill completed! Created {block.name} with {total_floors} floors and {total_rooms} rooms."
        )

    # ── Duplicate Structure ───────────────────────────────────────────────────

    @staticmethod
    def duplicate_block_structure(db: Session, source_block_id: int, data: DuplicateBlockRequest, user_id: Optional[int] = None) -> DuplicateBlockResponse:
        source_block = CampusStructureService.get_block(db, source_block_id)
        existing = db.query(CampusBlock).filter(CampusBlock.code == data.new_block_code.strip().upper()).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Block with code '{data.new_block_code}' already exists")

        # 1. Create Cloned Block
        new_block = CampusBlock(
            name=data.new_block_name.strip(),
            code=data.new_block_code.strip().upper(),
            floors_count=source_block.floors_count,
            description=f"Cloned structure from {source_block.name}",
            department_id=source_block.department_id if data.copy_department_mappings else None,
            is_active=True
        )
        db.add(new_block)
        db.flush()

        existing_room_numbers = {
            r_num for (r_num,) in db.query(Room.room_number).all()
        }

        cloned_floors = 0
        cloned_rooms = 0

        # Query floors and rooms
        source_floors = db.query(CampusFloor).filter(CampusFloor.block_id == source_block_id).order_by(CampusFloor.display_order).all()

        for sf in source_floors:
            new_floor = CampusFloor(
                block_id=new_block.id,
                floor_number=sf.floor_number,
                floor_name=sf.floor_name,
                display_order=sf.display_order,
                is_active=True
            )
            db.add(new_floor)
            db.flush()
            cloned_floors += 1

            source_rooms = db.query(Room).filter(Room.floor_id == sf.id).all()
            for sr in source_rooms:
                new_room_no = sr.room_number
                if data.prefix_replace_from and data.prefix_replace_to:
                    if new_room_no.startswith(data.prefix_replace_from):
                        new_room_no = data.prefix_replace_to + new_room_no[len(data.prefix_replace_from):]
                    else:
                        new_room_no = f"{data.new_block_code}-{new_room_no}"
                else:
                    new_room_no = f"{data.new_block_code}-{new_room_no}"

                if new_room_no in existing_room_numbers:
                    new_room_no = f"{new_room_no}_copy"

                new_room = Room(
                    room_number=new_room_no,
                    room_name=new_room_no,
                    room_type=sr.room_type,
                    capacity=sr.capacity,
                    block_id=new_block.id,
                    floor_id=new_floor.id,
                    department_id=sr.department_id if data.copy_department_mappings else None,
                    is_exam_eligible=sr.is_exam_eligible if data.copy_exam_configs else False,
                    exam_capacity=sr.exam_capacity if data.copy_exam_configs else None,
                    required_invigilators=sr.required_invigilators if data.copy_exam_configs else 1,
                    lab_type=sr.lab_type,
                    equipment_category=sr.equipment_category,
                    is_timetable_eligible=sr.is_timetable_eligible,
                    is_active=True
                )
                db.add(new_room)
                existing_room_numbers.add(new_room_no)
                cloned_rooms += 1

        db.commit()
        db.refresh(new_block)

        CampusStructureService._log_audit(db, user_id, "CAMPUS_BLOCK_DUPLICATED", {
            "source_block_id": source_block_id,
            "new_block_id": new_block.id,
            "cloned_rooms": cloned_rooms
        })

        return DuplicateBlockResponse(
            new_block=CampusBlockOut.model_validate(new_block),
            cloned_floors_count=cloned_floors,
            cloned_rooms_count=cloned_rooms,
            message=f"Duplicated {source_block.name} into {new_block.name} with {cloned_floors} floors and {cloned_rooms} rooms."
        )

    # ── Bulk Room Assignment ──────────────────────────────────────────────────

    @staticmethod
    def bulk_assign_rooms(db: Session, data: BulkRoomAssignRequest, user_id: Optional[int] = None) -> BulkRoomAssignResponse:
        rooms = db.query(Room).filter(Room.id.in_(data.room_ids)).all()
        if not rooms:
            raise HTTPException(status_code=404, detail="No matching rooms found for the given IDs")

        for r in rooms:
            if data.room_type is not None:
                r.room_type = data.room_type
            if data.clear_department:
                r.department_id = None
            elif data.department_id is not None:
                r.department_id = data.department_id
            if data.clear_class:
                r.primary_class_id = None
            elif data.primary_class_id is not None:
                r.primary_class_id = data.primary_class_id
            if data.is_exam_eligible is not None:
                r.is_exam_eligible = data.is_exam_eligible
            if data.exam_capacity is not None:
                r.exam_capacity = data.exam_capacity
            if data.required_invigilators is not None:
                r.required_invigilators = data.required_invigilators
            if data.is_active is not None:
                r.is_active = data.is_active

        db.commit()

        CampusStructureService._log_audit(db, user_id, "ROOMS_BULK_ASSIGNED", {
            "updated_count": len(rooms),
            "room_type": data.room_type.value if data.room_type else None,
            "department_id": data.department_id,
            "primary_class_id": data.primary_class_id
        })

        return BulkRoomAssignResponse(
            updated_count=len(rooms),
            message=f"Successfully updated {len(rooms)} room(s)."
        )

    @staticmethod
    def bulk_assign_floor_department(db: Session, floor_id: int, department_id: Optional[int], clear_department: bool = False, user_id: Optional[int] = None) -> int:
        floor = db.query(CampusFloor).filter(CampusFloor.id == floor_id).first()
        if not floor:
            raise HTTPException(status_code=404, detail="Floor not found")
        new_dept_id = None if clear_department else department_id
        count = db.query(Room).filter(Room.floor_id == floor_id).update({"department_id": new_dept_id}, synchronize_session=False)
        db.commit()
        CampusStructureService._log_audit(db, user_id, "FLOOR_DEPARTMENT_BULK_ASSIGNED", {
            "floor_id": floor_id,
            "department_id": new_dept_id,
            "updated_count": count
        })
        return count

    @staticmethod
    def bulk_assign_block_department(db: Session, block_id: int, department_id: Optional[int], clear_department: bool = False, user_id: Optional[int] = None) -> int:
        block = db.query(CampusBlock).filter(CampusBlock.id == block_id).first()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")
        new_dept_id = None if clear_department else department_id
        if not clear_department and department_id is not None:
            block.department_id = department_id
        elif clear_department:
            block.department_id = None
        count = db.query(Room).filter(Room.block_id == block_id).update({"department_id": new_dept_id}, synchronize_session=False)
        db.commit()
        CampusStructureService._log_audit(db, user_id, "BLOCK_DEPARTMENT_BULK_ASSIGNED", {
            "block_id": block_id,
            "department_id": new_dept_id,
            "updated_count": count
        })
        return count

    # ── Structure Tree & Metrics ──────────────────────────────────────────────

    @staticmethod
    def _to_room_out(room: Room) -> CampusRoomOut:
        return CampusRoomOut(
            id=room.id,
            room_number=room.room_number,
            room_name=room.room_name or room.room_number,
            room_type=room.room_type,
            capacity=room.capacity,
            block_id=room.block_id,
            floor_id=room.floor_id,
            area_id=room.area_id,
            department_id=room.department_id,
            primary_class_id=room.primary_class_id,
            is_exam_eligible=room.is_exam_eligible,
            exam_capacity=room.exam_capacity,
            required_invigilators=room.required_invigilators,
            lab_type=room.lab_type,
            equipment_category=room.equipment_category,
            is_timetable_eligible=room.is_timetable_eligible,
            is_active=room.is_active,
            notes=room.notes,
            block_name=room.block.name if room.block else None,
            floor_name=room.floor.floor_name if room.floor else None,
            department_name=room.department.name if room.department else None,
            primary_class_name=f"{room.primary_class.name} ({room.primary_class.section})" if room.primary_class else None,
            created_at=room.created_at or datetime.utcnow(),
            updated_at=room.updated_at
        )

    @staticmethod
    def get_structure_tree(db: Session) -> CampusStructureTreeOut:
        blocks = db.query(CampusBlock).options(
            joinedload(CampusBlock.department),
            joinedload(CampusBlock.floors).joinedload(CampusFloor.rooms).joinedload(Room.department),
            joinedload(CampusBlock.floors).joinedload(CampusFloor.rooms).joinedload(Room.primary_class)
        ).order_by(CampusBlock.name).all()

        tree_blocks: List[CampusStructureTreeBlockOut] = []

        for b in blocks:
            floor_list: List[CampusStructureTreeFloorOut] = []
            dept_map: Dict[int, Dict[str, Any]] = {}
            for f in sorted(b.floors, key=lambda fl: fl.display_order):
                room_list = [CampusStructureService._to_room_out(r) for r in sorted(f.rooms, key=lambda rm: rm.room_number)]
                for r in f.rooms:
                    if r.department_id and r.department:
                        if r.department_id not in dept_map:
                            dept_map[r.department_id] = {
                                "id": r.department.id,
                                "name": r.department.name,
                                "code": r.department.code or "",
                                "room_count": 0
                            }
                        dept_map[r.department_id]["room_count"] += 1

                floor_list.append(CampusStructureTreeFloorOut(
                    id=f.id,
                    floor_number=f.floor_number,
                    floor_name=f.floor_name,
                    display_order=f.display_order,
                    is_active=f.is_active,
                    rooms=room_list
                ))

            tree_blocks.append(CampusStructureTreeBlockOut(
                id=b.id,
                name=b.name,
                code=b.code,
                floors_count=b.floors_count,
                department_id=b.department_id,
                department_name=b.department.name if b.department else None,
                is_active=b.is_active,
                floors=floor_list,
                associated_departments=list(dept_map.values())
            ))

        # Check for unassigned legacy rooms
        unassigned_rooms = db.query(Room).filter(or_(Room.block_id == None, Room.floor_id == None)).options(
            joinedload(Room.department),
            joinedload(Room.primary_class)
        ).order_by(Room.room_number).all()

        return CampusStructureTreeOut(
            blocks=tree_blocks,
            unassigned_rooms=[CampusStructureService._to_room_out(r) for r in unassigned_rooms]
        )

    @staticmethod
    def get_structure_metrics(db: Session) -> CampusStructureMetricsOut:
        total_blocks = db.query(CampusBlock).count()
        total_floors = db.query(CampusFloor).count()
        total_rooms = db.query(Room).count()

        total_classrooms = db.query(Room).filter(Room.room_type == RoomType.classroom).count()
        total_labs = db.query(Room).filter(Room.room_type.in_([RoomType.lab, RoomType.laboratory])).count()
        total_exam_halls = db.query(Room).filter(or_(Room.room_type == RoomType.examination_hall, Room.is_exam_eligible == True)).count()
        total_other = total_rooms - (total_classrooms + total_labs)

        # ── Configuration Warnings Checks ──────────────────────────────────
        warnings: List[str] = []

        # 1. Departments with no mapped block
        all_departments = db.query(Department).all()
        mapped_dept_ids = {b.department_id for b in db.query(CampusBlock.department_id).filter(CampusBlock.department_id != None).all()}
        mapped_dept_ids.update({r.department_id for r in db.query(Room.department_id).filter(Room.department_id != None).all()})

        unmapped_depts = [d for d in all_departments if d.id not in mapped_dept_ids]
        for ud in unmapped_depts:
            warnings.append(f"Department '{ud.name}' has no mapped physical block or department room.")

        # 2. Classrooms with no department assigned
        unassigned_classrooms = db.query(Room).filter(
            Room.room_type == RoomType.classroom,
            Room.department_id == None
        ).count()
        if unassigned_classrooms > 0:
            warnings.append(f"{unassigned_classrooms} classrooms have no department mapped.")

        # 3. Exam halls with no exam capacity
        incomplete_exam_halls = db.query(Room).filter(
            or_(Room.room_type == RoomType.examination_hall, Room.is_exam_eligible == True),
            Room.exam_capacity == None
        ).count()
        if incomplete_exam_halls > 0:
            warnings.append(f"{incomplete_exam_halls} examination halls have no exam capacity set.")

        # 4. Classes without primary classroom
        all_classes = db.query(Class).all()
        classes_without_room = [c for c in all_classes if c.default_room_id is None]
        if classes_without_room:
            warnings.append(f"{len(classes_without_room)} active classes have no primary classroom assigned.")

        # 5. Blocks with no active exam halls
        blocks = db.query(CampusBlock).all()
        for b in blocks:
            exam_halls_in_block = db.query(Room).filter(
                Room.block_id == b.id,
                or_(Room.room_type == RoomType.examination_hall, Room.is_exam_eligible == True),
                Room.is_active == True
            ).count()
            if exam_halls_in_block == 0:
                warnings.append(f"Block '{b.name}' ({b.code}) has no active examination hall.")

        return CampusStructureMetricsOut(
            total_blocks=total_blocks,
            total_floors=total_floors,
            total_rooms=total_rooms,
            total_classrooms=total_classrooms,
            total_labs=total_labs,
            total_exam_halls=total_exam_halls,
            total_other_rooms=max(0, total_other),
            unmapped_departments_count=len(unmapped_depts),
            unassigned_classrooms_count=unassigned_classrooms,
            classes_without_room_count=len(classes_without_room),
            warnings=warnings
        )

    # ── Global Campus Search ──────────────────────────────────────────────────

    @staticmethod
    def search_campus(db: Session, query: str) -> CampusSearchResponse:
        q_str = f"%{query.strip()}%"
        results: List[CampusSearchItemOut] = []

        # 1. Search Rooms
        rooms = db.query(Room).filter(
            or_(Room.room_number.ilike(q_str), Room.room_name.ilike(q_str))
        ).options(joinedload(Room.block), joinedload(Room.floor), joinedload(Room.department)).limit(20).all()

        for r in rooms:
            b_name = r.block.name if r.block else "Unassigned Block"
            f_name = r.floor.floor_name if r.floor else "Unassigned Floor"
            results.append(CampusSearchItemOut(
                category="ROOM",
                title=r.room_name or r.room_number,
                subtitle=f"{b_name} · {f_name} · {r.room_type.value.replace('_', ' ').title()}",
                block_name=b_name,
                floor_name=f_name,
                room_number=r.room_number,
                room_type=r.room_type.value,
                capacity=r.capacity,
                target_id=r.id
            ))

        # 2. Search Departments
        departments = db.query(Department).filter(
            or_(Department.name.ilike(q_str), Department.code.ilike(q_str))
        ).limit(10).all()

        for d in departments:
            # find blocks or rooms associated
            d_blocks = db.query(CampusBlock).filter(CampusBlock.department_id == d.id).all()
            b_names = ", ".join(b.name for b in d_blocks) if d_blocks else "No primary block"
            results.append(CampusSearchItemOut(
                category="DEPARTMENT",
                title=d.name,
                subtitle=f"Code: {d.code} · Primary Block: {b_names}",
                target_id=d.id
            ))

        # 3. Search Blocks
        blocks = db.query(CampusBlock).filter(
            or_(CampusBlock.name.ilike(q_str), CampusBlock.code.ilike(q_str))
        ).limit(10).all()

        for b in blocks:
            results.append(CampusSearchItemOut(
                category="BLOCK",
                title=b.name,
                subtitle=f"Code: {b.code} · {b.floors_count} Floors",
                block_name=b.name,
                target_id=b.id
            ))

        return CampusSearchResponse(
            query=query,
            total_results=len(results),
            results=results
        )

    # ── Export & Import ───────────────────────────────────────────────────────

    @staticmethod
    def export_csv(db: Session) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Block Code", "Block Name", "Floor Number", "Floor Name",
            "Room Code", "Room Name", "Room Type", "Capacity",
            "Exam Eligible", "Exam Capacity", "Department Code", "Class Name"
        ])

        rooms = db.query(Room).options(
            joinedload(Room.block),
            joinedload(Room.floor),
            joinedload(Room.department),
            joinedload(Room.primary_class)
        ).order_by(Room.room_number).all()

        for r in rooms:
            writer.writerow([
                r.block.code if r.block else "",
                r.block.name if r.block else "",
                r.floor.floor_number if r.floor else "",
                r.floor.floor_name if r.floor else "",
                r.room_number,
                r.room_name or r.room_number,
                r.room_type.value,
                r.capacity,
                "YES" if r.is_exam_eligible else "NO",
                r.exam_capacity or "",
                r.department.code if r.department else "",
                r.primary_class.name if r.primary_class else ""
            ])

        return output.getvalue()

    @staticmethod
    def validate_csv_import(db: Session, csv_content: str) -> CampusStructureImportValidationOut:
        reader = csv.DictReader(io.StringIO(csv_content))
        total_rows = 0
        valid_count = 0
        warning_count = 0
        error_count = 0
        details = []
        preview_rows = []

        dept_codes = {d.code.upper(): d.id for d in db.query(Department).all()}
        existing_rooms = {r_num for (r_num,) in db.query(Room.room_number).all()}
        seen_in_batch = set()

        for idx, row in enumerate(reader, start=1):
            total_rows += 1
            room_code = row.get("Room Code", "").strip()
            block_code = row.get("Block Code", "").strip()
            floor_name = row.get("Floor Name", "").strip()
            dept_code = row.get("Department Code", "").strip().upper()

            if not room_code:
                error_count += 1
                details.append(f"Row {idx}: Missing Room Code.")
                continue

            if room_code in seen_in_batch:
                error_count += 1
                details.append(f"Row {idx}: Duplicate Room Code '{room_code}' within the file.")
                continue
            seen_in_batch.add(room_code)

            row_warnings = []
            if room_code in existing_rooms:
                row_warnings.append("Will update existing room")

            if dept_code and dept_code not in dept_codes:
                row_warnings.append(f"Department '{dept_code}' does not exist in FAFLOW")

            if not block_code:
                row_warnings.append("No block assigned")

            if row_warnings:
                warning_count += 1

            valid_count += 1
            if len(preview_rows) < 15:
                preview_rows.append({
                    "row": idx,
                    "room_code": room_code,
                    "block": block_code,
                    "floor": floor_name,
                    "type": row.get("Room Type", "classroom"),
                    "capacity": row.get("Capacity", "60"),
                    "notes": "; ".join(row_warnings) if row_warnings else "Valid"
                })

        return CampusStructureImportValidationOut(
            total_rows=total_rows,
            valid_count=valid_count,
            warning_count=warning_count,
            error_count=error_count,
            can_commit=error_count == 0 and total_rows > 0,
            details=details[:50],
            preview_rows=preview_rows
        )

    @staticmethod
    def commit_csv_import(db: Session, csv_content: str, user_id: Optional[int] = None) -> CampusStructureImportCommitOut:
        validation = CampusStructureService.validate_csv_import(db, csv_content)
        if not validation.can_commit:
            raise HTTPException(status_code=400, detail="Cannot commit import due to validation errors. Please correct and re-validate.")

        reader = csv.DictReader(io.StringIO(csv_content))
        blocks_created = 0
        floors_created = 0
        rooms_created = 0
        rooms_updated = 0

        block_cache = {b.code: b for b in db.query(CampusBlock).all()}
        floor_cache = {(f.block_id, f.floor_number): f for f in db.query(CampusFloor).all()}
        dept_cache = {d.code.upper(): d.id for d in db.query(Department).all()}

        for row in reader:
            block_code = row.get("Block Code", "").strip().upper()
            block_name = row.get("Block Name", "").strip() or block_code
            floor_num_str = row.get("Floor Number", "").strip()
            floor_name = row.get("Floor Name", "").strip() or "Ground Floor"
            room_code = row.get("Room Code", "").strip()
            room_name = row.get("Room Name", "").strip() or room_code
            room_type_str = row.get("Room Type", "classroom").strip().lower()
            capacity_str = row.get("Capacity", "60").strip()
            exam_eligible_str = row.get("Exam Eligible", "NO").strip().upper()
            exam_cap_str = row.get("Exam Capacity", "").strip()
            dept_code = row.get("Department Code", "").strip().upper()

            block = None
            if block_code:
                if block_code not in block_cache:
                    block = CampusBlock(name=block_name, code=block_code, is_active=True)
                    db.add(block)
                    db.flush()
                    block_cache[block_code] = block
                    blocks_created += 1
                else:
                    block = block_cache[block_code]

            floor = None
            if block:
                try:
                    f_num = int(floor_num_str) if floor_num_str else 0
                except ValueError:
                    f_num = 0

                f_key = (block.id, f_num)
                if f_key not in floor_cache:
                    floor = CampusFloor(block_id=block.id, floor_number=f_num, floor_name=floor_name, display_order=f_num, is_active=True)
                    db.add(floor)
                    db.flush()
                    floor_cache[f_key] = floor
                    floors_created += 1
                else:
                    floor = floor_cache[f_key]

            # Resolve RoomType
            try:
                r_type = RoomType(room_type_str)
            except ValueError:
                r_type = RoomType.classroom

            capacity = int(capacity_str) if capacity_str.isdigit() else 60
            exam_cap = int(exam_cap_str) if exam_cap_str.isdigit() else None
            is_exam_eligible = exam_eligible_str in ("YES", "TRUE", "1") or r_type == RoomType.examination_hall
            dept_id = dept_cache.get(dept_code)

            existing_room = db.query(Room).filter(Room.room_number == room_code).first()
            if existing_room:
                existing_room.room_name = room_name
                existing_room.room_type = r_type
                existing_room.capacity = capacity
                if block:
                    existing_room.block_id = block.id
                if floor:
                    existing_room.floor_id = floor.id
                if dept_id:
                    existing_room.department_id = dept_id
                existing_room.is_exam_eligible = is_exam_eligible
                if exam_cap:
                    existing_room.exam_capacity = exam_cap
                rooms_updated += 1
            else:
                new_room = Room(
                    room_number=room_code,
                    room_name=room_name,
                    room_type=r_type,
                    capacity=capacity,
                    block_id=block.id if block else None,
                    floor_id=floor.id if floor else None,
                    department_id=dept_id,
                    is_exam_eligible=is_exam_eligible,
                    exam_capacity=exam_cap,
                    is_active=True
                )
                db.add(new_room)
                rooms_created += 1

        db.commit()
        CampusStructureService._log_audit(db, user_id, "CAMPUS_STRUCTURE_CSV_IMPORTED", {
            "blocks_created": blocks_created,
            "floors_created": floors_created,
            "rooms_created": rooms_created,
            "rooms_updated": rooms_updated
        })

        return CampusStructureImportCommitOut(
            blocks_created=blocks_created,
            floors_created=floors_created,
            rooms_created=rooms_created,
            rooms_updated=rooms_updated,
            message=f"Import successful! Created {blocks_created} blocks, {floors_created} floors, {rooms_created} rooms, and updated {rooms_updated} rooms."
        )
