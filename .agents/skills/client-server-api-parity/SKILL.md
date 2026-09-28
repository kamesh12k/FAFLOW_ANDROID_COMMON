---
name: client-server-api-parity
description: Use this skill when comparing a mobile or web client's API call definitions (Retrofit/OpenAPI/fetch calls) against the actual backend route implementations, to find contract mismatches, dead endpoints, scope creep, or missing error handling.
---

# Client-Server API Parity Checker

## Goal
Find concrete, evidence-based mismatches between what a client calls and what the
backend actually implements/permits — not a superficial "does an endpoint with this name
exist" check.

## Instructions
1. Extract the full list of client-side API call definitions (method, path, request/response
   types) from the client's API/service layer file(s).
2. Extract the full list of backend route definitions (method, path, dependencies/guards,
   request/response schemas) from the backend router files.
3. For each client call, match it to its backend route and check:
   - HTTP method and path match exactly (including trailing slashes, which frameworks can
     treat as distinct)
   - The role/permission dependency on that route actually permits the roles the client
     app is built for (cross-reference with the rbac-parity-auditor skill's findings if
     available)
   - Request/response field names and nullability match between client DTOs and backend
     schemas
4. Flag any client-side call to an endpoint whose backend guard restricts it to a role
   outside the client app's intended user base as scope creep — the client shipped UI for
   a workflow its actual users can never complete.
5. Flag any backend route with no corresponding client call only if the task explicitly
   asks for a completeness/coverage check — otherwise this is expected (backend serves
   multiple clients).

## Constraints
- Do not assume an endpoint "exists so it's fine to call" — check the guard on that
  specific route, not a same-named route elsewhere or a general impression of the API's
  permissiveness.
- Report mismatches with exact file:line citations on both sides (client and backend).
