---
name: env-cwd EPERM burst on long-idle resume (self-healed)
description: Stop-hook + node uv_cwd + file-write EPERM burst at one Stop event after a 5-day idle resume; fully self-healed the next turn - the known OS/harness-level transient, no dotfiles fix
type: project
relates_to: [session_2026-06-13_env-cwd-eperm-incident-and-resume.md, session_2026-08-07_cmux-team-config-heal.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

**Symptom (2026-09-02):** at one Stop event, every `~/.claude/hooks/*.sh` failed "Operation not permitted", node threw `EPERM: operation not permitted, uv_cwd`, and (the turn before) an Edit to a beat file failed EPERM with `test -w` reporting the file non-writable despite `-rw-r--r--`. Read/Write/Edit on absolute paths that DON'T fork a shell kept working - the tell that this is a getcwd/spawn problem, not file damage.

**Root cause:** the session resumed after a ~5-day idle gap (date jumped 2026-08-28 -> 2026-09-02). During the gap the working dir was rebuilt (improv mtime Aug 30; ~/.claude mtime Sep 2), so this idle session's shell held a STALE cwd handle. getcwd() then returned EPERM, and since bash/node resolve cwd at process START, they could not even launch the hook scripts. This is the same class as the 2026-06-13 env-cwd-eperm incident (crash/restart residue + a lowercase-alias cwd), which was ruled OS/harness-level and "unfixable from inside the session."

**Difference from 2026-06-13 (the good difference):** that case was PERSISTENT within the session (needed a fresh Claude Code process from a healthy cwd). This one was a ONE-TIME burst at a single Stop event and SELF-HEALED on the very next turn, when the harness re-established a valid cwd (the "Shell cwd was reset to ..." messages). Verified after: `verify-before-done-stop.sh`, `justify-queue-drain-stop.sh`, `chrome-tabgroup-stop.sh` all execute exit 0 (no EPERM); `node -e process.cwd()` works; the beat file is writable again; no ACLs, no uchg/schg flags, disk 79% (not full).

**No dotfiles fix - deliberately.** The hooks are intact symlinks with exec bits and run fine; bash failing to LAUNCH them is upstream of any hook code, so no hook edit can prevent it. Modifying working hooks to "fix" this would be fabricating a fix for a non-bug (the exact anti-pattern the hook-error protocol's precedent warns against). The only real remedy if it PERSISTS is a fresh Claude Code process from a healthy cwd (reboot / relaunch cmux+Terminal), per the 2026-06-13 beat. If these EPERM bursts become FREQUENT on resume, that is a harness-level item (Claude Code firing Stop hooks before re-establishing cwd on a long-idle resume) to report upstream, not a dotfiles change.

**For a future session that sees this burst:** do not panic-edit the hooks. Confirm health first (`cd ~/Documents/Github/improv && git status` in a plain shell; run a representative hook with `echo '{}' | bash <hook>`). If green, it already self-healed - proceed. If it persists, relaunch from a healthy cwd.
