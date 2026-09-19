import os
import re
import json

with open('b:/FAFLOW_UNIFIED/backend/openapi_endpoints.json', 'r', encoding='utf-8') as f:
    backend_eps = json.load(f)

backend_map = set()
for ep in backend_eps:
    norm = re.sub(r'\{[^}]+\}', '{id}', ep['path'])
    backend_map.add((ep['method'].upper(), norm))

frontend_dir = 'b:/FAFLOW_UNIFIED/frontend/src'
direct_calls = []

api_pattern = re.compile(r"api\.(get|post|put|patch|delete)\s*\(\s*[`'\"]([^`'\"]+)[`'\"]", re.IGNORECASE)

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(('.js', '.jsx')) and file != 'services.js' and file != 'client.js':
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                matches = api_pattern.findall(content)
                relpath = os.path.relpath(filepath, frontend_dir)
                for method, raw_path in matches:
                    norm_path = re.sub(r"\$\{[^}]+\}", "{id}", raw_path)
                    direct_calls.append((relpath, method.upper(), raw_path, norm_path))

print(f"Total direct API calls outside services.js: {len(direct_calls)}")
missing_direct = 0
for rel, m, raw, norm in direct_calls:
    exists = (m, norm) in backend_map or (m, norm + '/') in backend_map or (m, norm[:-1] if norm.endswith('/') else norm) in backend_map
    if not exists:
        missing_direct += 1
        print(f"  [MISSING] {rel:40} | {m:6} {raw}")
    else:
        print(f"  [EXISTS]  {rel:40} | {m:6} {raw}")

print(f"Missing direct calls: {missing_direct}")
