#!/bin/bash
# SessionStart + SessionEnd hook: reap orphaned cmux/agent team records so they
# do not linger in the FleetView/cmux UI after team work finishes.
#
# WHY: spawning teammates via the Agent tool (with or without worktree
# isolation) leaves a team record at ~/.claude/teams/<name>/ and a task list at
# ~/.claude/tasks/<name>/. These survive after every teammate terminates - and
# TeamDelete REFUSES to remove a team if any member is still marked "active",
# which happens when a teammate wedges (e.g. an API error) and never approves
# its shutdown. Those orphans accumulate and show as phantom "open" workspaces.
# This reaper force-removes them; it does not depend on member status.
#
# WHAT IT TOUCHES: ONLY ~/.claude/teams/<name> and ~/.claude/tasks/<name>.
# It NEVER touches anything under a memory/ path - session beats are sacred and
# live in .claude/memory/ and ~/.claude/projects/*/memory/, which this hook
# refuses to delete (hard guard in reap()). "Preserve memory, clean up teams."
#
# Reap rules:
#   session-end mode  : reap teams whose leadSessionId == the ending session_id
#                       (this session owned them, they are done), PLUS any team
#                       older than MAX_AGE_HOURS (abandoned-team GC).
#   session-start mode: reap teams NOT owned by the current session that are
#                       idle (newest inbox mtime older than IDLE_MINUTES) or
#                       older than MAX_AGE_HOURS. Catches orphans left by a
#                       crashed/prior session, promptly, at the next start.
#
# LIVE-TEAM GUARD (2026-07-08, Jonah - durable fix for the recurring orphan bug):
# regardless of mode or reason, a team is NEVER reaped while any of its member
# processes are still alive. A teammate's own SessionStart runs this reaper with
# ITS session_id (which is not the lead's leadSessionId), so a long-parked
# executor made the reaper treat the ACTIVE lead team as an idle orphan and
# rmtree it - the rmtree then partially failed on an open inbox file, leaving a
# config-less dir that broke every subsequent spawn. cmux launches each member
# as claude.exe with the team dir name verbatim in its args (--team-name
# session-<id> and --agent-id <agent>@session-<id>), so we scan the process list
# once and skip any team whose name appears in a live process. See
# reference_cmux_team_init_orphan_bug.md.
#
# Tunables (env): TEAM_REAP_MAX_AGE_HOURS (default 12),
#                 TEAM_REAP_IDLE_MINUTES   (default 240),
#                 TEAM_REAP_DISABLE=1 to disable entirely,
#                 TEAM_REAP_PS_OVERRIDE=<file> to stand in for the ps process
#                   scan (test-only; contents are scanned for team markers).
#
# Mode comes from $1 ("session-end" | "session-start"); falls back to the
# payload's hook_event_name.

MODE="${1:-}"
INPUT=$(cat)

[ "${TEAM_REAP_DISABLE:-}" = "1" ] && { echo "{}"; exit 0; }

printf '%s' "$INPUT" | MODE="$MODE" python3 -c '
import json, sys, os, time, shutil

MAX_AGE_HOURS = float(os.environ.get("TEAM_REAP_MAX_AGE_HOURS", "12"))
# Idle default raised 30 -> 240 (2026-07-04): teammate SessionStarts run this
# reaper, and a 30m inbox-idle window reaped the ACTIVE lead team mid-run twice
# (long executor units send no inbox traffic while working). Age-gc still GCs.
IDLE_MINUTES  = float(os.environ.get("TEAM_REAP_IDLE_MINUTES", "240"))

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

mode = os.environ.get("MODE") or ""
if not mode:
    ev = data.get("hook_event_name", "")
    mode = "session-end" if ev == "SessionEnd" else "session-start"

session_id = data.get("session_id", "") or ""
home = os.path.expanduser("~")
teams_dir = os.path.join(home, ".claude", "teams")
tasks_dir = os.path.join(home, ".claude", "tasks")

if not os.path.isdir(teams_dir):
    print("{}"); sys.exit(0)

SAFE = __import__("re").compile(r"^[A-Za-z0-9._-]+$")

def is_memory_path(p):
    # Hard guard: never let this reaper touch a beats/memory location.
    low = p.replace("\\", "/")
    return "/memory" in low or low.rstrip("/").endswith("MEMORY.md")

def reap(name):
    """Force-remove a team dir + its task dir. Returns True if anything went."""
    if not name or name in (".", "..") or not SAFE.match(name):
        return False
    removed = False
    for base in (teams_dir, tasks_dir):
        target = os.path.join(base, name)
        # Must be a direct child of the intended base, and never a memory path.
        rp = os.path.realpath(target)
        if os.path.dirname(rp) != os.path.realpath(base):
            continue
        # Hard rails: must live under .claude/teams or .claude/tasks, and must
        # never be a memory/beats path. Refuse anything else outright.
        rp_slash = rp + "/"
        in_team_or_task = ("/.claude/teams/" in rp_slash) or ("/.claude/tasks/" in rp_slash)
        if is_memory_path(rp) or not in_team_or_task:
            continue
        if os.path.isdir(target):
            try:
                shutil.rmtree(target)
                removed = True
            except Exception as e:
                sys.stderr.write("team-reaper: failed to remove %s: %s\n" % (target, e))
    return removed

def newest_inbox_mtime(team_path):
    inbox = os.path.join(team_path, "inboxes")
    newest = 0.0
    try:
        for f in os.listdir(inbox):
            try:
                newest = max(newest, os.path.getmtime(os.path.join(inbox, f)))
            except OSError:
                pass
    except OSError:
        pass
    # Fall back to the config mtime if no inboxes.
    if newest == 0.0:
        try:
            newest = os.path.getmtime(os.path.join(team_path, "config.json"))
        except OSError:
            newest = 0.0
    return newest

def _proc_scan_text():
    # Full process-args listing, scanned for live team markers. Overridable via
    # TEAM_REAP_PS_OVERRIDE (a file whose contents stand in for the ps output)
    # so the regression test can simulate a live member deterministically.
    override = os.environ.get("TEAM_REAP_PS_OVERRIDE")
    if override:
        try:
            with open(override) as f:
                return f.read()
        except OSError:
            return ""
    try:
        import subprocess
        return subprocess.check_output(
            ["ps", "-Axww", "-o", "args="], timeout=5
        ).decode("utf-8", "replace")
    except Exception:
        # If the scan cannot run, fall back to the safe direction: treat every
        # team as live so nothing is reaped this pass (see team_has_live_process).
        return None

PROC_TEXT = _proc_scan_text()

def team_has_live_process(name):
    # A live teammate or lead process carries the team dir name in its args:
    # cmux spawns claude.exe with --team-name <name> and --agent-id
    # <agent>@<name>. If ANY live process references this team, the team is
    # ACTIVE - reaping it would delete config.json out from under running
    # members (the recurring orphan bug). Bias to NOT reap: a missed reap only
    # delays a cleanup, whereas a false reap wedges the live team spawn path. A
    # failed scan (PROC_TEXT is None) skips too. Match the concrete markers, not
    # a bare substring, so a short team name cannot collide with unrelated args.
    if not name:
        return False
    if PROC_TEXT is None:
        return True
    return (("--team-name " + name) in PROC_TEXT
            or ("--team-name=" + name) in PROC_TEXT
            or ("@" + name) in PROC_TEXT
            or ("/teams/" + name) in PROC_TEXT)

now = time.time()
reaped = []
skipped = []
for name in os.listdir(teams_dir):
    team_path = os.path.join(teams_dir, name)
    cfg_path = os.path.join(team_path, "config.json")
    if not os.path.isfile(cfg_path):
        # Config-LESS orphan: a team dir with NO config.json. The harness writes
        # config.json only at startup, so a dir that has inboxes/ but no config
        # is a broken orphan - a partial reap, or a compaction-continued session
        # whose new teamId was never initialized (reference_cmux_team_init_orphan
        # _bug.md). The OLD reaper `continue`d past every config-less dir, so it
        # lingered forever and broke every subsequent named spawn (the config
        # read fails). Reap it so the next startup can re-init cleanly - but
        # NEVER while a live process still references the team (it may be
        # mid-init): the same live-member guard used for configured teams, biased
        # to not-reap on any uncertainty. Skip stray non-dir entries.
        if os.path.isdir(team_path):
            if team_has_live_process(name):
                skipped.append("%s [config-less orphan: live-member process]" % name)
            elif reap(name):
                reaped.append("%s [config-less orphan]" % name)
        continue
    try:
        cfg = json.load(open(cfg_path))
    except Exception:
        cfg = {}

    lead = cfg.get("leadSessionId", "") or ""
    created_ms = cfg.get("createdAt", 0) or 0
    age_h = (now - created_ms / 1000.0) / 3600.0 if created_ms else 0.0

    should = False
    reason = ""
    if mode == "session-end":
        if session_id and lead == session_id:
            should, reason = True, "owned-by-ending-session"
        elif created_ms and age_h >= MAX_AGE_HOURS:
            should, reason = True, "age-gc(%.1fh)" % age_h
    else:  # session-start
        if session_id and lead == session_id:
            should = False  # do not reap a team the brand-new session just adopted
        elif created_ms and age_h >= MAX_AGE_HOURS:
            should, reason = True, "age-gc(%.1fh)" % age_h
        else:
            idle_min = (now - newest_inbox_mtime(team_path)) / 60.0
            if idle_min >= IDLE_MINUTES:
                should, reason = True, "idle(%.0fm)" % idle_min

    if should:
        if team_has_live_process(name):
            skipped.append("%s [%s: live-member process]" % (name, reason))
        elif reap(name):
            reaped.append("%s [%s]" % (name, reason))

if reaped:
    sys.stderr.write("team-reaper(%s): removed %d orphan team(s): %s\n" % (mode, len(reaped), ", ".join(reaped)))
if skipped:
    sys.stderr.write("team-reaper(%s): kept %d live team(s): %s\n" % (mode, len(skipped), ", ".join(skipped)))

print("{}")
'
