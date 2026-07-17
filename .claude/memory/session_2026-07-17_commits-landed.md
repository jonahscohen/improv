---
name: 2026-07-17 commits - sidecoach eval gate + verify-hook message fix landed on main
description: Both units committed to main after full verification; records what landed and why it went to main rather than a branch
type: project
relates_to: [session_2026-07-17_sidecoach-eval-harness-wired-into-gate.md, session_2026-07-17_verify-hook-message-matches-flag.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (sidecoach 71/71 exit 0; hook suite 46/46; both committed clean)
confidence: high
---

Jonah asked for both units to be committed. Landed on main as two separate commits.

1. `2e113048` sidecoach: run the eval golden snapshots in the default test gate
   - sidecoach/scripts/run-tests.ts, sidecoach/package.json + the two audit beats.
   - 66 -> 71 suites; npm test now builds first so a src regression cannot pass on stale dist.

2. hooks/verify-before-done: make the demand match the flag
   - claude/hooks/verify-before-done.sh, claude/hooks/test-nudge-debounce.sh + beat + MEMORY.md.
   - Non-visual code no longer ordered to screenshot; 17 -> 46 test assertions.

**Why main and not a branch:** the default harness guidance is to branch off the default
branch first, but this repo's established practice is direct-to-main (the prior commit
09d19d55 says in its own message "Committed on request to get everything onto main"), and
the dotfiles propagation model depends on it - `~/.claude/hooks/*` are symlinks into this
repo and teammates get changes "on their next pull" from main (Team Rules). A branch would
park the hook fix off the propagation path.

**Gate note (not a bug):** the beats-dirty gate blocked the second commit even though beats
were already written, because intervening Bash calls (git add, git log) re-arm the dirty
flag via memory-nudge. Writing this beat is the correct way through - the gate wanted the
commit itself recorded, which is exactly what this is. Do not reach for a bypass here.

**Known false positive worth watching:** `.needs-verification` was left at "visual" by a
probe command that merely CONTAINED the string "npm run build" while running from the
improv root, which has no package.json, so project_has_ui() correctly assumed UI and
over-fired. deploy_indicators still uses bare substring matching (`"npm run build" in cmd`)
rather than the token anchoring is_verification_only already uses, so any command that
merely mentions a build string arms the flag. Left alone deliberately: narrowing it would
reduce recall, and [[feedback_hooks_prefer_false_positives]] says over-fire is the
preferred direction. Worth revisiting only if it crosses the cried-wolf threshold.

## Files touched

None beyond the two commits above - this beat records them.
