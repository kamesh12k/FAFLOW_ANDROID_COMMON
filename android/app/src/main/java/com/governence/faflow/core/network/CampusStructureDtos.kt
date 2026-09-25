package com.governence.faflow.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CampusFloorDto(
    @Json(name = "id") val id: Int,
    @Json(name = "block_id") val blockId: Int,
    @Json(name = "floor_number") val floorNumber: Int,
    @Json(name = "floor_name") val floorName: String,
    @Json(name = "display_order") val displayOrder: Int = 0,
    @Json(name = "rooms_count") val roomsCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class CampusBlockDto(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "code") val code: String,
    @Json(name = "floors_count") val floorsCount: Int = 1,
    @Json(name = "description") val description: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "floors") val floors: List<CampusFloorDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CampusRoomDto(
    @Json(name = "id") val id: Int,
    @Json(name = "room_number") val roomNumber: String,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "room_type") val roomType: String = "classroom",
    @Json(name = "capacity") val capacity: Int = 60,
    @Json(name = "block_id") val blockId: Int? = null,
    @Json(name = "block_name") val blockName: String? = null,
    @Json(name = "floor_id") val floorId: Int? = null,
    @Json(name = "floor_name") val floorName: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "primary_class_id") val primaryClassId: Int? = null,
    @Json(name = "primary_class_name") val primaryClassName: String? = null,
    @Json(name = "is_exam_eligible") val isExamEligible: Boolean = false,
    @Json(name = "exam_capacity") val examCapacity: Int? = null,
    @Json(name = "required_invigilators") val requiredInvigilators: Int = 1,
    @Json(name = "lab_type") val labType: String? = null,
    @Json(name = "equipment_category") val equipmentCategory: String? = null,
    @Json(name = "is_timetable_eligible") val isTimetableEligible: Boolean = true,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "location_hierarchy") val locationHierarchy: String? = null
)

@JsonClass(generateAdapter = true)
data class StructureFloorNode(
    @Json(name = "id") val id: Int,
    @Json(name = "floor_number") val floorNumber: Int,
    @Json(name = "floor_name") val floorName: String,
    @Json(name = "rooms") val rooms: List<CampusRoomDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class StructureBlockNode(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "code") val code: String,
    @Json(name = "department_name") val departmentName: String? = null,
    @Json(name = "floors") val floors: List<StructureFloorNode> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CampusStructureTreeResponse(
    @Json(name = "institution_name") val institutionName: String = "Campus Structure",
    @Json(name = "blocks") val blocks: List<StructureBlockNode> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CampusStructureMetricsDto(
    @Json(name = "total_blocks") val totalBlocks: Int = 0,
    @Json(name = "total_floors") val totalFloors: Int = 0,
    @Json(name = "total_rooms") val totalRooms: Int = 0,
    @Json(name = "total_classrooms") val totalClassrooms: Int = 0,
    @Json(name = "total_labs") val totalLabs: Int = 0,
    @Json(name = "total_exam_halls") val totalExamHalls: Int = 0,
    @Json(name = "total_other_rooms") val totalOtherRooms: Int = 0,
    @Json(name = "unmapped_departments_count") val unmappedDepartmentsCount: Int = 0,
    @Json(name = "unassigned_classrooms_count") val unassignedClassroomsCount: Int = 0,
    @Json(name = "classes_without_room_count") val classesWithoutRoomCount: Int = 0,
    @Json(name = "warnings") val warnings: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class PatternPreviewItemDto(
    @Json(name = "room_number") val roomNumber: String,
    @Json(name = "room_name") val roomName: String? = null,
    @Json(name = "is_conflict") val isConflict: Boolean = false,
    @Json(name = "conflict_reason") val conflictReason: String? = null
)

@JsonClass(generateAdapter = true)
data class PatternPreviewResponseDto(
    @Json(name = "total_requested") val totalRequested: Int = 0,
    @Json(name = "valid_count") val validCount: Int = 0,
    @Json(name = "conflict_count") val conflictCount: Int = 0,
    @Json(name = "items") val items: List<PatternPreviewItemDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class RoomPatternPreviewRequestDto(
    @Json(name = "pattern") val pattern: String,
    @Json(name = "start_num") val startNum: Int = 1,
    @Json(name = "count") val count: Int = 10,
    @Json(name = "room_type") val roomType: String = "classroom",
    @Json(name = "capacity") val capacity: Int = 60
)

@JsonClass(generateAdapter = true)
data class SmartFloorConfigDto(
    @Json(name = "floor_number") val floorNumber: Int,
    @Json(name = "floor_name") val floorName: String,
    @Json(name = "room_count") val roomCount: Int = 10,
    @Json(name = "start_num") val startNum: Int = 1,
    @Json(name = "pattern") val pattern: String = "{floor}{number:02d}",
    @Json(name = "room_type") val roomType: String = "classroom",
    @Json(name = "capacity") val capacity: Int = 60,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "is_exam_eligible") val isExamEligible: Boolean = false,
    @Json(name = "exam_capacity") val examCapacity: Int? = null,
    @Json(name = "required_invigilators") val requiredInvigilators: Int = 1
)

@JsonClass(generateAdapter = true)
data class SmartBlockAutoFillRequestDto(
    @Json(name = "block_name") val blockName: String,
    @Json(name = "block_code") val blockCode: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "floors") val floors: List<SmartFloorConfigDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class SmartBlockAutoFillResponseDto(
    @Json(name = "block") val block: CampusBlockDto,
    @Json(name = "total_floors_created") val totalFloorsCreated: Int,
    @Json(name = "total_rooms_created") val totalRoomsCreated: Int,
    @Json(name = "message") val message: String
)

@JsonClass(generateAdapter = true)
data class BulkRoomAssignRequestDto(
    @Json(name = "room_ids") val roomIds: List<Int>,
    @Json(name = "room_type") val roomType: String? = null,
    @Json(name = "department_id") val departmentId: Int? = null,
    @Json(name = "primary_class_id") val primaryClassId: Int? = null,
    @Json(name = "is_exam_eligible") val isExamEligible: Boolean? = null,
    @Json(name = "exam_capacity") val examCapacity: Int? = null,
    @Json(name = "required_invigilators") val requiredInvigilators: Int? = null,
    @Json(name = "is_active") val isActive: Boolean? = null
)

@JsonClass(generateAdapter = true)
data class BulkAssignResponseDto(
    @Json(name = "updated_count") val updatedCount: Int,
    @Json(name = "message") val message: String
)

@JsonClass(generateAdapter = true)
data class DuplicateBlockRequestDto(
    @Json(name = "new_block_name") val newBlockName: String,
    @Json(name = "new_block_code") val newBlockCode: String,
    @Json(name = "prefix_replace_from") val prefixReplaceFrom: String? = null,
    @Json(name = "prefix_replace_to") val prefixReplaceTo: String? = null
)

@JsonClass(generateAdapter = true)
data class DuplicateBlockResponseDto(
    @Json(name = "new_block") val newBlock: CampusBlockDto,
    @Json(name = "cloned_floors_count") val clonedFloorsCount: Int,
    @Json(name = "cloned_rooms_count") val clonedRoomsCount: Int,
    @Json(name = "message") val message: String
)

@JsonClass(generateAdapter = true)
data class CampusSearchResultItemDto(
    @Json(name = "category") val category: String,
    @Json(name = "title") val title: String,
    @Json(name = "subtitle") val subtitle: String,
    @Json(name = "room_id") val roomId: Int? = null,
    @Json(name = "room_number") val roomNumber: String? = null,
    @Json(name = "block_id") val blockId: Int? = null,
    @Json(name = "block_name") val blockName: String? = null,
    @Json(name = "details") val details: Map<String, String>? = null
)

@JsonClass(generateAdapter = true)
data class CampusSearchResponseDto(
    @Json(name = "query") val query: String,
    @Json(name = "total_results") val totalResults: Int,
    @Json(name = "results") val results: List<CampusSearchResultItemDto> = emptyList()
)
