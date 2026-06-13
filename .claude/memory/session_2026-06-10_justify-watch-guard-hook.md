---
name: Justify watch made unkillable - guard hook blocks turn-end while watch is down
description: The watch died because the relaunch-after-task step was manual discipline and got dropped; now a Stop hook mechanically blocks ending a turn while ~/.claude/.justify-watch-on exists and no poller runs
type: project
relates_to: [session_2026-06-10_justify-watch-forever-loop.md]
supersedes: session_2026-06-10_justify-watch-forever-loop.md
---

Collaborator: Jonah. 2026-06-10. "Why did the watch die? Fix it permanently so that it never times out unless the user consents to end watch."

## Why it died (self-analysis)
The forever loop never times out - its ONLY exit is a prompt arriving (that exit IS the wake mechanism). The contract was "relaunch after handling each task," and that step was pure discipline. After the two-prompt reorder/bold batch I went into respond+beats, Jonah's easing tweak arrived as a chat interrupt mid-turn, and the relaunch was dropped. Failure mode: a critical recurring step lived in my head instead of in the harness. Same class of failure the beat hooks and screenshot hooks exist to prevent - it needed a hook.

## The mechanical fix
1. **Canonical script** `justify/cli/justify-watch.sh` (repo source) copied to `~/.claude/justify-watch.sh`: while-true poll of :9223/prompts every 2s, no idle exit ever; on prompt -> /tmp/justify-inbox.json + JUSTIFY_TASK_RECEIVED + exit 0 (wakes the session). Launch: Bash run_in_background.
2. **State flag** `~/.claude/.justify-watch-on` = "the user wants the watch running". Created when the watch is armed. Removed ONLY on explicit user consent to end the watch (then also pkill the poller).
3. **Guard hook** `claude/hooks/justify-watch-guard.sh` (symlinked into ~/.claude/hooks/, registered in settings.json for Stop + SessionStart):
   - Stop: if flag exists and `pgrep -f justify-watch.sh` finds nothing -> `{"decision":"block","reason":...}` - the turn CANNOT end until the session relaunches the poller. Forgetting is no longer possible.
   - SessionStart: same condition -> injected reminder, so a fresh session (new machine/day) re-arms the watch.
4. settings.json is the repo symlink, so the registration is durable in the dotfiles.

## Verified
- Poller launched via new script; pgrep finds it; guard exits silent (no block) while alive.
- Killed the poller deliberately: Stop event -> block JSON emitted; SessionStart -> reminder text emitted. Relaunched (task bnogw67g6). Flag armed.

To END the watch (the one consensual path): user says so -> rm ~/.claude/.justify-watch-on && pkill -f justify-watch.sh.

Files: justify/cli/justify-watch.sh (new), claude/hooks/justify-watch-guard.sh (new), claude/settings.json (Stop + SessionStart entries), ~/.claude/justify-watch.sh + hooks symlink + .justify-watch-on (installed state).
