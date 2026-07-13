#!/bin/bash
# PreToolUse hook for Bash. Blocks a cmux surface/pane/workspace/window close
# unless the close is PROVABLY safe.
#
# 2026-07-12 (Jonah): during teammate teardown the lead ran
#   cmux close-surface --surface surface:23
# on a `general-purpose` pane it BELIEVED was a leftover of the two build agents
# it had spawned. It was not. It was Jonah's justify-watch WORKER, a live
# claude.exe, and force-closing the surface killed it, stalling two queued
# Send-All batches. Full analysis:
#   ppai/.claude/memory/feedback_2026-07-12_never-force-close-a-live-pane.md
#
# Two signals were available and both were ignored:
#   1. LIVENESS  - a live backing process means the pane is a RUNNING agent.
#                  A live process is never "a leftover to clean up".
#   2. OWNERSHIP - the surface was never positively matched to a pane this
#                  session actually spawned. It was identified by ELIMINATION
#                  ("my agents are gone, so this must be theirs"), which is not
#                  identification at all.
#
# A close is allowed only when BOTH hold, for every surface it would close:
#   (a) LIVENESS: no live agent / protected / busy process backs the surface.
#       HARD gate, NO override. The ownership assertion can only unlock an
#       already-dead pane, so it can never be used to kill a running agent.
#   (b) OWNERSHIP: the caller positively named the target as one it owns, via
#       an env prefix ON THE SAME command:
#           CMUX_CLOSE_CONFIRM=surface:23 cmux close-surface --surface surface:23
#       or a session ledger: ~/.claude/.cmux-owned-surfaces.<session_key>
#       (one ref per line).
#
# DENY IS THE DEFAULT. Everything the guard cannot prove, it blocks: no cmux to
# query, an unresolvable surface, no explicit target, an unparseable command, a
# close hidden inside `bash -c` / `eval` / a command substitution, or cmux
# output whose shape it does not recognise. A guard that falls through to allow
# on anything it fails to understand is a guard the next unparsed command walks
# straight past - which is exactly how the incident happened.
#
# Command parsing is a real quote-aware tokenizer, not a regex. Regex detection
# was tried first and an independent review broke it in six ways in one pass
# (quoted `'cmux'`, escaped `cmu\x`, `$(printf cmux)`, `bash -c '...'`, `if`/
# `time`/`env` prefixes, repeated --surface flags). Tokenizing is what makes
# "prose about the command" (echo, grep, a heredoc beat) separable from "code
# that runs the command" without leaving a hole between them.
#
# Regression tests: claude/hooks/test-cmux-close-guard.sh

INPUT=$(cat)

CMUX_CLOSE_GUARD_INPUT="$INPUT" python3 <<'PYEOF'
import json, os, re, shutil, subprocess, sys

CLOSE_SUBS = ("close-surface", "close-panel", "close-pane",
              "close-workspace", "close-window")
CLOSE_TOKEN_RE = re.compile("|".join(CLOSE_SUBS))

COOPERATIVE = (
    "Teardown is cooperative: send a shutdown_request and let the agent close its "
    "OWN pane. Only force-close a pane after you have (1) confirmed its backing "
    "process is dead and (2) positively identified it as a pane THIS session "
    "spawned. Closing by elimination ('my agents are gone, so this must be a "
    "leftover') is how Jonah's justify-watch worker got killed on 2026-07-12."
)


def emit(reason=None):
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    else:
        print("{}")
    sys.exit(0)


raw = os.environ.get("CMUX_CLOSE_GUARD_INPUT") or ""
try:
    payload = json.loads(raw or "{}")
except Exception:
    # Unparseable hook payload. Do not brick every Bash call on a harness format
    # change - but do not wave a close through inside something we cannot read.
    if CLOSE_TOKEN_RE.search(raw) and "cmux" in raw:
        emit("BLOCKED: this Bash payload could not be parsed, and it mentions a cmux "
             "close subcommand. The guard cannot prove what it would close. " + COOPERATIVE)
    emit()

cmd = ((payload.get("tool_input") or {}).get("command") or "")
if not isinstance(cmd, str) or not cmd:
    emit()

# Cheap bail: not even a candidate. Normalise away the characters an obfuscated
# invocation would hide behind first - `cmu\x` and `'cmux'` both run cmux, and a
# bail that reads the RAW string lets them through before any parsing happens.
#
# The bail deliberately keys on the close SUBCOMMAND alone and does NOT also
# require the literal string "cmux": `$(printf c)$(printf mux) close-surface`
# contains no "cmux" anywhere, and an executable can always be assembled out of
# pieces. The subcommand is the part that cannot be obfuscated away without cmux
# refusing the command too. Tokenizing is cheap and pure; the expensive cmux
# introspection below only runs once a real close invocation has been parsed.
NORM = re.sub(r"[\\'\"]", "", cmd)
if not CLOSE_TOKEN_RE.search(NORM):
    emit()


# ---------------------------------------------------------------------------
# Shell tokenizer. Heredoc bodies are data (a beat, a doc) and are stripped.
# Everything else is split into commands and quote-resolved words, so `echo
# 'cmux close-surface ...'` is one ARGUMENT to echo while `bash -c 'cmux
# close-surface ...'` is a wrapper carrying code - a distinction a regex on the
# raw string cannot make.
# ---------------------------------------------------------------------------
# group(3) is the REST OF THE OPENER LINE, which must survive: in
# `cat <<'EOF' | bash`, the `| bash` sits after the marker, and a regex that
# swallowed it along with the body erased the very executor that runs the close.
# group(4) is the body.
HEREDOC_RE = re.compile(r"<<-?\s*(['\"]?)([\w.-]+)\1([^\n]*)\n(.*?)^\s*\2\s*$", re.S | re.M)


def strip_heredocs(s):
    """Remove heredoc BODIES, keeping everything else on the opener line."""
    return HEREDOC_RE.sub(lambda m: m.group(3) + "\n", s)


def tokenize(s):
    """-> list of commands; each command is a list of (word, is_dynamic)."""
    cmds, cur = [], []
    word, dyn, has_word = "", False, False
    i, n = 0, len(s)

    def flush_word():
        nonlocal word, dyn, has_word
        if has_word:
            cur.append((word, dyn))
        word, dyn, has_word = "", False, False

    def flush_cmd():
        nonlocal cur
        flush_word()
        if cur:
            cmds.append(cur)
        cur = []

    while i < n:
        c = s[i]
        if c in ";&|\n(){}":
            flush_cmd()
            i += 1
            continue
        if c in " \t\r":
            flush_word()
            i += 1
            continue
        if c == "\\" and i + 1 < n:
            word += s[i + 1]
            has_word = True
            i += 2
            continue
        # $'...' ANSI-C quoting is a literal, not an expansion. Left to the generic
        # "$" branch it produced the word "$cmux", which is not cmux, which allowed.
        if c == "$" and i + 1 < n and s[i + 1] == "'":
            j, buf, escaped = i + 2, [], False
            while j < n:
                if s[j] == "\\" and j + 1 < n:
                    # \x78, \154, \n ... ANSI-C decodes these. We do not, so the word is
                    # unresolvable: `$'cmu\x78'` would otherwise read as the literal
                    # "cmux78" and miss. Mark it dynamic and let the deny paths take it.
                    escaped = True
                    buf.append(s[j + 1])
                    j += 2
                    continue
                if s[j] == "'":
                    break
                buf.append(s[j])
                j += 1
            word += "".join(buf)
            if escaped:
                dyn = True
            has_word = True
            i = j + 1
            continue
        if c == "'":
            j = s.find("'", i + 1)
            if j < 0:
                j = n
            word += s[i + 1:j]        # single quotes: literal, never dynamic
            has_word = True
            i = j + 1
            continue
        if c == '"':
            j, buf = i + 1, []
            while j < n:
                if s[j] == "\\" and j + 1 < n:
                    buf.append(s[j + 1])
                    j += 2
                    continue
                if s[j] == '"':
                    break
                buf.append(s[j])
                j += 1
            chunk = "".join(buf)
            # Expansions inside double quotes still expand: "$CMUX" runs cmux.
            if re.search(r"\$[({\w]|`", chunk):
                dyn = True
            word += chunk
            has_word = True
            i = j + 1
            continue
        # $( ), ${ }, ` `, and the process substitutions <( ) >( ) are word CONTENT,
        # not separators. Letting the "(" fall through to the separator branch split
        # `$(printf cmux)` into pieces and lost the fact that the executable was
        # unresolvable - and split `bash < <(printf ...)` away from its payload.
        if (c == "$" and i + 1 < n and s[i + 1] in "({") or \
           (c in "<>" and i + 1 < n and s[i + 1] == "("):
            open_ch = s[i + 1]
            close_ch = ")" if open_ch == "(" else "}"
            depth, j = 0, i + 1
            while j < n:
                if s[j] == open_ch:
                    depth += 1
                elif s[j] == close_ch:
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            word += s[i:min(j + 1, n)]
            dyn, has_word = True, True
            i = j + 1
            continue
        if c == "`":
            j = s.find("`", i + 1)
            if j < 0:
                j = n
            word += s[i:j + 1]
            dyn, has_word = True, True
            i = j + 1
            continue
        # A bare $VAR is an expansion too: `CMUX=cmux; $CMUX close-surface ...`
        # resolves to cmux at run time and must not be treated as a literal word.
        if c == "$" and i + 1 < n and (s[i + 1].isalnum() or s[i + 1] == "_"):
            dyn = True
        word += c
        has_word = True
        i += 1

    flush_cmd()
    return cmds


# Words that precede the real executable and should be skipped over.
PREFIXES = {"sudo", "env", "command", "exec", "nohup", "builtin", "time",
            "timeout", "gtimeout", "if", "then", "else", "elif", "do", "while",
            "until", "!", "stdbuf", "nice", "caffeinate"}
# Executables that can RUN a string handed to them - directly, from stdin, or via
# an -exec/system() escape hatch.
#
# The guard does NOT try to work out WHERE the close text sits relative to one of
# these. It cannot: `echo '...' | bash`, `cat <<EOF | bash`, `find -exec cmux ...`,
# `awk 'BEGIN{system(...)}'` and `env -S '...'` all execute a close that lives in a
# completely different command than the executor, or in no command at all. Chasing
# each shape is a losing game - the list of ways a shell can execute a string is
# open-ended. So the rule is coarse and total: if a close subcommand appears
# ANYWHERE in a command line, and an executor appears ANYWHERE in that same line,
# the whole line is denied. Prose (echo/grep/cat/a quoted message) survives because
# none of those can execute what they are handed.
WRAPPERS = {"bash", "sh", "zsh", "dash", "ksh", "fish", "csh", "eval", "source",
            ".", "xargs", "ssh", "python", "python3", "perl", "ruby", "node",
            "osascript", "script", "watch", "parallel", "find", "awk", "gawk",
            "mawk", "make", "sed", "tmux", "screen", "expect", "docker"}
ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

# Prefix flags that swallow the NEXT word. Skipping only flags and numbers left
# `sudo -u spare3 cmux close-surface ...` resolving its executable to "spare3",
# which classified as harmless and allowed the close.
PREFIX_VALUE_FLAGS = {
    "sudo": {"-u", "-g", "-p", "-C", "-U", "-R", "-T", "-D", "-h",
             "--user", "--group", "--prompt", "--chdir", "--host"},
    # NOTE: -S / --split-string is deliberately NOT here. `env -S 'cmux close-surface
    # ...'` EXECUTES its operand; treating it as a value to skip over walked straight
    # past the close. Left unlisted, the operand becomes the executable and the
    # "executable named after a close subcommand" rule denies it.
    "env": {"-u", "-C", "--unset", "--chdir"},
    "timeout": {"-s", "-k", "--signal", "--kill-after"},
    "gtimeout": {"-s", "-k", "--signal", "--kill-after"},
    "nice": {"-n"},
    "stdbuf": {"-i", "-o", "-e"},
    "caffeinate": {"-t", "-w"},
}
NUMERIC = re.compile(r"^[\d.]+$")


def classify_command(words):
    """-> (kind, exec_name, env, args, had_prefix). kind: cmux|wrapper|dynamic|other"""
    env, idx, had_prefix = [], 0, False
    while idx < len(words):
        w, dynamic = words[idx]
        if ENV_ASSIGN.match(w):
            env.append(w)
            idx += 1
            continue
        base = os.path.basename(w)
        if base in PREFIXES:
            had_prefix = True
            value_flags = PREFIX_VALUE_FLAGS.get(base, set())
            idx += 1
            while idx < len(words):
                nxt = words[idx][0]
                if nxt.startswith("-"):
                    if nxt in value_flags and idx + 1 < len(words):
                        idx += 2
                    else:
                        idx += 1
                    continue
                if NUMERIC.match(nxt) and base in ("timeout", "gtimeout", "nice"):
                    idx += 1
                    continue
                break
            continue
        break
    if idx >= len(words):
        return "other", "", env, [], [], had_prefix
    w, dynamic = words[idx]
    args = [x[0] for x in words[idx + 1:]]
    args_dyn = [x[1] for x in words[idx + 1:]]
    if dynamic:
        return "dynamic", w, env, args, args_dyn, had_prefix
    base = os.path.basename(w)
    if base == "cmux":
        return "cmux", base, env, args, args_dyn, had_prefix
    if base in WRAPPERS:
        return "wrapper", base, env, args, args_dyn, had_prefix
    return "other", base, env, args, args_dyn, had_prefix


def subcommand_of(args):
    """cmux [global-flags] <subcommand> ... - first word that is not a flag or a
    flag's value."""
    i = 0
    while i < len(args):
        a = args[i]
        if a.startswith("-"):
            if "=" not in a and i + 1 < len(args) and not args[i + 1].startswith("-"):
                i += 2
                continue
            i += 1
            continue
        return a, args[i + 1:]
    return None, []


def flag_values(args, *names):
    """EVERY value for a repeatable flag. Last-value-wins CLIs make 'check the
    first one' a bypass, so we validate them all."""
    out, i = [], 0
    while i < len(args):
        a = args[i]
        for name in names:
            if a == "--" + name and i + 1 < len(args):
                out.append(args[i + 1])
                i += 1
                break
            if a.startswith("--" + name + "="):
                out.append(a.split("=", 1)[1])
                break
        i += 1
    return out


# A heredoc body is DATA when it feeds cat/tee/a file (writing a beat about this
# very command) and CODE when it feeds a shell: `bash <<EOF ... EOF` runs it.
# Stripping every body unconditionally handed the second case a free pass.
# A heredoc BODY is data when it feeds cat/tee/a file (writing a beat, a script, a
# doc that quotes this very command) and CODE when its opener line feeds a shell:
# `bash <<EOF`, `cat <<EOF | bash`, `$(printf bash) <<EOF` all execute the body.
# The opener line includes everything AFTER the marker, which is where the `| bash`
# lives.
for _m in HEREDOC_RE.finditer(cmd):
    if not CLOSE_TOKEN_RE.search(_m.group(4)):
        continue
    _line_start = cmd.rfind("\n", 0, _m.start()) + 1
    _opener = cmd[_line_start:_m.start()] + " " + _m.group(3)
    for _words in tokenize(_opener):
        if classify_command(_words)[0] in ("wrapper", "dynamic"):
            emit("BLOCKED: a heredoc carrying a cmux close subcommand is being fed to a "
                 "shell, which will execute the body. The guard cannot verify a close it "
                 "only sees as heredoc text. Run the close directly. " + COOPERATIVE)

EXEC_REGION = strip_heredocs(cmd)
commands = [classify_command(w) for w in tokenize(EXEC_REGION) if w]

# THE COARSE RULE - one rule for the entire obfuscation/indirection class.
#
# If a close subcommand appears in the EXECUTABLE part of this line (heredoc bodies
# excluded - those were just handled), and anything in the line can EXECUTE a string
# (a shell, an interpreter, an -exec/system() escape, or an executable the guard
# cannot even resolve), then the close may be routed through it in a way no parser
# can follow:
#     echo '...' | bash    find -exec cmux ...    awk 'BEGIN{system(...)}'
#     env -S '...'         "$CMUX" close-surface  $(printf c)$(printf mux) close-...
# WHERE the close text sits relative to the executor does not matter and cannot be
# made to matter. Tracing the data flow is a losing game; the co-occurrence is the
# denial. Prose survives because echo/grep/cat/git cannot execute what they are
# handed - and because a heredoc body writing a FILE is not part of this region.
if CLOSE_TOKEN_RE.search(re.sub(r"[\\'\"]", "", EXEC_REGION)):
    for _c in commands:
        if _c[0] in ("wrapper", "dynamic"):
            emit("BLOCKED: this command line contains a cmux close subcommand AND `%s`, "
                 "which can execute a string it is given (via an argument, a pipe, a "
                 "heredoc, an -exec, or an executable the guard cannot resolve). The guard "
                 "cannot follow a close routed through it, so it cannot prove which pane "
                 "would die. Run the close on its own, directly. %s"
                 % (_c[1] or "an unresolvable command", COOPERATIVE))

close_cmds = []       # cmux invocations whose subcommand is a close
for kind, name, env, args, args_dyn, had_prefix in commands:
    if kind == "cmux":
        sub, rest = subcommand_of(args)
        if sub in CLOSE_SUBS:
            close_cmds.append((sub, rest, env))
            continue
        # A generated subcommand: `cmux "$(printf close-surface)" --surface surface:23`.
        # The word is not the literal token, so subcommand matching never sees a close.
        if any(args_dyn):
            emit("BLOCKED: a cmux command carries an argument the guard cannot resolve "
                 "(a substitution or variable), so it cannot tell whether the subcommand "
                 "is a close. Spell the command out literally. %s" % COOPERATIVE)
        # Our flag-value heuristic did not land on the close subcommand, yet a close
        # subcommand is sitting right there in the args: a boolean global flag
        # (`cmux --no-focus close-surface ...`) desynced the two. Reading the docs
        # (`cmux help close-surface`) is the one benign shape.
        if any(a in CLOSE_SUBS for a in args) and sub not in ("help", "docs"):
            emit("BLOCKED: this looks like a cmux close but the guard cannot reliably "
                 "identify the subcommand (an unrecognised global flag is in the way), so "
                 "it cannot verify what it would close. Run the close with no global flags "
                 "in front of the subcommand. %s" % COOPERATIVE)
        continue

    # (wrapper and dynamic commands never reach here - the coarse rule above took them.)

    # The executable ITSELF named after a close subcommand: an alias, a shell function,
    # or a wrapper script. We cannot see through any of them.
    if kind == "other" and CLOSE_TOKEN_RE.search(name):
        emit("BLOCKED: `%s` is being run as a command. The guard can only verify a close it "
             "can read - a direct `cmux <close-subcommand>` - not an alias, function, or "
             "wrapper script standing in for one. %s" % (name, COOPERATIVE))

    # A command prefix (sudo/env/timeout) whose executable we could not resolve, in a
    # command that carries a close subcommand: an option operand we do not know about
    # shifted the executable out from under us. Do not guess.
    if kind == "other" and had_prefix and any(CLOSE_TOKEN_RE.search(a) for a in args):
        emit("BLOCKED: a cmux close subcommand appears behind a command prefix whose "
             "executable the guard could not resolve (`%s`). It cannot verify what would "
             "close. Run the close directly. %s" % (name or "?", COOPERATIVE))

    # kind == "other" otherwise (echo, grep, a quoted commit message): the token is an
    # argument, i.e. data. Allowed.

if not close_cmds:
    emit()


# ---------------------------------------------------------------------------
# cmux introspection. No cmux, no proof, no close.
# ---------------------------------------------------------------------------
def find_cmux():
    for cand in (os.environ.get("CMUX_CLOSE_GUARD_CMUX"),
                 shutil.which("cmux"),
                 os.path.expanduser("~/.claude/cmux/cmux"),
                 "/Applications/cmux.app/Contents/Resources/bin/cmux"):
        if cand and os.path.isfile(cand) and os.access(cand, os.X_OK):
            return cand
    return None


CMUX = find_cmux()
if not CMUX:
    emit("BLOCKED: cannot verify this close - the cmux CLI is not resolvable, so the "
         "guard cannot check whether the target pane is backed by a live agent. "
         + COOPERATIVE)


def cmux_run(args, timeout=6):
    try:
        p = subprocess.run([CMUX] + args, capture_output=True, text=True, timeout=timeout)
    except Exception:
        return None
    return (p.stdout or "") if p.returncode == 0 else None


panels_txt = cmux_run(["list-panels", "--id-format", "both"])
top_txt = cmux_run(["top", "--all", "--processes", "--format", "tsv"])
if panels_txt is None or top_txt is None:
    emit("BLOCKED: cannot verify this close - cmux did not answer an introspection query "
         "(list-panels / top), so the guard cannot prove the target pane's process is "
         "dead. " + COOPERATIVE)

surface_by_key = {}
for line in panels_txt.splitlines():
    m = re.search(r"\b(surface:(\d+))\b(?:\s+([0-9A-Fa-f-]{36}))?", line)
    if not m:
        continue
    ref, num, uuid = m.group(1), m.group(2), m.group(3)
    surface_by_key[ref] = ref
    surface_by_key[num] = ref
    if uuid:
        surface_by_key[uuid.lower()] = ref


def resolve_surface(value):
    if not value:
        return None
    v = value.strip()
    return surface_by_key.get(v) or surface_by_key.get(v.lower())


# `cmux top --processes --format tsv` rows: cpu, mem, count, kind, id, parent, name.
# Parse STRICTLY: a row shape we do not recognise means the format drifted, and a
# guard reading drifted output cannot claim a pane is dead.
REF_PARENT = re.compile(r"^(surface|pane|workspace|window|tag|total)[:\w.-]*$")
proc_name, kids, surface_roots = {}, {}, {}
surfaces_in_top = set()
attributed_to_a_surface = False
parse_ok = True

for line in top_txt.splitlines():
    if not line.strip():
        continue
    f = line.split("\t")
    if len(f) < 7:
        parse_ok = False
        break
    kind, ident, parent, name = f[3], f[4], f[5], f[6].strip()
    if kind == "surface":
        surfaces_in_top.add(ident)
        continue
    if kind != "process":
        continue
    try:
        pid = int(ident)
    except ValueError:
        parse_ok = False
        break
    proc_name[pid] = name
    if parent.startswith("surface:"):
        surface_roots.setdefault(parent, []).append(pid)
        attributed_to_a_surface = True
        continue
    try:
        kids.setdefault(int(parent), []).append(pid)
        continue
    except ValueError:
        pass
    if not REF_PARENT.match(parent):
        parse_ok = False           # unknown parent shape: do not guess
        break
    # a known roll-up ref (tag/pane/workspace): the same pid is also reported
    # under its surface, so ignoring the duplicate row is safe.

if not parse_ok or not attributed_to_a_surface:
    emit("BLOCKED: cmux process output is not in the shape this guard understands, so it "
         "cannot map panes to their backing processes and cannot prove the target is "
         "dead. Fix the guard's parser before force-closing anything. " + COOPERATIVE)


def subtree(surface):
    seen, stack, out = set(), list(surface_roots.get(surface, [])), []
    while stack:
        pid = stack.pop()
        if pid in seen:
            continue
        seen.add(pid)
        out.append(pid)
        stack.extend(kids.get(pid, []))
    return out


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except Exception:
        return True
    return True


# ps truncates names ("mcp-server-darw"), so match on prefixes.
AGENT_RE = re.compile(r"^(claude|codex|opencode|aider|gemini|amp|cursor-agent|goose|crush|omc|omx|omo)", re.I)
PROTECTED_RE = re.compile(r"justify", re.I)
IDLE_RE = re.compile(r"^-?(zsh|bash|sh|dash|fish|ksh|login|sleep|tmux|screen|cmux)$", re.I)


def classify_surface(surface):
    """-> (state, detail). state: agent | protected | busy | idle | unknown"""
    if surface not in surfaces_in_top:
        return "unknown", ""       # cmux told us nothing about it: cannot prove dead
    busy = None
    for pid in subtree(surface):
        if not alive(pid):
            continue
        name = proc_name.get(pid, "")
        if PROTECTED_RE.search(name):
            return "protected", "%s pid %d" % (name, pid)
        if AGENT_RE.search(name):
            return "agent", "%s pid %d" % (name, pid)
        if IDLE_RE.match(name):
            continue
        if busy is None:
            busy = "%s pid %d" % (name, pid)
    return ("busy", busy) if busy else ("idle", "")


# ---------------------------------------------------------------------------
# Ownership. Positive identification only, scoped to THIS invocation - a token
# sitting on some other command in the same line proves nothing about this one.
# ---------------------------------------------------------------------------
def ledger_values():
    key = re.sub(r"[^A-Za-z0-9._-]", "_", str(payload.get("session_id") or "")) or "global"
    out = set()
    try:
        with open(os.path.expanduser("~/.claude/.cmux-owned-surfaces." + key)) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    out.add(line)
                    r = resolve_surface(line)
                    if r:
                        out.add(r)
    except Exception:
        pass
    return out


LEDGER = ledger_values()


def owned(ref, env_assignments):
    if ref in LEDGER:
        return True
    claimed = set()
    for a in env_assignments:
        k, _, v = a.partition("=")
        if k != "CMUX_CLOSE_CONFIRM":
            continue
        for part in re.split(r"[,\s]+", v):
            part = part.strip()
            if not part:
                continue
            claimed.add(part)
            r = resolve_surface(part)
            if r:
                claimed.add(r)
    return ref in claimed


# ---------------------------------------------------------------------------
# Resolve targets and decide.
# ---------------------------------------------------------------------------
tree_state = {}


def load_tree():
    if tree_state:
        return tree_state
    txt = cmux_run(["tree", "--all"]) or ""
    ws_surfaces, win_workspaces = {}, {}
    cur_win = cur_ws = None
    for line in txt.splitlines():
        mw = re.search(r"\bwindow (window:\d+)", line)
        if mw:
            cur_win = mw.group(1)
            win_workspaces.setdefault(cur_win, [])
            continue
        mws = re.search(r"\bworkspace (workspace:\d+)", line)
        if mws:
            cur_ws = mws.group(1)
            ws_surfaces.setdefault(cur_ws, [])
            if cur_win:
                win_workspaces.setdefault(cur_win, []).append(cur_ws)
            continue
        ms = re.search(r"\bsurface (surface:\d+)", line)
        if ms and cur_ws:
            ws_surfaces.setdefault(cur_ws, []).append(ms.group(1))
    # A workspace/window close is only as safe as the member list behind it. If the
    # tree does not account for every surface cmux reports, a live pane could be
    # sitting in the gap - so refuse rather than check an incomplete set.
    seen = set()
    for surfs in ws_surfaces.values():
        seen.update(surfs)
    if seen != surfaces_in_top:
        emit("BLOCKED: cmux's pane tree does not account for every surface cmux reports "
             "(%d in the tree, %d with process data), so the guard cannot enumerate what "
             "this close would take down. Close the panes one at a time by surface. %s"
             % (len(seen), len(surfaces_in_top), COOPERATIVE))
    tree_state["ws"] = ws_surfaces
    tree_state["win"] = win_workspaces
    return tree_state


for sub, args, env in close_cmds:
    if sub in ("close-surface", "close-panel", "close-pane"):
        raws = flag_values(args, "surface", "panel", "pane")
        if not raws:
            emit("BLOCKED: %s was called without an explicit --surface target, so it would "
                 "close whatever pane happens to be current and the guard cannot identify "
                 "what that is. Name the surface. %s" % (sub, COOPERATIVE))
        groups = []
        for raw_v in raws:
            ref = resolve_surface(raw_v)
            if not ref:
                emit("BLOCKED: cannot resolve '%s' to a live cmux surface, so the guard cannot "
                     "prove what it would close or whether that pane is running an agent. Run "
                     "'cmux list-panels' and name an existing surface. %s" % (raw_v, COOPERATIVE))
            groups.append((ref, [ref]))

    elif sub == "close-workspace":
        raws = flag_values(args, "workspace")
        if not raws:
            emit("BLOCKED: close-workspace was called without an explicit --workspace target. "
                 "It would close every pane in whatever workspace is current. " + COOPERATIVE)
        tree = load_tree()
        groups = []
        for raw_v in raws:
            ref = raw_v if raw_v.startswith("workspace:") else "workspace:" + raw_v.strip()
            members = tree["ws"].get(ref)
            if not members:
                emit("BLOCKED: cannot resolve '%s' to a cmux workspace with known panes, so the "
                     "guard cannot prove which panes it would close. %s" % (raw_v, COOPERATIVE))
            groups.append((ref, members))

    elif sub == "close-window":
        raws = flag_values(args, "window")
        if not raws:
            emit("BLOCKED: close-window was called without an explicit --window target. It would "
                 "close every pane in whatever window is current. " + COOPERATIVE)
        tree = load_tree()
        groups = []
        for raw_v in raws:
            ref = raw_v if raw_v.startswith("window:") else "window:" + raw_v.strip()
            members = []
            for ws in tree["win"].get(ref, []):
                members.extend(tree["ws"].get(ws, []))
            if not members:
                emit("BLOCKED: cannot resolve '%s' to a cmux window with known panes, so the guard "
                     "cannot prove which panes it would close. %s" % (raw_v, COOPERATIVE))
            groups.append((ref, members))
    else:
        continue

    for container, members in groups:
        # (a) LIVENESS - hard gate, no override. A live process is never a leftover.
        for surf in members:
            state, detail = classify_surface(surf)
            if state == "unknown":
                emit("BLOCKED: cmux reports no process data for %s, so the guard cannot prove "
                     "that pane is dead. %s" % (surf, COOPERATIVE))
            if state in ("agent", "protected"):
                what = ("a LIVE agent process (%s)" % detail if state == "agent"
                        else "a LIVE protected process (%s) - that is the user's Justify worker "
                             "or daemon" % detail)
                emit("BLOCKED: %s is backed by %s. A live process is NOT a leftover to clean up - "
                     "it is a running agent, and closing its surface kills it and whatever queued "
                     "work it holds. There is no override for a live pane. %s"
                     % (surf, what, COOPERATIVE))
            if state == "busy":
                emit("BLOCKED: %s is running a live process (%s), so it is not an empty leftover "
                     "pane. Confirm that process is meant to die before closing its surface. %s"
                     % (surf, detail, COOPERATIVE))

        # (b) OWNERSHIP - positive identification, never by elimination.
        if not owned(container, env):
            emit("BLOCKED: %s has no live process, but this command does not positively identify "
                 "it as a pane THIS session spawned. If you are certain you spawned it AND its "
                 "process is dead, assert that identity on the command itself: "
                 "CMUX_CLOSE_CONFIRM=%s cmux %s ... (or list it in "
                 "~/.claude/.cmux-owned-surfaces.<session_id>). Naming the target is the point - "
                 "it forces identification instead of a guess. %s"
                 % (container, container, sub, COOPERATIVE))

emit()
PYEOF
