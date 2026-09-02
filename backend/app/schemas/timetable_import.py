"""
schemas/timetable_import.py
───────────────────────────
Pydantic schemas for the timetable Excel import preview and commit endpoints.
"""

from pydantic import BaseModel, Field


class TimetableImportPreviewRow(BaseModel):
    """
    Represents a single parsed and resolved slot from the Excel sheet,
    returned during the preview stage for admin verification and mapping.
    """

    id: str = Field(
        ...,
        description="Unique temporary ID for the preview row to track edits in frontend.",
    )
    source_cell: str = Field(
        ...,
        description="Traceability coordinate in the Excel sheet (e.g. 'CS-STAFF!C5').",
    )
    raw_text: str = Field(
        ...,
        description="Raw, unmodified text from the Excel cell.",
    )
    day_order: int = Field(
        ...,
        description="Parsed Day Order rotation index (1 to 6).",
    )
    period_number: int = Field(
        ...,
        description="Parsed period index (1 to 5).",
    )

    # Teacher
    teacher_raw: str = Field(
        ...,
        description="Raw teacher name read from the block header.",
    )
    teacher_id: int | None = Field(
        None,
        description="Resolved teacher database ID, if matched.",
    )
    teacher_name: str | None = Field(
        None,
        description="Resolved teacher name in the database, if matched.",
    )

    # Class
    class_raw: str | None = Field(
        None,
        description="Raw class name extracted from the cell.",
    )
    class_id: int | None = Field(
        None,
        description="Resolved class database ID, if matched.",
    )
    class_name: str | None = Field(
        None,
        description="Resolved class formatted name + section, if matched.",
    )
    create_new_class: bool = Field(
        False,
        description="Flag indicating if this class needs to be auto-created.",
    )
    class_year: str | None = Field(
        None,
        description="Parsed year (roman numeral) for new class creation.",
    )
    class_section: str | None = Field(
        None,
        description="Parsed section letter for new class creation.",
    )
    class_department_id: int | None = Field(
        None,
        description="Teacher's department ID to assign the new class to.",
    )
    class_department_name: str | None = Field(
        None,
        description="Teacher's department name to display in the UI.",
    )

    # Subject
    subject_raw: str | None = Field(
        None,
        description="Raw subject name extracted from the cell.",
    )
    subject_id: int | None = Field(
        None,
        description="Resolved subject database ID, if matched.",
    )
    subject_name: str | None = Field(
        None,
        description="Resolved subject name in the database, if matched.",
    )
    subject_code: str | None = Field(
        None,
        description="Resolved subject code in the database, if matched.",
    )
    create_new_subject: bool = Field(
        False,
        description="Flag indicating if this subject needs to be auto-created.",
    )
    subject_type: str | None = Field(
        None,
        description="Resolved subject type ('lab' or 'theory') for auto-creation.",
    )

    # Room
    room_raw: str | None = Field(
        None,
        description="Raw room number extracted from the LAB suffix, if present.",
    )
    room_id: int | None = Field(
        None,
        description="Resolved room database ID, if matched.",
    )
    room_number: str | None = Field(
        None,
        description="Resolved room number in the database, if matched.",
    )

    # Matching Confidence Status
    status: str = Field(
        ...,
        description="Resolution status: 'resolved' or 'needs_review'.",
    )
    message: str = Field(
        ...,
        description="Human-readable explanation of the resolution confidence and matching details.",
    )


class TimetableImportPreviewSummary(BaseModel):
    """Summary counts for the preview response."""
    total_slots: int
    resolved_slots: int
    needs_review_slots: int
    skipped_no_class: int = 0


class TimetableImportPreviewResponse(BaseModel):
    """Full preview result returned to the frontend."""
    rows: list[TimetableImportPreviewRow]
    summary: TimetableImportPreviewSummary


from pydantic import BaseModel, Field, model_validator

class TimetableImportCommitRow(BaseModel):
    """
    A single timetable slot to be committed to the database.
    Supports either an existing teacher_id or a new teacher_name.
    Also supports class auto-creation.
    """
    teacher_id: int | None = Field(None, description="ID of the teacher, if existing.")
    teacher_name: str | None = Field(None, description="Name of the new teacher to create.")
    class_id: int | None = Field(None, description="ID of the class, if existing.")
    class_name: str | None = Field(None, description="Raw class name/year to create, if class_id is not provided.")
    class_section: str | None = Field(None, description="Section letter for the new class.")
    class_department_id: int | None = Field(None, description="Department to assign the new class to.")
    create_new_class: bool = Field(False, description="Flag indicating if this class needs to be auto-created.")
    class_year: str | None = Field(None, description="Parsed year (roman numeral) for new class creation.")
    subject_id: int | None = Field(None, description="ID of the subject (optional).")
    subject_name: str | None = Field(None, description="Name of the new subject to create.")
    subject_type: str | None = Field(None, description="Type of the subject ('lab' or 'theory') for auto-creation.")
    room_id: int | None = Field(None, description="Optional ID of the room.")
    day_order: int = Field(..., description="Day order rotation index (1-6).")
    period_number: int = Field(..., description="Period index (1-5).")


class TimetableImportCommitRequest(BaseModel):
    """Payload for committing edited/confirmed slots."""
    slots: list[TimetableImportCommitRow] = Field(..., description="List of slots to insert.")
    semester_for_new_classes: int | None = Field(None, description="Semester for newly created classes (1-8).")

    @model_validator(mode="after")
    def validate_semester_if_class_created(self) -> 'TimetableImportCommitRequest':
        needs_class_creation = any(s.class_id is None and (s.class_name or s.create_new_class) for s in self.slots)
        if needs_class_creation:
            if self.semester_for_new_classes is None:
                raise ValueError("semester_for_new_classes is required when creating a new class")
            if self.semester_for_new_classes < 1 or self.semester_for_new_classes > 8:
                raise ValueError("semester_for_new_classes must be between 1 and 8")
        return self


class TimetableImportResult(BaseModel):
    """Summary returned by POST /api/admin/timetable/import/commit."""

    teachers_processed: int = Field(
        ...,
        description="Distinct teacher blocks found and processed in the Excel.",
    )
    slots_inserted: int = Field(
        ...,
        description="Rows newly inserted into timetable_slots.",
    )
    duplicates_skipped: int = Field(
        ...,
        description="Slots that already existed (teacher+day+period) and were skipped.",
    )
    validation_errors: list[str] = Field(
        default_factory=list,
        description="Non-fatal resolution errors (unknown teacher/subject/class).",
    )
    conflicts: list[str] = Field(
        default_factory=list,
        description="Class-level scheduling conflicts detected across teacher blocks.",
    )
