import os
import re
import json

with open('b:/FAFLOW_UNIFIED/backend/openapi_endpoints.json', 'r', encoding='utf-8') as f:
    backend_eps = json.load(f)

backend_map = {}
for ep in backend_eps:
    norm = re.sub(r'\{[^}]+\}', '{id}', ep['path'])
    backend_map[(ep['method'].upper(), norm)] = ep

services_file = 'b:/FAFLOW_UNIFIED/frontend/src/api/services.js'
with open(services_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

api_pattern = re.compile(r'api\.(get|post|put|patch|delete)\s*\(\s*[`\'"]([^`\'"]+)[`\'"]', re.IGNORECASE)

calls = []
for idx, line in enumerate(lines):
    match = api_pattern.search(line)
    if match:
        method = match.group(1).upper()
        raw_path = match.group(2)
        # convert template ${...} to {id}
        norm_path = re.sub(r'\$\{[^}]+\}', '{id}', raw_path)
        calls.append((idx + 1, method, raw_path, norm_path))

print(f"Total API calls in services.js: {len(calls)}")

matched = 0
mismatches = []
for line_no, method, raw_path, norm_path in calls:
    # normalize trailing slash if needed
    key = (method, norm_path)
    key_slash = (method, norm_path + '/' if not norm_path.endswith('/') else norm_path[:-1])
    
    if key in backend_map:
        matched += 1
    elif key_slash in backend_map:
        matched += 1
    else:
        mismatches.append((line_no, method, raw_path, norm_path))

print(f"Matched with backend routes: {matched}")
print(f"Unmatched (Potential 404 / Missing Endpoints): {len(mismatches)}")
for line_no, method, raw_path, norm_path in mismatches:
    print(f"  Line {line_no:3d}: {method:6} {raw_path:45} -> norm: {norm_path}")
