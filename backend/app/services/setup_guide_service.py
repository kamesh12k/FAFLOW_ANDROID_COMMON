from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.department import Department
from app.models.academic_calendar import AcademicYear, Semester
from app.models.room import Room
from app.models.user import User, Role
from app.models.class_ import Class
from app.models.subject import Subject
from app.models.student import Student
from app.models.day_order_calendar import CalendarDay, DayType
from app.models.timetable import TimetableSlot
from app.models.campus_geofence import CampusGeofence
from app.schemas.setup_guide import (
    SetupStepOut,
    SetupStepPrerequisite,
    ModuleReadinessOut,
    DataFlowNodeOut,
    DataFlowEdgeOut,
    DataFlowGraphOut,
    SetupReadinessResponse,
)


def get_setup_readiness(db: Session, tenant_department_id: Optional[int] = None) -> SetupReadinessResponse:
    """
    Evaluates live database configuration counts, computes prerequisite satisfaction,
    and returns verified dependency state for all modules and steps.
    """
    # 1. Live Record Counts
    dept_query = db.query(func.count(Department.id))
    if tenant_department_id:
        dept_query = dept_query.filter(Department.id == tenant_department_id)
    departments_count = dept_query.scalar() or 0

    academic_years_count = db.query(func.count(AcademicYear.id)).scalar() or 0
    semesters_count = db.query(func.count(Semester.id)).scalar() or 0

    room_query = db.query(func.count(Room.id))
    if tenant_department_id:
        room_query = room_query.filter(
            (Room.department_id == tenant_department_id) | (Room.department_id.is_(None))
        )
    rooms_count = room_query.scalar() or 0

    teacher_query = db.query(func.count(User.id)).filter(
        User.role.in_([Role.teacher, Role.admin]),
        User.is_active == True
    )
    if tenant_department_id:
        teacher_query = teacher_query.filter(User.department_id == tenant_department_id)
    teachers_count = teacher_query.scalar() or 0

    class_query = db.query(func.count(Class.id))
    if tenant_department_id:
        class_query = class_query.filter(Class.department_id == tenant_department_id)
    classes_count = class_query.scalar() or 0

    subject_query = db.query(func.count(Subject.id)).filter(Subject.is_archived == False)
    if tenant_department_id:
        subject_query = subject_query.filter(Subject.department_id == tenant_department_id)
    subjects_count = subject_query.scalar() or 0

    student_query = db.query(func.count(Student.id)).filter(Student.is_active == True)
    if tenant_department_id:
        student_query = student_query.filter(Student.department_id == tenant_department_id)
    students_count = student_query.scalar() or 0

    working_days_count = db.query(func.count(CalendarDay.id)).filter(
        CalendarDay.day_type == DayType.working,
        CalendarDay.day_order.isnot(None)
    ).scalar() or 0

    timetable_slots_query = db.query(func.count(TimetableSlot.id))
    if tenant_department_id:
        timetable_slots_query = timetable_slots_query.join(Class, TimetableSlot.class_id == Class.id).filter(
            Class.department_id == tenant_department_id
        )
    timetable_slots_count = timetable_slots_query.scalar() or 0

    geofences_count = db.query(func.count(CampusGeofence.id)).filter(
        CampusGeofence.is_active == True
    ).scalar() or 0

    # 2. Build Steps with Real Dependencies
    # Step 1: Departments
    step_departments = SetupStepOut(
        id="departments",
        step_number=1,
        title="Academic Departments",
        category="foundation",
        why_required="Departments are the root organizational units for faculty, students, classes, and course offerings.",
        what_depends_on_it=["Faculty & Staff Accounts", "Classes & Sections", "Course Subjects", "Student Enrollments", "Departmental Labs"],
        required_fields=["Department Name (e.g. Computer Science & Engineering)", "Unique Code (e.g. CSE)"],
        config_url="/admin/departments",
        action_text="Manage Departments",
        current_count=departments_count,
        unit_label="departments configured",
        status="ready" if departments_count > 0 else "not_started",
        is_complete=departments_count > 0,
        is_blocked=False,
        prerequisites=[],
    )

    # Step 2: Academic Year & Semesters
    ay_sem_ready = academic_years_count > 0 and semesters_count > 0
    step_calendar_terms = SetupStepOut(
        id="academic_terms",
        step_number=2,
        title="Academic Years & Semesters",
        category="foundation",
        why_required="Academic years and calendar terms establish the timeline for curriculum delivery, class schedules, and student attendance tracking.",
        what_depends_on_it=["Day Order Calendar", "Student Batch Enrollments", "Class Semester Rotations"],
        required_fields=["Academic Year Name (e.g. 2026-2027)", "Start Date", "End Date", "Semester Term Names (Odd / Even)"],
        config_url="/admin/academic-calendar",
        action_text="Configure Academic Calendar",
        current_count=academic_years_count,
        unit_label=f"{academic_years_count} academic year(s), {semesters_count} semester term(s)",
        status="ready" if ay_sem_ready else ("in_progress" if academic_years_count > 0 else "not_started"),
        is_complete=ay_sem_ready,
        is_blocked=False,
        prerequisites=[],
    )

    # Step 3: Rooms & Venues
    step_rooms = SetupStepOut(
        id="rooms",
        step_number=3,
        title="Rooms, Classrooms & Labs",
        category="structure",
        why_required="Physical rooms and specialized computer/engineering labs are assigned to timetable slots and class sections to prevent double-booking.",
        what_depends_on_it=["Timetable Allocations", "Room Availability Heatmaps", "Lab Staff Assignments"],
        required_fields=["Room Number / Name", "Room Type (Classroom / Lab)", "Seating Capacity", "Department Ownership (Optional)"],
        config_url="/admin/rooms",
        action_text="Configure Rooms & Labs",
        current_count=rooms_count,
        unit_label="rooms & labs registered",
        status="ready" if rooms_count > 0 else "not_started",
        is_complete=rooms_count > 0,
        is_blocked=False,
        prerequisites=[],
    )

    # Step 4: Teachers & Faculty Staff
    teachers_blocked = departments_count == 0
    teachers_prereqs = [
        SetupStepPrerequisite(
            id="departments",
            title="Academic Departments",
            is_satisfied=departments_count > 0,
            required_count=1,
            current_count=departments_count,
            message="At least one department is required before registering faculty."
        )
    ]
    step_teachers = SetupStepOut(
        id="teachers",
        step_number=4,
        title="Faculty & Teaching Staff",
        category="structure",
        why_required="Faculty members are assigned to timetable slots, take student attendance, apply for duty leaves, and act as substitution coverage.",
        what_depends_on_it=["Timetable Scheduling", "Student Attendance Marking", "Leave Management", "Substitution Dispatch", "Workload Credits"],
        required_fields=["Full Name", "Email / Username", "Primary Department", "User Role (Teacher / HOD / Admin)"],
        config_url="/admin/teachers",
        action_text="Manage Faculty",
        current_count=teachers_count,
        unit_label="faculty members active",
        status="ready" if teachers_count > 0 else ("blocked" if teachers_blocked else "not_started"),
        is_complete=teachers_count > 0,
        is_blocked=teachers_blocked,
        prerequisites=teachers_prereqs,
        block_reason="Create at least one department first." if teachers_blocked else None,
    )

    # Step 5: Classes & Sections
    classes_blocked = departments_count == 0
    classes_prereqs = [
        SetupStepPrerequisite(
            id="departments",
            title="Academic Departments",
            is_satisfied=departments_count > 0,
            required_count=1,
            current_count=departments_count,
            message="A department must be chosen when creating a class."
        )
    ]
    step_classes = SetupStepOut(
        id="classes",
        step_number=5,
        title="Classes & Sections",
        category="structure",
        why_required="Classes group students into academic cohorts (e.g. CSE-A, Sem 5) for timetable scheduling, daily attendance, and course delivery.",
        what_depends_on_it=["Student Directory", "Timetable Matrix", "Classwise Timetables", "Student Attendance Records", "Class Faculty Directory"],
        required_fields=["Class Name (e.g. III B.Tech CSE)", "Section (A/B/C)", "Department", "Curriculum Semester (1-8)", "Default Room (Optional)"],
        config_url="/admin/classes",
        action_text="Configure Classes",
        current_count=classes_count,
        unit_label="class sections created",
        status="ready" if classes_count > 0 else ("blocked" if classes_blocked else "not_started"),
        is_complete=classes_count > 0,
        is_blocked=classes_blocked,
        prerequisites=classes_prereqs,
        block_reason="Create at least one department before adding classes." if classes_blocked else None,
    )

    # Step 6: Course Subjects
    subjects_blocked = departments_count == 0
    subjects_prereqs = [
        SetupStepPrerequisite(
            id="departments",
            title="Academic Departments",
            is_satisfied=departments_count > 0,
            required_count=1,
            current_count=departments_count,
            message="Subjects belong to specific academic departments."
        )
    ]
    step_subjects = SetupStepOut(
        id="subjects",
        step_number=6,
        title="Course Subjects & Curriculum",
        category="curriculum",
        why_required="Subjects define the theory and laboratory courses taught during each semester with assigned credit weights.",
        what_depends_on_it=["Timetable Scheduling", "Student Attendance by Course", "Faculty Credit Tracking"],
        required_fields=["Subject Code (e.g. CS3501)", "Subject Name (e.g. Compiler Design)", "Department", "Subject Type (Theory/Lab)", "Credits", "Semester"],
        config_url="/admin/subjects",
        action_text="Manage Subjects",
        current_count=subjects_count,
        unit_label="subjects cataloged",
        status="ready" if subjects_count > 0 else ("blocked" if subjects_blocked else "not_started"),
        is_complete=subjects_count > 0,
        is_blocked=subjects_blocked,
        prerequisites=subjects_prereqs,
        block_reason="Create at least one department before cataloging subjects." if subjects_blocked else None,
    )

    # Step 7: Student Master Directory
    students_blocked = classes_count == 0 or departments_count == 0
    students_prereqs = [
        SetupStepPrerequisite(
            id="classes",
            title="Classes & Sections",
            is_satisfied=classes_count > 0,
            required_count=1,
            current_count=classes_count,
            message="Students must be enrolled in an active class section."
        ),
        SetupStepPrerequisite(
            id="departments",
            title="Academic Departments",
            is_satisfied=departments_count > 0,
            required_count=1,
            current_count=departments_count,
            message="Students belong to a department."
        )
    ]
    step_students = SetupStepOut(
        id="students",
        step_number=7,
        title="Student Master Directory",
        category="structure",
        why_required="Enrolled students receive attendance marks during each class period and feed student attendance analytics.",
        what_depends_on_it=["Daily Student Attendance Marking", "Student Absence Alerts", "Attendance Percentage Calculations"],
        required_fields=["Register Number / Unique Student ID", "Roll Number", "Student Name", "Assigned Class & Section", "Department"],
        config_url="/admin/classes",
        action_text="Import / Add Students",
        current_count=students_count,
        unit_label="students enrolled",
        status="ready" if students_count > 0 else ("blocked" if students_blocked else "not_started"),
        is_complete=students_count > 0,
        is_blocked=students_blocked,
        prerequisites=students_prereqs,
        block_reason="Create at least one class before enrolling students." if students_blocked else None,
    )

    # Step 8: Day Order Calendar & Working Days
    day_orders_blocked = academic_years_count == 0
    day_orders_prereqs = [
        SetupStepPrerequisite(
            id="academic_terms",
            title="Academic Years & Semesters",
            is_satisfied=academic_years_count > 0,
            required_count=1,
            current_count=academic_years_count,
            message="Day orders must be anchored to an Academic Year timeline."
        )
    ]
    step_day_orders = SetupStepOut(
        id="day_orders",
        step_number=8,
        title="Day Order Calendar & Working Schedule",
        category="scheduling",
        why_required="FAFLOW operates on an institutional 6-Day Order cycle (Day 1 to Day 6). Calendar dates map to Day Orders and identify holidays/exams.",
        what_depends_on_it=["Daily Timetable Resolution", "Daily Attendance Sessions", "Leave Date Substitution Mapping", "Staff Check-in Validation"],
        required_fields=["Academic Year Date Range", "Day Order Sequence (1-6)", "Holiday / Non-working Day Exemptions"],
        config_url="/admin/academic-calendar",
        action_text="Generate Day Order Schedule",
        current_count=working_days_count,
        unit_label="working day orders configured",
        status="ready" if working_days_count > 0 else ("blocked" if day_orders_blocked else "not_started"),
        is_complete=working_days_count > 0,
        is_blocked=day_orders_blocked,
        prerequisites=day_orders_prereqs,
        block_reason="Configure an Academic Year before generating Day Orders." if day_orders_blocked else None,
    )

    # Step 9: Master Timetable Matrix
    timetable_blocked = classes_count == 0 or subjects_count == 0 or teachers_count == 0
    timetable_prereqs = [
        SetupStepPrerequisite(
            id="classes",
            title="Classes & Sections",
            is_satisfied=classes_count > 0,
            required_count=1,
            current_count=classes_count,
            message="Timetable slots require classes."
        ),
        SetupStepPrerequisite(
            id="subjects",
            title="Course Subjects",
            is_satisfied=subjects_count > 0,
            required_count=1,
            current_count=subjects_count,
            message="Timetable slots require course subjects."
        ),
        SetupStepPrerequisite(
            id="teachers",
            title="Faculty Members",
            is_satisfied=teachers_count > 0,
            required_count=1,
            current_count=teachers_count,
            message="Timetable slots require teachers assigned."
        )
    ]
    step_timetable = SetupStepOut(
        id="timetable",
        step_number=9,
        title="Master Timetable Allocations",
        category="scheduling",
        why_required="Timetable slots map Class + Subject + Teacher + Room to Day Orders (1-6) and Periods (1-5), powering the entire daily operations engine.",
        what_depends_on_it=["Teacher Daily Schedules", "Student Attendance Taking", "Auto-Substitution Matching", "Today's Coverage Monitor", "Room Utilization"],
        required_fields=["Class Section", "Subject", "Assigned Teacher", "Day Order (1-6)", "Period Number (1-5)", "Room / Lab (Optional)"],
        config_url="/admin/timetable",
        action_text="Build Timetable Schedule",
        current_count=timetable_slots_count,
        unit_label="timetable slots allocated",
        status="ready" if timetable_slots_count > 0 else ("blocked" if timetable_blocked else "not_started"),
        is_complete=timetable_slots_count > 0,
        is_blocked=timetable_blocked,
        prerequisites=timetable_prereqs,
        block_reason="Ensure Classes, Subjects, and Faculty exist before building timetable slots." if timetable_blocked else None,
    )

    # Step 10: Campus Geofence & Governance Controls
    step_geofences = SetupStepOut(
        id="campus_geofence",
        step_number=10,
        title="Campus Geofence & Check-In Boundaries",
        category="operations",
        why_required="Defines geographical GPS polygons/radii for staff physical presence verification during mobile attendance check-in/out.",
        what_depends_on_it=["Mobile Geofence Attendance", "Location Spoofing Prevention", "Attendance In-Campus Validation"],
        required_fields=["Geofence Zone Name", "Latitude", "Longitude", "Radius in meters (or Polygon Boundary Coordinates)"],
        config_url="/admin/geofences",
        action_text="Configure Geofences",
        current_count=geofences_count,
        unit_label="active geofence zones",
        status="ready" if geofences_count > 0 else "not_started",
        is_complete=geofences_count > 0,
        is_blocked=False,
        prerequisites=[],
    )

    all_steps = [
        step_departments,
        step_calendar_terms,
        step_rooms,
        step_teachers,
        step_classes,
        step_subjects,
        step_students,
        step_day_orders,
        step_timetable,
        step_geofences,
    ]

    completed_steps = sum(1 for s in all_steps if s.is_complete)
    total_steps = len(all_steps)
    progress_percent = int((completed_steps / total_steps) * 100)

    # Determine next recommended step: First step that is NOT complete and NOT blocked
    next_rec = next((s for s in all_steps if not s.is_complete and not s.is_blocked), None)
    if not next_rec:
        # If none unblocked, pick first uncompleted
        next_rec = next((s for s in all_steps if not s.is_complete), None)

    # 3. Module Readiness Evaluation
    # Module: Student Attendance
    student_att_reqs = [
        SetupStepPrerequisite(id="classes", title="Classes & Sections", is_satisfied=classes_count > 0, required_count=1, current_count=classes_count),
        SetupStepPrerequisite(id="students", title="Students Enrolled", is_satisfied=students_count > 0, required_count=1, current_count=students_count),
        SetupStepPrerequisite(id="subjects", title="Course Subjects", is_satisfied=subjects_count > 0, required_count=1, current_count=subjects_count),
        SetupStepPrerequisite(id="teachers", title="Faculty Members", is_satisfied=teachers_count > 0, required_count=1, current_count=teachers_count),
        SetupStepPrerequisite(id="timetable", title="Timetable Slots", is_satisfied=timetable_slots_count > 0, required_count=1, current_count=timetable_slots_count),
        SetupStepPrerequisite(id="day_orders", title="Working Day Orders", is_satisfied=working_days_count > 0, required_count=1, current_count=working_days_count),
    ]
    missing_att = [r.title for r in student_att_reqs if not r.is_satisfied]
    att_status = "READY" if len(missing_att) == 0 else ("PARTIALLY_READY" if len(missing_att) <= 2 else "NOT_READY")

    # Module: Staff Attendance
    staff_att_reqs = [
        SetupStepPrerequisite(id="teachers", title="Staff & Faculty", is_satisfied=teachers_count > 0, required_count=1, current_count=teachers_count),
        SetupStepPrerequisite(id="campus_geofence", title="Campus Geofence", is_satisfied=geofences_count > 0, required_count=1, current_count=geofences_count),
        SetupStepPrerequisite(id="day_orders", title="Day Order Calendar", is_satisfied=working_days_count > 0, required_count=1, current_count=working_days_count),
    ]
    missing_staff_att = [r.title for r in staff_att_reqs if not r.is_satisfied]
    staff_att_status = "READY" if len(missing_staff_att) == 0 else "NOT_READY"

    # Module: Leaves & Approvals
    leave_reqs = [
        SetupStepPrerequisite(id="teachers", title="Faculty & Staff Accounts", is_satisfied=teachers_count > 0, required_count=1, current_count=teachers_count),
        SetupStepPrerequisite(id="departments", title="Academic Departments", is_satisfied=departments_count > 0, required_count=1, current_count=departments_count),
    ]
    missing_leaves = [r.title for r in leave_reqs if not r.is_satisfied]
    leave_status = "READY" if len(missing_leaves) == 0 else "NOT_READY"

    # Module: Substitution Workflow
    sub_reqs = [
        SetupStepPrerequisite(id="teachers", title="Faculty Members", is_satisfied=teachers_count > 0, required_count=1, current_count=teachers_count),
        SetupStepPrerequisite(id="timetable", title="Timetable Slots", is_satisfied=timetable_slots_count > 0, required_count=1, current_count=timetable_slots_count),
        SetupStepPrerequisite(id="day_orders", title="Day Order Calendar", is_satisfied=working_days_count > 0, required_count=1, current_count=working_days_count),
    ]
    missing_sub = [r.title for r in sub_reqs if not r.is_satisfied]
    sub_status = "READY" if len(missing_sub) == 0 else "NOT_READY"

    # Module: Master Timetable
    tt_reqs = [
        SetupStepPrerequisite(id="classes", title="Classes & Sections", is_satisfied=classes_count > 0, required_count=1, current_count=classes_count),
        SetupStepPrerequisite(id="subjects", title="Course Subjects", is_satisfied=subjects_count > 0, required_count=1, current_count=subjects_count),
        SetupStepPrerequisite(id="teachers", title="Faculty Members", is_satisfied=teachers_count > 0, required_count=1, current_count=teachers_count),
    ]
    missing_tt = [r.title for r in tt_reqs if not r.is_satisfied]
    tt_status = "READY" if len(missing_tt) == 0 else "NOT_READY"

    module_readiness = [
        ModuleReadinessOut(
            id="student_attendance",
            name="Student Attendance Module",
            description="Allows teachers to mark period attendance with real-time student absence tracking and analytics.",
            status=att_status,
            status_label="Operational & Ready" if att_status == "READY" else ("Partially Configured" if att_status == "PARTIALLY_READY" else "Prerequisites Incomplete"),
            route_url="/admin/student-attendance",
            action_text="Open Student Attendance",
            requirements=student_att_reqs,
            missing_prerequisites=missing_att,
        ),
        ModuleReadinessOut(
            id="timetable",
            name="Master Timetable & Scheduling",
            description="Controls weekly class schedules, room allocations, and faculty period assignments.",
            status=tt_status,
            status_label="Ready for Scheduling" if tt_status == "READY" else "Prerequisites Required",
            route_url="/admin/timetable",
            action_text="Open Timetable Grid",
            requirements=tt_reqs,
            missing_prerequisites=missing_tt,
        ),
        ModuleReadinessOut(
            id="substitutions",
            name="Leave & Auto-Substitution Engine",
            description="Finds conflict-free substitute faculty and dispatches alter-assignment alerts when teachers take leave.",
            status=sub_status,
            status_label="Active & Ready" if sub_status == "READY" else "Requires Timetable & Calendar",
            route_url="/admin/today-substitutions",
            action_text="View Substitutions",
            requirements=sub_reqs,
            missing_prerequisites=missing_sub,
        ),
        ModuleReadinessOut(
            id="staff_attendance",
            name="Staff Geofence Check-In",
            description="Validates physical presence on campus for staff punch-in and duty logs.",
            status=staff_att_status,
            status_label="Geofence Enabled" if staff_att_status == "READY" else "Geofence Zone Needed",
            route_url="/admin/attendance",
            action_text="Open Staff Attendance",
            requirements=staff_att_reqs,
            missing_prerequisites=missing_staff_att,
        ),
        ModuleReadinessOut(
            id="leaves",
            name="Faculty Leave Management",
            description="Processes staff leave applications, multi-tier approvals, and duty leave quota tracking.",
            status=leave_status,
            status_label="Ready for Submissions" if leave_status == "READY" else "Setup Staff First",
            route_url="/admin/leaves",
            action_text="Manage Leaves",
            requirements=leave_reqs,
            missing_prerequisites=missing_leaves,
        ),
    ]

    # 4. Verified Data Flow Graph (Nodes & Edges)
    data_flow_nodes = [
        DataFlowNodeOut(id="departments", label="Departments", category="Foundation", purpose="Root organizational unit", used_by=["Faculty", "Classes", "Subjects", "Rooms"], current_count=departments_count, config_url="/admin/departments"),
        DataFlowNodeOut(id="academic_year", label="Academic Year & Terms", category="Foundation", purpose="Defines term timeline", used_by=["Calendar Days", "Classes", "Enrollments"], current_count=academic_years_count, config_url="/admin/academic-calendar"),
        DataFlowNodeOut(id="rooms", label="Rooms & Labs", category="Structure", purpose="Physical venues for classes and labs", used_by=["Classes", "Timetable"], current_count=rooms_count, config_url="/admin/rooms"),
        DataFlowNodeOut(id="teachers", label="Faculty & Staff", category="People", purpose="Teaches classes, takes attendance, takes leave", used_by=["Timetable", "Attendance", "Substitutions", "Credits"], current_count=teachers_count, config_url="/admin/teachers"),
        DataFlowNodeOut(id="classes", label="Classes & Sections", category="Structure", purpose="Student cohort group", used_by=["Students", "Timetable", "Attendance"], current_count=classes_count, config_url="/admin/classes"),
        DataFlowNodeOut(id="subjects", label="Course Subjects", category="Curriculum", purpose="Curriculum courses with credit units", used_by=["Timetable", "Attendance", "Credits"], current_count=subjects_count, config_url="/admin/subjects"),
        DataFlowNodeOut(id="students", label="Student Directory", category="People", purpose="Enrolled students receiving attendance", used_by=["Student Attendance", "Analytics"], current_count=students_count, config_url="/admin/classes"),
        DataFlowNodeOut(id="calendar_days", label="Day Order Calendar", category="Scheduling", purpose="Maps daily dates to Day Orders (1-6)", used_by=["Timetable Matching", "Attendance", "Substitutions"], current_count=working_days_count, config_url="/admin/academic-calendar"),
        DataFlowNodeOut(id="timetable", label="Timetable Matrix", category="Scheduling", purpose="Slot allocation (Class + Subject + Teacher + Period)", used_by=["Attendance Sessions", "Substitutions", "Live Coverage"], current_count=timetable_slots_count, config_url="/admin/timetable"),
        DataFlowNodeOut(id="attendance", label="Student Attendance", category="Operations", purpose="Daily period-wise attendance records", used_by=["Attendance Reports", "Student Absence Alerts"], current_count=0, config_url="/admin/student-attendance"),
        DataFlowNodeOut(id="substitutions", label="Alter Assignments", category="Operations", purpose="Automated substitute coverage for approved leaves", used_by=["Schedule Replacement", "Faculty Credits"], current_count=0, config_url="/admin/today-substitutions"),
    ]

    data_flow_edges = [
        DataFlowEdgeOut(from_node="departments", to_node="teachers", relationship="Affiliated with", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="departments", to_node="classes", relationship="Owns", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="departments", to_node="subjects", relationship="Offers", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="departments", to_node="rooms", relationship="Allocates", is_hard_dependency=False),
        DataFlowEdgeOut(from_node="academic_year", to_node="calendar_days", relationship="Schedules terms for", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="classes", to_node="students", relationship="Enrolls", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="classes", to_node="timetable", relationship="Assigned to slot", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="subjects", to_node="timetable", relationship="Taught in slot", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="teachers", to_node="timetable", relationship="Conducts slot", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="rooms", to_node="timetable", relationship="Hosts slot", is_hard_dependency=False),
        DataFlowEdgeOut(from_node="calendar_days", to_node="timetable", relationship="Resolves Day Order (1-6)", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="timetable", to_node="attendance", relationship="Generates daily sessions for", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="students", to_node="attendance", relationship="Marked present/absent in", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="timetable", to_node="substitutions", relationship="Identifies slot needing substitute", is_hard_dependency=True),
        DataFlowEdgeOut(from_node="teachers", to_node="substitutions", relationship="Assigned as available substitute", is_hard_dependency=True),
    ]

    overall_status = "ready" if progress_percent == 100 else ("in_progress" if progress_percent > 30 else "setup_required")

    return SetupReadinessResponse(
        total_steps=total_steps,
        completed_steps=completed_steps,
        progress_percent=progress_percent,
        overall_status=overall_status,
        next_recommended_step=next_rec,
        steps=all_steps,
        module_readiness=module_readiness,
        data_flow=DataFlowGraphOut(nodes=data_flow_nodes, edges=data_flow_edges),
    )
