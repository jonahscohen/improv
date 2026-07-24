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
# DENY IS THE DEFAULT once cmux can be seen. Everything the guard cannot prove, it
# blocks: an unresolvable surface, no explicit target, an unparseable command, or a
# close hidden inside `bash -c` / `eval` / a command substitution. A guard that
# falls through to allow on anything it fails to understand is a guard the next
# unparsed command walks straight past - which is exactly how the incident happened.
#
# That stays true even when cmux ITSELF cannot be seen (2026-07-23). Three drafts
# tried to fail-SOFT there - allow when cmux looks absent, unreachable or drifted -
# and independent review broke each one: a close subcommand keeps working while
# introspection is down, a bare name can resolve for the shell but not for this hook,
# and a missing path can be created by an earlier command on the same line. What
# changed is the REMEDY, not the verdict: an unintrospectable cmux still denies, but
# the denial offers CMUX_CLOSE_UNVERIFIED, an explicit per-target break-glass, so
# getting unstuck no longer means restarting cmux. See the introspection section.
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


def warn(msg):
    # Loud-but-non-blocking notice. Goes to stderr (surfaces in the hook log /
    # transcript) and never touches the stdout decision, so an unverified close taken
    # on a caller's explicit break-glass is announced without the warning itself
    # changing any permission outcome - the same posture as the beats provenance lint,
    # where a warning never blocks.
    sys.stderr.write("cmux-close-guard: " + msg + "\n")


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
            j, buf, live = i + 1, [], []
            while j < n:
                if s[j] == "\\" and j + 1 < n:
                    buf.append(s[j + 1])
                    # An ESCAPED $ or backtick is literal text, not an expansion. The
                    # escape used to be collapsed into the same buffer the dynamism test
                    # read, so "\$(cmux close-surface ...)" - inert prose in a doc, a beat,
                    # or a review prompt - looked like a live substitution. Track escaped
                    # positions separately so only real expansions mark a word dynamic.
                    live.append("\x00")
                    j += 2
                    continue
                if s[j] == '"':
                    break
                buf.append(s[j])
                live.append(s[j])
                j += 1
            chunk = "".join(buf)
            # Expansions inside double quotes still expand: "$CMUX" runs cmux.
            if re.search(r"\$[({\w]|`", "".join(live)):
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
# `+?` covers bash's append form. Without it `PATH+=:/tmp/cbin cmux close-surface` was
# not recognised as an env PREFIX at all, so the executable resolved to the assignment
# word instead of to cmux, no close was parsed, and the line fell through ALLOWED -
# closing the current pane with no target verification. (Codex, 9th pass.)
ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\+?=")

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
    """-> (kind, exec_name, env, args, args_dyn, had_prefix).

    kind: cmux|wrapper|dynamic|other. args_dyn parallels args, flagging each word the
    tokenizer could not resolve to a literal.
    """
    env, idx, had_prefix, env_dyn = [], 0, False, False
    while idx < len(words):
        w, dynamic = words[idx]
        if ENV_ASSIGN.match(w):
            env.append(w)
            # An assignment whose VALUE is a substitution EXECUTES that substitution:
            # `out=$(cmux close-surface --surface surface:23)` runs the close before the
            # assignment ever happens. Swallowed as inert env, it yielded no parsed close
            # and the line was allowed outright - and capturing output this way is an
            # everyday shell shape, not an exotic one. Remembering the dynamism lets the
            # coarse rule below deny it. (Codex, 10th pass.)
            if dynamic:
                env_dyn = True
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
        return ("dynamic" if env_dyn else "other"), "", env, [], [], had_prefix
    w, dynamic = words[idx]
    args = [x[0] for x in words[idx + 1:]]
    args_dyn = [x[1] for x in words[idx + 1:]]
    if dynamic or env_dyn:
        return "dynamic", w, env, args, args_dyn, had_prefix
    base = os.path.basename(w)
    if base == "cmux":
        # Return the FULL word, not the basename. `/opt/cmux/bin/cmux` and `./cmux`
        # are cmux invocations whose PATH matters: absence has to be judged against
        # the binary the command actually names, not against the guard's own search
        # list, or an out-of-tree cmux reads as "absent" and sails through.
        return "cmux", w, env, args, args_dyn, had_prefix
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
        # A DYNAMIC WORD carrying a close subcommand is a substitution, and a
        # substitution RUNS its contents - it does not matter which command it is
        # attached to, or that the command itself is harmless:
        #     echo $(cmux close-surface --surface surface:23)
        #     export out=$(cmux close-surface --surface surface:23)
        # bash executes the close before echo/export ever runs. Only `cmux` commands
        # consulted args_dyn before, so a substitution hanging off any OTHER command
        # was never examined and the line was allowed. (Codex, 11th pass.)
        for _word, _is_dyn in zip(_c[3], _c[4]):
            if _is_dyn and CLOSE_TOKEN_RE.search(re.sub(r"[\\'\"]", "", _word)):
                emit("BLOCKED: this command line carries a cmux close subcommand inside a "
                     "substitution (`%s`), which the shell EXECUTES before the surrounding "
                     "command runs. The guard cannot prove which pane that would close. Run "
                     "the close on its own, directly. %s"
                     % (_word[:60], COOPERATIVE))

close_cmds = []       # cmux invocations whose subcommand is a close
for kind, name, env, args, args_dyn, had_prefix in commands:
    if kind == "cmux":
        sub, rest = subcommand_of(args)
        if sub in CLOSE_SUBS:
            # A close whose ARGS are not fully literal cannot be verified, even though
            # its subcommand parsed cleanly. The flags are repeatable and last-value
            # -wins, so a second target can expand in at run time:
            #   cmux close-surface --surface surface:40 "$(printf -- '--surface')" surface:23
            # The guard would prove the dead surface:40 and cmux would close the LIVE
            # surface:23. The dynamic-arg check below used to sit only on the
            # NOT-a-close branch, so a parsed close skipped it entirely. (Codex, 4th pass.)
            if any(args_dyn):
                emit("BLOCKED: this cmux close carries an argument the guard cannot resolve "
                     "(a substitution or variable), so it cannot tell which surface would "
                     "actually be closed - another --surface can expand in at run time and "
                     "close a different pane than the one verified. Spell the close out "
                     "literally. " + COOPERATIVE)
            close_cmds.append((sub, rest, env, name))
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

    # A binary the guard cannot identify as cmux, run with a close subcommand AND a
    # cmux pane-target flag: a renamed or copied cmux.
    #     install -m 755 "$(command -v cmux)" /tmp/cmux-x
    #     /tmp/cmux-x close-surface --surface surface:23
    # Classification matches on basename == "cmux", so `cmux-x` was "other", the close
    # token counted as inert data, and the line was allowed outright. (Codex, 4th pass.)
    #
    # Requiring a --surface/--panel/--pane/--workspace/--window target ALONGSIDE the
    # close token is what keeps ordinary tooling out of this branch: `grep
    # close-surface docs/`, `rg close-surface claude/hooks` and `echo close-surface`
    # carry no such flag. A first draft keyed on "the first non-flag argument is a
    # close subcommand", which applied cmux's own subcommand grammar to every
    # executable and denied all three of those - blocking ordinary work on a hook that
    # runs on EVERY Bash call. (Codex, 5th pass.) Scanning every arg rather than just
    # the subcommand slot also covers a boolean global flag in front of the
    # subcommand: `/tmp/cmux-x --no-focus close-surface --surface surface:23`.
    # The cmux-in-the-name clause catches the no-target shape `/tmp/cmux-x
    # close-surface` (which the real cmux would answer by closing the CURRENT pane),
    # without widening the rule to executables that have nothing to do with cmux.
    if kind == "other" and any(a in CLOSE_SUBS for a in args) and \
            (flag_values(args, "surface", "panel", "pane", "workspace", "window")
             or "cmux" in os.path.basename(name or "").lower()):
        emit("BLOCKED: `%s` is being run with a cmux close subcommand. The guard can only "
             "verify a close made through a binary it can identify as cmux - not a renamed "
             "or copied one, which it cannot introspect and will not execute. Run the close "
             "through `cmux`. %s" % (name or "?", COOPERATIVE))

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

# A close whose runtime executable could differ from the one this guard introspects.
# The guard proves a pane is safe using the cmux IT resolves; that proof only transfers
# if the shell resolves the same binary. Anything on the line that remaps command
# resolution breaks the transfer, and the guard would prove one binary's view of the
# panes while a different binary does the closing. Three shapes, all refused:
#     PATH=/tmp/cbin:$PATH cmux close-surface ...     (env prefix)
#     PATH=/tmp/cbin:$PATH; cmux close-surface ...    (bare assignment; also env)
#     export PATH=/tmp/cbin:$PATH; cmux close-surface ...   (export/declare/set form)
#     hash -p /tmp/cmux-x cmux; cmux close-surface ...      (hash/alias remap)
# (Codex, 5th and 6th passes - the export and hash forms were missed by a first draft
# that only scanned parsed env-prefix assignments.)
PATH_MUTATORS = {"export", "declare", "typeset", "set"}
REMAPPERS = {"hash", "alias", "unalias", "enable"}


def assigns_path(word):
    # Both `PATH=...` and bash's append form `PATH+=...`. Matching only on "PATH="
    # missed `export PATH+=:/tmp/cbin`, which appends a directory just as effectively.
    # (Codex, 8th pass.)
    return word.startswith("PATH=") or word.startswith("PATH+=")


for _k, _n, _env, _a, _ad, _hp in commands:
    _base = os.path.basename(_n or "")
    if any(assigns_path(x) for x in _env) or \
            (_base in PATH_MUTATORS and any(assigns_path(x) for x in _a)):
        emit("BLOCKED: this command line changes PATH and runs a cmux close. The guard "
             "resolves cmux using its own PATH, so it cannot prove the binary that would "
             "actually run is the one it inspected. Run the close without changing PATH. "
             + COOPERATIVE)
    if _base in REMAPPERS:
        emit("BLOCKED: this command line remaps command resolution (`%s`) and runs a cmux "
             "close, so the guard cannot prove the `cmux` it inspected is the one the "
             "shell would run. Run the close on its own. %s" % (_base, COOPERATIVE))


# ---------------------------------------------------------------------------
# cmux introspection: the UNINTROSPECTABLE case (2026-07-23).
#
# The guard used to deny on EVERY uncertainty, including uncertainty about cmux
# ITSELF, so an unavailable or drifted CLI blocked closes until the user restarted
# cmux - costly, and it interrupts the very work the restart is meant to protect.
#
# The fix is NOT a fail-soft. Three drafts tried one (allow when cmux looks absent,
# unreachable, or drifted) and independent Codex review broke every version: a close
# subcommand keeps working while introspection is broken; a bare name resolves
# differently for the shell than for this hook; and a missing path can be created by
# an earlier command on the same line. There is no state in which "the guard cannot
# see cmux" reliably implies "the close cannot kill a pane", so the guard no longer
# tries to infer one. What changed instead is the REMEDY:
#
#   When cmux cannot be introspected - list-panels/top error, time out, come back
#   empty, or arrive in a shape this parser does not recognise - the close is still
#   DENIED, but the denial now carries CMUX_CLOSE_UNVERIFIED: an explicit, per-target
#   break-glass the caller asserts on the same command after checking the pane by
#   hand. That turns "restart cmux and lose your session" into one named, warned, and
#   logged assertion, without ever making an unverified close the default.
#
#   The break-glass is scoped exactly to what is unverifiable. list-panels/top are
#   needed by EVERY close, so their failure needs every close on the line to be
#   asserted. The pane tree is needed only by workspace/window closes, so a tree
#   outage clears only the close that asserted it - a surface close later on the same
#   line is still fully liveness-checked (an earlier draft leaked a whole-line allow
#   here, which re-opened the 2026-07-12 incident; caught by the second Codex pass).
#
# Introspection ALWAYS runs the binary find_cmux() resolves, never one the command
# supplied, so a close can never be cleared by state a caller-provided binary
# reported - and the guard never execs an unverified binary from a pre-exec hook.
# For that proof to transfer to the command, the command has to resolve cmux the same
# way this hook does, which is why a path-named executable and a PATH reassignment are
# both refused above. What remains outside the guard's reach is shell state it cannot
# see from a command string - an alias, a shell function, or a `hash -p` override
# installed in an earlier tool call. Those are deliberate redirections, not the
# accidental teardown this guard is built to stop.
# ---------------------------------------------------------------------------
OVERRIDE = os.environ.get("CMUX_CLOSE_GUARD_CMUX")


def find_cmux():
    # CMUX_CLOSE_GUARD_CMUX is a test/override seam. When set it is AUTHORITATIVE:
    # resolve it or treat cmux as ABSENT - do NOT fall through to the real app.
    # Falling through made tests non-hermetic (a stub-path typo silently drove the
    # live cmux session) and defeated the override's purpose.
    if OVERRIDE:
        if os.path.isfile(OVERRIDE) and os.access(OVERRIDE, os.X_OK):
            return OVERRIDE
        warn("CMUX_CLOSE_GUARD_CMUX is set to '%s', which is not an executable file - "
             "treating cmux as absent. Unset it to restore normal resolution."
             % OVERRIDE)
        return None
    for cand in (shutil.which("cmux"),
                 os.path.expanduser("~/.claude/cmux/cmux"),
                 "/Applications/cmux.app/Contents/Resources/bin/cmux"):
        if cand and os.path.isfile(cand) and os.access(cand, os.X_OK):
            return cand
    return None


def names_explicit_path(exe):
    """Does this close name its executable by PATH rather than by bare name?"""
    return bool(exe) and ("/" in exe or exe.startswith("~"))


if any(names_explicit_path(e) for (_s, _a, _v, e) in close_cmds):
    # A path-named executable is refused outright, in BOTH directions:
    #
    #  - it EXISTS: the guard will not exec an unverified binary from a
    #    pre-execution hook merely to introspect it. Its "read-only" subcommands
    #    could do anything, including closing a pane before the guard has decided.
    #    It is also never allowed to become the introspection source, so a caller
    #    cannot hand the guard a binary that reports whatever clears the close.
    #  - it does NOT exist: tempting to allow ("it cannot run"), but that is a
    #    TOCTOU. An earlier command on the same line can create it:
    #        install -m 755 <real cmux> /tmp/cmux-x; /tmp/cmux-x close-surface ...
    #    is absent at hook time and fully functional at execution time. Same class
    #    covers a broken symlink whose target appears, or a chmod +x in between.
    #    (Codex third pass. An earlier draft allowed exactly this.)
    emit("BLOCKED: this close names its executable by path rather than running the "
         "installed `cmux`. The guard will not execute an unverified binary to check "
         "the pane, and it cannot trust that a path missing now will still be missing "
         "when the command runs. Run the close through `cmux` on PATH so the pane can "
         "be verified first. " + COOPERATIVE)

for _sub, _args, _env, _exe in close_cmds:
    if "--" in _args:
        # End-of-options. Past it, cmux's own parser stops reading --surface as a
        # flag, so `cmux close-surface -- --surface surface:40` may close something
        # else entirely while the guard "proved" surface:40 safe. The guard cannot
        # model another program's option parser, so it refuses the shape.
        emit("BLOCKED: this close contains a `--` end-of-options separator, so the "
             "guard cannot tell which target cmux's own parser would actually use - "
             "it could verify one pane and close another. Spell the close out without "
             "`--`. " + COOPERATIVE)

CMUX = find_cmux()


def cmux_run(args, timeout=6):
    try:
        p = subprocess.run([CMUX] + args, capture_output=True, text=True, timeout=timeout)
    except Exception:
        return None
    return (p.stdout or "") if p.returncode == 0 else None


def target_values(sub, args):
    """The raw --surface/--workspace/--window values this close names."""
    if sub in ("close-surface", "close-panel", "close-pane"):
        return flag_values(args, "surface", "panel", "pane")
    if sub == "close-workspace":
        return flag_values(args, "workspace")
    if sub == "close-window":
        return flag_values(args, "window")
    return []


def breakglass_for(sub, args, env):
    """Does THIS close carry CMUX_CLOSE_UNVERIFIED naming every one of its targets?

    Deliberately per-target and deliberately not a boolean: a truthy flag would be
    pasted once and forgotten, while naming the surface forces the same positive
    identification the ownership gate demands. Scoped to one command, so a token on
    a different command in the same line proves nothing about this one.
    """
    raws = target_values(sub, args)
    if not raws:
        return False                  # no explicit target: nothing named, nothing to trust
    claimed = set()
    for a in env:
        k, _, v = a.partition("=")
        if k != "CMUX_CLOSE_UNVERIFIED":
            continue
        for part in re.split(r"[,\s]+", v):
            if part.strip():
                claimed.add(part.strip())
    if not claimed:
        return False
    return all(r.strip() in claimed for r in raws)


def breakglass_all():
    """Every close on the line is individually break-glassed.

    Required before a WHOLE-LINE allow, which is the only thing this hook can emit.
    """
    return bool(close_cmds) and all(breakglass_for(s, a, e) for s, a, e, _x in close_cmds)


def unintrospectable(what):
    """cmux RESOLVED but did not answer usefully -> fail-CLOSED, with a break-glass.

    Only for a cmux the guard could actually locate and run. The "cannot resolve cmux
    at all" case is a hard deny handled above: the break-glass asserts "I checked this
    pane", and with no reachable cmux there is nothing for that assertion to attach to.

    Denying is the safe default because a close subcommand can keep working while the
    introspection subcommands are broken, so the break-glass exists to make the remedy
    something other than "restart cmux and lose your session".

    Only for failures that make EVERY close unverifiable (list-panels/top). A failure
    that blocks just one close - the pane tree, which only workspace/window closes
    need - must NOT come through here: allowing the whole line on that basis would
    wave through surface closes whose liveness is still perfectly checkable.
    """
    if breakglass_all():
        warn("%s - proceeding UNVERIFIED because every close on this line carries a "
             "CMUX_CLOSE_UNVERIFIED assertion naming its own target. The live-pane "
             "check did NOT run; this was taken on the caller's assertion alone." % what)
        emit()
    emit("BLOCKED: %s, so the guard cannot prove the target pane is dead - and a close "
         "can still succeed while introspection is broken, so this is not safe to wave "
         "through. Restarting cmux restores the check. If you cannot restart, verify "
         "the pane yourself (the cmux UI, or `ps` against its process) and then assert "
         "it per-target on the same command: CMUX_CLOSE_UNVERIFIED=<target> cmux "
         "<close-subcommand> --... %s" % (what, COOPERATIVE))


if not CMUX:
    # A bare `cmux` that resolves nowhere the guard can see. NOT treated as absent:
    # the shell that runs the command may resolve it anyway (a different PATH than this
    # hook inherited, a profile entry, a shell function), so "I cannot find it" is not
    # proof it will not run.
    #
    # Deliberately NOT break-glassable, unlike the paths below. CMUX_CLOSE_UNVERIFIED
    # means "I checked this pane by hand"; with no reachable cmux the guard cannot
    # confirm the asserted pane exists at all, so the assertion has nothing to attach
    # to. It is also not the failure this change exists to relieve: the remedy here is
    # a one-time resolution fix, not a per-session cmux restart. (Codex, 7th pass -
    # unintrospectable() was reached from here, which let the break-glass cover it.)
    emit("BLOCKED: the cmux CLI is not resolvable from this hook, so the guard cannot "
         "check whether the target pane is backed by a live agent - and a bare name can "
         "still resolve for the shell that runs the command, so this is not safe to wave "
         "through. CMUX_CLOSE_UNVERIFIED does not apply here. Make cmux resolvable (it is "
         "normally on PATH, at ~/.claude/cmux/cmux, or inside cmux.app) and re-run. "
         + COOPERATIVE)


panels_txt = cmux_run(["list-panels", "--id-format", "both"])
top_txt = cmux_run(["top", "--all", "--processes", "--format", "tsv"])
if panels_txt is None or top_txt is None:
    # TRANSIENT: cmux is installed but its CLI did not answer (non-zero exit, a
    # timeout, or a crash). The close subcommand may still work, so this is not safe
    # to wave through.
    unintrospectable("cmux did not answer an introspection query (list-panels/top)")
if not panels_txt.strip() or not top_txt.strip():
    # EMPTY: cmux answered but reported no panels or no process data. The asymmetric
    # shape is the dangerous one - list-panels naming surface:23 while `top` comes
    # back empty means the pane demonstrably EXISTS and its liveness is simply
    # unknown, which is the least safe moment to allow a close.
    unintrospectable("cmux returned empty list-panels/top output")

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
    # DRIFT: cmux answered, but `top` is not in the shape this guard parses - a schema
    # change after a cmux auto-update, or a partial/garbled response. This is the
    # WORST case to fail-soft on: cmux is provably healthy (it answered), so the close
    # subcommand is almost certainly still fully functional. Deny, with the
    # break-glass as the no-restart escape hatch.
    unintrospectable("cmux process output is not in the shape this guard understands "
                     "(schema drift after a cmux update, or a partial response)")


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
tree_unavailable = [False]     # memo: do not re-query a tree already known silent


def load_tree(sub, args, env):
    """The pane tree, or None when it is unavailable AND this close break-glasses it.

    Returning None (rather than emitting a whole-line allow) is load-bearing. Only
    workspace/window closes need the tree, so a tree outage leaves surface closes
    fully verifiable. An earlier draft emitted allow straight from here, which meant
        CMUX_CLOSE_UNVERIFIED=workspace:2 cmux close-workspace --workspace workspace:2; \\
        CMUX_CLOSE_UNVERIFIED=surface:23 cmux close-surface  --surface  surface:23
    cleared the LIVE surface:23 without ever running the liveness check - the exact
    2026-07-12 incident, reintroduced. Caught by the second Codex pass. The caller
    now skips member enumeration for THIS close only and keeps checking the rest.
    """
    if tree_state:
        return tree_state
    txt = None if tree_unavailable[0] else cmux_run(["tree", "--all"])
    if txt is None or not txt.strip():
        tree_unavailable[0] = True
        if breakglass_for(sub, args, env):
            warn("cmux `tree` did not answer - %s taken UNVERIFIED on this command's "
                 "own CMUX_CLOSE_UNVERIFIED assertion. Every other close on the line "
                 "is still checked normally." % sub)
            return None
        emit("BLOCKED: cmux `tree` did not answer, so the panes inside this "
             "workspace/window cannot be enumerated and the guard cannot tell what "
             "the close would take down. Restarting cmux restores the check. If you "
             "cannot restart, close the panes one at a time by surface, or verify "
             "this container yourself and assert it on the same command: "
             "CMUX_CLOSE_UNVERIFIED=%s cmux %s ... %s"
             % ((target_values(sub, args) or ["<target>"])[0], sub, COOPERATIVE))
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


for sub, args, env, _exe in close_cmds:
    if sub in ("close-surface", "close-panel", "close-pane"):
        raws = target_values(sub, args)
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
        raws = target_values(sub, args)
        if not raws:
            emit("BLOCKED: close-workspace was called without an explicit --workspace target. "
                 "It would close every pane in whatever workspace is current. " + COOPERATIVE)
        tree = load_tree(sub, args, env)
        if tree is None:
            continue          # break-glassed by this command alone; others still checked
        groups = []
        for raw_v in raws:
            ref = raw_v if raw_v.startswith("workspace:") else "workspace:" + raw_v.strip()
            members = tree["ws"].get(ref)
            if not members:
                emit("BLOCKED: cannot resolve '%s' to a cmux workspace with known panes, so the "
                     "guard cannot prove which panes it would close. %s" % (raw_v, COOPERATIVE))
            groups.append((ref, members))

    elif sub == "close-window":
        raws = target_values(sub, args)
        if not raws:
            emit("BLOCKED: close-window was called without an explicit --window target. It would "
                 "close every pane in whatever window is current. " + COOPERATIVE)
        tree = load_tree(sub, args, env)
        if tree is None:
            continue          # break-glassed by this command alone; others still checked
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
