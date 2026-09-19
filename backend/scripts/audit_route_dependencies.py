import os
import re

routes_dir = 'b:/FAFLOW_UNIFIED/backend/app/routes'
all_routes = []

for file in os.listdir(routes_dir):
    if file.endswith('.py') and file != '__init__.py':
        filepath = os.path.join(routes_dir, file)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        # Find router decorator and function
        pattern = re.compile(r'@router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']*)["\'][^)]*\)\s*\n(?:@[^\n]+\n)*def\s+(\w+)\s*\(([^)]*)\)', re.DOTALL)
        
        matches = pattern.findall(content)
        for method, path, func_name, params in matches:
            # Check dependencies in params
            has_auth = 'Depends' in params
            dep_matches = re.findall(r'Depends\s*\(\s*(\w+)\s*\)', params)
            
            all_routes.append({
                'file': file,
                'method': method.upper(),
                'path': path,
                'func': func_name,
                'dependencies': dep_matches
            })

print(f"Total routes discovered in app/routes: {len(all_routes)}")

# Identify routes with NO dependencies at all
unprotected = [r for r in all_routes if not r['dependencies']]
print(f"Routes with NO dependencies (public or unauthenticated): {len(unprotected)}")
for r in unprotected:
    print(f"  {r['file']:25} | {r['method']:6} {r['path']:35} | {r['func']}")

print("\nRoutes depending ONLY on get_current_user (generic auth without explicit role check):")
generic_auth = [r for r in all_routes if r['dependencies'] == ['get_current_user']]
for r in generic_auth:
    print(f"  {r['file']:25} | {r['method']:6} {r['path']:35} | {r['func']}")
