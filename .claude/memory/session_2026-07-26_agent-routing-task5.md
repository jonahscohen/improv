---
name: Agent routing Task 5 complete (route-intent cooldown)
description: One nudge per 15-minute window, overridable via ROUTE_INTENT_COOLDOWN/ROUTE_INTENT_COOLDOWN_FILE. Real TDD (RED confirmed before implementing). Suite 21/21.
type: project
relates_to: [session_2026-07-26_agent-routing-task4.md]
author_human: Jonah
source: session
verified: bash claude/hooks/test-route-intent.sh 21/21, run 3x to rule out flake, plus a background codex review of the diff
confidence: high
---

# Task 5: cooldown

Collaborator: Jonah. Commit: "hooks: add route-intent cooldown".

## What shipped

`route-intent.sh` gains a cooldown gate placed right after the `min_chars`
check and before the `exempt` loop, per the brief:

- `cooldown_file` resolves from `ROUTE_INTENT_COOLDOWN_FILE`, else
  `cfg["cooldown_state_file"]` expanded (`~/.claude/.route-intent-cooldown`
  by default).
- `cooldown_seconds` resolves from `ROUTE_INTENT_COOLDOWN`, else
  `cfg["cooldown_seconds"]` (900), falling back to 900 on a parse error.
- `in_cooldown()` fail-opens (returns False, i.e. not suppressed) on any
  read error or missing file, and short-circuits False whenever
  `cooldown_seconds <= 0`.
- `touch_cooldown()` fail-opens (swallows write errors) and is called only
  at the moment a tier actually matches and fires, immediately before the
  nudge is printed - so cooldown starts on real nudges only, not on every
  invocation.

## TDD evidence

RED: appended the three cooldown assertions (900s window: first fires,
second silent; 0s window: both fire) before implementing anything.
`bash claude/hooks/test-route-intent.sh` gave 20 passed, 1 failed -
"second nudge suppressed by cooldown (got: {...Explore...})" - the actual
output showed the second prompt firing for real (matched Explore), proving
the assertion was not vacuous: both prompts genuinely match a tier, so
silence in the GREEN run can only come from the cooldown, not from a
prompt that never matched anything. This directly answers the standing
lesson from Tasks 1 and 3 (silent assertions that pass for the wrong
reason) before trusting the test.

GREEN (first attempt): implementing exactly the brief's code caused a
**real regression** - 16 passed, 5 failed, with every pre-existing
`assert_routes` test suddenly silent. Root cause, confirmed via
`stat`/`date` against the live `~/.claude/.route-intent-cooldown` file: the
real cooldown file already held a timestamp from seconds earlier.
CORRECTION (per team lead, post-report): the hook was never wired live in
this session - the warm timestamp came from the team lead's own manual
probes against the real default path, not from a live dogfooded hook. The
mechanism is unchanged: the first `run_hook` call in the suite (using the
real default file/900s window, since it takes no env override) re-touched
that same real file, and every subsequent plain `run_hook` call in the
same execution then fell inside that 900-second window and went silent -
not because of a code defect, but because the pre-existing 18 assertions
and the new cooldown assertions all share process-global default state (a
single real file, keyed by nothing else) once cooldown exists, and that
file was not empty when this test run started.

Fix: added a small isolation block at the top of
`test-route-intent.sh` (not a helper redefinition) that exports a
throwaway `ROUTE_INTENT_COOLDOWN_FILE` and `ROUTE_INTENT_COOLDOWN=0` before
any assertions run, with a `trap ... EXIT` to clean up the temp file. This
makes every plain `run_hook`/`assert_routes`/`assert_silent` call hermetic
against both the real machine's cooldown file and against each other
within one run, while the cooldown-specific tests already override
`ROUTE_INTENT_COOLDOWN_FILE`/`ROUTE_INTENT_COOLDOWN` per invocation (a
per-command env prefix takes precedence over an exported parent value).
Confirmed the real `~/.claude/.route-intent-cooldown` file's mtime was
unchanged by three consecutive suite runs after the fix - zero side
effects on real session state.

GREEN (after isolation fix): 21 passed, 0 failed, confirmed stable across
three consecutive runs.

## Deviation from the brief worth flagging

The brief's Step 3 code block is exactly what I implemented in
`route-intent.sh`, unchanged. The one thing not in the brief's text is the
isolation block added to `test-route-intent.sh` (the `export`/`trap` lines
right after `HOOK` is set). This was necessary to keep the suite green and
was not a redefinition of any locked helper (`pass`, `fail`, `run_hook`,
`assert_routes`, `assert_silent` are untouched) - it is test setup that
runs before any of them are called. Flagging it explicitly since the brief
did not anticipate the interaction between a real, already-live hook
instance and a test suite that shares its default state file.

## Files touched
- `claude/hooks/route-intent.sh` (cooldown gate + touch-on-fire)
- `claude/hooks/test-route-intent.sh` (isolation export/trap + 3 cooldown
  assertions appended before RESULTS)
- `.claude/memory/session_2026-07-26_agent-routing-task5.md` (this beat)
