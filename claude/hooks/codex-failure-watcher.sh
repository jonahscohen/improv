#!/bin/bash
# PostToolUse hook for Bash. Watches completed codex CLI invocations for a
# FAILURE signature (capacity flake or an error/stream-error line) and injects a
# reminder to retry-lean / switch-model rather than silently skip the cross-model
# gate.
#
# THE GAP (codex-doctor protocol, failure mode 2 of 3): codex exec sometimes
# returns "Selected model is at capacity" or a stream/error line instead of a
# verdict. When that slips by unnoticed the produce-and-verify gate is silently
# skipped. This watcher catches the COMPLETED-but-failed case and nudges a retry.
# A HANG cannot be caught here (PostToolUse only fires on completion) - that path
# is manual elapsed-vs-CPU + SIGKILL per reference_codex_exec_hang_sigkill.
#
# TRIP: tool_name == "Bash" AND the command INVOKES codex (see the tokenizer
# below) AND the command OUTPUT (from tool_response - string OR object with
# stdout/output) contains a failure signature. Otherwise no-op. Any parse error
# -> no-op (fail-open; never break Bash).
#
# The python payload is a QUOTED heredoc, not `python3 -c '...'`: the tokenizer
# has to handle the single-quote character itself, which cannot survive a
# single-quoted bash argument. The hook payload travels by temp FILE rather than
# by env var because tool_response carries full command output, and env counts
# against ARG_MAX.
#
# Collaborator: Jonah Cohen, 2026-06-25. Tokenizer rewrite 2026-07-28.

INPUT=$(cat)

_warn() {  # emit a visible, model-readable notice that the watcher could not run
  printf '%s\n' "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"CODEX WATCHER INERT: $1 codex-failure-watcher.sh could not inspect this codex call for a capacity/stream failure. Read the output yourself before treating the cross-model gate as satisfied.\"}}"
}

# python3 is the whole engine here. Without it the watcher is INERT, and an inert
# watcher is indistinguishable from "codex succeeded" - the exact silent skip this
# hook exists to prevent. Say so, but only on a payload that mentions codex at all,
# so a machine without python3 does not get a warning on every unrelated Bash call.
if ! command -v python3 >/dev/null 2>&1; then
  case "$INPUT" in
    *codex*|*CODEX*) _warn "python3 is not on PATH, so" ;;
    *)               printf '%s\n' '{}' ;;
  esac
  exit 0
fi

PAYLOAD_FILE=$(mktemp "${TMPDIR:-/tmp}/codex-watcher.XXXXXX") || PAYLOAD_FILE=""
if [ -z "$PAYLOAD_FILE" ] || [ ! -f "$PAYLOAD_FILE" ]; then
  # Never carry on with an unset path: a `> ""` would truncate nothing and the
  # reader would then inspect an EMPTY payload and report a clean codex call.
  case "$INPUT" in
    *codex*|*CODEX*) _warn "a temp file could not be created, so" ;;
    *)               printf '%s\n' '{}' ;;
  esac
  exit 0
fi
trap 'rm -f "$PAYLOAD_FILE"' EXIT
printf '%s' "$INPUT" > "$PAYLOAD_FILE"

CODEX_WATCHER_PAYLOAD="$PAYLOAD_FILE" python3 <<'PYEOF'
import json, os, sys, re

try:
    with open(os.environ["CODEX_WATCHER_PAYLOAD"], "r", encoding="utf-8", errors="replace") as fh:
        data = json.load(fh)
except Exception:
    print("{}"); sys.exit(0)

# ---------------------------------------------------------------------------
# INVOCATION DETECTION
#
# The previous implementation matched raw text after a raw-text separator:
#   (?:^|[\n;&|])\s*(?:VAR=\S+\s+)*(?:timeout\s+\S+\s+)?codex(?=\s|$)
# It claimed to require "a whole command token", but with no shell tokenization
# that claim was false in BOTH directions. Measured 2026-07-28 with
# _tests/probe-codex-invoke.sh against a real capacity response: 9 of 18 genuine
# invocation forms were SILENT (sudo, env, command, command substitution,
# backticks, an absolute or tilde-qualified path, nohup, bash -c) and a heredoc
# BODY merely mentioning codex fired. Silence on a real capacity failure is the
# dangerous direction: it skips the cross-model review gate with no trace.
#
# So the command is now actually TOKENIZED, quote-aware, and codex is looked for
# at a COMMAND POSITION only. Quoted material, comments, heredoc bodies (unless
# fed to a shell) and argument positions cannot trip it; every real invocation
# form in the probe does.
#
# KNOWN LIMITS (accepted, and true as written):
#   - The command name is not variable-expanded, so $CODEX exec, an alias, and a
#     shell function that wraps codex are not seen.
#   - sudo -u bob codex IS seen (the wrapper option table below consumes -u and
#     its argument), but an unlisted option that takes an argument would shadow
#     the command name.
#   - A heredoc body is scanned only when the enclosing command is a shell.
#   - A command longer than 100000 chars skips tokenizing and falls back to a
#     bare substring test, which over-fires rather than under-fires on purpose.
# ---------------------------------------------------------------------------

SQ = chr(39)
DQ = chr(34)

_WRAPPERS = {
    "sudo", "doas", "env", "command", "builtin", "exec", "nohup", "nice",
    "ionice", "time", "stdbuf", "setsid", "timeout", "gtimeout", "xargs",
    "caffeinate", "arch",
}
_SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
# Executors whose STRING ARGUMENT is a command line in its own right.
_EVAL = {"eval"}
# Shell options that consume the next token, so the command name is not mistaken for
# the option operand (bash -O extglob -c "codex ..." was a false negative).
_SHELL_OPT_ARG = {"-O", "+O", "-o", "+o"}
# Compound-command keywords: a command follows them, so they must not be read as
# the command name (if x; then codex exec; fi was otherwise a false negative).
_KEYWORDS = {"then", "do", "else", "elif", "if", "while", "until", "!", "coproc"}
# Wrapper options that consume the NEXT token, which would otherwise be mistaken
# for the command name and stop the walk one token short of codex.
_OPT_ARG = {
    "sudo": {"-u", "-g", "-p", "-C", "-U", "-r", "-t", "-T", "-h",
             "--user", "--group", "--prompt"},
    "doas": {"-u", "-C"},
    "env": {"-u", "--unset", "-C", "--chdir", "-S", "--split-string"},
    "nice": {"-n"},
    "ionice": {"-c", "-n"},
    "timeout": {"-s", "--signal", "-k", "--kill-after"},
    "gtimeout": {"-s", "--signal", "-k", "--kill-after"},
    "xargs": {"-I", "-i", "-n", "-P", "-d", "-a", "-E", "-L", "-s"},
    "stdbuf": {"-i", "-o", "-e"},
    "exec": {"-a"},
}
_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\+?=")
_DURATION = re.compile(r"^[0-9]+(?:\.[0-9]+)?[smhd]?$")
_SHELL_C = re.compile(r"^-[a-zA-Z]*c$")
_LOOKUP_OPT = re.compile(r"^-[a-zA-Z]*[vV]$")
_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_WORDCHARS = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*")
# A heredoc delimiter is an arbitrary shell WORD, not an identifier. `<<EOF-1`
# and `<<EOF:1` both parsed as EOF, so the terminator was never found and every
# later line - including a genuine codex call - was swallowed as body.
_DELIM = re.compile(r"^[^\s<>|&;()'\"`]+")
_FD = re.compile(r"^[0-9]{1,3}$")
_OPS2 = ("&&", "||", "|&", ";;")
_OPS1 = ";&|(){}\n"


def _read_subst(cmd, i, closer):
    """Read a dollar-paren or backtick command context; return (inner, next_index).

    QUOTE-AWARE: a paren inside quotes does not close the substitution. Codex review
    2026-07-28 - `out=$(printf ) ; codex exec "review")` closed at the quoted paren,
    so the real codex call after it was never seen.
    """
    depth = 1
    out = []
    n = len(cmd)
    while i < n:
        c = cmd[i]
        if c == "\\" and i + 1 < n:
            out.append(cmd[i:i + 2]); i += 2; continue
        if c == SQ:
            j = cmd.find(SQ, i + 1)
            j = n if j == -1 else j + 1
            out.append(cmd[i:j]); i = j; continue
        if c == DQ:
            j = i + 1
            while j < n:
                if cmd[j] == "\\" and j + 1 < n:
                    j += 2; continue
                if cmd[j] == DQ:
                    j += 1; break
                j += 1
            out.append(cmd[i:j]); i = j; continue
        if closer == ")":
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    return "".join(out), i + 1
        elif c == "`":
            return "".join(out), i + 1
        out.append(c); i += 1
    return "".join(out), n


def _extract_substs(text):
    """Collect every $(...) / backtick body in text (used for expandable heredocs)."""
    found = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == "\\" and i + 1 < n:
            i += 2; continue
        if c == SQ:
            j = text.find(SQ, i + 1)
            i = n if j == -1 else j + 1
            continue
        if c == "$" and text[i + 1:i + 3] == "((":
            i += 3; continue
        if c == "$" and text[i + 1:i + 2] == "(":
            body, i = _read_subst(text, i + 2, ")"); found.append(body); continue
        if c == "`":
            body, i = _read_subst(text, i + 1, "`"); found.append(body); continue
        i += 1
    return found


def _read_heredoc(cmd, start, delim, strip):
    """Return (body, index_after_terminator) for a heredoc body starting at start."""
    n = len(cmd)
    i = start
    lines = []
    while i < n:
        j = cmd.find("\n", i)
        line = cmd[i:] if j == -1 else cmd[i:j]
        probe = line.strip() if strip else line.rstrip("\r")
        if probe == delim:
            return "\n".join(lines), (n if j == -1 else j + 1)
        lines.append(line)
        if j == -1:
            return "\n".join(lines), n
        i = j + 1
    return "\n".join(lines), n


def _tokenize(cmd):
    """Quote-aware shell tokenizer.

    Emits (kind, text, nested) where kind is word | op | op_redir | heredoc and
    nested is the list of command-substitution bodies found inside a word.
    """
    toks = []
    cur = []
    nested = []
    skips = []
    heredoc_cursor = None
    i, n = 0, len(cmd)

    def flush():
        if cur or nested:
            toks.append(("word", "".join(cur), list(nested)))
            del cur[:]
            del nested[:]

    while i < n:
        c = cmd[i]
        if c == "\\":
            if i + 1 < n:
                if cmd[i + 1] != "\n":
                    cur.append(cmd[i + 1])
                i += 2
            else:
                i += 1
            continue
        if c == SQ:
            j = cmd.find(SQ, i + 1)
            if j == -1:
                cur.append(cmd[i + 1:]); i = n
            else:
                cur.append(cmd[i + 1:j]); i = j + 1
            continue
        if c == DQ:
            i += 1
            while i < n:
                d = cmd[i]
                if d == "\\" and i + 1 < n:
                    cur.append(cmd[i + 1]); i += 2; continue
                if d == DQ:
                    i += 1; break
                if d == "$" and cmd[i + 1:i + 3] == "((":
                    _a, i = _read_subst(cmd, i + 3, ")")
                    if cmd[i:i + 1] == ")":
                        i += 1
                    nested.extend(_extract_substs(_a))
                    continue
                if d == "$" and cmd[i + 1:i + 2] == "(":
                    s, i = _read_subst(cmd, i + 2, ")"); nested.append(s); continue
                if d == "`":
                    s, i = _read_subst(cmd, i + 1, "`"); nested.append(s); continue
                cur.append(d); i += 1
            continue
        if c == "$" and cmd[i + 1:i + 3] == "((":
            # Arithmetic is not a command context - `echo $((codex + 1))` runs
            # nothing - but a substitution INSIDE it does execute:
            # `echo $(( $(codex exec) + 0 ))`.
            _a, i = _read_subst(cmd, i + 3, ")")
            if cmd[i:i + 1] == ")":
                i += 1
            nested.extend(_extract_substs(_a))
            cur.append("0"); continue
        if c == "$" and cmd[i + 1:i + 2] == "(":
            s, i = _read_subst(cmd, i + 2, ")"); nested.append(s); continue
        if c == "`":
            s, i = _read_subst(cmd, i + 1, "`"); nested.append(s); continue
        if c == "#" and not cur and not nested:
            j = cmd.find("\n", i)
            i = n if j == -1 else j
            continue
        if c in " \t":
            flush(); i += 1; continue
        if c == "\n":
            flush(); toks.append(("op", "\n", []))
            i += 1
            while skips and skips[0][0] == i:
                i = skips.pop(0)[1]
            heredoc_cursor = None
            continue
        if cmd[i:i + 3] == "<<<":
            # A here-string fed to a shell IS a script: `bash <<< 'codex exec'` runs
            # codex. Tagged distinctly so _scan can recurse into the following word.
            flush(); toks.append(("op_redir", "<<<", [])); i += 3; continue
        if cmd[i:i + 2] == "<<":
            flush()
            k = i + 2
            strip = False
            if cmd[k:k + 1] == "-":
                strip = True; k += 1
            while k < n and cmd[k] in " \t":
                k += 1
            quote = ""
            if cmd[k:k + 1] in (SQ, DQ):
                quote = cmd[k]; k += 1
            # A delimiter is an arbitrary WORD, not an identifier. `<<EOF-1` used to
            # parse as EOF, so the real terminator was never found and every later
            # line - including a genuine codex call - was swallowed as heredoc body.
            m = _DELIM.match(cmd[k:])
            if not m:
                toks.append(("op_redir", "<<", [])); i = k; continue
            delim = m.group(0)
            k += m.end()
            if quote and cmd[k:k + 1] == quote:
                k += 1
            i = k
            if heredoc_cursor is None:
                nl = cmd.find("\n", i)
                heredoc_cursor = n if nl == -1 else nl + 1
            body, end = _read_heredoc(cmd, heredoc_cursor, delim, strip)
            # An UNQUOTED delimiter means the body is expanded before the command
            # runs, so a $(...) inside it really does execute. A quoted delimiter
            # (<<'EOF') is literal and expands nothing.
            expansions = [] if quote else _extract_substs(body)
            toks.append(("heredoc", body, expansions))
            skips.append((heredoc_cursor, end))
            heredoc_cursor = end
            continue
        two = cmd[i:i + 2]
        if two in _OPS2:
            flush(); toks.append(("op", two, [])); i += 2; continue
        if c in "<>":
            j = i + 1
            if cmd[j:j + 1] in (">", "&"):
                j += 1
            flush(); toks.append(("op_redir", cmd[i:j], [])); i = j; continue
        if c in _OPS1:
            flush(); toks.append(("op", c, [])); i += 1; continue
        cur.append(c); i += 1
    flush()
    return toks


def _scan(toks, depth):
    at_cmd = True
    skip_word = False
    last_redir = ""
    cur_is_shell = False
    shell_reads_stdin = False
    i = 0
    while i < len(toks):
        kind, text, subs = toks[i]
        for s in subs:
            if _invokes_codex(s, depth + 1):
                return True
        if kind == "heredoc":
            # Only a shell READING STDIN executes the body. `bash -c "..." <<EOF` does
            # not: with -c the script comes from the argument and stdin is just data.
            if cur_is_shell and shell_reads_stdin and _invokes_codex(text, depth + 1):
                return True
            i += 1; continue
        if kind == "op":
            at_cmd = True; skip_word = False; last_redir = ""
            cur_is_shell = False; shell_reads_stdin = False
            i += 1; continue
        if kind == "op_redir":
            skip_word = True; last_redir = text; i += 1; continue
        if skip_word:
            skip_word = False
            # `bash <<< "codex exec"` feeds the word to the shell as a script.
            if (last_redir == "<<<" and cur_is_shell and shell_reads_stdin
                    and _invokes_codex(text, depth + 1)):
                return True
            last_redir = ""
            i += 1; continue
        if not at_cmd:
            i += 1; continue
        # A leading fd number belongs to the redirection that follows it, not to the
        # command: `2>/tmp/err codex exec` really does run codex.
        if (_FD.match(text) and i + 1 < len(toks) and toks[i + 1][0] == "op_redir"):
            i += 1; continue

        # At a command position: walk the prefix chain (assignments, wrappers and
        # their options) forward to the effective command name.
        wrapper = None
        shell_mode = False
        expect_cmd_string = False
        j = i
        while j < len(toks):
            k2, t2, _sub2 = toks[j]
            if k2 in ("op", "heredoc"):
                break
            if k2 == "op_redir":
                j += 2; continue
            if expect_cmd_string:
                if _invokes_codex(t2, depth + 1):
                    return True
                break
            if _ASSIGN.match(t2):
                j += 1; continue
            if _FD.match(t2) and j + 1 < len(toks) and toks[j + 1][0] == "op_redir":
                j += 1; continue
            if t2.startswith("-") and len(t2) > 1:
                if shell_mode and _SHELL_C.match(t2):
                    expect_cmd_string = True
                    shell_reads_stdin = False   # -c: the script is the argument
                elif shell_mode and t2 in _SHELL_OPT_ARG:
                    j += 1
                elif wrapper == "env" and t2 in ("-S", "--split-string"):
                    # env -S "codex exec ..." splits the string into a command.
                    if j + 1 < len(toks) and _invokes_codex(toks[j + 1][1], depth + 1):
                        return True
                    break
                elif wrapper == "command" and _LOOKUP_OPT.match(t2):
                    # `command -v codex` RESOLVES the name, it does not run it. Found by
                    # _tests/measure-hook-corpus.py: this shape is the single most common
                    # way codex is mentioned in real traffic (availability probes), and
                    # treating it as an invocation would have made the watcher noisy on
                    # exactly the commands that prove codex is NOT running.
                    break
                elif wrapper and "=" not in t2 and t2 in _OPT_ARG.get(wrapper, ()):
                    j += 1
                j += 1; continue
            base = os.path.basename(t2.rstrip("/")).lower()
            if base == "codex":
                return True
            if base in _WRAPPERS:
                wrapper = base; j += 1; continue
            if base in _KEYWORDS:
                # `coproc NAME cmd ...` names the coprocess; skip the NAME so the
                # real command is not mistaken for it.
                if base == "coproc" and j + 2 < len(toks):
                    nxt = toks[j + 1]
                    if (nxt[0] == "word" and _NAME.match(nxt[1])
                            and toks[j + 2][0] == "word"
                            and os.path.basename(nxt[1]).lower() != "codex"):
                        j += 1
                j += 1; continue
            if base in _EVAL:
                # eval CONCATENATES all of its arguments and runs the result, so
                # `eval "echo ok;" "codex exec"` invokes codex. Taking only the
                # first argument missed that.
                joined = []
                for k3 in range(j + 1, len(toks)):
                    if toks[k3][0] != "word":
                        break
                    joined.append(toks[k3][1])
                if joined and _invokes_codex(" ".join(joined), depth + 1):
                    return True
                break
            if base in _SHELLS:
                shell_mode = True; cur_is_shell = True; shell_reads_stdin = True
                wrapper = None; j += 1; continue
            if base in ("find", "gfind"):
                # find -exec / -execdir introduce a whole COMMAND, which may itself
                # be a wrapper or a shell: `find . -exec sh -c "codex exec" \;`.
                # Re-scan the operand span as a command rather than only testing the
                # first token for the name codex.
                for k3 in range(j + 1, len(toks)):
                    if toks[k3][0] != "word":
                        break
                    if toks[k3][1] in ("-exec", "-execdir"):
                        span = []
                        for k4 in range(k3 + 1, len(toks)):
                            if toks[k4][0] != "word" or toks[k4][1] in (";", "+"):
                                break
                            span.append(toks[k4])
                        if span and _scan(span, depth + 1):
                            return True
                break
            if wrapper in ("timeout", "gtimeout") and _DURATION.match(t2):
                j += 1; continue
            # A shell handed a SCRIPT FILE reads its program from that file, so a
            # heredoc on it is plain data: `bash ./run.sh <<EOF ... EOF` must not
            # be read as executing the body.
            if shell_mode:
                shell_reads_stdin = False
            break
        at_cmd = False
        i += 1
    return False


def _invokes_codex(command, depth=0):
    if depth > 12 or not command:
        return False
    if "codex" not in command.lower():
        return False
    if len(command) > 100000:
        # Too big to tokenize cheaply in the Bash path. Over-fire rather than
        # miss a capacity failure; the output signature still has to match.
        return True
    try:
        return _scan(_tokenize(command), depth)
    except Exception:
        # A tokenizer crash must not read as a clean codex call.
        return True


try:
    tool = data.get("tool_name", "") or ""
    inp = data.get("tool_input", {}) or {}
    command = inp.get("command", "") or ""

    if tool != "Bash" or not _invokes_codex(command):
        print("{}"); sys.exit(0)

    # Extract command output from tool_response: string, or object with
    # stdout/output (also pull stderr/content/result for robustness).
    resp = data.get("tool_response", data.get("tool_result", ""))
    output = ""
    if isinstance(resp, str):
        output = resp
    elif isinstance(resp, dict):
        parts = []
        for key in ("stdout", "output", "stderr", "content", "result"):
            v = resp.get(key)
            if isinstance(v, str):
                parts.append(v)
            elif isinstance(v, list):
                for it in v:
                    if isinstance(it, str):
                        parts.append(it)
                    elif isinstance(it, dict):
                        t = it.get("text")
                        if isinstance(t, str):
                            parts.append(t)
        output = "\n".join(parts) if parts else json.dumps(resp)

    if not output:
        print("{}"); sys.exit(0)

    # Failure signatures (case-insensitive): capacity flake + stream/request errors.
    sigs = [
        r"selected model is at capacity",
        r"model is at capacity",
        r"at capacity",
        r"stream[ _]error",
        r"error sending request",
        r"request failed",
    ]
    tripped = any(re.search(p, output, re.IGNORECASE) for p in sigs)
    # A codex/rust-style error line (uppercase ERROR at line start) - case-sensitive
    # so prose mentions of "error" in a successful review do not over-fire.
    if not tripped and re.search(r"(?m)^\s*ERROR\b", output):
        tripped = True

    if tripped:
        msg = (
            "CODEX FAILURE DETECTED (capacity/error). Per the codex-doctor protocol: "
            "treat by re-running the review with a LEANER findings-only prompt (give "
            "codex the already-verified context to cut synthesis tokens) and/or "
            "-m <alternate-model>; if it persists after one retry, fall back to "
            "lead-gate + the partial trace (a completed cross-model pass still "
            "satisfies produce-and-verify). Do NOT silently skip the cross-model gate."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": msg
            }
        }))
    else:
        print("{}")
except Exception:
    print("{}")
PYEOF
