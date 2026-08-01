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
# LIVE-LEAD GUARD (2026-07-28, Jonah - the member guard above was not enough):
# the member scan only ever matches TEAMMATE processes, because only they carry
# the team name in argv. Measured on the live machine: the four teammates of
# team session-d883bc0d carried "--team-name session-d883bc0d", while the lead
# itself (the cmux launch script and its claude process) carried ONLY
# "--session-id <leadSessionId>" and the team name appeared nowhere in its args.
# The standing teardown rule kills each teammate the moment its unit is
# accepted, so a healthy lead that is between waves has ZERO processes carrying
# the team name - it is indistinguishable from an abandoned team, and the idle
# rule rmtree'd the LIVE team twice in one day, breaking every subsequent spawn
# (the runtime reads config.json live, it does not cache it).
#
# So a team is also never reaped while its LEAD SESSION is alive, established
# from config.json's leadSessionId by two independent signals, OR'd, both of
# which decay on their own so neither can pin a directory forever (the one
# standing exception is the pre-existing PROC_TEXT-is-None bias below: if the ps
# scan fails PERSISTENTLY, every team reads as live for as long as that lasts.
# That bias is deliberate and kept - a stale directory is recoverable, deleting
# a live team is the bug this whole guard exists to prevent - but it is a real
# exception to "nothing pins a directory forever", so it is named here):
#   1. a live process whose argv carries that session id (observed shapes:
#      "--session-id <id>" on the lead, "--parent-session-id <id>" on its
#      teammates). Dies with the process - the primary signal.
#   2. the session transcript ~/.claude/projects/*/<leadSessionId>.jsonl having
#      been written within TEAM_REAP_LEAD_TRANSCRIPT_MINUTES. This is a bounded
#      grace window, not an existence test: transcripts live forever, so an
#      existence test would be a permanent false-alive and would leak the
#      directory. The window is bounded on BOTH sides (a future-dated mtime is
#      rejected past a small skew allowance), the tunable is forced finite, and
#      symlinks cannot aim the probe outside the projects tree - each of those
#      is a way the "bounded" claim would otherwise have been false. It covers
#      a lead that just died or is mid-restart, and it
#      backstops signal 1 if the runtime's argv shape ever changes. It is only
#      ever an OR term - a missing transcript never means dead, because a
#      resumed/compacted lead can outlive the transcript named by its original
#      leadSessionId (observed on team session-fb0d96bd, whose lead had a live
#      member process but no transcript under its recorded leadSessionId).
#
# EXEMPTION, load-bearing: the lead guard does NOT apply to the
# owned-by-ending-session reap, where the ending session IS the lead. That hook
# runs inside the lead's own still-running process, so both signals report alive
# by construction; honouring them there would disable the primary cleanup path
# and leak every team directory forever. A session ending is authoritative about
# its own liveness in a way no inference can beat. The member-process guard
# still applies there, unchanged.
#
# Tunables (env): TEAM_REAP_MAX_AGE_HOURS (default 12),
#                 TEAM_REAP_IDLE_MINUTES   (default 240),
#                 TEAM_REAP_LEAD_TRANSCRIPT_MINUTES (default 240; 0 disables
#                   the transcript signal and leaves process liveness alone),
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
import json, sys, os, time, shutil, stat, math, re

# One year, in the unit each tunable uses. An upper bound is not cosmetic: merely
# LARGE finite value still overflows to inf once multiplied into seconds
# (1e308 * 60 == inf), which would make the transcript window unbounded and
# reopen the permanent false-alive. A bound here keeps every derived number
# finite. A lower bound matters too: a negative idle/age turns every team into a
# reap candidate immediately.
_YEAR_MINUTES = 525600.0
_YEAR_HOURS = 8760.0

def _env_float(name, default, lo, hi):
    # A tunable must never crash the hook (a typo used to raise before the JSON
    # guard was even reached), never be non-finite, and never sit outside the
    # range its own logic assumes. Anything else falls back to the documented
    # default, loudly, rather than silently changing what gets deleted.
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        v = float(raw)
    except (TypeError, ValueError):
        sys.stderr.write("team-reaper: %s=%r is not a number; using %s\n"
                         % (name, raw, default))
        return default
    if not math.isfinite(v):
        sys.stderr.write("team-reaper: %s=%r is not finite; using %s\n"
                         % (name, raw, default))
        return default
    if v < lo or v > hi:
        sys.stderr.write("team-reaper: %s=%r is outside [%s, %s]; using %s\n"
                         % (name, raw, lo, hi, default))
        return default
    return v

MAX_AGE_HOURS = _env_float("TEAM_REAP_MAX_AGE_HOURS", 12.0, 0.0, _YEAR_HOURS)
# Idle default raised 30 -> 240 (2026-07-04): teammate SessionStarts run this
# reaper, and a 30m inbox-idle window reaped the ACTIVE lead team mid-run twice
# (long executor units send no inbox traffic while working). Age-gc still GCs.
IDLE_MINUTES  = _env_float("TEAM_REAP_IDLE_MINUTES", 240.0, 0.0, _YEAR_MINUTES)
# IDLE REAPING IS OPT-IN SINCE 2026-08-01 (Jonah). See the idle branch for why.
# TEAM_REAP_IDLE=1 restores the old behaviour; the window tunable above is still
# honoured when it does.
IDLE_REAP_ENABLED = os.environ.get("TEAM_REAP_IDLE", "") == "1"
# Bounded grace window on the lead session transcript (see LIVE-LEAD GUARD).
# 0 is a valid setting and disables the transcript signal; negative is a typo.
LEAD_TRANSCRIPT_MINUTES = _env_float(
    "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES", 240.0, 0.0, _YEAR_MINUTES)
# How far AHEAD of now a transcript mtime may sit and still count as fresh.
# Tolerates ordinary clock jitter; anything further ahead is rejected, because a
# future-dated file would otherwise read as fresh until that date passes.
LEAD_TRANSCRIPT_SKEW_SECONDS = 300.0

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

SAFE = re.compile(r"^[A-Za-z0-9._-]+$")
# A team name or session id must not be followed by another name character, so
# a longer identifier cannot satisfy a lookup for a shorter one.
NAME_BOUNDARY = r"(?![A-Za-z0-9._-])"

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
    # Token-bounded, like the lead match: a bare substring test let a longer
    # team name keep a shorter one alive forever (a live "worker@session-abc2"
    # kept dead team "session-abc"), which is a false-alive that leaks a
    # directory for as long as the colliding process lives. The boundary is
    # "not another name character", so a real path like /teams/<name>/inboxes
    # still matches on the following slash.
    esc = re.escape(name)
    for marker in (r"--team-name[= ]" + esc + NAME_BOUNDARY,
                   r"@" + esc + NAME_BOUNDARY,
                   r"/teams/" + esc + NAME_BOUNDARY):
        if re.search(marker, PROC_TEXT):
            return True
    return False

def lead_transcript_fresh(lead):
    # Signal 2 of the lead guard: has the lead session transcript been written
    # inside the grace window? MTIME-BOUNDED on purpose - transcripts are never
    # deleted, so testing existence would keep a dead lead "alive" forever and
    # leak its team dir. SAFE-match the id before building a path so a corrupt
    # config cannot aim this read outside the projects tree.
    if not lead or LEAD_TRANSCRIPT_MINUTES <= 0 or not SAFE.match(lead):
        return False
    proj_root = os.path.join(home, ".claude", "projects")
    try:
        root_rp = os.path.realpath(proj_root)
        projects = os.listdir(proj_root)
    except OSError:
        return False
    window = LEAD_TRANSCRIPT_MINUTES * 60.0
    now_t = time.time()
    for d in projects:
        cand = os.path.join(proj_root, d, lead + ".jsonl")
        # Symlinks must not aim this read outside the projects tree: a fresh (or
        # future-dated) file elsewhere would otherwise read as a live lead. The
        # realpath prefix test covers a symlinked project DIR; lstat + S_ISREG
        # covers a symlinked transcript, which realpath alone would follow.
        rp = os.path.realpath(cand)
        if rp != root_rp and not rp.startswith(root_rp + os.sep):
            continue
        try:
            st = os.lstat(cand)
        except OSError:
            continue
        if not stat.S_ISREG(st.st_mode):
            continue
        # Bounded on BOTH sides. An mtime dated into the future would stay
        # "fresh" until that date arrived - an unbounded false-alive, and the
        # one way this window could still leak a directory forever.
        age = now_t - st.st_mtime
        if -LEAD_TRANSCRIPT_SKEW_SECONDS <= age <= window:
            return True
    return False

def lead_session_is_live(lead):
    # Is the LEAD SESSION that owns this team still running? Only teammates
    # carry the team name in argv, so team_has_live_process cannot see a lead
    # whose teammates have all been torn down - which is the normal, healthy
    # state of a well-run session between waves. Same not-reap bias: a failed
    # process scan counts as alive.
    #
    # An unusable lead id (missing, non-string, or not SAFE) yields NO signal
    # rather than "alive": claiming alive on garbage would pin the directory
    # forever, and a team with live members is still covered by the member scan.
    if not lead or not SAFE.match(lead):
        return False
    if PROC_TEXT is None:
        return True
    for flag in ("--session-id", "--parent-session-id", "--resume"):
        # Token-bounded: a plain substring test would let a corrupt short lead
        # id ("a") match an unrelated "--session-id abc..." and report alive.
        pat = r"(?:^|\s)" + re.escape(flag) + r"[= ]" + re.escape(lead) + r"(?=\s|$)"
        if re.search(pat, PROC_TEXT):
            return True
    return lead_transcript_fresh(lead)

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

    # config.json is machine-written but must never be trusted to be well-typed:
    # a non-string leadSessionId reached string concatenation and crashed the
    # whole hook, and a non-numeric createdAt crashes the age arithmetic below.
    lead = cfg.get("leadSessionId", "") or ""
    if not isinstance(lead, str):
        lead = ""
    try:
        created_ms = float(cfg.get("createdAt", 0) or 0)
    except (TypeError, ValueError):
        created_ms = 0.0
    age_h = (now - created_ms / 1000.0) / 3600.0 if created_ms else 0.0

    should = False
    reason = ""
    # Whether the live-LEAD guard applies to this reap. True everywhere except
    # the owned-by-ending-session case below, where the lead is the one ending.
    check_lead = True
    if mode == "session-end":
        if session_id and lead == session_id:
            should, reason = True, "owned-by-ending-session"
            check_lead = False
        elif created_ms and age_h >= MAX_AGE_HOURS:
            should, reason = True, "age-gc(%.1fh)" % age_h
    else:  # session-start
        if session_id and lead == session_id:
            should = False  # do not reap a team the brand-new session just adopted
        elif created_ms and age_h >= MAX_AGE_HOURS:
            should, reason = True, "age-gc(%.1fh)" % age_h
        else:
            # QUIET IS NOT DEATH (Jonah, 2026-08-01).
            #
            # newest_inbox_mtime measures TEAMMATE CHATTER. The teardown rule in
            # CLAUDE.md requires standing every teammate down once its unit is
            # accepted, and that stops all inbox writes by design - so a team
            # looks maximally idle exactly when it has been managed WELL. Nothing
            # else can see the lead either: once the teammates are gone, no live
            # process carries the team name in argv OR environment (measured), so
            # the only remaining guard is leadSessionId, and a team whose lead id
            # has no transcript on this machine - the compaction/resume case - has
            # no guard at all.
            #
            # That is how session-55c0bc13 was deleted under a running lead on
            # 2026-08-01 after a five-agent teardown, and Jonah reports it several
            # times before. The lead only finds out when it next tries to spawn,
            # and by then a named spawn fails "team file not found" and an unnamed
            # one is refused by agent-teams-guard: no parallel work at all.
            #
            # Abandonment is still collected by the signals that mean abandonment
            # rather than quiet - age-gc above, and the config-less orphan sweep.
            # A team costs a few KB; a destroyed one costs the session.
            idle_min = (now - newest_inbox_mtime(team_path)) / 60.0
            if IDLE_REAP_ENABLED and idle_min >= IDLE_MINUTES:
                should, reason = True, "idle(%.0fm)" % idle_min

    if should:
        if team_has_live_process(name):
            skipped.append("%s [%s: live-member process]" % (name, reason))
        elif check_lead and lead_session_is_live(lead):
            skipped.append("%s [%s: lead session alive]" % (name, reason))
        elif reap(name):
            reaped.append("%s [%s]" % (name, reason))

if reaped:
    sys.stderr.write("team-reaper(%s): removed %d orphan team(s): %s\n" % (mode, len(reaped), ", ".join(reaped)))
if skipped:
    sys.stderr.write("team-reaper(%s): kept %d live team(s): %s\n" % (mode, len(skipped), ", ".join(skipped)))

print("{}")
'
