import os
import re

services_dir = 'b:/FAFLOW_UNIFIED/backend/app/services'
findings = []

for file in sorted(os.listdir(services_dir)):
    if file.endswith('.py') and file != '__init__.py':
        filepath = os.path.join(services_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find queries on models without department filtering
        # Check methods in the service
        methods = re.finditer(r'def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)', content)
        for m in methods:
            m_name = m.group(1)
            params = m.group(2)
            # Find end of function
            start = m.end()
            next_m = re.search(r'\n    def\s+', content[start:])
            body = content[start:start + next_m.start()] if next_m else content[start:]

            # Look for db.query(...)
            queries = re.findall(r'db\.query\(([A-Za-z0-9_]+)\)', body)
            for q in queries:
                if q in ('User', 'StaffAttendanceRecord', 'LeaveRequest', 'AttendanceSession', 'Student', 'Class', 'TimetableSlot'):
                    # Check if body contains department_id or tenant_department_id
                    has_dept = 'department_id' in body or 'tenant_department_id' in body or 'dept_id' in body
                    if not has_dept and 'current_user' in params:
                        findings.append((file, m_name, q, params))

print(f"Total potential unscoped queries with current_user in params: {len(findings)}")
for f in set(findings):
    print(f"  {f[0]:30} | {f[1]:30} | {f[2]}")
