import json
import re
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from comprehensive_audit import frontend_by_path, android_api_calls

with open('openapi_endpoints.json', encoding='utf-8') as f:
    endpoints = json.load(f)

# Normalize OpenAPI paths: /admin/users/{user_id} -> /admin/users/{id}
backend_map = {}
for ep in endpoints:
    norm_path = re.sub(r'\{[^}]+\}', '{id}', ep['path'])
    backend_map[(ep['method'], norm_path)] = ep

frontend_matched = []
frontend_unmatched = []

for (method, path), files in frontend_by_path.items():
    norm_path = re.sub(r'\{[^}]+\}', '{id}', path)
    if (method, norm_path) in backend_map:
        frontend_matched.append((method, path, files))
    else:
        frontend_unmatched.append((method, path, files))

print(f"Frontend Matched: {len(frontend_matched)}")
print(f"Frontend Unmatched / Potential Mismatches: {len(frontend_unmatched)}")
for m, p, f in sorted(frontend_unmatched):
    print(f"  [MISSING IN BACKEND] {m:6} {p:45} called by {f[:2]}")

android_matched = []
android_unmatched = []
for a in android_api_calls:
    m = a['method']
    p = a['normalized_path']
    if (m, p) in backend_map:
        android_matched.append(a)
    else:
        android_unmatched.append(a)

print(f"\nAndroid Matched: {len(android_matched)}")
print(f"Android Unmatched / Potential Mismatches: {len(android_unmatched)}")
for a in android_unmatched:
    print(f"  [MISSING IN BACKEND] {a['method']:6} {a['raw_path']:45} in {a['file']}")
