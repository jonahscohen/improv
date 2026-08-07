---
name: Artifact-open mandate trio built and lead-verified
description: The verification-cluster trio that forces Claude to open/show self-created artifacts is built, wired, all suites green, live-verified by the lead; Codex review running
type: project
relates_to: [session_2026-08-06_artifact-open-mandate-dispatch.md, decision_2026-08-06_artifact-surface-scope.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

**Built (surface-hook-builder, then lead-completed):** the `artifact-open` trio in the VERIFICATION cluster.
- `artifact-open-mandate.sh` (PostToolUse Write/Artifact): records an in-scope, net-new, on-disk artifact path to `~/.claude/.artifact-pending.$SESSION_KEY` (per-session, APPEND, dedup, require-exists, 1-day reaper - copied from screenshot-open-mandate) and injects an "open it and show the user" reminder.
- `artifact-open-clear.sh` (PostToolUse Read/Artifact): discharges a pending path when it is surfaced.
- `artifact-open-stop.sh` (Stop): blocks ONCE per burst listing every unshown artifact; emits `{}` (allow) when nothing pending; fail-open.

**Default ON** via DISABLE marker `~/.claude/.artifact-surface-disabled` (concise polarity). Hard Stop-block enforcement.

**Builder stalled mid-unit:** it completed the build + wiring + local test gate (its own task list marked T1-T4 done, T5 Codex review in_progress) then went idle - process gone, only an idle_notification sent, NO completion report and NO beats. The lead took over the unfinished tail (Codex review + beats + this record). Idle heartbeat was correctly NOT treated as completion.

**Lead independent verification (all green):**
- Three suites: test-artifact-open-mandate 22/0, test-artifact-open-clear 9/0, test-artifact-open-stop 12/0.
- Wiring present: cluster-wirings.json (6 refs), install.sh verification cluster list (the 3 names), browser-tree.json (9 = 3 spots x 3), README count bump. hook-registry-guard --audit rc0.
- LIVE behavior (the load-bearing checks, exercised through the real hook, not the tests): a .png and a .md report in a NON-excluded dir -> flagged + reminder emitted; a Read of the path -> cleared; Stop with one still pending -> ONE block whose reason names the unshown file; Stop after all cleared -> `{}` allow; a `.claude/memory` beat -> NOT flagged; a `/var/folders` scratch path -> NOT flagged; disable marker present -> fully silent.

**Testing-error caught (self-analysis):** my first live png test reported FAIL because I used `mktemp -d` as the artifact's parent, and macOS mktemp lives under `/var/folders/` which is a CORRECTLY-excluded scratch location - so the hook rightly ignored it. The hook was right; my test location was confounded. Fixed by using a genuinely non-excluded path (`/Users/spare3/artifact-probe-*`, created + removed). Lesson: when verifying an exclusion-based detector, the "should-fire" fixture must live OUTSIDE every exclusion, and a temp dir is itself an exclusion here.

**Still pending:** Codex cross-model review (running, background be4sruul0) - fold findings + re-verify before final done. Nothing committed; all uncommitted for Jonah.

**Files:** created claude/hooks/{artifact-open-mandate,artifact-open-clear,artifact-open-stop}.sh + their three test-*.sh; modified claude/hooks/cluster-wirings.json, install.sh, claude/hooks/browser-tree.json, README.md.
