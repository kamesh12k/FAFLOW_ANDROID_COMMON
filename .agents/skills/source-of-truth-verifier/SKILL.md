---
name: source-of-truth-verifier
description: Use this skill before trusting any claim in a README, milestone report, architecture doc, or prior audit summary about what a system currently does, which repo/branch is canonical, which role has which permission, or whether a feature is "production ready" or "fully implemented." Applies whenever the user asks to audit, verify, or reconcile documentation against actual code behavior.
---

# Source-of-Truth Verifier

## Goal
Prevent propagating documentation claims as fact when the actual source code says
something different or the documentation is stale/contradicted by evidence like git
history.

## Instructions
1. Never accept a doc's claim (e.g. "canonical repo," "role X can do Y," "100% parity,"
   "production ready") without an independent check against:
   - The actual source code implementing the behavior (not a comment describing it)
   - `git log` timestamps/authorship if the claim is about currency or ownership of a repo/file
2. When two sources disagree (e.g. a governance doc says repo A is canonical but repo B
   has newer commits), state both, show the evidence for each, and report the
   *contradiction itself* as a finding — do not silently pick one and move on.
3. When you find evidence contradicting a prior claim you (the agent) already made in this
   session or in a report you wrote earlier, correct it explicitly and visibly. Do not
   quietly overwrite it. State what the old claim was, why it was wrong, and what the
   new evidence shows. This applies to your own earlier outputs the same as any doc.
4. Before asserting a role/permission mapping (e.g. "role X is the HOD"), trace it through
   actual authorization code (dependency injection, middleware, decorators) — not through
   component/file naming conventions, which can be misleading (e.g. a component named
   `HodDashboard.jsx` does not prove the role gating it behind is actually role="hod").

## Constraints
- Do not mark any claim "PASS" or "verified" without citing the specific file/line that
  proves it.
- Do not resolve a repo/source conflict by assuming the more official-sounding one
  (monorepo, "unified," "canonical" in its name) is correct — check timestamps and content.
