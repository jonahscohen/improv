#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit|Bash.
# Two jobs:
#   1. If a PROJECT file changed: touch ~/.claude/.memory-dirty.<session> (enables commit gate)
#   2. If a MEMORY file changed: remove ~/.claude/.memory-dirty.<session> (clears the gate)
# Also nudges the assistant to write memory before responding.
#
# For Bash calls the command is CLASSIFIED, not blanket-dirtied. A read-only
# command (`git status`, `grep`, `ls`, ...) leaves the flag untouched; only a
# recognized WRITE token (`sed -i`, `> file`, `rm `, `cp `, the `install` verb,
# ...) sets it. See the read_only / writes / is_pure_git lists below for the
# actual classification. (The header used to claim "always sets dirty (we can't
# reliably detect what files changed)". That has been false for a long time and
# it cost an agent a false diagnosis on 2026-07-16: it read the comment, believed
# it over the code, and wrote the claim into a beat as fact. Measured behaviour:
# git status / grep / ls / composer install all leave the flag CLEAR;
# `sed -i s/a/b/ file.php` ARMS it.)
#
# The flag is keyed by SESSION. It used to be one global file,
# $HOME/.claude/.memory-dirty, shared by every concurrent Claude process. With
# several sessions live, ANY one of them editing a project file armed the gate
# for ALL of them, and a beat written by ANY of them cleared it for ALL of them.
# So a session that owed nothing got blocked, and a session that did owe a beat
# had its debt silently discharged by a stranger. That is misattribution, not
# just noise - the same defect already fixed twice, for the multiple-choice
# violation flag and the screenshot pending slot.
# See reference_2026-07-10_multiple-choice-hook-cross-session.md,
#     reference_2026-07-10_screenshot-pending-is-global-and-arms-on-fiction.md,
#     session_2026-07-10_two-approved-hook-fixes.md.
#
# Key derivation is duplicated verbatim in bash-guard.sh (the READER). If you
# change it, change both - a writer and a reader that disagree on the path make
# the gate FAIL OPEN, which looks exactly like a gate with nothing to catch.

INPUT=$(cat)

# NO REAPER HERE, DELIBERATELY. screenshot-open-mandate.sh reaps its per-session
# pending files after 24h, and mirroring that here was the obvious symmetry - but
# it is wrong for THIS flag, and an independent Codex review flagged the attempt
# as a fail-open. A screenshot obligation is a within-turn thing; a beat debt
# legitimately persists for as long as the session does. Any reaper deletes a LIVE
# session's genuine debt once it crosses the window (a long-lived or resumed
# session), and the next `git commit` sails through beat-less. That is the exact
# failure this gate exists to prevent, so the gate does not get a timer.
# Per-session flags are 0 bytes and are removed on the session's next beat write;
# an abandoned one is harmless clutter. Clutter is the cheaper problem.
printf '%s' "$INPUT" | python3 -c '
import json, re, sys, os, time

# Debounce window: skip nudge text if a memory write happened within this many seconds.
# Flag-setting is unaffected; only the additionalContext string is suppressed.
DEBOUNCE_SECONDS = 30

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
transcript_path = data.get("transcript_path", "")

# Session key. Sanitised to [A-Za-z0-9._-] so a hostile or odd id cannot escape
# the directory, with "global" as the fallback for a missing/empty id.
#
# The fallback deliberately fails CLOSED, not open. An id-less writer arms
# .memory-dirty.global and an id-less reader blocks on .memory-dirty.global, so
# the gate still fires; id-less sessions simply share one bucket, which is the
# pre-fix behaviour and no worse than it. Choosing "no id -> no flag" instead
# would mean any payload that dropped the field walked through the gate. The
# field is supplied by the harness, not by the model, so this is not a lever the
# assistant can pull - but a fail-open default would make it one.
#
# Duplicated verbatim in bash-guard.sh. Change both or the gate fails open.
#
# ACCEPTED RESIDUE (independent Codex review, 2026-07-17), inherited from the
# screenshot key this mirrors and true of that gate too:
#   - the sanitisation is LOSSY, so two ids differing only in disallowed
#     characters collide ("a/b" and "a_b" both key to "a_b"), letting either one
#     clear the debt owed by the other;
#   - the key is UNBOUNDED, so a ~300-char id yields a filename over NAME_MAX;
#     open() raises ENAMETOOLONG, the except-swallow below drops it, and nothing
#     arms -> a beat-less commit.
# Both are UNREACHABLE on real input: the harness emits UUIDs, and on a UUID this
# regex is the IDENTITY function (36 chars, no character replaced) - verified
# against the two live session ids on this machine. Hashing the raw id would fix
# both, but bash-guard.sh derives ONE key for this gate AND the screenshot gate,
# whose writers (screenshot-open-{mandate,clear}.sh) would then disagree with it
# and silently fail open. That trade - a theoretical bug for a live one - is not
# worth taking here; a fix must change all four files together, deliberately.
session_key = re.sub(r"[^A-Za-z0-9._-]", "_", str(data.get("session_id", ""))) or "global"
dirty_flag = os.path.expanduser("~/.claude/.memory-dirty." + session_key)
last_memory_write = os.path.expanduser("~/.claude/.last-memory-write")

def is_subagent_context(path):
    """True if this session is a sidechain subagent or a named teammate.
    Signals come from the transcript JSONL:
      - any record with isSidechain == True  -> Agent-tool spawned sidechain
      - any record carrying a teamName field -> cmux-teams teammate
    The parent session sets neither, so the absence of both means we are
    in the top-level session and the nudge should fire normally."""
    if not path:
        return False
    try:
        with open(path) as fh:
            for i, line in enumerate(fh):
                if i > 20:  # only the header + first few records carry these
                    break
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                if d.get("isSidechain") is True:
                    return True
                if d.get("teamName"):
                    return True
    except (FileNotFoundError, OSError):
        return False
    return False

IS_SUBAGENT = is_subagent_context(transcript_path)

def recently_satisfied():
    """True if a memory write happened within DEBOUNCE_SECONDS."""
    try:
        mtime = os.path.getmtime(last_memory_write)
    except (FileNotFoundError, OSError):
        return False
    return (time.time() - mtime) < DEBOUNCE_SECONDS

def touch_last_memory_write():
    try:
        with open(last_memory_write, "a"):
            pass
        os.utime(last_memory_write, None)
    except Exception:
        pass

# For Bash: check if command looks like it modifies files (not read-only)
if tool == "Bash":
    cmd = data.get("tool_input", {}).get("command", "")
    import re as _re
    # ROOT-CAUSE FIX (T-0033): the write-token scan below substring-matches the
    # command, so any write token sitting inside a QUOTED span - a commit
    # message, an echo arg, a grep pattern - false-fired the dirty flag. The
    # classic case is `git commit -m "a -> b"` (the "-> " matches the "> "
    # redirect token), but a message containing "rm ", "touch ", or "mv " as
    # ordinary words trips it just as hard, and a mixed compound like
    # `git add x && echo y | grep z && git commit -m "p -> q"` defeats the
    # pure-git exemption entirely. Fix: strip quoted spans FIRST, then match on
    # the bare command. Real redirects/writes are unquoted; the false-positive
    # text is always quoted. cmd_bare is what every token check below uses.
    # NOTE: this python body runs inside a shell single-quoted `python3 -c '...'`,
    # so a literal single-quote here would terminate that string. Build the quote
    # characters via chr() (39=apostrophe, 34=double-quote) to stay shell-safe.
    _SQ = chr(39); _DQ = chr(34)
    cmd_bare = _re.sub(_SQ + "[^" + _SQ + "]*" + _SQ, " ", cmd)       # strip single-quoted spans
    cmd_bare = _re.sub(_DQ + "[^" + _DQ + "]*" + _DQ, " ", cmd_bare)  # strip double-quoted spans

    # Skip read-only commands
    read_only = ["ls", "cat", "head", "tail", "grep", "rg ", "find", "echo", "pwd",
                 "git status", "git log", "git diff", "git show", "git branch",
                 "wc ", "diff ", "readlink", "which", "type ", "file ",
                 "curl -s", "node -e", "python3 -c"]
    is_read = any(cmd.strip().startswith(r) for r in read_only)
    # Pure-git commands never AUTHOR project content that needs a beat - they
    # manipulate VCS state, and `git commit` is what CONSUMES a beat. Kept as a
    # secondary guard; the de-quoting above already neutralizes the arrow/word
    # false-matches that originally motivated it. A compound mixing git with a
    # real non-git writer (e.g. `sed -i x && git add`) is NOT pure-git and still
    # falls through to the write check, where the unquoted `sed -i` is detected.
    _segments = [s.strip() for s in _re.split(r"&&|\|\||;|\||\n", cmd_bare) if s.strip()]
    is_pure_git = bool(_segments) and all(s.startswith("git ") or s == "git" for s in _segments)
    # Skip memory-related commands (match the bare command so a quoted mention
    # of a memory path in a message neither falsely clears nor sets the flag)
    is_memory = ".claude/memory" in cmd_bare or "MEMORY.md" in cmd_bare
    # A redirection to the null device writes NOTHING. Strip it from a SCAN copy
    # BEFORE the write-token match so a read-only command sunk into /dev/null -
    # `beats.py verify > /dev/null 2>&1`, `rg foo src/ > /dev/null` - is not
    # misclassified as a project-file write that falsely sets .memory-dirty (bug
    # fixed 2026-07-14: a pull-time verify/search redirected to /dev/null re-dirtied
    # the flag). The (?![\w./-]) guard strips ONLY the exact /dev/null device: a real
    # named path like `> /dev/null.log` or `> /dev/nullx` keeps its `> file` token in
    # cmd_scan and dirties exactly as before. fd-redirect chars ($fd>&$fd, e.g. 2>&1)
    # never contained a `> ` / `>>` write token to begin with, so they need no strip.
    cmd_scan = _re.sub(r"(?:\d*|&)>>?\s*/dev/null(?![\w./-])", " ", cmd_bare)
    # `tee /dev/null` (with optional -a/-i flags) also writes only to the null device,
    # so strip it too: `cmd | tee /dev/null` (swallow output while still running) must
    # not be read as a `tee ` write. The -\S+ run only eats dash-flags, never a file
    # operand. Strip ONLY when /dev/null is the SOLE tee sink: the lookahead requires it
    # be followed by end / a pipe-or-terminator (| & ; )) / a stdin or fd redirect
    # (< or [n]>), NOT another output file. So `tee /dev/null out.txt` keeps its `tee `
    # token and dirties (out.txt is a real sink), and `tee /dev/null.log` / `/dev/nullx`
    # (a real named path, not the device) are not matched either.
    cmd_scan = _re.sub(r"\btee(?:\s+-\S+)*\s+/dev/null(?=\s*(?:$|[|&;)]|<|\d*>))", " ", cmd_scan)
    # A redirect to session SCRATCHPAD is not a PROJECT write (temp-file over-fire, 2026-07-26):
    # strip a redirect whose target path contains /scratchpad/ before the write-token scan, exactly
    # as /dev/null is stripped above, so a backgrounded run logging to scratchpad does not dirty.
    # (Bare /tmp is NOT stripped - a throwaway project tree can live under /tmp/; only /scratchpad/ declassifies.)
    cmd_scan = _re.sub(r"(?:\d*|&)>>?\s*\S*/scratchpad/\S+", " ", cmd_scan)
    # Commands that write files. Redirects are handled by _has_redirect below, NOT by bare
    # "> " / ">>" substrings: those also matched the "-> " ARROW. De-quoting (cmd_bare) already
    # neutralizes a QUOTED arrow, but an UNQUOTED arrow in a for/while/printf compound (not in
    # the read_only prefix list) still false-set .memory-dirty (Jonah 2026-07-23). A real
    # redirect operator is never preceded by a dash. Two dash-guarded branches:
    #   "> "  - single redirect, SPACE-required so fd-dup 2>&1 does NOT match (as the old
    #           "> " token behaved);
    #   ">>"  - append, space OPTIONAL, restoring the old bare ">>" recall for no-space
    #           appends like `printf x >>gen.ts` / `node x 2>>build.log` (Codex 2026-07-23 High:
    #           requiring a space there was a recall regression in the dangerous direction).
    # Neither branch matches "-> " / "->>" (dash) or ">(procsub)". Mirrors verify-before-done.sh.
    writes = ["cp ", "mv ", "python3 <<", "cat <<", "tee ",
              "sed -i", "chmod", "ln -s", "mkdir", "touch ", "rm "]
    _has_redirect = bool(_re.search(r"(?<!-)(?:> |>>)", cmd_scan))
    # The coreutils `install` file-writing verb, matched only in COMMAND POSITION -
    # the first real word of a segment (past VAR= assignments and sudo/env-style
    # wrappers), optionally path-qualified (/usr/bin/install, ./bin/install).
    # ROOT-CAUSE FIX (U7b issue 1): the old bare substring "install" matched every
    # command that merely NAMED an install script - `bash install.sh`, `./install.sh`,
    # `bash claude/hooks/test-install-hook-deploy.sh`, `npm uninstall x`, even
    # `npm help install topic` - so a read-only run of the installer or its test suite
    # falsely set .memory-dirty and blocked worktree commits (Wave 1: U1 hit this 3x).
    # Command-position plus a trailing \s is what separates the real verb from those:
    #   - install.sh / ./install.sh (a dot follows the command word - no \s)
    #   - test-install-*.sh, `npm help install topic`, `node x.js install` (install is
    #     an ARGUMENT, not the segment command word)
    #   - installer / uninstall / reinstall (install is not the whole command word)
    # are all excluded, while `install -m ...`, `sudo install -d ...`, a path-qualified
    # `/usr/bin/install ...`, and env-wrapped `env FOO=bar install ...` /
    # `/usr/bin/env install ...` still dirty (the DANGEROUS direction is a real install
    # write that fails to dirty, so the wrapper clause allows each wrapper to be
    # path-qualified and to carry -flags and VAR= operands). Runs over _segments
    # (already split on && || ; | \n) so a real install after a separator -
    # `make x && install -m 644 a /etc/a` - is caught too. A false-dirty is the safe
    # direction (it just asks for a beat). KNOWN GAP (Codex U7b review, accepted): a
    # wrapper VALUE-flag that consumes the next word - `sudo -u root install ...`,
    # `timeout -s TERM 5 install ...` - is not detected (that needs the per-flag
    # arg-parsing bash-guard.sh carries in head_name; not replicated in this simpler
    # hook). Such forms almost always target system dirs, not project files, so the
    # miss is low-risk; flagged for the lead rather than over-fitting the regex.
    _install_cmd = _re.compile(
        r"^\s*(?:[A-Za-z_][\w]*=\S*\s+)*"
        r"(?:(?:\S*/)?(?:sudo|env|command|exec|time|nice|nohup|xargs|timeout|setsid|stdbuf)"
        r"(?:\s+-\S+)*(?:\s+[A-Za-z_][\w]*=\S*)*\s+)*"
        r"(?:\S*/)?install\s")
    is_install_verb = any(_install_cmd.search(seg) for seg in _segments)
    is_write = (any(w in cmd_scan for w in writes) or _has_redirect or is_install_verb) and not is_pure_git

    # Clear the dirty flag only on a real WRITE into a memory path - a `cp`/`tee`/redirect
    # /`sed -i` whose path is under .claude/memory or MEMORY.md. A READ-ONLY command that
    # merely NAMES a memory path (`ls .claude/memory`, `grep MEMORY.md docs/`,
    # `cat .claude/memory/x.md`) must NOT clear a legitimately-dirty flag - that was a
    # false-clean hole (Codex U7b review, High): source edited -> `ls .claude/memory` ->
    # `git commit` slipped past the gate beat-less. Gating on is_write also matches issue
    # 2 as written ("a recognized Bash WRITE INTO .claude/memory/ clears"). is_write is
    # already `... and not is_pure_git`, so a commit message naming a memory path never
    # clears. (Residual, accepted: a compound that writes a NON-memory file AND names a
    # memory path in the same segment, e.g. `sed -i s/a/b/ src/app.ts && cp x .claude/
    # memory/y`, still clears - separating write TARGETS from mere mentions needs the
    # target parser bash-guard.sh carries; not replicated here. Flagged for the lead.)
    if is_memory and is_write:
        try:
            os.remove(dirty_flag)
        except FileNotFoundError:
            pass
        touch_last_memory_write()
        print("{}"); sys.exit(0)

    if is_write and not is_read:
        try:
            open(dirty_flag, "w").close()
        except Exception:
            pass
        if recently_satisfied() or IS_SUBAGENT:
            print("{}"); sys.exit(0)
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "BASH WROTE FILES. You are in dirty state. Write a session beat to .claude/memory/ BEFORE composing any text response to the user."
            }
        }))
    else:
        print("{}")
    sys.exit(0)

# For Write/Edit/MultiEdit: check file_path
file_path = data.get("tool_input", {}).get("file_path", "")

if not file_path:
    print("{}"); sys.exit(0)

is_memory = (".claude/" in file_path and "/memory/" in file_path) or file_path.endswith("MEMORY.md")

if is_memory:
    try:
        os.remove(dirty_flag)
    except FileNotFoundError:
        pass
    touch_last_memory_write()
    print("{}"); sys.exit(0)

# A write to session SCRATCHPAD is NOT a project change and must not arm the commit dirty flag (the
# temp-file-write over-fire, flagged 2026-07-26). Scratchpad lives under /private/tmp/.../scratchpad.
# NOTE: bare /tmp is deliberately NOT excluded - tests and real callers put throwaway project trees
# under /tmp/ (the test-nudge-debounce fixture uses /tmp/fake-project), so ONLY the explicit /scratchpad/ segment declassifies.
if "/scratchpad/" in file_path:
    print("{}"); sys.exit(0)

# Project file changed - set dirty flag and nudge
try:
    open(dirty_flag, "w").close()
except Exception:
    pass

if recently_satisfied() or IS_SUBAGENT:
    print("{}"); sys.exit(0)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "PROJECT FILE CHANGED. You are in dirty state. Write a session beat to .claude/memory/ BEFORE composing any text response to the user."
    }
}))
'
