from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ClassRollRuleBase(BaseModel):
    prefix: str = Field(..., min_length=1, max_length=20, description="Roll prefix e.g. 25UCS")
    start_number: int = Field(..., ge=1, description="Start roll number e.g. 1")
    end_number: int = Field(..., ge=1, description="End roll number e.g. 60")
    padding: int = Field(default=3, ge=1, le=10, description="Digit padding width (e.g. 3 for 001)")
    is_active: bool = True


class ClassRollRuleCreate(ClassRollRuleBase):
    academic_year_id: Optional[int] = None


class ClassRollRuleUpdate(BaseModel):
    prefix: Optional[str] = None
    start_number: Optional[int] = None
    end_number: Optional[int] = None
    padding: Optional[int] = None
    is_active: Optional[bool] = None


class ClassRollExceptionCreate(BaseModel):
    roll_number: str = Field(..., min_length=1, max_length=50)
    exception_type: str = Field(..., pattern="^(INCLUDE|EXCLUDE)$")
    reason: Optional[str] = Field(None, max_length=255)


class ClassRollExceptionOut(BaseModel):
    id: int
    class_roll_rule_id: int
    roll_number: str
    exception_type: str
    reason: Optional[str] = None
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassRollRuleOut(ClassRollRuleBase):
    id: int
    class_id: int
    academic_year_id: int
    academic_year_name: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    exceptions: List[ClassRollExceptionOut] = []

    model_config = ConfigDict(from_attributes=True)


class RollValidationPreviewOut(BaseModel):
    class_id: int
    class_name: str
    academic_year_id: int
    academic_year_name: str
    prefix: str
    start_number: int
    end_number: int
    expected_count: int
    found_count: int
    missing_rolls: List[str] = []
    additional_rolls: List[str] = []
    excluded_rolls: List[str] = []
    effective_count: int
    warnings: List[str] = []
    conflicts: List[str] = []


class EffectiveStudentItem(BaseModel):
    id: int
    roll_number: str
    roll_suffix: str
    name: str
    is_active: bool
    source: str  # "PRIMARY_RANGE", "ADDITIONAL"


class EffectiveRosterOut(BaseModel):
    class_id: int
    class_name: str
    section: str
    department_id: int
    academic_year_id: int
    academic_year_name: str
    total_effective: int
    students: List[EffectiveStudentItem]
    validation: RollValidationPreviewOut


# Bulk Import Schemas
class BulkStudentImportRow(BaseModel):
    row_number: int
    roll_number: str
    name: str
    status: str  # "VALID", "EXISTING_STUDENT", "INVALID_FORMAT", "CONFLICT"
    message: Optional[str] = None


class BulkStudentImportPreviewOut(BaseModel):
    total_rows: int
    valid_count: int
    warning_count: int
    error_count: int
    rows: List[BulkStudentImportRow]


class BulkStudentImportCommitRequest(BaseModel):
    academic_year_id: Optional[int] = None
    rows: List[BulkStudentImportRow]


class BulkStudentImportResultOut(BaseModel):
    created_students: int
    created_enrollments: int
    updated_enrollments: int
    total_enrolled: int = 0
    skipped_count: int
    message: str


# Rollover Schemas
class RolloverClassProgression(BaseModel):
    from_class_id: int
    from_class_name: str
    to_class_id: Optional[int] = None
    to_class_name: Optional[str] = None
    action: str  # "PROMOTE", "GRADUATE", "HOLD"
    eligible_count: int
    review_required_count: int


class AcademicYearRolloverPreviewOut(BaseModel):
    from_year_id: int
    from_year_name: str
    to_year_id: int
    to_year_name: str
    classes: List[RolloverClassProgression]
    total_eligible: int
    total_review_required: int
    warnings: List[str] = []


class AcademicYearRolloverExecuteRequest(BaseModel):
    from_year_id: int
    to_year_id: int
    progressions: List[RolloverClassProgression]


class AcademicYearRolloverResultOut(BaseModel):
    promoted_students: int
    graduated_students: int
    rules_copied: int
    message: str
