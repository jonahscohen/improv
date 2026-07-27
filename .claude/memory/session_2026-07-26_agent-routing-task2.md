---
name: Agent routing Task 2 complete (classifier live, all four tiers routing correctly)
description: route-intent.sh + route-intent.json shipped at 036839b1. Suite 10/10. Controller exercised the hook with real prompts - all four tiers route correctly and a multi-tier prompt escalates to opus-executor. All seven fail-open paths verified rc=0 empty.
type: project
relates_to: [session_2026-07-26_agent-routing-task1-fix.md, session_2026-07-26_agent-routing-plan.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller ran the suite (10/10), probed 5 real prompts through the hook observing actual nudge text, and independently confirmed 7 fail-open paths return rc=0 with empty output
confidence: high
---

# Task 2: lexicon and classifier

Collaborator: Jonah. Implemented by `task2-classifier` (sonnet), commit
`036839b1`, branch `agent-routing`. Suite 10/10 (6 from Task 1 plus 4 new).

## What shipped

- `claude/hooks/route-intent.json` - tunable lexicon. Four tiers, each with an
  `agent`, `model`, `label`, and regex `patterns` list, plus
  `escalation_order`, `config` (cooldown, min length), and the `nudge` template.
- `claude/hooks/route-intent.sh` - the classifier. Bash wrapper passes the
  lexicon path and raw stdin to python3 through ENVIRONMENT VARIABLES, with the
  Python body in a quoted heredoc so the shell expands nothing inside it. That
  is what makes it injection-safe.

## Controller verification, done directly rather than on report

Ran five real prompts through the hook and read the actual emitted nudge:

| prompt shape | routed to |
|---|---|
| "where is the cooldown seconds value set..." | quick-answer (haiku) |
| "find all the callers of detect-session-model..." | Explore (built-in) |
| "rename the helper touch_cooldown to... across every hook" | sonnet-impl (sonnet) |
| "implement a new caching layer..." | opus-executor (opus) |
| "refactor the flow handler AND update every reference" | opus-executor (escalated) |

The last row is the tie-break working: that prompt matches both `sonnet_impl`
and `opus_executor`, and resolves UP. Task 4 formally locks this, but it is
already correct.

Fail-open independently confirmed on all seven paths (malformed JSON, empty
stdin, null prompt, array payload, whitespace-only prompt, corrupt lexicon,
missing lexicon). Every one returns rc=0 with empty output.

## Process defect found and fixed

`task2-classifier` flagged that its brief said "8 passed" where the real total
was 10. **Root cause:** the briefs are EXTRACTED SNAPSHOTS of the plan, and I
staged Task 2's brief before correcting the plan's cumulative counts in
`b316a99e`. The snapshot kept the stale numbers.

Fix applied: re-extracted briefs 3 through 7 from the corrected plan. **Rule
for this workflow: re-stage every downstream brief after any plan edit, because
a brief is a copy and does not track its source.**

## Files touched
- `claude/hooks/route-intent.json`, `claude/hooks/route-intent.sh` (new)
- `claude/hooks/test-route-intent.sh` (4 assertions appended)
- `.claude/memory/session_2026-07-26_agent-routing-task2.md` (this beat)
