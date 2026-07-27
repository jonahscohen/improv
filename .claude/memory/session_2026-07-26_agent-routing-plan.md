---
name: Agent routing implementation plan (8 tasks, TDD, removal isolated)
description: Wrote docs/superpowers/plans/2026-07-26-agent-routing.md - 8 TDD tasks building the roster, classifier, suppression, tie-break, cooldown, fail-open, installer wiring, and the model-routing cluster removal. Discovered the guard is an installer cluster, not a standalone hook; corrected the spec.
type: project
relates_to: [session_2026-07-26_agent-routing-design.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: dependency sites grepped at HEAD 1bd2e239; plan self-review run; no implementation started
confidence: high
---

# Agent routing implementation plan

Plan written to `docs/superpowers/plans/2026-07-26-agent-routing.md`. Nothing
implemented yet. Collaborator: Jonah. Follows the design in
`session_2026-07-26_agent-routing-design.md`.

## Task breakdown

1. Agent roster (`quick-answer` haiku read-only, `sonnet-impl` sonnet
   edit-capable, `opus-executor` promoted global) plus the test harness
2. Lexicon + classifier core, fires on a single-tier match
3. Suppression: scrub code fences / backticks / URLs / XML, min-length gate,
   informational-framing exempts
4. Escalate-up tie-break, regression-locked against a lexicon reorder
5. Cooldown, one nudge per 15-minute window
6. Fail-open hardening: malformed stdin, corrupt lexicon, invalid regex
7. Wire into `cluster-wirings.json`, `install.sh`, and live `settings.json`
8. Remove the `model-routing` cluster (INDEPENDENT; routing ships without it)

Test counts are cumulative and asserted per task: 4, 8, 13, 16, 19, 26, 28.

## Discovery that corrected the spec

The spec's Removal scope was wrong and has been amended in place.
`model-router-guard.sh` is not a standalone hook - it is a registered INSTALLER
CLUSTER (`model-routing`). Removal touches eight sites, not two:
`cluster-wirings.json:293-310`, plus `install.sh` at `:477` (KEYS), its DESCS
entry, `:506` (FILES), `:508` (DIRS), `:509` (PICKS), `:602` (CLUSTER_KEYS),
`:635` (`cluster_hooks()`), `:1222` and `:1789` (case statements), and `:4827`
(the special-case `detect-session-model.sh` link).

**Hazard:** `KEYS`/`DESCS`/`FILES`/`DIRS`/`PICKS` are index-aligned parallel
arrays. Removing from one without the others silently relabels every cluster
below the insertion point. Task 8 asserts equal lengths across all five before
committing.

**Why:** the original grep only covered `~/.claude/`, which is a directory of
symlinks, so it found the live wiring but not the repo-side installer that
produces it. Lesson for this repo: when scoping a hook removal, grep
`install.sh` and `claude/hooks/cluster-wirings.json`, not just `settings.json`.

`install.sh:4827` is safe to delete because `install.sh:4776-4779` already
symlinks `detect-session-model.sh` unconditionally in the fable pass, so the
dependency survives the guard.

## Consequence of the size discovery

Removal is now larger than the routing build it was attached to. It was
isolated as the last task with an explicit note that Tasks 1-7 deliver working
routing on their own, so the removal can be deferred or narrowed without
reworking anything.

## Files touched
- `docs/superpowers/plans/2026-07-26-agent-routing.md` (new)
- `docs/superpowers/specs/2026-07-26-agent-routing-design.md` (Removal scope corrected)
- `.claude/memory/session_2026-07-26_agent-routing-plan.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
