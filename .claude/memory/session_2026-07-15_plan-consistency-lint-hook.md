---
name: plan-consistency-lint Stop hook built (U7/U10/U12 dispatch-plan linter)
description: TDD'd a Stop hook that lints docs/plans/*.md dispatch docs for intra-unit Owns-vs-prompt drift and blocked-but-proceed sequencing contradictions - the candidate hook proposed in feedback_self_review_before_codex.md. 16/16 fixture cases green; real plan doc yields LOW-only (no false block) after fixing two self-caught false positives.
type: project
relates_to: [feedback_self_review_before_codex.md, session_2026-07-14_parallel-dispatch-plan.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-15. Branch `wave1-debt-burndown`. NOT committed (per instruction). Built the plan-doc consistency linter that feedback_self_review_before_codex.md proposed as the mechanization of the dumb-consistency catches (so Codex is spent only on hard problems).

## What was built
- `claude/hooks/plan-consistency-lint.sh` - Stop hook, bash wrapper + embedded python3 (beats-staleness-guard.sh style). Two entrypoints: default `stop` mode (reads stdin JSON + transcript) and `--lint-file <doc>` debug/test mode (prints `LEVEL: HIGH|LOW|CLEAN` + findings).
- `claude/hooks/test-plan-consistency-lint.sh` - 16 assertions (8 spec fixtures + loop-guard + fail-open x2 + non-plan-ignored + end-to-end block + warn-only + suppression). Exit 0 all-pass, 1 assertion-fail, 2 setup-fail.

## Behavior (Stop event)
- stop_hook_active true -> `{}` (loop guard). Non-JSON / missing transcript / any internal exception -> `{}` (FAIL-OPEN; internal errors only, never a real finding).
- Collects Write/Edit/MultiEdit `input.file_path` from transcript_path; keeps plan docs still on disk. Plan doc = path under `docs/plans/*.md` OR first ~50 lines contain literal `For agentic workers`.
- Any HIGH finding -> `{"decision":"block","reason":...}`. Only LOW -> `{"systemMessage":...}` (does NOT block). Else `{}`.

## Detectors
- **A (Owns vs dispatch-prompt ownership clause):** split units on `^## Unit`; extract `**Owns:**` field and the prompt's ownership clause (span from `own only|own EXACTLY|own:|own ` to the first of `(1)|Implement|Fix|Correct|Replace|TDD|Do NOT|Relocate|<sentence-break>`). Backtick file tokens (contain `/` or a known ext; exclude command fragments). Owns token absent from clause (or clause token absent from Owns) -> HIGH. Symbolic ("new hooks/fixtures dir"), paraphrase/shorthand, or basename-vs-fullpath -> LOW. Read-only / owns-nothing unit exempt. `Do NOT edit X` collected as exclusions (not prompt-owned).
- **B (sequencing):** a BLOCKING phrase (`blocked by`, `depends on`, `only after`, `runs last`, `must wait for`, `after .*(integrated|accepted|merged)`) co-occurring with an IMMEDIATE phrase (`proceed immediately`, `start now`, ...) with NO local qualifier (`except`, `but after`, `relative to`, `-independent`, `not gated on`, `P0a`) in the immediate phrase's sentence -> HIGH. Qualified -> LOW. `<!-- plan-lint: sequencing-ok ... -->` in the unit suppresses B.

## Self-analysis: two FALSE POSITIVES I caught on the real doc BEFORE reporting (self-review pass, per feedback_self_review_before_codex.md)
Ran the linter against the real docs/plans/2026-07-14-parallel-dispatch-plan.md as verification. It fired 3 HIGH - ALL false positives from MY bugs, not real drift:
1. **`e.g.` abbreviation truncated the prompt clause.** My clause-end used a bare `. ` (period-space) sentence boundary; `a new fixtures dir (e.g. ...)` in U12's prompt cut the clause at `e.g.`, dropping `test-site-1/` and `install.sh` -> spurious "omitted from prompt" HIGH. Why: `e.g.`/`i.e.` are abbreviations, not sentence boundaries. How fixed: a real sentence boundary is `.` + space + Capital (`\.\s+[A-Z]`).
2. **Owns explanatory prose tokenized as owned.** U7b's Owns paragraph has a trailing `Note: ... the /dev/null and re-arm fixes ...`; my extractor pulled `/dev/null` as an owned file -> spurious HIGH. Why: the spec bounds the prompt CLAUSE (stops at prose) but says the Owns field runs "until a blank line" with no prose bound; a `Note:` sentence names files the unit does NOT own. How fixed: `trim_to_list()` bounds token extraction to the leading ownership-LIST sentence (read-only detection still runs on the full field). This is a deliberate refinement of the literal spec extraction, made to stop the gate over-firing on the doc it targets - flagged to the orchestrator.

After both fixes: real doc = LEVEL LOW (7 legit non-blocking warns: U3/U5/U7b basename-shorthand where the prompt drops a dir prefix; U8/U9 "change only" phrasing has no canonical `own` clause), ZERO HIGH -> no false block. This is the correct calibration: surfaces real minor drift as warn, blocks only on genuine class-U7/U10/U12 mistakes.

## Known non-blocking behaviors on the real doc (reported, not silently decided)
- U8/U9 use "change only `X`" not "own only `X`" -> no clause marker -> LOW no-clause warn. Adding "change only" to the clause-start markers would silence them; left as a spec-faithful WARN pending orchestrator call.
- The basename warns (U3/U5/U7b) are the spec's intended `basename-vs-fullpath -> WARN`.

## Registration
- Added `~/.claude/hooks/plan-consistency-lint.sh` to the `Stop` array in `claude/settings.json` (repo source). settings.json re-validated as JSON.
- `~/.claude/settings.json` is a SEPARATE live copy that must be kept in sync; a session restart is required to activate. Did NOT edit the live copy (out of lane).

## Verify commands
- `bash claude/hooks/test-plan-consistency-lint.sh` -> 16 passed, 0 failed, exit 0.
- `bash claude/hooks/plan-consistency-lint.sh --lint-file docs/plans/2026-07-14-parallel-dispatch-plan.md` -> LEVEL: LOW (no HIGH).
- `python3 -c "import json;json.load(open('claude/settings.json'))"` -> valid.

## Cross-model review (codex-review.py, real Codex, 3 rounds - GATE PASSED)
- Round 1 (183.2s, exit 0): 8 findings. Folded 7: (High) shell-level fail-open now captures python output + emits neutral if empty; (High) looks_like_file strips `:NN` before the shape test so `install.sh:203` is recognized (my test 2 had MASKED this - the .js.map carried the HIGH; added an isolating test R1); (Med) split_units closes a unit only at heading level <=2 so `### subheadings` stay content; (Med) clause openers add change|write|edit|modify + only/EXACTLY/: with an empty-clause guard (a clause naming no files WARNs, never HIGH-blocks); (Med) BLOCK_RE adds `blocked until`/`blocked on`; (Med) EXCL_RE captures past the dot inside `MEMORY.md`; (Low) read-only exemption anchored to owns-nothing / read-only-with-no-file-tokens. DECLINED 1: adding `once`/`after` to sequencing qualifiers - `only after` / `after ...merged` are already BLOCKING phrases in the spec, so treating `after` as a qualifier is self-contradictory and risks suppressing real contradictions; the sequencing-ok comment is the relief valve and "prefer false positives" covers the rare over-block.
- Round 2 (158.3s, exit 0): confirmed the 7 folds correct; 3 refinements folded: (Med) wrap the python group `{ ...; } 2>/dev/null` so a here-doc/shell failure fails open QUIETLY; (Med) tokenize marks a token soft/non-HIGH when preceded by a content-reference phrase (`references to`/`mentions of`) so `change only references to X in Y` no longer false-HIGHs the content token; (Low) is_plan_doc matches `(?:^|/)docs/plans/[^/]+\.md$` so a repo-relative path is detected.
- Round 3 (76.3s, exit 0): **GO. No residual findings.**
- Codex could not run the suite (its sandbox forbids mktemp) - it was a source review each round; I ran the suite locally.

## Self-analysis (per feedback_self_review_before_codex.md, the beat that motivated this hook)
Codex still caught two bucket-2 (self-catchable) misses in round 1: (1) my test 2 asserted only doc-level HIGH, which MASKED that `install.sh:203` was silently dropped by looks_like_file - a real false-negative my own test hid; the fix was an ISOLATING regression test (R1) so each token class is independently asserted. (2) I followed the spec's Owns extraction ("until a blank line") too literally and let `Note:`-prose tokens (`/dev/null`) become owned - I caught this myself on the real-doc self-review pass BEFORE Codex, which is the discipline that beat demands. Calibration: the self-review pass (running the linter on the real doc) caught the two worst false positives; Codex then caught the masked false-negative and robustness gaps. Lesson reinforced: assert each behavior in ISOLATION, don't let a coarse doc-level assertion mask a per-token bug.

## Test count: 27 assertions, all green (8 spec fixtures + pipeline/loop-guard/fail-open + 8 round-1 regressions R1-R8 + 3 round-2 regressions R9-R11)

## Files touched
- claude/hooks/plan-consistency-lint.sh (new)
- claude/hooks/test-plan-consistency-lint.sh (new)
- claude/settings.json (Stop array registration)
- .claude/memory/session_2026-07-15_plan-consistency-lint-hook.md (this beat) + MEMORY.md index
