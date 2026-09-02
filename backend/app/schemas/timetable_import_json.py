from pydantic import BaseModel, Field
import re

class TimetableJsonImportSlot(BaseModel):
    teacher_name: str = Field(
        ...,
        description="Full name of the teacher as it would appear on the timetable, e.g. 'Dr.V.VIJAYA DEEPA'"
    )
    day_order: int = Field(
        ...,
        ge=1,
        le=6,
        description="Day Order rotation index (1 to 6)"
    )
    period_number: int = Field(
        ...,
        ge=1,
        le=5,
        description="Period index (1 to 5)"
    )
    subject_raw: str = Field(
        ...,
        description="Subject name or code as written in the source sheet"
    )
    class_raw: str | None = Field(
        None,
        description="Class and section, e.g. 'I CS A', or null if not applicable"
    )
    room_raw: str | None = Field(
        None,
        description="Room number if a lab/room is specified, else null"
    )

class TimetableJsonImportRequest(BaseModel):
    slots: list[TimetableJsonImportSlot] = Field(
        ...,
        description="List of raw timetable slots to preview and resolve."
    )


def get_ai_prompt_template() -> str:
    import typing
    # Query schema descriptions dynamically from TimetableJsonImportSlot
    fields_desc = []
    
    # We retrieve the field info dynamically to avoid drift
    for field_name, field in TimetableJsonImportSlot.model_fields.items():
        desc = field.description or ""
        annotation = field.annotation
        origin = typing.get_origin(annotation)
        args = typing.get_args(annotation)
        
        is_optional = False
        base_type = annotation
        
        if origin is typing.Union or (hasattr(typing, "UnionType") and origin is typing.UnionType):
            is_optional = type(None) in args or any(a is None or getattr(a, "__name__", "") == "NoneType" for a in args)
            # Find the non-None type
            non_none_args = [a for a in args if a is not None and getattr(a, "__name__", "") != "NoneType"]
            if non_none_args:
                base_type = non_none_args[0]
        
        if base_type is int:
            if field_name == "day_order":
                type_str = "integer 1-6"
            elif field_name == "period_number":
                type_str = "integer 1-5"
            else:
                type_str = "integer"
        else:
            type_str = "string"
            
        if is_optional:
            type_str += " or null"
            
        fields_desc.append(f'      "{field_name}": "{type_str} — {desc}"')
        
    schema_str = "{\n  \"slots\": [\n    {\n" + ",\n".join(fields_desc) + "\n    }\n  ]\n}"
    
    return f"""You are converting a college timetable Excel file into JSON for import into FACREDIT.

Return ONLY valid JSON matching this schema, no markdown fences, no explanation:

{schema_str}

Rules:
- One object per (teacher, day_order, period_number) slot found in the sheet.
- Use null when a field is not present or unclear — do not guess.
- day_order and period_number must be integers, not strings.
- Do not invent slots that aren't in the sheet.
- Output must be valid, parseable JSON and nothing else.

Here is the timetable Excel file: [attach it here]"""
