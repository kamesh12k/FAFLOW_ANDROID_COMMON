import os
import re

services_dir = 'b:/FAFLOW_UNIFIED/backend/app/services'
findings = []

# Pattern to look for db.query on entities that should be department-scoped
scoped_models = ['User', 'LeaveRequest', 'TimetableSlot', 'TeacherCredit', 'Class', 'Subject', 'Student', 'StudentAttendanceRecord']

for root, dirs, files in os.walk(services_dir):
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                current_func = 'module'
                for idx, line in enumerate(lines):
                    func_match = re.match(r'def\s+(\w+)\s*\(([^)]*)\)', line)
                    if func_match:
                        current_func = func_match.group(1)
                        params = func_match.group(2)
                    
                    for model in scoped_models:
                        if f'db.query({model})' in line or f'db.query({model}.' in line:
                            # Check if current_func has tenant_department_id or department_id
                            findings.append({
                                'file': file,
                                'line': idx + 1,
                                'func': current_func,
                                'model': model,
                                'code': line.strip()
                            })

print(f"Total queries on scoped models: {len(findings)}")

# Check which functions have db.query(User) or db.query(LeaveRequest) with .all() without department filter
unscoped = []
for f in findings:
    if '.all()' in f['code'] and 'filter' not in f['code']:
        unscoped.append(f)

print(f"Potential un-filtered .all() queries: {len(unscoped)}")
for u in unscoped[:20]:
    print(f"  {u['file']}:{u['line']} in {u['func']}() -> {u['code']}")
