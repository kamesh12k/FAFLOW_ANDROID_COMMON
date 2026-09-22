from app.database import SessionLocal
from app.services.campus_structure_service import CampusStructureService
from app.schemas.campus_structure import (
    SmartBlockAutoFillRequest, SmartFloorConfig, RoomPatternPreviewRequest
)
from app.models.room import RoomType

db = SessionLocal()
try:
    print("--- 1. Testing Metrics & Warnings ---")
    metrics = CampusStructureService.get_structure_metrics(db)
    print(f"Total Blocks: {metrics.total_blocks}")
    print(f"Total Rooms: {metrics.total_rooms}")
    print(f"Warnings ({len(metrics.warnings)}):")
    for w in metrics.warnings[:3]:
        print(f"  * {w}")

    print("\n--- 2. Testing Pattern Preview ---")
    preview = CampusStructureService.preview_room_generation(db, RoomPatternPreviewRequest(
        pattern="A-{number}",
        start_num=101,
        count=5,
        room_type=RoomType.classroom,
        capacity=60
    ))
    print(f"Requested: {preview.total_requested}, Valid: {preview.valid_count}, Conflicts: {preview.conflict_count}")
    print(f"Sample: {[item.room_number for item in preview.items]}")

    print("\n--- 3. Testing Tree Fetch ---")
    tree = CampusStructureService.get_structure_tree(db)
    print(f"Institution: {tree.institution_name}, Blocks: {len(tree.blocks)}")

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY.")
finally:
    db.close()
