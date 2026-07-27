---
name: Task 7 Codex review found a real installer completeness gap - fixed and re-verified
description: Codex flagged that cluster_hooks() agent-routing only deploys route-intent.sh, not the route-intent.json lexicon or the claude/agents/ roster the FILES text promises - a fresh install would silently ship a non-functional hook. Fixed by extending the deploy loop's per-hook special-case (same pattern as model-router-guard.sh + detect-session-model.sh), proven in an isolated sandbox. Also caught and fixed a second, self-discovered bug while investigating: my manual live settings.json wiring put route-intent.sh in the wrong UserPromptSubmit group relative to cluster-wirings.json's declared matcher, which would have caused a duplicate hook entry on a future automated re-run.
type: project
relates_to: [session_2026-07-26_agent-routing-task7.md]
author_human: Jonah
source: session
verified: isolated sandbox test proves the deploy loop now symlinks route-intent.json + all 3 claude/agents/*.md files alongside route-intent.sh; bash -n install.sh clean; full suite still 30/30; live settings.json corrected and re-parses; live smoke test through the corrected group still produces the right nudge at rc=0
confidence: high
---

# Task 7 follow-up: Codex review found a real gap, fixed before reporting done

Collaborator: Jonah. This is a same-day follow-up to
`session_2026-07-26_agent-routing-task7.md`, driven by the mandatory
cross-model review gate (Team Rule 8) run on the Task 6+7 diff via
`claude/hooks/codex-review.py`.

## Finding 1 (Codex): companion files never get deployed

`install.sh:498/509`'s own DESCS/FILES text says agent-routing "Installs
route-intent.sh + route-intent.json and the ~/.claude/agents/ roster."
But `cluster_hooks()` for `agent-routing` returns only `"route-intent.sh"`,
and the deploy loop (`install.sh:4827-4836` at commit time) only
symlinks whatever `cluster_hooks()` names. On a genuinely fresh machine,
picking `agent-routing` would deploy `route-intent.sh` alone: no
`route-intent.json` (the hook's own `[ -f "$LEXICON" ] || exit 0` guard
means it fails open silently, i.e. routes nothing, forever) and no
`~/.claude/agents/*.md` roster (so even if it did nudge, `Agent(
subagent_type: quick-answer)` would have nothing to resolve against
outside this repo). This is a real completeness bug in Task 7's own
scope, not a pre-existing issue - the brief's Step 5 array text
overpromised relative to what its own code did.

Traced this against the ONE existing precedent for a hook with
companion files (`model-router-guard.sh` + `detect-session-model.sh`,
`install.sh:4832-4835`) and the sidecoach convention for hook-adjacent
DATA files (`install.sh:4704-4706`: plain `ln -sf`, explicitly NOT
`link_or_copy`, because `link_or_copy`'s copy-mode unconditionally
`chmod +x`'s the destination - fine for an executable, wrong for a JSON
lexicon or a markdown agent definition).

Fix: added a `route-intent.sh` special case to the deploy loop,
mirroring both precedents - `ln -sf` the lexicon and each roster `.md`
file (`mkdir -p "$CLAUDE_DIR/agents"` first, since it may not exist yet).

Verified in an isolated sandbox (not by risking a real `install.sh` run,
which has no dry-run mode and 5000+ lines of side effects): extracted
just the deploy-loop block via a marker-based slice, sourced it in a
subshell with `REPO_DIR` pointed at the real repo, `CLAUDE_DIR` pointed
at a scratch `/tmp` directory, `_eff="route-intent.sh"`, and a stub
`link_or_copy` that just symlinks. Result: `route-intent.json` and all 3
of `quick-answer.md` / `sonnet-impl.md` / `opus-executor.md` landed
correctly in the scratch dirs, alongside `route-intent.sh` itself.
Cleaned up the scratch dirs after.

## Finding 2 (self-discovered while fixing finding 1): live wiring landed in the wrong group

While re-verifying, checked which `UserPromptSubmit` group in the live
`~/.claude/settings.json` actually held `route-intent.sh` after Task 7's
Step 7 (the brief's own script, which just appends to
`ups[-1]["hooks"]` - the LAST existing group). That group has
`"matcher": ""`. But `cluster-wirings.json`'s `route-intent.sh` entry
declares `"matcher": null`, and `install.sh`'s real wiring function
(`add()`, around `install.sh:4856-4865`) resolves `matcher: None` to
"the group with NO `matcher` key at all" - a DIFFERENT, earlier group in
this file (the one holding `concise-toggle.sh`, `grounding-gate.sh`,
`task-loop-mandate.sh`, etc; matcher key absent, not empty-string).

Consequence if left as-is: if `install.sh --only agent-routing` (or a
future `ampersand` re-run) ever executes on this machine, `add()` checks
for `route-intent.sh` only within the absent-matcher group it targets,
would not find it there (it actually lives in the `matcher: ""` group),
and would append a SECOND `route-intent.sh` entry - the hook would then
fire twice per prompt, printing the nudge twice.

Fix: removed `route-intent.sh` from the `matcher: ""` group (restoring
it to just `api-drift-ack.sh`, its pre-Task-7 state) and added it to the
absent-matcher group instead, matching what the real `add()` function
would produce. Backed up settings.json again before this correction
(third backup this session). Re-ran the live smoke test from the
corrected position: still fires correctly, `rc=0`, expected nudge text.
Removed the resulting `~/.claude/.route-intent-cooldown` afterward.

## Findings not acted on (with reasoning)

Codex also flagged that `test-route-intent.sh`'s `assert_wired` (loose
match on `"UserPromptSubmit" in json.dumps(e)`) and the installer-cluster
grep check (`grep -q agent-routing install.sh`, which would pass on help
text alone) are weaker than ideal, and that the Task-6 invalid-regex test
could theoretically pass even if `ROUTE_INTENT_LEXICON` were silently
ignored. Did not modify: the first two are the team lead's own brief
code, given as an exact block to append verbatim ("Append before the
RESULTS block: [code]") - not something I authored or was asked to
strengthen. The third is empirically already disproven by the Task 6
mutation-test evidence in the prior beat: removing the per-pattern
`except re.error` while `ROUTE_INTENT_LEXICON` pointed at the mutated
temp file caused the assertion to FAIL (silent output, no "Explore") -
if the env var were being ignored and the real default lexicon were
used instead, that mutation would have had no effect (the default
lexicon has no invalid regex to trip on) and the test would have stayed
green. Recording this rather than silently dropping the finding, per the
standing instruction to say what was and was not acted on and why.

## Files touched
- `install.sh` (deploy-loop special case for route-intent.sh's
  companions)
- `~/.claude/settings.json` (live group correction, outside repo)
- `.claude/memory/session_2026-07-26_agent-routing-task7-codex-fix.md`
  (this beat)
