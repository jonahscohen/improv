#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit|Bash.
# Two jobs:
#   1. If a PROJECT file changed: touch ~/.claude/.memory-dirty (enables commit gate)
#   2. If a MEMORY file changed: remove ~/.claude/.memory-dirty (clears the gate)
# Also nudges the assistant to write memory before responding.
# For Bash calls: always sets dirty (we can't reliably detect what files changed).

DIRTY_FLAG="$HOME/.claude/.memory-dirty"

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os, time

# Debounce window: skip nudge text if a memory write happened within this many seconds.
# Flag-setting is unaffected; only the additionalContext string is suppressed.
DEBOUNCE_SECONDS = 30

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
transcript_path = data.get("transcript_path", "")
dirty_flag = os.path.expanduser("~/.claude/.memory-dirty")
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
    # Commands that write files
    writes = ["cp ", "mv ", "python3 <<", "cat <<", "> ", ">>", "tee ", "install",
              "sed -i", "chmod", "ln -s", "mkdir", "touch ", "rm "]
    is_write = any(w in cmd_scan for w in writes) and not is_pure_git

    if is_memory:
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
