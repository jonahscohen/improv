---
name: sidecoach QA-gate Stop hook - independent verification
description: Independent verifier's test suite + adversarial findings for sidecoach-qa-gate-stop.sh
type: project
relates_to: [session_2026-08-23_sidecoach-qa-gate-finish-boundary.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Independent verification (produce-and-verify mandate) of the sidecoach QA-gate
finish-boundary Stop hook built by teammate qa-gate. Verifier owned the test file +
adversarial review; did NOT edit the builder's hook/arm/override files.

## What was verified

Unit under test:
- claude/hooks/sidecoach-qa-gate-stop.sh (Stop gate - blocks reporting a substantive design change done until the sidecoach QA gate provably ran).
- claude/hooks/qa-gate-manual.sh (UserPromptSubmit override).
- claude/hooks/sidecoach-orchestrate-edit.sh (arm point - writes ~/.claude/.needs-qa-gate.<KEY> = target basename on a substantive design edit).

Deliverable: claude/hooks/test-sidecoach-qa-gate-stop.sh - 55 assertions, mirrors
test-concise-detect-stop.sh / test-verify-visual-gate.sh format (fake $HOME per case,
throwaway git repos, both directions, PASS/FAIL counters, contains helper, exit 0
all-pass / 1 any-fail). Result: 55 passed, 0 failed.

Command: `bash claude/hooks/test-sidecoach-qa-gate-stop.sh` -> "RESULTS: 55 passed, 0 failed / All tests pass." exit 0.

## Contract confirmed empirically

Real Claude Code transcripts carry a top-level ISO `timestamp` (Z-suffixed) on every
assistant entry (59/59 in a sampled transcript), so the timestamp-gated evidence path
is production-sound. A real sidecoach run logs a Skill tool_use `{"skill":"sidecoach",
"args":"audit ..."}` - matches the builder's `input.skill`/`input.args` predicate.
tool_use records are runtime-authored (un-forgeable); the agent only emits `text` blocks.

## Axes CERTIFIED correct (the lead's bar)

- No deadlock / permanent trap: blocks at most once per armed cycle; every error/loop
  path allows; tree-clean, evidence, and override all clear. "block -> real run next
  stop -> clears" verified.
- Fail-direction: fail-OPEN on hook/parse errors (garbage/empty/wrong-shape stdin,
  missing transcript, total detect failure); fail-CLOSED on tree uncertainty
  (not-a-repo / nonexistent / empty cwd, git error). Both hold, opposite directions.
- Anti-replay: old or untimestamped evidence never clears a fresh flag.
- Session-scoping: another session's flag never blocks this one; override session-scoped.
- Anti-loop 4 layers present + correct (stop_hook_active, once-per-burst, atomic
  noclobber claim, fail-open trap). Coupling: Stop DESIGN_EXTS superset of arm side;
  non-app dir regex byte-identical with verify-before-done-stop.sh.

## Adversarial findings (all reproduced)

FINDING C (HIGH) - the text-signature clear path is self-gameable by the agent's OWN
completion report. A single assistant text block with a (sidecoach|qa-gate) marker +
all three verbs + one struct token clears the gate with NO tool call. Repro:
"Done. Ran the sidecoach qa-gate: audit, critique, polish - no findings, contrast
passes." -> ALLOW. The Skill tool_use path is un-forgeable; the text fallback is the
hole. Defeats the gate's anti-rationalization purpose. Recommend: drop the text path
(rely on Skill tool_use + tree-clean + override) or bind it to detect-verifiable
specifics. Deliberate tradeoff by builder -> ship/no-ship escalated to lead.

FINDING B (MEDIUM) - a 2nd substantive design change after an IGNORED block escapes
the gate for the rest of the session: burst flag persists across a re-arm, so
change #2..N are never gated. Safe direction (never loops), weaker than once-per-arm.
Recommend: record arm identity in the burst flag; re-block when a newer arm supersedes.

FINDING D (LOW) - the cross-gate deferral slips into a double-block on an unreadable
tree (both flags armed + cwd not a git repo): visual_dirty=0 on uncertainty, so the
deferral does not fire and both gates block. No loop, rare, just noisier. Recommend:
defer when needs-verification=='visual' AND design_dirty.

## Resolution (lead rulings folded + re-verified)

Lead ruled: (a) DROP the text-signature clear path entirely - text never clears, only a
real Skill tool_use / tree-clean / override; and finding-4: require ALL THREE stages
(audit AND critique AND polish in post-arm sidecoach Skill tool_uses) to clear - a single
verb must not. Builder folded C (dropped text path), finding-4 (all-three), B (re-block on
fresh re-arm, keyed on int(arm-flag mtime) STORED as burst-flag content - immune to
file-mtime races, strict -gt so the same arm never loops), D (deferral fires when
needs-verification=='visual' regardless of a certain visual_dirty read; fail-closed
preserved when only qa is armed). Builder also folded 6 independent Codex findings
(evidence must be an assistant entry; tz-naive stamps rejected; strict UTF-8 decode
fail-closed; session-key parity; arm scope narrowed to gate scope). Suite stays green
through all of it.

Suite grew to 65 assertions, all green, DETERMINISTIC. Fixed a self-inflicted flake: the
gate keys re-arm on int(arm-flag mtime), so the B-fix cases pin explicit epoch-seconds
instead of relying on sub-second wall-clock. New sections: all-three-required,
text-never-clears (incl. the exact former-gaming string), B-fix re-arm + loop-guard,
D-fix defer-on-unreadable-tree + fail-closed guard, plus coupling assertions.

Packaging: both hooks wired in browser-tree.json + app-wirings.json + install.sh; the
component-browser test's qa-gate assertions are green. Its 2 remaining failures
(stage_all-clears-opposite-pending, apply_pending_plan-multi-hook-off-list) are JUSTIFY
cases that reproduce on a PURE HEAD checkout (145 passed / 2 failed) - pre-existing at HEAD,
untouched by this unit, out of scope.

## FINAL VERDICT: CERTIFIED

Suite 65/65 green + deterministic (3 consecutive clean runs). No deadlock/trap; fail-OPEN on
errors and fail-CLOSED on tree uncertainty both hold; anti-loop 4 layers correct;
session-scoped; text un-gameable; all-three enforced; re-arm re-blocks without looping;
deferral no longer double-blocks. Independent verification complete.

Files touched: claude/hooks/test-sidecoach-qa-gate-stop.sh (new, verifier-owned).
Pre-existing repo defect noted (not this unit): test-component-browser.sh 2 justify cases
fail at HEAD.
