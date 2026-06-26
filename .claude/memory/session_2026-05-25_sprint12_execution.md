---
name: session-2026-05-25-sprint12-execution
description: Sprint 12 execution log - craft chain expanded to 8 flows (added flowB, flowE in research positions); test updated; dogfood history reset wired.
type: project
relates_to: [session_2026-05-25_sprint12_design.md]
---

Human collaborator: Jonah.

## T1 status

Edited `sidecoach/src/oracle-command-registry.ts` craft entry:

- flowIds expanded 6 -> 8: `[A, B, E, F, G, H, I, J]`. B (component research) lands before G (component implementation). E (motion patterns) lands before H (motion integration).
- guidanceAppend gained 2 new lines: component-patterns researched, motion-patterns researched.
- parityChecklist gained 2 new entries: `component research`, `motion patterns researched`.

Next: update sprint11 chain test (length 6 -> 8 + assert B and E presence) - or rename to sprint12 to avoid confusion. Going to update in-place since the test name is generic enough ("craft chain includes motion + a11y") to keep.

Created sprint12 test (10 assertions inc. order + parityChecklist + guidanceAppend coverage). Loosened Sprint 11 test's length-6 assertion to length-`>= 6` so it remains valid after Sprint 12.

T1 verified: tsc clean. sprint11 test 8/8 PASS (length >= 6). sprint12 test 13/13 PASS (length === 8 + order + parity + guidance). sprint8 parameterized parity grew 199 -> 201 PASS (picked up new parityChecklist entries). Committed `8aa2bd6`.

T2: edited `dogfood-craft-step2.ts` to clear `~/.claude/sidecoach-flow-history.json` at the start of run(). Imports `os` + `path`. Logs the cleared-history path on stdout for traceability. About to tsc-check + run dogfood as the external probe.
