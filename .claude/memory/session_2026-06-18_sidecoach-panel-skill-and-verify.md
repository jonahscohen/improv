---
name: Sidecoach panel - skill surfacing + verification (Steps 4-5)
description: skill now prints the panel verbatim and suppresses mid-run verbosity; full build/test green
type: project
relates_to: [session_2026-06-18_sidecoach-panel-wired.md, feedback_post_phase_reality_check.md]
---

Collaborator: Jonah

Steps 4-5 of the make-Sidecoach-real plan - completes the feature.

## Step 4 - skill (verbosity reduction)
claude/skills/sidecoach/SKILL.md (symlinked live): added `panel` to the result contract and a
"panel (the progress surface - keep the run quiet)" directive in Using Output Correctly. Claude now
PRINTS `result.panel` (and each `sidecoach_lane` start/advance `.panel`) VERBATIM and does NOT dump
the verbose markdown Build Report or paste guidance steps as prose - the panel replaces the mid-run
chatter. The detailed Build Report stays in `artifacts` for on-request findings detail. The
invocation template now prints `r.panel` and keeps guidance/checklist for the model's own execution.

## Step 5 - build + test
- content-guard: `bash claude/hooks/test-content-guard.sh` -> 35/35.
- sidecoach full suite: `npm test` -> 56/56 suites (incl. the new panel-renderer suite).
- mcp-server: `npm test` -> 296/297; the 1 failure is `python_repl OOM` (macOS cannot enforce the
  256m cap) - a KNOWN environmental fail (see session_2026-06-14_p4d-baseline-oom-env-fail), NOT a
  regression from this work.
- `npx tsc` clean in sidecoach; `tsc` clean in mcp-server.
- Rebuilt sidecoach dist (dist/sidecoach-orchestrator.js has 5 renderSidecoachPanel call sites) and
  mcp-server dist against it - no type break (panel fields are additive/optional).
- Rendered a live sample card via ts-node: matches the marketing demo 1:1.

## Not yet done (user action)
LIVE e2e in a real Claude Code session is NOT verified: the sidecoach MCP server only loads the new
dist on a Claude Code RESTART. After restart, run `/sidecoach audit <target>` (or a sidecoach_lane
start/advance) and confirm the compact panel prints (progressive snapshots + final card) and the old
verbose mid-run output is gone.

Whole feature (Steps 0-5) complete + recorded across:
content-guard-emoji-presentation, sidecoach-panel-renderer, sidecoach-panel-wired, this beat.
Files this step: claude/skills/sidecoach/SKILL.md (+ rebuilt sidecoach/dist, mcp-server/dist).
