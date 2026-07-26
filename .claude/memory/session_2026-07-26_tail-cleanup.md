---
name: Tail cleanup - routing-test reconciliation, phase-iii port, retry-once, 3 hook fixes
description: Finished the housekeeping tail after the fan-out wave (Jonah "finish the whole tail"). Gated 20 of 21 deferred routing tests, fixed the stale craft-length assertion, ported the broken jest-style phase-iii test to plain-assert (44 asserts, covers 3 untested live modules), added a run-tests retry-once wrapper, and tuned 3 flagged hooks. 161 suites green.
type: project
relates_to: [session_2026-07-25_orphan-test-triage.md, session_2026-07-25_routing-consolidation.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 161 suites green; each ported/fixed test run green in isolation; all 3 hook fixes unit-tested (should-block/should-pass cases)
confidence: high
---

Collaborator: Jonah. 2026-07-26. "Finish the whole tail."

## Test housekeeping (sidecoach)
- **21 deferred routing tests reconciled** against the landed routing refactor: ran each, **19 pass -> gated** in run-tests.ts. 2 failed:
  - `sprint12-craft-chain-includes-research`: STALE assertion `craft.flowIds.length === 8`; the chain grew to 11 (flowA..flowM + flowJ, verified via VERB_REGISTRY.craft). Fixed 8->11 (keeps the composition lock) -> now passes -> gated (20th).
  - `sprint3-process-path`: PRE-EXISTING RED, DEFERRED (not gated). `engine.process('lint design.md')` no longer emits the "Source: DESIGN.md L<n>" citation the test expects. NOT an E-refactor regression (doesn't touch removed code) - it's silently-unverified live code; fixing it is a feature-vs-test call flagged for later, not gated red.
- **phase-iii-integration.test.ts PORTED** jest-style -> plain-assert. Was a `declare global` describe/test/expect file with NO jest in the repo, so it only compiled, never ran. It is the ONLY coverage for FlowSpecificValidator + FlowMetricsTracker + FlowHandlerCache (all live, orchestrator-imported). Ported the ~20 correctness cases (44 asserts, runs green); DROPPED the 2 wall-clock timing benchmarks (not correctness, flake under load). Gated.
- **run-tests retry-once wrapper**: ts-node can spuriously fail to COMPILE under concurrent load (TS2304 on a symbol that resolves in isolation - F flagged 2/81 in the triage batch). The runner now retries a failed suite ONCE; a transient flake passes attempt 2, a genuinely-red suite fails both and is still counted (no masking). Didn't need to fire at 161, but de-risks the larger suite in CI.
- Gate: 88 -> 140 (orphan-triage) -> **161** (this: +20 routing +1 phase-iii). No drop.

## Hook fixes (claude/hooks - dotfiles, live via symlink)
- **model-router-guard.sh `claude --model` false-positive** (flagged by 2 agents; it even blocked my own grep). The regex anchored `claude` at ANY whitespace, so `--provider claude --model gemini-3.6-flash` (a flag to the eval harness, not the claude CLI) tripped the session-model-override block. Narrowed the anchor to a real COMMAND position (`^` or after `; | & (`), so a genuine `claude --model X` override still blocks but the harness arg + quoted prose mentions do not. Unit-tested: 4 should-block + 3 should-pass all correct.
- **memory-nudge.sh scratchpad over-fire**: it armed the commit dirty-flag on ANY write, never checking the TARGET, so scratchpad/temp writes (/private/tmp/.../scratchpad, /tmp) falsely dirtied the gate. Two fixes: (1) Write/Edit branch skips file_path under /tmp | /private/tmp | /scratchpad/; (2) Bash branch strips `> /tmp/...` redirects before the write-token scan (mirrors the existing /dev/null strip). Unit-tested: scratchpad write -> no dirty, real project write -> still dirties + nudges.
- retry-once = the 3rd flagged hook item (lives in run-tests, above).

## Files
- edited: sidecoach/scripts/run-tests.ts (20 routing + phase-iii entries + retry-once), sidecoach/src/__tests__/sprint12-craft-chain-includes-research.test.ts (8->11), sidecoach/src/phase-iii-integration.test.ts (ported), sidecoach/dist (phase-iii recompiled), claude/hooks/model-router-guard.sh, claude/hooks/memory-nudge.sh.
- DEFERRED (flagged, not done): sprint3-process-path (feature-vs-test call); 5 slow-but-green suites (gate-cost call).
