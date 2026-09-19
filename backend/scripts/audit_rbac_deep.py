import os
import re
from app.main import app

def analyze_rbac():
    # Routes in FastAPI app
    role_dependencies = {
        'require_admin', 'require_super_admin', 'require_system_admin',
        'require_principal', 'require_teacher', 'require_manager',
        'require_manager_or_admin', 'require_governance', 'require_principal_or_governance'
    }

    routes_dir = 'b:/FAFLOW_UNIFIED/backend/app/routes'
    findings = []

    for file in sorted(os.listdir(routes_dir)):
        if file.endswith('.py') and file != '__init__.py':
            filepath = os.path.join(routes_dir, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find all endpoints
            # Matches @router.<method>(...) followed by def <func>(...)
            endpoints = re.finditer(r'@router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']*)["\'][^)]*\)\s*\n(?:@[^\n]+\n)*def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)', content, re.DOTALL)
            for ep in endpoints:
                method = ep.group(1).upper()
                path = ep.group(2)
                func_name = ep.group(3)
                params = ep.group(4)

                deps = re.findall(r'Depends\s*\(\s*([a-zA-Z0-9_]+)\s*\)', params)
                has_role_check = any(d in role_dependencies for d in deps)
                has_current_user = 'get_current_user' in deps or 'require_credentials_set' in deps
                
                # Check if inside the function body there is an explicit role check (e.g. current_user.role)
                # Find the function body up to next def or end of file
                start_pos = ep.end()
                next_def = re.search(r'\n(?:@router|def )\b', content[start_pos:])
                body = content[start_pos:start_pos + next_def.start()] if next_def else content[start_pos:]
                
                has_body_role_check = bool(re.search(r'current_user\.role\b|role not in|role !=|require_role', body))

                findings.append({
                    'file': file,
                    'method': method,
                    'path': path,
                    'func': func_name,
                    'deps': deps,
                    'has_role_dep': has_role_check,
                    'has_current_user': has_current_user,
                    'has_body_role_check': has_body_role_check
                })

    print(f"Total analyzed endpoints: {len(findings)}")
    # Endpoints with user auth but NO role dep and NO body role check
    unrestricted = [f for f in findings if f['has_current_user'] and not f['has_role_dep'] and not f['has_body_role_check']]
    print(f"\nEndpoints with current_user but NO explicit role enforcement ({len(unrestricted)}):")
    for u in unrestricted:
        print(f"  {u['file']:25} | {u['method']:6} {u['path']:35} | {u['func']}")

    # Endpoints with NO dependencies at all
    no_deps = [f for f in findings if not f['deps']]
    print(f"\nEndpoints with NO dependencies at all ({len(no_deps)}):")
    for nd in no_deps:
        print(f"  {nd['file']:25} | {nd['method']:6} {nd['path']:35} | {nd['func']}")

if __name__ == '__main__':
    analyze_rbac()
