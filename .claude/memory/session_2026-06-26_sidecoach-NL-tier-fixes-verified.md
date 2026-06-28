---
name: Sidecoach NL tier - durable fixes (loud-fail + diagnosis framing) verified
description: After live-linking the missing lane files, made the silent lane-tier-disable LOUD (stderr deploy diagnostic in sidecoach-keyword.sh) and broadened the intent nudge to route DIAGNOSIS/critique to /sidecoach audit (not just building). Installer was already correct - the gap was a stale deploy. All three behaviors verified.
type: project
relates_to: [session_2026-06-26_sidecoach-NL-tier-dead-rootcause.md, session_2026-06-26_sidecoach-invocation-gap.md]
---

Collaborator: Jonah. 2026-06-26.

## INSTALLER WAS ALREADY CORRECT (the gap was a stale deploy, not installer code)
install.sh:2642-2644 already links sidecoach-lanes.json + sidecoach_lanes.py, and the
comment at 2638-2640 even predicts this exact failure ("WITHOUT it the lane tier silently
disables, so it MUST be deployed alongside"). A past session fixed the installer; this
machine's deploy (symlinks dated Jun 8-12) predates the lane tier (Jun 13) and was never
re-run. My manual symlinks now match exactly what install.sh would produce (idempotent
ln -sf, same repo targets). No installer code change needed.

## FIX 1 - make the silent failure LOUD (sidecoach-keyword.sh)
The import except-clause swallowed the ImportError silently (the comment even claimed
"loudly" while the code was silent - that lie is what let the tier sit dead 13 days).
Now: on import failure, if a required sibling is actually absent on disk, write a LOUD
non-blocking stderr diagnostic naming the missing file (sidecoach_lanes.py or
sidecoach-lanes.json) + the fix ("Run install.sh"). A HEALTHY tier stays silent (only a
genuine deploy/config breakage warns). Control flow unchanged: still degrades to verb-only.

## FIX 2 - diagnosis framing (sidecoach-intent.json nudge)
Old nudge was build-only ("Before hand-coding... BUILDING UI"). A read-only "what's wrong
with this page / feels off / look at <url>" is the PUREST audit case yet the old copy gave
no reason to run the engine - so a fresh Claude eyeballed a screenshot instead. New nudge
adds: "Before hand-coding OR hand-eyeballing"; explicitly maps DIAGNOSE/review/critique of
existing UI to the audit->critique->polish gate; tells you to run `/sidecoach audit <target>`
which RENDERS + runs the engine "instead of eyeballing a screenshot, which misses the
objective and taste defects a human read will not catch."

## VERIFIED (all three, from a non-repo CWD = real-session conditions)
- C: sidecoach-intent.json valid JSON; nudge contains DIAGNOSE + /sidecoach audit.
- A (healthy, module linked): diagnosis prompt -> new audit-directed nudge on stdout, stderr EMPTY.
- B (broken deploy, .py absent from hook dir): stdout empty (graceful verb-only degrade) +
  stderr LOUD: "natural-language/lane tier DISABLED - sidecoach_lanes.py is not deployed...
  Run install.sh...". Silent failure converted to loud.

## FIX 3 - regression test (DONE, suite green)
Added a DEPLOY-COMPLETENESS GUARD section to test-sidecoach-keyword.sh: (1) a hook dir
WITHOUT sidecoach_lanes.py must warn LOUD on stderr + degrade to verb-only (no nudge);
(2) the healthy repo hook must fire the diagnosis-aware nudge with NO stderr noise. Also
repointed two pre-existing nudge assertions off the dropped substring "sidecoach flow or
mode" onto the stable opener "reads as front-end". Full suite: 114 passed, 0 failed.

## VERIFICATION STATE (all green)
- test-sidecoach-keyword.sh: 114 passed, 0 failed (incl. the 4 new deploy-guard cases).
- test_sidecoach_lanes.py: PASS. test_classifier_parity.py: PASS (classifier untouched, confirmed).
- LIVE deploy completeness: all 5 NL-tier siblings present + symlinked to repo
  (sidecoach-keyword.sh, sidecoach_lanes.py, sidecoach-lanes.json, sidecoach-verbs.json,
  sidecoach-intent.json). DEPLOY COMPLETE.

## STILL TO DO
- Independent Codex review of the diff (running, bg); fold findings; re-verify.
- End-to-end invocation test: fresh top-level session on Jonah's natural prompt should now
  route into sidecoach (best run by Jonah in a clean session; the tier is live + verified).

## Files touched
- claude/hooks/sidecoach-keyword.sh (loud deploy diagnostic on lane-import failure)
- claude/hooks/sidecoach-intent.json (nudge broadened to cover diagnosis/critique)
- ~/.claude/hooks/{sidecoach_lanes.py, sidecoach-lanes.json} (live symlinks, prior step)
</content>
