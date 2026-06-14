---
name: P4d baseline - mcp-server suite is 253/1 with 1 ENVIRONMENTAL OOM failure (not a regression)
description: mcp-server npm test baseline before P4d = 253 passed / 1 failed; the 1 failure is python_repl OOM (over-256m allocation killed) which macOS cannot enforce (no cgroup memory cap); tree byte-identical to main so it is pre-existing/environmental, not a P4d regression
type: reference
relates_to: [session_2026-06-14_p4d-v2-approved.md]
---

Before executing P4d, the mcp-server suite baseline (cd sidecoach/mcp-server &&
npm test) = 254 tests: 253 passed, 1 failed. The ONE failure is:
  fault-injection/python-repl-faults.test.ts
  'python_repl OOM: over-256m allocation is killed, surfaced (not a hang)'

Root cause: the test allocates ~400MB in a sandboxed Python subprocess and
expects the OS OOM-killer to kill it (exit 137 / non-zero). macOS has no cgroup
memory enforcement, so the allocation succeeds and the test's OOM-handled
assertion fails. Confirmed environmental: `git diff main -- sidecoach/mcp-server/`
is EMPTY on branch lane-p4d, so the mcp-server tree is byte-identical to main =
this is pre-existing, not introduced by P4d.

**Implication for execution:** the plan's verify steps say mcp-server ends with
'0 failed'. On THIS host the truthful green baseline is '253 passed, 1 env-fail'.
Success criterion during P4d = NO NEW failures beyond that single OOM test. Do NOT
try to fix the OOM test (out of scope, environmental). P4d only adds
lanes:null/intent:null + signal to python-repl-faults.test.ts fixtures; it does
not touch the OOM test logic.

Engine suite (cd sidecoach && npm test) baseline + P1 hook suites are green.

Collaborator: Jonah.
