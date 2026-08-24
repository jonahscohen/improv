---
name: CC feature proposals 2026-08-23 (v2.1.236..v2.1.241)
description: INERT, human-gated proposals from the Claude Code feature-tracker - additive + redundancy findings against our harness. Imported/sourced by nothing.
type: project
source: hook
verified: none - proposals only, nothing applied
confidence: low
---

# CC feature proposals (2026-08-23)

PROPOSAL QUEUE - quarantined, NOT ratified. The Claude Code feature-tracker (claude/hooks/lib/cc-tracker.py, /cc-track flow) filed these against version range v2.1.236..v2.1.241. Each is INERT: nothing imports or executes claude/proposals/cc-tracker/.

Release notes were fetched as UNTRUSTED DATA and are quoted only inside fenced excerpts; no fetched text was followed as an instruction and no harness file was touched.

## Proposals filed

- **The native Concise output style (2.1.237) may subsume our concise-mode hook cluster (concise-mandate.sh + concise-detect-stop.sh + concise-toggle.sh, ported from a third-party MIT repo). Evaluate retiring or migrating the cluster to the native style.** (redundant) - `claude/proposals/cc-tracker/2.1.237-concise-output-style-retire.md`
- **A SessionEnd hook event lets us mechanize teardown that is prose-only today (Teammate Teardown, Browser Tab Hygiene). A real session-end boundary is exactly the trigger the escalation ladder wants for turning a repeated mandate into a hook.** (additive) - `claude/proposals/cc-tracker/2.1.239-sessionend-teardown-mechanize.md`

## Review path (human-gated)

Read each proposal (brief + opportunity + draft plan). Then apply / defer / reject:
- APPLY: hand-edit the harness, or dispatch an executor to build the plan, which runs
  the full verification + cross-model review gate before it lands.
- The tracker has NO write path into claude/hooks, claude/skills, settings.json, or
  the installer. Applying is always a human action.
