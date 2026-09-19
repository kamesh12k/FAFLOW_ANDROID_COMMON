import os
import re

services_path = 'b:/FAFLOW_UNIFIED/frontend/src/api/services.js'
with open(services_path, 'r', encoding='utf-8') as f:
    services_content = f.read()

exported_apis = set(re.findall(r'export\s+const\s+(\w+)\s*=', services_content))
print(f"Total exported APIs in services.js: {len(exported_apis)}")
for a in sorted(exported_apis):
    print(f"  {a}")

frontend_dir = 'b:/FAFLOW_UNIFIED/frontend/src'
missing_imports = {}

pattern = re.compile(r"import\s+\{([^}]+)\}\s+from\s+['\"][^'\"]*services(?:[\.a-zA-Z]*)?['\"]")

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(('.js', '.jsx')) and file != 'services.js':
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                matches = pattern.findall(content)
                relpath = os.path.relpath(filepath, frontend_dir)
                for match in matches:
                    names = [n.strip().split(' as ')[0].strip() for n in match.split(',') if n.strip()]
                    for name in names:
                        if name not in exported_apis:
                            missing_imports.setdefault(name, []).append(relpath)

print(f"\nTotal Missing / Unexported API services imported by components: {len(missing_imports)}")
for name, file_list in missing_imports.items():
    print(f"\n[CRITICAL: MISSING IN services.js] -> {name}")
    for fl in file_list:
        print(f"   used by: {fl}")
