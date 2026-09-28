---
name: rbac-parity-auditor
description: Use this skill when auditing or modifying role-based access control (RBAC) across a client (mobile/web) and backend — checking whether a role name used in client-side navigation/gating code actually corresponds to a role the backend issues, and whether backend authorization dependencies actually grant the permissions the client assumes they do.
---

# RBAC Parity Auditor

## Goal
Catch the class of bug where client-side code gates a feature on a role string, user
type, or permission flag that doesn't match what the backend actually issues or enforces
— either because the string is wrong, doesn't exist, or the backend's authorization
dependency has different (often narrower) semantics than the client assumes (e.g.
read-only restrictions, admin_level sub-tiers, department scoping).

## Instructions
1. Enumerate the backend's actual role/permission model at its source of definition
   (enum, model, or equivalent) — not from a docs page unless corroborated. List every
   valid value.
2. Enumerate every place the client checks a role/permission string (grep for role
   comparisons, permission flags, hardcoded role lists). List each check with its exact
   file and line.
3. For each client-side check, confirm the compared string(s) are literal values that
   actually appear in (1). Flag any string that can never be returned by the backend as
   dead/broken code.
4. For each backend authorization dependency/decorator involved, read its full body — not
   just its name. A function named `require_admin` may still contain special-cased
   read-only carve-outs for other roles, method-based branching (GET vs POST/PATCH/DELETE),
   or narrower checks than the name implies. Do not assume a permissive-sounding function
   name means unrestricted write access for every role you'd expect it to cover.
5. Check for sub-tier fields the client might not be capturing (e.g. an `admin_level` or
   `scope` field alongside a coarser `role` field) that the backend uses to distinguish
   users the client is treating identically.
6. Check department/tenant/org scoping specifically: does an "unscoped" or "view all"
   fallback trigger when a scoping header/param is absent? If so, confirm whether the
   client actually sends that header/param on every relevant call — an omitted header can
   silently turn into a wider-than-intended view rather than an error.
7. Report every mismatch with severity (BLOCKER if it causes escalation or blocks a core
   workflow for its intended role; lower if merely dead code or redundant checks).

## Constraints
- Never conclude a role mapping (e.g. "role X is the intended HOD/admin/manager
  equivalent") from naming conventions alone (route paths, component names, comments).
  Confirm it against the authorization code path that a request from that role actually
  hits.
- If your own reasoning changes mid-audit because of new evidence, restate the corrected
  conclusion explicitly rather than letting an earlier wrong conclusion stand unaddressed
  elsewhere in your output.
