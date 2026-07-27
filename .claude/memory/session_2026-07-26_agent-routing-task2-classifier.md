---
name: Agent routing Task 2 - lexicon and classifier core shipped
description: claude/hooks/route-intent.json (4-tier lexicon) + route-intent.sh (fail-open bash+python3 UserPromptSubmit classifier), TDD RED 6/10 then GREEN 10/10, committed.
type: project
relates_to: [session_2026-07-26_agent-routing-task1-roster.md]
author_human: Jonah
source: session
verified: tests - bash claude/hooks/test-route-intent.sh, RED 6 passed/4 failed before the hook existed, GREEN 10 passed/0 failed after; manual fail-open probes (empty stdin, malformed JSON, missing lexicon, corrupt lexicon, no-match prompt) all exit 0 with clean stdout/stderr
confidence: high
---

# Task 2: lexicon and classifier core

Collaborator: Jonah. Implemented Task 2 of
`docs/superpowers/plans/2026-07-26-agent-routing.md` per
`.superpowers/sdd/2026-07-26-agent-routing/task-2-brief.md`, as a dispatched
teammate under the branch `agent-routing`.

## What shipped

- `claude/hooks/route-intent.json` (new) - the prompt-shape registry: 4 tiers
  (`quick_answer`, `explore`, `sonnet_impl`, `opus_executor`), each mapping to
  one roster agent name from Task 1, an `escalation_order` list, and a
  `nudge` template. `config` (cooldown_seconds, cooldown_state_file,
  min_prompt_chars) and `exempt` are present but not yet consumed by this
  task's classifier - they are scaffolding for Tasks 3-6, which extend this
  same file.
- `claude/hooks/route-intent.sh` (new) - the UserPromptSubmit hook. Bash
  wrapper resolves `LEXICON` via `ROUTE_INTENT_LEXICON` env override (the
  seam Task 6 uses to inject a corrupt lexicon and prove fail-open), reads
  stdin once, and passes both the lexicon path and raw payload to python3 via
  env vars into a quoted heredoc (`<<'PYEOF'`) so the shell never expands
  anything inside the Python body - this is what makes the hook injection-
  safe. The whole Python body is one try/except that exits 0 on any error;
  `json.load` of the lexicon lives inside that try. Matching walks
  `escalation_order` and returns the first regex hit, so a prompt matching
  several tiers resolves to the most capable matched tier (not best-match or
  longest-match scoring) and prints one JSON object with
  `hookSpecificOutput.additionalContext`.
- Extended `claude/hooks/test-route-intent.sh` (existing, from Task 1) with
  `run_hook`, `assert_routes`, `assert_silent` helpers and 4 new assertions
  (one per tier), inserted immediately before the RESULTS summary block per
  the brief.

## Why the fail-open shape matters

This hook sits directly in the prompt path on every turn. Every failure mode
(missing lexicon file, empty stdin, malformed JSON payload, corrupt lexicon
JSON, a bad regex pattern in a tier) must exit 0 with no output - a loud
failure here would break every prompt in the session, not just this feature.

## TDD evidence

RED: `bash claude/hooks/test-route-intent.sh` before `route-intent.sh`/
`route-intent.json` existed -> `RESULTS: 6 passed, 4 failed`, all 4 new cases
failing with `got: <silent>` (bash exits nonzero on missing script, `run_hook`
captures empty stdout) - matches the brief's expected failure exactly.

GREEN: same command after both files were created and `chmod +x` applied ->
`RESULTS: 10 passed, 0 failed`.

Note: the brief's Step 5 text says "Expected: PASS, RESULTS: 8 passed, 0
failed" - that count is stale in the brief (it predates Task 1 growing the
existing suite to 6 assertions). The controller's task message explicitly
corrected this to 10 (6 existing + 4 new), which is what the suite actually
produces. Flagging this as a brief inconsistency, not a code defect.

## Self-review

- Traced every failure path in `route-intent.sh` by hand: missing lexicon
  file, empty stdin, non-dict JSON payload, empty/whitespace-only prompt,
  missing tiers/escalation_order/nudge keys, a `re.error` from a bad pattern,
  and the outer catch-all - all exit 0, all silent.
- Manually probed 5 fail-open cases beyond the brief's 4 test assertions
  (empty stdin, malformed JSON, missing lexicon via env override, corrupt
  lexicon via env override, a plain no-match prompt) plus one clean-output
  case - all exit 0, stderr empty on the clean-output case, valid JSON on
  stdout.
- `shellcheck` clean on `route-intent.sh` (no findings). `shellcheck` on
  `test-route-intent.sh` emits one info-level SC2329 ("assert_silent is
  never invoked") - expected, since Task 2 only wires `assert_routes` calls;
  `assert_silent` is scaffolding for Tasks 3-6's silence assertions per the
  brief's own text ("Tasks 3-6 extend this same file").
- Scanned all three touched files for emoji, emdash, and AI-attribution
  strings - none found.
- Did not add anything beyond the brief: no min_prompt_chars gating, no
  cooldown logic, no exempt-pattern handling - those are explicitly later
  tasks' scope per the brief and the controller's notes.
- `.claude/memory/MEMORY.md` and `MEMORY-archive.md` were already modified
  in the working tree before this task started (visible in git status at
  session start) - left untouched and unstaged; not part of this task's file
  set and appear to be concurrent memory-compactor/other-teammate churn.

## Files touched
- `claude/hooks/route-intent.json` (new)
- `claude/hooks/route-intent.sh` (new)
- `claude/hooks/test-route-intent.sh` (modified - 4 new assertions + 2 helpers)
- `.claude/memory/session_2026-07-26_agent-routing-task2-classifier.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
