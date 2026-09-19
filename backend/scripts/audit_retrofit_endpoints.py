import os
import re
from app.main import app

def check_retrofit():
    retrofit_path = 'b:/android/app/src/main/java/com/governence/faflow/core/network/FaflowApiService.kt'
    with open(retrofit_path, 'r', encoding='utf-8') as f:
        content = f.read()

    retrofit_routes = re.findall(r'@(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"\s*\)', content)

    openapi = app.openapi()
    backend_routes = set()
    for path, path_item in openapi.get('paths', {}).items():
        for m in path_item.keys():
            if m.upper() in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'):
                backend_routes.add((m.upper(), path.rstrip('/')))

    print(f"Total Retrofit routes defined: {len(retrofit_routes)}")
    missing = []
    for method, path in retrofit_routes:
        norm_path = '/' + path.lstrip('/').rstrip('/')
        norm_path_regex = '^' + re.sub(r'\{[^}]+\}', r'[^/]+', norm_path) + '$'
        matched = False
        for bm, bp in backend_routes:
            if bm == method:
                bp_norm_regex = '^' + re.sub(r'\{[^}]+\}', r'[^/]+', bp) + '$'
                if re.match(bp_norm_regex, norm_path) or re.match(norm_path_regex, bp):
                    matched = True
                    break
        if not matched:
            missing.append((method, norm_path))

    print(f"Missing in backend: {len(missing)}")
    for m in missing:
        print(f"  {m[0]:6} {m[1]}")

if __name__ == '__main__':
    check_retrofit()
