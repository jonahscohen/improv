---
name: ELIAS mode build (Explain Like I'm A Stakeholder)
description: Default-OFF stakeholder-audience response mode, three-hook trio mirroring concise with inverted marker, plus concise interaction edits, wiring, tests, docs.
type: project
relates_to: [session_2026-07-26_concise-mode-feature-committed.md, session_2026-07-26_concise-stop-gate.md, session_2026-08-05_elias-plan-recovered-and-build-dispatch.md, decision_2026-08-05_elias-mode-design.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

ELIAS ("Explain Like I'm A Stakeholder") is a toggleable response mode built as a three-hook trio modeled byte-for-byte on the concise-* trio, with the marker polarity INVERTED (default OFF, opt-in via ENABLE marker `~/.claude/.elias-enabled`). Executed from docs/superpowers/plans/2026-08-05-elias-mode.md (stamped 821d51fd == HEAD). NOT committed per Jonah - left in the working tree for review.

Why: concise governs LENGTH and is a universal preference (on by default); ELIAS governs AUDIENCE and is a per-conversation choice, so injecting it into a normal engineering session would strip the paths/commands/identifiers a developer needs. Default-off matches the voice system.

How: three new hooks (mandate/toggle/detect-stop) + two surgical edits to concise-detect-stop.sh (volume relaxation + cross-gate deferral) + wiring in cluster-wirings.json, install.sh, browser-tree.json + three new test suites + concise-suite additions + README counts.

Per-task progress (each verified by its plan `-> verify:` clause):

- Task 1 DONE: claude/hooks/elias-mandate.sh (SessionStart/PostCompact, shebang `#!/bin/bash`, marker test `[ -f ]` inverted from concise). Verify: SILENT-WHEN-OFF, INJECTS-WHEN-ON (PostCompact event name threaded, ELIAS MODE IS ON present), EMIT-BODY-OK (raw body not JSON).
- Task 2 DONE: claude/hooks/elias-toggle.sh (UserPromptSubmit, shebang `#!/usr/bin/env bash`, mirrors concise-toggle emit/emit_on/honest-failure, marker polarity inverted, whole-message normalization with U+2019/U+02BC curly-apostrophe mapping, trailing `.`/`!` stripped but not `?`). Verify: ON-OK, NO-MIDPROSE, CURLY-OK.
- Task 3 DONE: claude/hooks/elias-detect-stop.sh (Stop gate, shebang `#!/usr/bin/env bash`, `set -euo pipefail` + `trap 'exit 0' EXIT`, artifact-shape detection only per D5 - no jargon wordlist). Inverts concise: NO predominantly-code skip, mode check is `|| exit 0`. Fifth anti-loop layer = cross-gate deferral (defers to `.concise-stop-blocked.<sid>`). Verify: SYNTAX-OK; ELIAS-off rc=0 silent. Smoke 11/11 green.
- Task 4 DONE: concise-detect-stop.sh two surgical edits. Edit A volume relaxation (ELIAS on + unset CONCISE_WORD_CAP -> export CONCISE_WORD_CAP=${ELIAS_WORD_CAP:-400}), if-form not &&-chain. Edit B cross-gate deferral (defers to `.elias-stop-blocked.<sid>`) placed AFTER clean-stop re-arm, before Layer 2. Verify: concise regression 45/0 UNCHANGED; elias=3, CONCISE_WORD_CAP=4.
- Task 5 DONE: wiring (6 sites) - cluster-wirings.json (3 keys), install.sh grounding line (+3), browser-tree.json spot1 tag/desc/hooks + spot2 hook_desc (3) + spot3 hook_owner (3 grounding). Verify: WIRING-OK, install count 1, TREE-OK, MANAGED x3, audit rc=0.
- Task 6 DONE: 4 suites. test-elias-mandate 13/0, test-elias-toggle 27/0, test-elias-detect-stop 33/0, test-concise-detect-stop 50/0 (+5 ELIAS INTERACTION A-E; regression contract intact at 45 pre-existing). One content-guard block during authoring (literal emdash in a test hygiene assert) resolved via chr(0x2014) codepoint - faithful, not a plan-text weakening.
- Task 7 DONE: README (74 total, Guardrails 42, grounding (10)) -> README-OK. Concise-touchpoint sweep done (exclusion list in ledger). FOUND + FIXED an extra touchpoint the plan's sweep list missed: install.sh:2037 FILES display "(7 grounding hooks)" -> "(10 grounding hooks)" (the concise-stop-gate beat confirms this string is a real touchpoint; my first grep pattern missed the "(N grounding hooks)" shape).
- Task 8 DONE: this beat + decision_2026-08-05_elias-mode-design.md (D1/D2/D5) + MEMORY.md pointers.

## Section 11 acceptance gate: ALL GREEN
Units: elias-mandate 13/0, elias-toggle 27/0, elias-detect-stop 33/0, concise 50/0 (+5). elias-*.sh bash -n clean. Registry: --audit rc0, --audit-data rc0, test-hook-registry 94/0, test-settings-wire-parity 22/0 + reverse parity. JSON: cluster-wirings + browser-tree valid; manifest valid (elias in grounding bucket + hook_desc + state). +x on all 3. Live: ELIAS off = 0 bytes; elias on -> marker + full ruleset; BOTH modes on -> exactly 1 block per burst in BOTH gate orderings. Hygiene: no attribution in new files; new files clean of emoji/emdash/endash. No aggregate runner exists (no Makefile/pkg.json/run-*.sh) so the explicit suite list is the gate.

Plan-clause defect (reported, not an impl gap): Section 11 "install.sh --dry-run --only config names all three elias hooks" is wrong two ways - grounding hooks resolve under `--only grounding` not `config`, and `--dry-run` prints selected COMPONENT KEYS not hook filenames. Fails identically for concise (0 hits), proving mislabel. Packaging proven equivalent to concise three ways: cluster_hooks grounding names all 3, manifest carries all 3, registry --check = MANAGED for all 3.

## Cross-model review (Team Rule 8)
REAL Codex via the deterministic wrapper claude/hooks/codex-review.py (exit 0, 143.9s). The codex-rescue AGENT was correctly BLOCKED by its guard for review-intent (it can silently downgrade to same-model self-review); the wrapper runs real Codex or fails loudly. Codex CONFIRMED the three load-bearing checks: R1 absent (mandate silent when marker absent), marker polarity consistent, Edit B placement correct. 7 findings, all adjudicated, ZERO code changes folded: F1 (High, cross-gate atomicity under hypothetical parallel Stop-hook execution) is plan-mandated peer-flag design whose robust fix conflicts with D6 + the lead's no-shared-library constraint (surfaced to lead; sequential exec = exactly 1 block, live-verified); F2/F3/F4/F5 are plan-verbatim regexes/thresholds with plan-defended tradeoffs (empirically confirmed as the plan's stated safe directions); F6 (React.js false-fire) is a FALSE POSITIVE (empirically silent); F7 (MUTANT label on negative-control cases 32/33) is a non-vacuous labeling nuance the plan itself uses.

## Self-analysis
The install.sh:2037 count string ("7 grounding hooks") was missed by my first sweep because my grep pattern ('grounding (7)' / 'the 7 grounding') did not cover the "(N grounding hooks)" shape used in the installer FILES array. Caught it only when the mislabeled `--only config` clause forced me deeper into the installer. Lesson: when sweeping count touchpoints, grep the NUMBER-agnostic noun ('grounding hooks') not a guessed number+format, and consult the precedent beat (concise-stop-gate named this exact string) before trusting a narrow pattern.

## Files
Created: claude/hooks/elias-mandate.sh, claude/hooks/elias-toggle.sh, claude/hooks/elias-detect-stop.sh, claude/hooks/test-elias-mandate.sh, claude/hooks/test-elias-toggle.sh, claude/hooks/test-elias-detect-stop.sh, .claude/memory/decision_2026-08-05_elias-mode-design.md, this file.
Modified: claude/hooks/concise-detect-stop.sh (Edit A + Edit B), claude/hooks/test-concise-detect-stop.sh (+5 cases), claude/hooks/cluster-wirings.json (3 keys), claude/hooks/browser-tree.json (3 spots), install.sh (grounding cluster_hooks + FILES count 7->10), README.md (3 counts).
NOT committed per Jonah - all changes left in the working tree for review.

