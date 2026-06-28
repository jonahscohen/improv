---
name: ROOT CAUSE - sidecoach NL tier was dead in production (missing deploy symlinks)
description: The natural-language intent tier never worked in ANY real session for ~13 days because sidecoach_lanes.py + sidecoach-lanes.json were committed (Jun 13) but never symlinked into ~/.claude/hooks/. import fails -> lane tier skipped -> silent on no-verb prompts. Live-fixed by linking the 2 files; hook now fires from any CWD.
type: project
relates_to: [session_2026-06-26_sidecoach-invocation-gap.md, session_2026-06-13_lane-p1-COMPLETE.md]
---

Collaborator: Jonah. 2026-06-26.

## THE BUG (reproduced, not theorized)
Running the LIVE hook ~/.claude/hooks/sidecoach-keyword.sh from a non-repo CWD (/tmp)
with the real "feels off... what's wrong with localhost:4830" prompt emitted NOTHING
(exit 0, empty). Reproduced the exact production failure.

## ROOT CAUSE
- ~/.claude/hooks/ is a directory of individual symlinks (59 symlinks, 4 real files),
  not a dir-symlink to the repo. The installer links files one by one.
- sidecoach-keyword.sh IS symlinked to the repo. But the two files the NL/lane tier needs:
    ~/.claude/hooks/sidecoach_lanes.py      -> MISSING (No such file)
    ~/.claude/hooks/sidecoach-lanes.json    -> MISSING (No such file)
  both exist in the repo (claude/hooks/, committed Jun 13 14:33) but were never linked.
- The live symlinks all date Jun 8-12; the lane tier (P1/P2) landed Jun 13 and install.sh
  was never re-run, so the .py module + lanes registry never deployed.
- Consequence: the hook runs, `import sidecoach_lanes` FAILS, lane_registry=None,
  sidecoach_lanes=None -> the entire lane+intent-nudge tier (sidecoach-keyword.sh:289)
  is SKIPPED -> falls to the legacy VERB-ONLY path -> any prompt with no explicit verb
  (polish/audit/...) goes SILENT. "feels off" has no verb -> no nudge, no cooldown touch.
  This is exactly why the other session's cooldown file was never touched at 07:52.
- => The natural-language "sidecoach drives on design intent" capability has been DEAD in
  every real session for ~13 days. My earlier repo-root test "passed" ONLY because running
  `bash claude/hooks/...` set HOOK_DIR to the repo's claude/hooks, where the module IS
  importable. The LIVE dir never had it.

## WHY THE TESTS DIDN'T CATCH IT
test-sidecoach-keyword.sh runs against the REPO copy (module present) -> green the whole
time while production was broken. The tests validated the CODE, never the DEPLOYMENT. That
is the gap: no test asserts the deployed ~/.claude/hooks/ has every sibling the hook imports.

## FIX (live, verified)
- Symlinked both missing files into ~/.claude/hooks/ (sidecoach_lanes.py, sidecoach-lanes.json).
- Re-ran the LIVE hook from /tmp, cold cooldown -> now EMITS the nudge. Tier is alive.
- Live immediately, no restart needed (hooks are read per-invocation).

## STILL TO DO (this resolution arc)
- Durable installer fix so a reinstall links these (install.sh) + audit broader drift.
- Framing: even alive, "diagnose this URL / what's wrong" gets only the build-framed
  advisory nudge; route diagnosis/critique to audit/critique.
- Deploy/invocation test: assert the live hooks dir has every required sibling (red when
  unlinked), and that a natural prompt fires end-to-end.
- Independent review, fold, re-verify.

## Files touched
- ~/.claude/hooks/sidecoach_lanes.py (new symlink), ~/.claude/hooks/sidecoach-lanes.json (new symlink)
</content>
