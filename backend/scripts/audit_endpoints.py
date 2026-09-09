import json
from collections import defaultdict

with open('openapi_endpoints.json', encoding='utf-8') as f:
    endpoints = json.load(f)

by_tag = defaultdict(list)
for ep in endpoints:
    tags = ep.get('tags', ['Other'])
    for t in tags:
        by_tag[t].append(ep)

print(f"Total tags/routers: {len(by_tag)}")
for tag in sorted(by_tag.keys()):
    print(f"\n### {tag} ({len(by_tag[tag])} endpoints)")
    for ep in sorted(by_tag[tag], key=lambda x: (x['path'], x['method'])):
        params = ', '.join(ep['parameters']) if ep['parameters'] else 'none'
        body = 'Yes' if ep['has_request_body'] else 'No'
        resp = ', '.join(ep['responses'])
        print(f"  - {ep['method']:6} {ep['path']:42} | Params: {params:20} | Body: {body:3} | Resp: {resp}")
