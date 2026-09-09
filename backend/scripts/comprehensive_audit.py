import os
import re
import json
import glob
from collections import defaultdict

# 1. Load OpenAPI endpoints
with open('openapi_endpoints.json', encoding='utf-8') as f:
    endpoints = json.load(f)

# Normalize endpoint paths and methods
backend_routes = set()
for ep in endpoints:
    backend_routes.add((ep['method'], ep['path']))

print(f"Loaded {len(backend_routes)} backend endpoint signatures.")

# 2. Extract Frontend API calls from services.js and components/pages
frontend_dir = 'b:/FAFLOW_UNIFIED/frontend/src'
api_calls = []

# Pattern to capture api.get('/path'...), api.post('/path'...), etc.
api_pattern = re.compile(r"api\.(get|post|put|patch|delete)\s*\(\s*[`'\"]([^`'\"]+)[`'\"]", re.IGNORECASE)

for root, dirs, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                matches = api_pattern.findall(content)
                relpath = os.path.relpath(filepath, frontend_dir)
                for method, path in matches:
                    # clean path template vars like ${id} -> {id}
                    clean_path = re.sub(r"\$\{[^}]+\}", "{id}", path)
                    api_calls.append({
                        'file': relpath,
                        'method': method.upper(),
                        'raw_path': path,
                        'normalized_path': clean_path
                    })

print(f"Discovered {len(api_calls)} frontend api calls across frontend source.")

# Group frontend calls by normalized path
frontend_by_path = defaultdict(list)
for c in api_calls:
    frontend_by_path[(c['method'], c['normalized_path'])].append(c['file'])

# 3. Android API calls
android_api_calls = []
android_dir = 'b:/android/app/src/main/java'
retrofit_pattern = re.compile(r"@(GET|POST|PUT|PATCH|DELETE)\s*\(\s*[\"']([^\"']+)[\"']\)", re.IGNORECASE)

for root, dirs, files in os.walk(android_dir):
    for f in files:
        if f.endswith('.kt'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                matches = retrofit_pattern.findall(content)
                relpath = os.path.relpath(filepath, android_dir)
                for method, path in matches:
                    clean_path = re.sub(r"\{[^}]+\}", "{id}", path)
                    if not clean_path.startswith('/'):
                        clean_path = '/' + clean_path
                    android_api_calls.append({
                        'file': relpath,
                        'method': method.upper(),
                        'raw_path': path,
                        'normalized_path': clean_path
                    })

print(f"Discovered {len(android_api_calls)} Android Retrofit endpoint calls.")

# 4. Compare Backend with Consumers
report = {
    "total_backend_endpoints": len(backend_routes),
    "total_frontend_calls": len(api_calls),
    "total_android_calls": len(android_api_calls),
    "frontend_calls_sample": api_calls[:10],
    "android_calls": android_api_calls
}

with open('audit_summary.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)

print("Comprehensive audit scan complete.")
