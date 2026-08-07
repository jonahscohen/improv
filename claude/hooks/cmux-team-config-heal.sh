#!/bin/bash
# SessionStart + PostToolUse hook: heal a MISSING cmux agent-teams team-config
# dir so named-teammate spawns stop dead-locking on a compaction-continued
# session. Sibling of cmux-teammate-shim-heal.sh (which heals the tmux-shim
# layer); this heals a DIFFERENT layer - the per-session team CONFIG - and the
# two must not be conflated. See reference_cmux_team_init_orphan_bug.md.
#
# THE BUG (recurred 2026-06-24 / 06-29 / 07-23 / 08-07): the harness keeps
# per-session team state at ~/.claude/teams/session-<SHORTID>/ with config.json +
# inboxes/team-lead.json. The team NAME is `session-` + the first 8 hex of a
# session UUID (verified in the binary: IEh(e)=`session-${e.slice(0,8)}`). On a
# FRESH session that UUID == CLAUDE_CODE_SESSION_ID and the harness creates the
# dir at startup - no problem. On a COMPACTION-CONTINUED session (the "Switching
# to latest Claude Code / reconnecting" relaunch) the harness INHERITS the OLD
# team name from the previous leg, so the name it wants is `session-<first8 of
# the ORIGINAL session id>` - a SHORTID that is NOT CLAUDE_CODE_SESSION_ID, whose
# full UUID never lands on disk, and which the continuation transcript does not
# carry until a spawn is attempted. If that dir is absent, named Agent spawns
# fail `team file for "session-<SHORTID>" not found` AND unnamed spawns are
# refused by agent-teams-guard's name requirement - a hard deadlock that until
# now needed a hand-authored config.json to clear.
#
# WHY THE ID IS NOT PURELY PREDICTABLE AT SessionStart (the derivation blocker):
# the ONLY carrier of the continuation name is the env var
# CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME, which the harness sets on the relaunch and
# then reads-and-deletes from process.env during its own startup (xOv()). It is
# absent entirely on fresh sessions. So a pure "predict the id at SessionStart"
# hook cannot be relied on. This hook therefore heals from TWO signals, so the
# heal never depends on guessing the id:
#
#   1. SessionStart arm (OPPORTUNISTIC, front-line): if
#      CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME is still in the environment (it may or
#      may not have survived the harness's own read-and-delete), pre-create that
#      team dir. When it survives, this eliminates even the first failed spawn.
#      When it does not, this arm is a silent no-op and arm 2 does the work.
#
#   2. PostToolUse(Agent) arm (GUARANTEED, backstop): the "team file for
#      \"session-<SHORTID>\" not found" error ALWAYS carries the exact name. On
#      that error this arm creates the dir from the canonical schema and injects
#      a note to re-issue the spawn. The retry then succeeds - no restart, no
#      hand-authored config.
#
# RESIDUAL GAP (honest): in the case where the env var did NOT survive to
# SessionStart, the FIRST spawn still returns the not-found error once; this hook
# heals on that error and the retry works automatically. Fully eliminating even
# that single failed call requires a harness change (lazy re-init on the team
# read path, or exposing the continuation name on disk / a stable env var) -
# option (c), outside these dotfiles.
#
# SAFETY (hardened per an independent Codex review, 2026-08-07):
#   - only ever acts inside a cmux session (CMUX_SOCKET_PATH set);
#   - only ever writes under ~/.claude/teams/<validated-name>/, where the name is
#     the exact `session-<hex>` shape and the dir is proven a NON-symlink direct
#     child of the teams dir (a symlink into teams would otherwise pass the
#     child-of-teams test yet write through to another team);
#   - NEVER clobbers a real config: the final config write is an ATOMIC
#     create-if-absent (mkstemp in the team dir, then os.link, which raises if the
#     path already exists) - not an exists-check-then-replace, which has a clobber
#     race. Inboxes are written O_CREAT|O_EXCL|O_NOFOLLOW, so a queued inbox or a
#     symlink is never overwritten or followed;
#   - the whole python body is wrapped so ANY unhandled error still prints exactly
#     one valid JSON object;
#   - exits 0 always (non-blocking). Canonical schema baked in, mirrors a live
#     healthy team (see reference_cmux_team_init_orphan_bug.md).
#
# ACCEPTED RESIDUAL (Codex round-2 review, 2026-08-07): the islink checks on
# team_dir/inbox_dir are path-based, so a concurrent swap of one of those dirs to
# a symlink AFTER the check but before the write would still be followed (a
# parent-directory TOCTOU). Judged out-of-scope and NOT rewritten to openat/dir_fd,
# for three reasons: (1) winning the race needs write access to ~/.claude/teams,
# which on this single-user workstation only the user's own code has - and such
# code can already write anywhere as the user, so the race grants no new capability;
# (2) the only real damage - clobbering a genuine config.json - is already
# prevented unconditionally by os.link, which raises rather than overwrite (Codex
# confirmed); (3) this exactly matches the hardening bar of the sibling
# team-reaper.sh, which uses the same realpath/path-based team-dir handling. Revisit
# if ~/.claude/teams ever becomes writable by another trust domain.
#
# The payload travels by temp FILE, and the python is a QUOTED heredoc, for the
# same two reasons codex-failure-watcher.sh uses that shape: tool_response can
# carry large output (env would risk ARG_MAX) and the python source contains
# apostrophes (a `python3 -c '...'` string would be terminated by them).

set -u

# Only relevant inside a cmux agent-teams session. Empty {} = no decision.
if [ -z "${CMUX_SOCKET_PATH:-}" ]; then
  echo '{}'
  exit 0
fi

# python3 is the whole engine (JSON parse + atomic writes). Without it the hook
# is a silent, non-blocking no-op rather than a crash - a heal that does not run
# is exactly the pre-hook status quo, so failing open here changes nothing for
# the worse.
if ! command -v python3 >/dev/null 2>&1; then
  echo '{}'
  exit 0
fi

INPUT=$(cat 2>/dev/null || true)

PAYLOAD_FILE=$(mktemp "${TMPDIR:-/tmp}/cmux-team-heal.XXXXXX") || PAYLOAD_FILE=""
if [ -z "$PAYLOAD_FILE" ] || [ ! -f "$PAYLOAD_FILE" ]; then
  # No temp file: cannot safely stage the payload, so fail open + non-blocking.
  echo '{}'
  exit 0
fi
trap 'rm -f "$PAYLOAD_FILE"' EXIT
printf '%s' "$INPUT" > "$PAYLOAD_FILE"

# Mode comes from $1 ("session-start" | "post-tool-use"); the wiring passes it
# explicitly, mirroring team-reaper.sh. Falls back to the payload's event name.
HEAL_MODE="${1:-}" \
HEAL_INHERITED_NAME="${CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME:-}" \
HEAL_PAYLOAD="$PAYLOAD_FILE" \
python3 <<'PY'
import json, sys, os, time, re, tempfile

# The entire body runs under one guard so any unhandled error still prints
# exactly one valid JSON object (fail-open, non-blocking).
def build_output():
    # The team name is `session-` + the first 8 hex of a UUID. Accept 6+ hex for a
    # little future flex; the strict shape doubles as the traversal/charset guard
    # (no "/", "\\", "..", no dot-entries can satisfy it).
    NAME_RE = re.compile(r"^session-[0-9a-fA-F]{6,}$")

    def name_is_safe(n):
        if not n or len(n) > 128:
            return False
        if "/" in n or "\\" in n or ".." in n:
            return False
        return bool(NAME_RE.match(n))

    def event_from_payload(d):
        ev = d.get("hook_event_name", "") or ""
        if ev == "SessionStart":
            return "session-start"
        if ev == "PostToolUse":
            return "post-tool-use"
        return ""

    mode = os.environ.get("HEAL_MODE", "") or ""

    try:
        with open(os.environ["HEAL_PAYLOAD"], "r", encoding="utf-8", errors="replace") as fh:
            data = json.load(fh)
    except Exception:
        data = {}

    if not mode:
        mode = event_from_payload(data)

    hook_event = "SessionStart" if mode == "session-start" else "PostToolUse"

    def wrap(context):
        if not context:
            return "{}"
        return json.dumps({"hookSpecificOutput": {
            "hookEventName": hook_event,
            "additionalContext": context,
        }})

    home = os.path.expanduser("~")
    teams_dir = os.path.join(home, ".claude", "teams")
    teams_real = os.path.realpath(teams_dir)

    session_id = data.get("session_id", "") or ""
    if not isinstance(session_id, str):
        session_id = ""
    cwd = data.get("cwd", "") or ""
    if not isinstance(cwd, str) or not cwd:
        try:
            cwd = os.getcwd()
        except OSError:
            cwd = "."

    # --- collect candidate team names to ensure -------------------------------
    # session-start: the inherited continuation name, IF the env var survived.
    # post-tool-use: the name carried by a "team file ... not found" error.
    candidates = []
    if mode == "session-start":
        inherited = (os.environ.get("HEAL_INHERITED_NAME", "") or "").strip()
        if inherited:
            candidates.append(inherited)
    elif mode == "post-tool-use":
        if (data.get("tool_name", "") or "") == "Agent":
            # Serialize the whole tool_response so the match works whether it is a
            # bare string, {content:...}, {error:...}, a list of blocks, or a
            # nested object, and regardless of JSON escaping of the quotes.
            resp = data.get("tool_response", data.get("tool_result", ""))
            try:
                blob = resp if isinstance(resp, str) else json.dumps(resp)
            except Exception:
                blob = ""
            # Match ONLY the real error shape:
            #   team file for "session-<hex>" not found
            # The [\s\\"'] separators absorb the (possibly JSON-escaped) quotes and
            # backslashes on either side of the name; requiring the trailing
            # "not found" keeps arbitrary text from minting a spurious team dir.
            for m in re.finditer(
                    r'''team file for[\s\\"']+(session-[0-9a-fA-F]{6,})[\s\\"']+not found''',
                    blob):
                candidates.append(m.group(1))
    else:
        return "{}"

    # De-dupe, preserve order, drop unsafe names.
    seen = set()
    safe = []
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        if name_is_safe(c):
            safe.append(c)

    O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
    healed = []
    for name in safe:
        team_dir = os.path.join(teams_dir, name)
        # A symlinked team dir is rejected outright: a symlink INTO teams would
        # pass the child-of-teams realpath test below yet write through to another
        # team. (Codex High, 2026-08-07.)
        if os.path.islink(team_dir):
            continue
        if os.path.dirname(os.path.realpath(team_dir)) != teams_real:
            continue

        cfg_path = os.path.join(team_dir, "config.json")
        # Fast path: a real config already exists -> healthy or owned, leave it.
        if os.path.exists(cfg_path):
            continue

        lead_agent = "team-lead@" + name
        # leadSessionId: prefer the current session id (so team-reaper's
        # lead-liveness guard can protect this team); else a placeholder, which the
        # 2026-06-29 repair verified the spawn path accepts.
        if session_id:
            lead_session = session_id
        else:
            lead_session = "%s-0000-0000-0000-000000000000" % name[len("session-"):]

        now_ms = int(time.time() * 1000)
        config = {
            "name": name,
            "createdAt": now_ms,
            "leadAgentId": lead_agent,
            "leadSessionId": lead_session,
            "members": [{
                "agentId": lead_agent,
                "name": "team-lead",
                "agentType": "team-lead",
                "joinedAt": now_ms,
                "tmuxPaneId": "leader",
                "cwd": cwd,
                "subscriptions": [],
                "backendType": "in-process",
            }],
        }

        inbox_dir = os.path.join(team_dir, "inboxes")
        try:
            os.makedirs(inbox_dir, exist_ok=True)
        except OSError as e:
            sys.stderr.write("cmux-team-config-heal: could not create %s: %s\n" % (inbox_dir, e))
            continue
        if os.path.islink(inbox_dir):
            continue

        # Atomic, clobber-safe, symlink-safe config write:
        #   mkstemp in team_dir -> a fresh, non-symlink temp (no pre-existing link
        #                          to follow) with a unique name;
        #   os.link(tmp, cfg)   -> ATOMIC create-if-absent; raises FileExistsError
        #                          if a real config appeared in the race window, so
        #                          a genuine config is NEVER clobbered.
        try:
            fd, tmp_path = tempfile.mkstemp(dir=team_dir, prefix=".heal-", suffix=".tmp")
        except OSError as e:
            sys.stderr.write("cmux-team-config-heal: mkstemp failed in %s: %s\n" % (team_dir, e))
            continue
        linked = False
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(config, f, indent=2)
                f.write("\n")
            os.chmod(tmp_path, 0o644)
            try:
                os.link(tmp_path, cfg_path)
                linked = True
            except FileExistsError:
                linked = False  # a real config won the race - leave it untouched
            except OSError as e:
                sys.stderr.write("cmux-team-config-heal: link %s failed: %s\n" % (cfg_path, e))
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        if not linked:
            continue

        # Empty inboxes, exclusive + no-follow create: never overwrite a real
        # queued inbox and never follow a symlink at that path.
        for inbox_name in ("team-lead.json", "descriptions.json"):
            p = os.path.join(inbox_dir, inbox_name)
            try:
                ifd = os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY | O_NOFOLLOW, 0o644)
            except FileExistsError:
                continue
            except OSError as e:
                sys.stderr.write("cmux-team-config-heal: inbox %s: %s\n" % (p, e))
                continue
            try:
                os.write(ifd, b"[]")
            finally:
                os.close(ifd)

        healed.append(name)

    if not healed:
        return "{}"

    joined = ", ".join(healed)
    # One informative line to stderr for the human/log (mirrors team-reaper).
    sys.stderr.write(
        "cmux-team-config-heal: created missing agent-teams config for %s "
        "(a compaction-continued session wanted a team dir the harness never "
        "initialized). Named spawns can proceed now. See "
        "reference_cmux_team_init_orphan_bug.md.\n" % joined)
    if mode == "post-tool-use":
        return wrap(
            "cmux-team-config-heal: the team dir %s was missing, which is why "
            "that named-teammate spawn failed with \"team file ... not found\". "
            "I created a valid team config from the canonical schema - RE-ISSUE "
            "the same named Agent spawn and it will land now (no restart needed)."
            % joined)
    return wrap(
        "cmux-team-config-heal: pre-created the inherited agent-teams team "
        "dir %s for this compaction-continued session, so named-teammate "
        "spawns will not dead-lock on a missing team file." % joined)


try:
    out = build_output()
except Exception:
    out = "{}"
print(out)
PY
exit 0
