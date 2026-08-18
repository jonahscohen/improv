#!/usr/bin/env python3
"""justify-watcher-consent.py - the single-use USER consent token for shutting down a
Justify-watching agent.

WHY THIS EXISTS (Jonah, 2026-08-17)
A Justify-watching agent (any teammate whose ROLE is watching the Justify daemon/queue,
named `justify-*` by convention: justify-warden, justify-owner, justify-watch) must NOT
be shut down by a managing / lead / peer agent. Only the human USER's direct command may
stop it. This has happened enough times to merit a mechanical, unbreakable prevention:
  - 2026-07-12: a managing agent killed the justify-watch daemon because it rendered as an
    unnamed general-purpose pane and the agent assumed "the other pane must be my leftover".
  - Most recently a lead agent stood down a `justify-owner` watcher it had spawned.

THE SECURITY MODEL (mirrors the daemon watch-disarm gate exactly)
There is NO privilege boundary between the agent and the user - they share a uid. The ONE
thing that separates them is the HARNESS:
  - every agent file/tool action passes through a PreToolUse HOOK (Bash, Write, Edit,
    SendMessage);
  - the user's own terminal does NOT pass through hooks, and IS a TTY;
  - the agent's Bash tool is NOT a TTY.
So the boundary is: the hooks block every agent path to shutting down a justify-* watcher,
and the ONLY mint path (the `justify-watcher-shutdown` CLI) refuses unless stdin is a TTY.
This is the identical strength of the already-blessed justify-watch-disarm gate, whose own
CLI says "this script is the ergonomics, not the security boundary" - the hook layer + TTY
gate is the boundary. This helper never MINTS (minting lives only in the TTY-gated CLI, so
there is no agent-runnable mint subcommand to abuse); it only CHECKS and CONSUMES.

TOKEN FILE  ~/.claude/.justify-watcher-shutdown-consent  (JSON)
  { "target": "<name|glob|*>", "expires": <unix>, "nonce": "<hex>",
    "by": "<user>", "created": <unix> }
The token is single-use (CONSUME deletes it) and short-lived (the CLI sets a ~120s TTL).

USAGE
  justify-watcher-consent.py check   <target>   # exit 0 if a valid token authorises it
  justify-watcher-consent.py consume <target>   # same, and DELETE the token (single-use)
  justify-watcher-consent.py path               # print the token path
Exit 0 = authorised. Exit 1 = not authorised (no token / expired / target mismatch /
malformed). Never raises; any error is a non-authorisation.
"""
import os
import sys
import json
import time
import fnmatch

TOKEN_PATH = os.path.join(os.path.expanduser("~"), ".claude",
                          ".justify-watcher-shutdown-consent")


def _load():
    try:
        # A symlink here is an agent forging the token by pointing it at a file it controls
        # (the guards' open() would follow it). The real token is written by the CLI as a
        # regular 0600 file via os.replace; refuse anything that is not a regular file.
        if os.path.islink(TOKEN_PATH):
            return None
        st = os.lstat(TOKEN_PATH)
        import stat as _stat
        if not _stat.S_ISREG(st.st_mode):
            return None
        with open(TOKEN_PATH) as f:
            d = json.load(f)
        if not isinstance(d, dict):
            return None
        return d
    except Exception:
        return None


def _target_matches(token_target, requested):
    """A token authorises `requested` ONLY when the request is no BROADER than the token: the
    token target is '*'/'all', an exact match, or a glob (fnmatch) whose PATTERN covers the
    requested name. The match is one-directional on purpose - a token for `justify-owner` must
    NOT authorise a broader request like `justify-*` (Codex finding, 2026-08-17)."""
    if token_target in (None, "", "*", "all"):
        return True
    tt = str(token_target)
    rq = str(requested or "")
    if tt == rq:
        return True
    # token is the PATTERN; the request must fall inside it. Not the reverse.
    if fnmatch.fnmatch(rq, tt):
        return True
    return False


def _valid_for(requested):
    d = _load()
    if d is None:
        return False
    try:
        expires = float(d.get("expires", 0))
    except Exception:
        return False
    if time.time() > expires:
        return False
    return _target_matches(d.get("target"), requested)


def main(argv):
    if len(argv) >= 1 and argv[0] == "path":
        print(TOKEN_PATH)
        return 0
    if len(argv) < 2 or argv[0] not in ("check", "consume"):
        sys.stderr.write("usage: justify-watcher-consent.py {check|consume} <target>\n")
        return 2
    action, requested = argv[0], argv[1]
    if not _valid_for(requested):
        return 1
    if action == "consume":
        # Single-use: the token is spent by DELETING it, and that delete MUST succeed for this
        # consume to authorise. If we cannot remove the file, a second caller could reuse the
        # same valid token within its TTL and break single-use (Codex finding, 2026-08-17), so
        # a failed unlink is a REFUSAL, not a pass - return non-zero and leave the shutdown
        # denied. A FileNotFoundError means another consumer already spent it between our
        # _valid_for() check and here (a race); that caller won, so THIS one is not authorised.
        # Net effect: at most one caller ever gets a 0 exit from a single token.
        try:
            os.unlink(TOKEN_PATH)
        except Exception:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
