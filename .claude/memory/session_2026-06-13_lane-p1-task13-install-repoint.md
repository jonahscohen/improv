---
name: Lane P1 Task 13 - install.sh repoint (LAST P1 task) + deploy the classifier module
description: Repointed install.sh from sidecoach-modes.json to sidecoach-lanes.json in both the deploy + deactivation loops, AND added sidecoach_lanes.py to the deployed set (the hook imports it at runtime - without it the deployed lane tier silently disables). bash -n clean; all suites unchanged.
type: project
relates_to: [session_2026-06-13_lane-p1-task6-hook-wiring.md, session_2026-06-13_lane-p1-task1-registry-loader.md]
---

Collaborator: Jonah

Implemented **Task 13 only** (the LAST P1 task) of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 1 file (install.sh).

## What was done (2 edits to install.sh)

Confirmed live anchors first: the only sidecoach-modes.json references were the deactivation loop (line 1048) and the deploy loop (line 2613) - matching the plan's cited lines.

1. **Deploy loop (~2613):** `for registry in sidecoach-verbs.json sidecoach-modes.json` -> `sidecoach-verbs.json sidecoach-lanes.json sidecoach_lanes.py`. Updated the comment. This symlinks all three into ~/.claude/hooks/.
2. **Deactivation loop (line 1048):** replaced sidecoach-modes.json -> sidecoach-lanes.json and added sidecoach_lanes.py so uninstall cleans up the new files too.

## The real fix (beyond the rename): deploy sidecoach_lanes.py

The team-lead flagged this and it was the actual bug: the lane tier's hook (sidecoach-keyword.sh) does `sys.path.insert(0, HOOK_DIR); import sidecoach_lanes` at runtime, where HOOK_DIR resolves to ~/.claude/hooks. The OLD installer never copied sidecoach_lanes.py, so a deployed install would hit the hook's `except: lane_registry = None` path and SILENTLY run without the lane tier (verb-only fallback). Adding sidecoach_lanes.py + sidecoach-lanes.json to the deploy loop makes the deployed hook actually run the v10 lane classifier. (HOOK_DIR = dirname of the symlinked hook = ~/.claude/hooks; pwd is logical, not symlink-resolved, so the sibling symlinks resolve.)

## Verification

- `grep -n sidecoach-modes.json install.sh` -> the only remaining hit is an INTENTIONAL historical comment ("...replaces the retired sidecoach-modes.json"); no functional reference remains. Per the plan, an intentional comment is left in place.
- both functional loops now carry sidecoach-lanes.json + sidecoach_lanes.py (deploy line 2618 + deactivation line 1048).
- `bash -n install.sh` -> exit 0 (parses clean).
- No behavior change elsewhere (Task 13 only touched install.sh): `python3 test_sidecoach_lanes.py` -> 35 passed 0 failed; `cd sidecoach && npm test` -> 5 suite(s) passed (exit 0); `bash test-sidecoach-keyword.sh` -> 110 passed 0 failed (see commit).
- model-router-guard: installer shell edit, no LLM/network.

## Concern / pre-existing gap flagged (NOT in Task 13 scope)

install.sh does NOT deploy `sidecoach-intent.json` (the nudge-tier registry) - no reference anywhere. This is PRE-EXISTING (predates the lane work) and the hook degrades gracefully (try/except -> intent={}, nudge disabled), but it means the NUDGE_ELIGIBLE tier never fires in a deployed install. Out of Task 13 scope; flagged for a possible follow-up.

## P1 completeness

After Task 13, P1 is functionally complete: registry+loader (T1), segmentation (T2 +fix), sanitize/blank (T3), scoring/scope (T4), decision flow (T5), hook wiring (T6 +quoted-verb fix), TS mirror+parity corpus (T7), /sidecoach phrase resolution+near-miss (T8), scoped test runner (T9), generator+lanes.generated (T10), modes.ts freeze (T11), v10 harness corpus (T12), install repoint (T13). All P4 items (MCP list-modes->list-lanes rename, modes.ts/dist deletion, SKILL.md/CHEATSHEET.md markers) remain deferred per plan.

## Follow-up: intent.json deploy gap CLOSED (team-lead approved)

The pre-existing gap I flagged was fixed in the same task (separate commit): added `sidecoach-intent.json` to BOTH install.sh loops (deploy ~2620 + deactivation 1048) alongside lanes.json + sidecoach_lanes.py. The hook reads sidecoach-intent.json at runtime for the NUDGE_ELIGIBLE tier; without deployment it degraded to nudge-disabled. Now the deployed nudge tier works. Re-verified: `bash -n install.sh` exit 0; grep shows intent.json in both functional loops; only-historical-comment modes.json remains; python 35/0 + parity 19 still green (install-only change, no code behavior). The "intent.json not deployed" concern from above is now RESOLVED.

## Files touched

- install.sh (deploy + deactivation loops: modes.json -> lanes.json + sidecoach_lanes.py + sidecoach-intent.json)
