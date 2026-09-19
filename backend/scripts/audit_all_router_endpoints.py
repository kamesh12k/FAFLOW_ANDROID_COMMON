import inspect
from app.main import ROUTERS
from fastapi.routing import APIRoute

def audit():
    role_dependencies = {
        'require_admin', 'require_super_admin', 'require_system_admin',
        'require_principal', 'require_teacher', 'require_manager',
        'require_manager_or_admin', 'require_governance', 'require_principal_or_governance'
    }

    public_routes = []
    any_user_routes = []
    role_guarded_routes = []

    for r in ROUTERS:
        router_prefix = r.prefix
        router_deps = [d.dependency.__name__ if hasattr(d, 'dependency') and hasattr(d.dependency, '__name__') else str(d) for d in r.dependencies]
        
        for route in r.routes:
            if not isinstance(route, APIRoute):
                continue
            
            # Combine router deps and route deps
            route_deps = [d.dependency.__name__ if hasattr(d, 'dependency') and hasattr(d.dependency, '__name__') else str(d) for d in route.dependencies]
            
            # Endpoint parameter deps
            sig = inspect.signature(route.endpoint)
            param_deps = []
            for p in sig.parameters.values():
                if hasattr(p.default, 'dependency') and hasattr(p.default.dependency, '__name__'):
                    param_deps.append(p.default.dependency.__name__)
            
            all_deps = set(router_deps + route_deps + param_deps)
            methods = list(route.methods)
            full_path = route.path

            has_role_guard = any(d in role_dependencies for d in all_deps)
            has_user_auth = any('user' in d.lower() or 'credentials' in d.lower() for d in all_deps)

            item = {
                'prefix': router_prefix,
                'path': full_path,
                'methods': methods,
                'func': route.endpoint.__name__,
                'deps': list(all_deps)
            }

            if not has_user_auth and not has_role_guard:
                public_routes.append(item)
            elif has_user_auth and not has_role_guard:
                any_user_routes.append(item)
            else:
                role_guarded_routes.append(item)

    print(f"Total Routes Audited: {len(public_routes) + len(any_user_routes) + len(role_guarded_routes)}")
    print(f"\n1. Public / Unauthenticated Routes ({len(public_routes)}):")
    for r in public_routes:
        print(f"   {r['methods'][0]:6} {r['path']:40} | {r['func']} | deps: {r['deps']}")

    print(f"\n2. Any Authenticated User (No explicit role guard) ({len(any_user_routes)}):")
    for r in any_user_routes:
        print(f"   {r['methods'][0]:6} {r['path']:40} | {r['func']} | deps: {r['deps']}")

    print(f"\n3. Role-Guarded Routes: {len(role_guarded_routes)}")

if __name__ == '__main__':
    audit()
