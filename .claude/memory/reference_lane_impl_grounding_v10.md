---
name: lane v10 implementation grounding (real-code map)
description: grounding-scout verified all 8 load-bearing v10 spec claims TRUE against live code (file:line) and found 12 blast-radius gaps; the ground truth the implementation plan builds on
type: reference
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-13_lane-v10-review-repair-read.md]
---

An independent Explore agent (grounding-scout, team lane-impl) verified the
frozen v10 spec's blast radius against the actual code (2026-06-13). All 8
load-bearing claims TRUE with file:line evidence:

1. sidecoach/package.json:12 test = only `ts-node src/intent-detector.test.ts`. TRUE.
2. verb-command-registry.ts: polish=[flowJ,flowM]:94, audit=[flowK,flowI]:121,
   critique=[flowL,flowK]:148. TRUE (loop derives to J,M,K,I,L).
3. ralph-loop.ts exists, NO production caller, converges on zero findings at
   :303-311 (the false-convergence t20 enshrines). TRUE.
4. checkpoint-store.ts schemaVersion 1 (:10), tmp+rename writes (:49-51). TRUE.
5. flow-history.ts:280 keys by SIDECOACH_SESSION_ID || 'default'. TRUE.
6. flow-handler-brand-verify.ts canExecute true (:33-36), errors w/o PRODUCT.md
   (:49-73). TRUE.
7. mcp-server/src/server.ts:92 Promise.race; :139-142 handler ctx is
   {logger, registries} - NO AbortSignal. TRUE (v10 must add signal +
   modify tools/types.ts).
8. polish-standard-validator.ts (22 numeric rules), extended-domain-validator.ts
   (POLISH_001..022 at :174-529), anti-pattern-validator.ts (27),
   taste-validator.ts all exist. TRUE.

Substantial-rewrite files: sidecoach-orchestrator.ts (67KB - lane API + lease
+ convergence), convergence-loop.ts (from ralph-loop.ts + semantic fixes).
New files: lanes.generated.ts, scripts/generate-lanes.ts,
flow-validation-capabilities.ts, product-rule-registry.ts, sidecoach-lanes.json,
mcp lane tool, classify-intent.ts (from resolve-keyword), list-lanes.ts (from
list-modes).

**12 blast-radius GAPS the spec did not name (must be in the plan):**
1. New test files (lane state machine, checkpoint v2/lease/CAS, convergence
   signature/boundary, rule-registry, capability binding, scope-policy parity).
2. The two static validator MODULES (theming/token, static-a11y) are named as
   floor requirements but do not exist as files - must be created.
3. Python classifier shim: keyword-resolver.ts is TS-only; the hook needs a
   Python equivalent for clause binding/occurrence suppression (shared parity).
4. mcp-server/src/tools/types.ts handler signature must gain signal?: AbortSignal.
5. Doc generation driver: who RUNS generate-lanes to regenerate SKILL.md/
   CHEATSHEET.md generated sections + get-cheatsheet.ts.
6. Marketing-site regeneration mechanism (cheatsheet.html/sidecoach.html) - no
   script named.
7. dist artifacts: lanes.generated.d.ts, generate-lanes.js, classify-intent.js,
   list-lanes.js, lane.js (+ .d.ts).
8. Outbox publisher file (likely outbox-publisher.ts or in session-memory-writer).
9. Checkpoint v1->v2 migration shim file.
10. bin/sidecoach-monitor lane subcommand module structure.
11. Lock/state-file path conventions (cooldown file, checkpoint O_EXCL lock).
12. session-memory-writer.ts scope of rewrite (conditional logical-key upsert
    by fencing token + outbox publish) - file exists, change scope unclear.

**Plan decomposition (staged per the spec; each sub-plan = working testable
software):** P1 lane registry + generation + classifier/hook tier; P2 lane
state machine + checkpoint/lease/outbox + sequence lanes + monitor/MCP lane
tool; P3 convergence floor (rule registry + four-status validators + 2 new
static validators + Flow J hardening + lane_converge enablement); P4 MCP
migration + doc/marketing regeneration.
