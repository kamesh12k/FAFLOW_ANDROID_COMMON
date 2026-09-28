---
name: verify-fix-log-loop
description: Use this skill whenever fixing a batch of confirmed bugs in a codebase, to keep the work efficient and evidence-based instead of producing large amounts of unverified prose or batching all fixes before testing anything.
---

# Verify-Fix-Log Loop

## Goal
Fix confirmed bugs efficiently, one at a time, with each fix backed by a compile/test
check and a terse log entry — avoiding both (a) re-diagnosing already-confirmed bugs, and
(b) making sweeping changes with no verification until the end.

## Instructions
1. For each bug in a provided/confirmed bug list, treat the given root cause and file
   citations as trustworthy starting points — spend minimal time re-confirming them
   (a quick read of the cited lines is enough) unless something looks inconsistent with
   the description, in which case flag the inconsistency before proceeding.
2. Make the minimal code change that fixes the described root cause. Do not refactor or
   touch unrelated code in the same pass.
3. Compile/build and run the relevant test(s) immediately after each individual fix, not
   after a batch of fixes. Add a regression test for the fix when practical.
4. Append one row to a running `BUGS_AND_FIXES.md` (or equivalent) log: bug ID, files
   changed, one-line description of the fix, test added, test result. Do not write a long
   narrative — the log is for tracking, not reporting.
5. Move to the next bug only after the current one compiles and its test passes (or after
   recording why it couldn't be fully verified, e.g. requires a live backend/device).
6. For any fix that touches an authorization/permission check, do not weaken the check to
   make a test pass — if a test fails because the permission model itself needs a decision
   from the user (e.g. "should this role be allowed to do this"), stop and ask rather than
   guessing.

## Constraints
- Never mark a fix as done without an actual compile/test run backing it, even if the
  change looks obviously correct.
- Never silently swallow an exception or hide an error to make a bug "go away."
- Never batch more than one bug's changes before verifying — verification catches
  regressions from bug N while fixing bug N+1 is still cheap to fix.
