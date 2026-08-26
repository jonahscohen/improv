---
name: sidecoach-schedule command + the enforce consent arm-hook registration gap
description: Built a simple `sidecoach-schedule on|off|status` command for the daily discovery daemon (item 4); discovered the taste promote/enforce consent flow was broken because the arm hooks were never registered in settings
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: schedule cmd - status/parse/repo-resolution tested; arm-hook gap - grep-confirmed unregistered
relates_to: [session_2026-08-25_sidecoach-drive-to-green.md]
---

TWO THINGS this session:

1. SIDECOACH-SCHEDULE COMMAND (Jonah asked for a simple command like `ampersand` to run the daily discovery daemon = item 4). Built claude/cmux/sidecoach-schedule (executable), reachable on PATH because ~/.claude/cmux symlinks to improv/claude/cmux. Subcommands: `on` (cp the plist to ~/Library/LaunchAgents + launchctl bootstrap gui/$(id -u), idempotent - bootout first), `off` (bootout + rm), `status`. Resolves REPO from its own real location via `pwd -P` (BUG caught+fixed: plain `pwd` returned the logical symlink path /Users/spare3/.claude/cmux so `${_dir%/claude/cmux}` did NOT strip - `pwd -P` resolves to the real improv path). Tested: `status` -> OFF/not-placed, source plist resolves to /Users/spare3/Documents/Github/improv/claude/launchd/...(found); bash -n clean. The committed plist paths are already correct for this machine (cross-machine templating stays install.sh's job). The `on`/`off` paths do system actions (launchctl) - the USER runs them; not run by me.

2. ENFORCE CONSENT ARM-HOOK GAP (root cause of item-3 sign-off failing). Jonah typed `promote-confirm ...` + `enforce-confirm ...` to enforce the motion.no-scale-zero-enter detector; the promote CLI REFUSED "no consent token present". Diagnosis: the consent token is minted by a UserPromptSubmit hook (sidecoach-taste-promote-arm.sh / sidecoach-taste-enforce-arm.sh) when the USER types the confirm phrase as the WHOLE prompt - but grep of live ~/.claude/settings.json UserPromptSubmit shows ONLY frontier-confirm-arm.sh, sidecoach-postuserp.sh, sidecoach-keyword.sh - the taste ARM HOOKS ARE NOT REGISTERED. So the enforce sign-off flow has never been functional; typing the confirm had nothing to intercept it. Same build-but-not-wired class as item 8 (auto-fire hooks). `approve` is a non-interactive-impossible helper that only prints the digest; it does NOT itself mint. Also: Jonah typed BOTH confirms on one line, but "the whole prompt" must be a single confirm - secondary issue behind the missing registration. FIX needed = register the two arm hooks in live + committed settings (UserPromptSubmit), then Jonah re-types each confirm as its own whole prompt -> token minted -> agent runs the promote/enforce CLI. Security-sensitive (consent minting) - flagged to Jonah for OK before registering. This is arguably an audit finding: item 3's enforce tier could never have been signed off without wiring these.

FILES: claude/cmux/sidecoach-schedule (new).
