#!/bin/bash
# PreToolUse hook for Bash. Blocks commands matching forbidden patterns.
# Reads hook input JSON from stdin, emits permissionDecision JSON to stdout.

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

REASON=""

# ---------------------------------------------------------------------------
# CMD_CODE: the command with its DATA stripped out, leaving only what the shell
# will actually execute. Heredoc bodies and quoted spans are literal text handed
# to another program (a commit message, an echo arg, a Codex prompt, a beat body)
# - they are not commands. Every gate that means "the agent is RUNNING x" must
# match against CMD_CODE, not the raw command, or it blocks PROSE that merely
# names x.
#
# Anti-false-block precedent: T-0003 (the self-block of commit 50fc1b0), and the
# same root cause as memory-nudge.sh's T-0033 de-quoting fix. A hook that blocks
# people for TALKING about a command is a hook they learn to disable.
#
# This was previously computed inline for the justify-watch gate only. Hoisted so
# the commit gates below share ONE normalization - two copies drift, and a gate
# matching the raw string is exactly the bug this exists to prevent.
#
# Stripping quotes naively would swing the error the OTHER way: a quoted string is
# data UNLESS the shell executes it. `bash -c "git commit"`, `eval "git commit"`,
# `$(git commit)` and backticks all RUN their contents, quotes notwithstanding. So
# the normalizer re-emits those executed fragments as their own code lines rather
# than dropping them. Data stays data; code stays code.
CMD_CODE=$(printf '%s' "$CMD" | python3 -c '
import sys, re

s = sys.stdin.read()

def dequote(t):
    """Drop quoted spans - their contents are literal data, not commands."""
    t = re.sub(r"\x27[^\x27]*\x27", " ", t)   # single-quoted spans
    t = re.sub(r"\"[^\"]*\"", " ", t)          # double-quoted spans
    # Comments are not executed either (# at line start or after whitespace).
    # Runs after de-quoting, so a # inside a string is already gone.
    t = re.sub(r"(^|\s)#[^\n]*", r"\1 ", t, flags=re.M)
    return t

# 1. Splice backslash-newline continuations - the shell sees one line, so must we
#    (`git \<newline>commit` is a real commit).
s = re.sub(r"\\\n", " ", s)

# 2. Heredoc bodies are data handed to another program, not shell code. A QUOTED
#    delimiter (<<\x27EOF\x27) is fully literal. An UNQUOTED one still expands
#    $(...) / backticks, so keep those bodies aside for the substitution scan.
expanding = []
def _hd(m):
    if not m.group(1):          # unquoted delimiter -> expansions still run
        expanding.append(m.group(0))
    return " "
code = re.sub(r"<<-?\s*([\x27\"]?)(\w+)\1.*?^\2\s*$", _hd, s, flags=re.S | re.M)

# 3. Pull out fragments the shell EXECUTES even though they sit inside quotes:
#    command substitution, and the argument of eval / bash -c / sh -c / zsh -c.
executed = []
subst_src = code + "\n" + "\n".join(expanding)
executed += re.findall(r"\$\(([^()]*)\)", subst_src)
executed += re.findall(r"`([^`]*)`", subst_src)
executed += [m[1] for m in re.findall(r"\beval\s+([\x27\"])(.*?)\1", code, flags=re.S)]
executed += [m[1] for m in re.findall(
    r"\b(?:bash|sh|zsh|dash)\s+-[a-zA-Z]*c[a-zA-Z]*\s+([\x27\"])(.*?)\1", code, flags=re.S)]

# 4. Emit the de-quoted command, then each executed fragment on its own line so
#    the command-position anchor below sees the fragment start as a line start.
out = [dequote(code)]
out += [dequote(frag) for frag in executed]
print("\n".join(out))
' 2>/dev/null || printf '%s' "$CMD")

# True when the agent is actually RUNNING `git commit` - i.e. the words sit in
# COMMAND POSITION in the normalized command (start of a line, or after ; && || | (
# optionally behind a wrapper word, a VAR=val prefix, or git's own global options).
#
# The commit gates below (beats-dirty, browser-verification, unread-screenshot)
# used to grep the RAW command for 'git\s+commit'. That FALSE-BLOCKED any command
# that merely quoted the words: `echo "remember to git commit"`, a Codex prompt
# string, a heredoc writing a beat that documents the commit gate. Observed live
# 2026-07-12. Only a real invocation trips the gates now; prose passes.
#
# The wrapper list (env/command/exec/time/xargs/...) and the git-global-option
# list (-c, -C, --git-dir=, ...) exist because anchoring to command position is
# only safe if it recognises every shape a REAL commit arrives in. `git grep -i
# commit` deliberately does NOT match: the option loop consumes leading git
# options only, and `grep` is not one, so the literal `commit` never lines up.
_GIT_COMMIT_RE='(^|[;&|()]+)[[:space:]]*((sudo|env|command|exec|time|nice|nohup|xargs|then|do|else|elif)([[:space:]]+-[^[:space:]]+)*[[:space:]]+)*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*git[[:space:]]+((-[cC][[:space:]]+[^[:space:]]+|--(git-dir|work-tree|exec-path|namespace)=[^[:space:]]+|--no-pager|--paginate|-p)[[:space:]]+)*commit([[:space:]]|[;&|)]|$)'

is_real_git_commit() {
  printf '%s' "$CMD_CODE" | grep -qE "$_GIT_COMMIT_RE"
}

# ---------------------------------------------------------------------------
# command_slices <name-regex> [required-word]
#
# Emits (one per line) every real INVOCATION of a command, with its ARGUMENTS
# INTACT - quotes and all. This is the second half of the data-vs-code split, and
# the gates below need it because CMD_CODE alone would neuter them: CMD_CODE
# deletes quoted spans, but `pkill -f "Justify headless"` keeps the thing it kills
# INSIDE the quotes. Deleting the argument would leave a gate that blocks nothing.
#
# So: use CMD_CODE when only the command NAME matters (git commit,
# justify-watch-disarm). Use command_slices when the gate must read what the
# command ACTS ON (which process pkill targets, whether a cmux call is a
# screenshot or an eval).
#
# This generalizes the quote-aware scanner that the cmux-eval gate already had
# inline (the T-0003 anti-false-block work) - one scanner, three callers, rather
# than a third hand-rolled parser. It is strictly more careful than that original:
# the old one only checked the character before the match, so prose containing a
# semicolon inside quotes ("echo 'first; pkill justify'") looked like a command
# start. This tracks quote state across the whole string, so it cannot.
#
# What counts as executed, and therefore scannable:
#   - segments at real separators  ; && || | ( ) { } newline
#   - command substitutions $(...) and `...` - they run even inside double quotes
#   - the payload of `eval` / `bash -c` / `sh -c`, but ONLY when that segment's
#     head word actually IS eval/bash/sh (so `echo "bash -c 'pkill justify'"` is
#     prose, not an invocation)
#   - substitutions inside an UNQUOTED heredoc body (those still expand)
# What is data, and therefore ignored:
#   - heredoc bodies (a beat documenting these very commands)
#   - quoted strings that nobody executes (an echo, a Codex prompt, a grep pattern)
#
# ---------------------------------------------------------------------------
# redirect_targets  (SLICE_MODE=redirects)
#
# The same scanner, second output mode. The watch-state gate below has to catch
# `echo '{}' > ~/.justify/watch-state.json`, and a REDIRECT is not an invocation -
# its head word is `echo`, so command_slices can never see it. It is still code:
# the shell, not echo, opens that file.
#
# It cannot be done with a regex over CMD_CODE either. CMD_CODE deletes quoted
# spans, so a real `> "$HOME/.justify/watch-state.json"` would vanish and the gate
# would go quiet on it. And it cannot be a regex over the raw string, because that
# is the very false-block being fixed (`echo "never write > watch-state.json"`).
# The distinction is quote STATE - a `>` inside quotes is prose, a `>` outside them
# is an open() - and the walker already tracks exactly that. So the redirect is
# recorded during the walk it already does, rather than in a fourth parser that
# would drift out of step with this one.
_slice_scan() {
  SLICE_CMD="$CMD" SLICE_NAMES="$1" SLICE_REQUIRE="${2:-}" SLICE_MODE="${3:-slices}" \
    python3 <<'PYEOF' 2>/dev/null
import os, re

cmd     = os.environ.get("SLICE_CMD", "")
names   = os.environ.get("SLICE_NAMES", "")
require = os.environ.get("SLICE_REQUIRE", "")
mode    = os.environ.get("SLICE_MODE", "slices")

NAME_RE = re.compile(r"^(?:%s)$" % names)
# Words that can sit in front of the real command without changing what it is.
PREFIX = {"sudo", "env", "command", "exec", "time", "nice", "nohup", "xargs",
          "then", "do", "else", "elif", "if", "while", "until",
          "timeout", "setsid", "stdbuf"}
# A bare number after a wrapper is that wrapper's argument, not the command:
# `timeout 10 pkill -f justify`, `nice -n 5 rm -rf .claude/memory`.
NUMARG = re.compile(r"^\d+(\.\d+)?[smhd]?$")
# Wrapper flags that CONSUME the next word. Without these, the flag's VALUE reads as
# the command name: `timeout -s TERM 10 pkill -f justify` resolved to `TERM` and the
# kill sailed through. (Codex review, 2026-07-12.)
WRAPPER_VALUE_FLAGS = {
    "timeout": {"-s", "--signal", "-k", "--kill-after"},
    "nice":    {"-n", "--adjustment"},
    "env":     {"-u", "--unset", "-C", "--chdir"},
    "xargs":   {"-n", "-P", "-I", "-L", "-d", "-E", "-s", "-a"},
    "sudo":    {"-u", "-g", "-C", "-p", "-U", "-t", "-r"},
    "stdbuf":  {"-i", "-o", "-e"},
}
SEPS = ";&|\n(){}"

cmd = re.sub(r"\\\n", " ", cmd)          # splice line continuations

# Heredoc bodies are data. A quoted delimiter is fully literal; an unquoted one
# still expands $(...) / backticks, so keep those bodies for the nested scan.
expanding = []
def _hd(m):
    if not m.group(1):
        expanding.append(m.group(0))
    return " "
text = re.sub(r"<<-?\s*(['\"]?)(\w+)\1.*?^\2\s*$", _hd, cmd, flags=re.S | re.M)

def _subst(t, open_idx):
    """t[open_idx] == '('. Return (index_after_close, inner_text), balanced.

    QUOTE-AWARE: a ')' inside quotes does not close the substitution. Counting bare
    parens let `echo "$(printf ')'; pkill -f justify)"` truncate the inner text at
    the literal ')', so the real command after it was never scanned - a bypass the
    old raw regex caught. Found by an independent Codex review, 2026-07-12."""
    depth, i, n = 0, open_idx, len(t)
    sq = dq = False
    while i < n:
        c = t[i]
        if sq:
            if c == "'":
                sq = False
        elif dq:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == '"':
                dq = False
        elif c == "'":
            sq = True
        elif c == '"':
            dq = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i + 1, t[open_idx + 1:i]
        i += 1
    return n, t[open_idx + 1:]

def _words(seg):
    """Split a segment into words at UNQUOTED whitespace.

    seg.split() is wrong here: `FOO="x y" git push --force origin main` splits into
    ['FOO="x', 'y"', 'git', ...], so head_name skipped the VAR= token, read `y` as
    the command, and the force-push sailed through. The quoted assignment VALUE is
    not a word boundary. (Codex review, 2026-07-12.)"""
    out, cur, i, n = [], "", 0, len(seg)
    sq = dq = False
    while i < n:
        c = seg[i]
        if sq:
            cur += c
            if c == "'":
                sq = False
        elif dq:
            if c == "\\" and i + 1 < n:
                cur += seg[i:i + 2]
                i += 2
                continue
            cur += c
            if c == '"':
                dq = False
        elif c == "'":
            sq = True
            cur += c
        elif c == '"':
            dq = True
            cur += c
        elif c in " \t\n":
            if cur:
                out.append(cur)
                cur = ""
        else:
            cur += c
        i += 1
    if cur:
        out.append(cur)
    return out

redirects = []

def _redirect_target(t, i, n):
    """t[i] == '>'. Return (index_after_TARGET, target_or_empty). The target is the
    next token, with any quotes peeled: a redirect FILENAME may legitimately be
    quoted (`> "$HOME/x.json"`) - that is code-adjacent data the shell still opens,
    unlike an echo argument.

    The caller drops everything up to the returned index from the segment text. A
    redirection is NOT an argument, and leaving it in place broke head_name: bash
    allows a redirect BEFORE the command word, so `>/tmp/out git push --force origin
    main` made the head word read as `/tmp/out` and the gate never fired. (Codex
    review, 2026-07-12.)"""
    j = i + 1
    if j < n and t[j] == ">":          # append form: >>
        j += 1
    if j < n and t[j] == "|":          # clobber form: >| (and >>| is not a thing)
        j += 1
    k = j
    while k < n and t[k] in " \t":
        k += 1
    tgt, saw_quote = "", False
    while k < n:
        ch = t[k]
        if ch in "\"'":                # quoted filename - peel the quotes
            q = ch
            saw_quote = True
            k += 1
            while k < n and t[k] != q:
                tgt += t[k]
                k += 1
            k += 1
            continue
        if ch in " \t" or ch in SEPS:  # `2>&1`, end of token
            break
        tgt += ch
        k += 1
    # `>&1` / `>&2` are fd dupes, not file opens.
    if tgt.startswith("&") or (not tgt and not saw_quote):
        return j, ""
    return k, tgt

def split_segments(t):
    """Split at UNQUOTED separators. Quotes and substitutions stay in the segment
    text (the gate needs the arguments); substitution bodies are ALSO returned
    separately, because the shell executes them in their own right."""
    segs, nested, cur = [], [], ""
    i, n = 0, len(t)
    sq = dq = False
    test_depth = 0        # inside [[ ... ]], a '>' is a comparison, not a redirect
    while i < n:
        c = t[i]
        if sq:
            cur += c
            if c == "'":
                sq = False
            i += 1
            continue
        if c == "$" and i + 1 < n and t[i + 1] == "(":
            j, inner = _subst(t, i + 1)
            cur += t[i:j]
            nested.append(inner)
            i = j
            continue
        if c == "`":
            j = t.find("`", i + 1)
            if j < 0:
                j = n
            nested.append(t[i + 1:j])
            cur += t[i:j + 1]
            i = j + 1
            continue
        if dq:
            if c == "\\" and i + 1 < n:
                cur += t[i:i + 2]
                i += 2
                continue
            cur += c
            if c == '"':
                dq = False
            i += 1
            continue
        if c == "'":
            sq = True
            cur += c
            i += 1
            continue
        if c == '"':
            dq = True
            cur += c
            i += 1
            continue
        # An unquoted backslash escapes the next character, so `echo \> file` is
        # printing a '>', not redirecting into file. Must run before the '>' branch
        # or the guard false-blocks on prose that escapes the operator.
        if c == "\\" and i + 1 < n:
            cur += t[i:i + 2]
            i += 2
            continue
        if c == "[" and i + 1 < n and t[i + 1] == "[":
            test_depth += 1
            cur += t[i:i + 2]
            i += 2
            continue
        if c == "]" and i + 1 < n and t[i + 1] == "]" and test_depth:
            test_depth -= 1
            cur += t[i:i + 2]
            i += 2
            continue
        # Unquoted, unescaped, and not inside [[ ]] - so this '>' really does open a
        # file. Drop the operator AND its target from the segment: a redirection is
        # not an argument, and leaving it in made head_name read the FILE as the
        # command for a leading redirect (`>/tmp/out git push --force origin main`).
        if c == ">" and not test_depth:
            k, tgt = _redirect_target(t, i, n)
            if tgt:
                redirects.append(tgt)
            i = k
            continue
        if c in SEPS:
            segs.append(cur)
            cur = ""
            i += 1
            continue
        cur += c
        i += 1
    segs.append(cur)
    return [s for s in segs if s.strip()], nested

def head_name(seg):
    """The command this segment actually runs, past wrappers and VAR=val."""
    seen_prefix = False
    cur_prefix = ""
    skip_next = False
    for w in _words(seg):
        if skip_next:                         # this word is the previous flag's VALUE
            skip_next = False
            continue
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w):
            continue
        if w.startswith("-"):
            if seen_prefix and "=" not in w \
                    and w in WRAPPER_VALUE_FLAGS.get(cur_prefix, ()):
                skip_next = True              # `timeout -s TERM 10 pkill ...`
            continue
        if seen_prefix and NUMARG.match(w):   # `timeout 10 cmd`, `nice -n 5 cmd`
            continue
        base = os.path.basename(w.strip("\"'"))
        if base in PREFIX:
            seen_prefix = True
            cur_prefix = base
            continue
        return base
    return ""

ENV_SPLIT_RE = re.compile(r"^-(S|-split-string)")

def env_split_payloads(seg):
    """`env -S "git push --force origin main"` / `env --split-string=...` SPLITS the
    string and runs it as a command. The quoted arg is CODE, and because it is one
    quoted word, head_name reads the whole string as the command NAME and matches
    nothing. The old raw regex caught this; the slice scan did not. (Codex, 2026-07-12.)"""
    saw_env = False
    for w in _words(seg):
        base = os.path.basename(w.strip("\"'"))
        if not saw_env:
            if base == "env":
                saw_env = True
            elif base in PREFIX or w.startswith("-") \
                    or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w):
                continue          # sudo / VAR= / flags may sit in front of env
            else:
                return []         # a real command that is not env - not this shape
        elif ENV_SPLIT_RE.match(w):
            return [m[1] for m in re.findall(r"(['\"])(.*?)\1", seg, flags=re.S)]
    return []

def payloads(seg, head):
    """Args that this segment EXECUTES as shell code."""
    if head == "eval":
        quoted = [m[1] for m in re.findall(r"(['\"])(.*?)\1", seg, flags=re.S)]
        if quoted:
            return quoted
        # `eval rm -rf .claude/memory` - eval runs it even with no quotes at all.
        # Only the quoted form was scanned, so the bare form was a clean bypass.
        rest = re.sub(r"^.*?\beval\b\s*", "", seg, count=1, flags=re.S)
        return [rest] if rest.strip() and rest != seg else []
    if head in ("bash", "sh", "zsh", "dash") \
            and re.search(r"(^|\s)-[a-zA-Z]*c[a-zA-Z]*(\s|$)", seg):
        return [m[1] for m in re.findall(r"(['\"])(.*?)\1", seg, flags=re.S)]
    return env_split_payloads(seg)

results = []
def walk(t, depth=0):
    if depth > 3:
        return
    segs, nested = split_segments(t)
    for seg in segs:
        head = head_name(seg)
        if NAME_RE.match(head):
            if not require or re.search(
                    r"(^|[^A-Za-z0-9_])%s([^A-Za-z0-9_]|$)" % re.escape(require), seg):
                results.append(" ".join(seg.split()))
        for p in payloads(seg, head):
            walk(p, depth + 1)
    for nt in nested:
        walk(nt, depth + 1)

walk(text)
# An unquoted heredoc body is still data, but its substitutions do run.
for body in expanding:
    for inner in re.findall(r"\$\(([^()]*)\)", body) + re.findall(r"`([^`]*)`", body):
        walk(inner, 1)

print("\n".join(redirects if mode == "redirects" else results))
PYEOF
}

# Every real invocation of a command, arguments intact. (Signature unchanged - the
# screenshot, cmux-eval and kill gates call this.)
command_slices() { _slice_scan "$1" "${2:-}" slices; }

# Every file the shell itself opens for writing via > or >>, quotes peeled.
redirect_targets() { _slice_scan '' '' redirects; }

# ---------------------------------------------------------------------------
# Figma-fidelity opt-out protection (Level 1 hardening, 2026-07-17 Jonah).
#
# _figma_marker_verdict prints "BLOCK" when a command would delete, move,
# truncate, edit, ALIAS (symlink/hardlink), or redirect-over the arming record
# .figma-fidelity.pending. The ONLY sanctioned way past the gate is a covering
# check in .figma-fidelity.json (the Stop gate then rm's the marker itself).
#
# It replaces a literal-substring grep that a real Codex review (2026-07-17)
# showed was BYPASSABLE and simultaneously OVER-BLOCKING:
#   - bypass: variable/quote/backslash indirection (`p=marker; rm "$p"`,
#     `rm .figma-fidelity'.pending'`, `rm .figma-fidelity\.pending`), symlink /
#     hardlink aliasing (`ln -s marker p; > p`), redirect forms the CMD_CODE
#     regex missed (`>|`, quoted, `$PWD/`, heredoc `cat <<EOF > marker`), and
#     unlisted mutators (unlink, install, find -delete, ed, ex, tee, dd, cp).
#   - over-block: read-only `sed -n '1,5p' marker`, and different files
#     (foo.figma-fidelity.pending, .figma-fidelity.pending.bak).
#
# How it closes them (see the beat session_2026-07-17_gate-hardening-*):
#   - a self-contained, quote/escape/heredoc-aware walk (its OWN parser, so the
#     shared command_slices/redirect_targets other gates rely on are untouched);
#   - resolves inline VAR=value assignments and $PWD/$HOME before matching;
#   - a target matches by BASENAME == .figma-fidelity.pending OR by
#     realpath/os.path.samefile against the real marker - the single highest-
#     value fix, killing symlink, hardlink, path-prefix and basename-robustness
#     at once (a raw substring never matches, so the near-miss files above pass);
#   - `sed` is a mutator ONLY with an in-place flag (-i/-i.bak/--in-place), so a
#     read-only sed passes; redirect writes are handled by the redirect walk;
#   - for a MUTATING/redirect target that still holds an unresolvable $, `, or
#     $( , DENY conservatively but ONLY while a build is actually armed (marker
#     file present) - so an unrelated `rm "$TMP"` in an unarmed repo is allowed.
# Reads (cat/grep/head/tail, sed without -i) name no mutating target and stay
# allowed; .figma-fidelity.json and .figma-fidelity.measuring are never the
# protected marker and stay allowed. Arbitrary python/perl inline writes remain
# unparseable from command text - an ACCEPTED residual closed separately by a
# Level-2 architectural change; do not try to fully parse python here.
_figma_marker_verdict() {
  FIGMA_CMD="$CMD" FIGMA_MARKER="$_FIGMA_MARKER" python3 <<'PYEOF' 2>/dev/null
import os, re, glob as _glob, fnmatch

cmd    = os.environ.get("FIGMA_CMD", "")
marker = os.environ.get("FIGMA_MARKER", "")
MARKER_BASE = ".figma-fidelity.pending"
marker_exists = bool(marker) and os.path.exists(marker)


def _abs(p):
    """Absolute, symlink-resolved path of an operand, relative to cwd. realpath
    (not normpath) is REQUIRED: macOS /var is a symlink to /private/var, and bash
    pwd / git rev-parse hand us the /var form while Python getcwd() returns the
    resolved form - a plain normpath would make the two disagree and the marker
    would never match. realpath also resolves a symlinked repo path, and works on
    a not-yet-existing marker (the existing prefix is resolved, the tail kept)."""
    p = os.path.expanduser(p)
    if not os.path.isabs(p):
        p = os.path.join(os.getcwd(), p)
    return os.path.realpath(p)


# OUR marker is a specific path (git-root/.figma-fidelity.pending), not any file
# that merely shares the basename - so `rm /other-repo/.figma-fidelity.pending`
# is NOT us and stays allowed. Matching is path-equality (works whether or not
# the file exists yet) OR samefile (catches a symlink/hardlink alias when armed).
marker_abs = _abs(marker) if marker else ""
marker_dir_abs = os.path.dirname(marker_abs) if marker_abs else ""

SEPS = ";&|\n(){}"
# Words that can precede the real command without changing what it is. Includes
# the zsh precommand modifiers noglob / nocorrect / builtin (this machine is zsh),
# without which `noglob rm marker` read its head as `noglob` and sailed through.
PREFIX = {"sudo", "env", "command", "exec", "time", "nice", "nohup", "xargs",
          "then", "do", "else", "elif", "if", "while", "until",
          "timeout", "setsid", "stdbuf", "noglob", "nocorrect", "builtin"}
NUMARG = re.compile(r"^\d+(\.\d+)?[smhd]?$")
WRAPPER_VALUE_FLAGS = {
    "timeout": {"-s", "--signal", "-k", "--kill-after"},
    "nice":    {"-n", "--adjustment"},
    "env":     {"-u", "--unset", "-C", "--chdir"},
    "xargs":   {"-n", "-P", "-I", "-L", "-d", "-E", "-s", "-a"},
    "sudo":    {"-u", "-g", "-C", "-p", "-U", "-t", "-r"},
    "stdbuf":  {"-i", "-o", "-e"},
}
VAR_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
ASSIGN_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", re.S)
ASSIGN_HEADS = {"export", "declare", "local", "typeset", "readonly"}
# Delete / edit-in-place: every non-flag operand is the thing acted on. Includes
# editors that open a NAMED file for writing (vim/vi/nano/emacs/ed/ex) and
# sqlite3 (opens its db arg read-write) - reading the marker still goes through
# cat/grep/head/tail/sed-n, which are NOT here.
MUT_EDIT = {"rm", "unlink", "shred", "truncate", "ed", "ex", "tee", "sponge", "patch",
            "vim", "vi", "view", "nano", "pico", "emacs", "sqlite3"}
# Rename / link: every operand matters (a source is renamed-away or aliased).
MUT_RENAME_LINK = {"mv", "ln", "link", "rename", "mmv"}
# Copy: only the DESTINATION (last operand) is written; sources are reads. A
# link-flag (cp -l / -s, rsync --link-dest) also aliases the source.
MUT_COPY = {"cp", "install", "rsync"}
# A short flag bundle carrying r/R, i.e. a recursive delete: -r, -R, -rf, -fr.
RECURSIVE_RE = re.compile(r"^-[a-zA-Z]*[rR]")
# In-place edit flag for sed/perl/ruby: -i, -i.bak, -pi, -ni, --in-place, and
# numeric bundles like perl -0777pi (digits allowed inside the bundle).
INPLACE_RE = re.compile(r"^-[0-9A-Za-z]*i")

cmd = re.sub(r"\\\n", " ", cmd)

# Strip heredoc BODIES but KEEP the introducer line - a redirect can live there
# (`cat <<EOF > marker`), and eating the whole block would hide it. group(3) is
# the rest of the introducer line, group(4) the body - captured because a heredoc
# can feed a destructive xargs its stdin (`xargs rm <<EOF\nmarker\nEOF`).
heredoc_bodies = []
def _hd(m):
    heredoc_bodies.append(m.group(4))
    return m.group(3)
cmd = re.sub(r"<<-?\s*(['\"]?)(\w+)\1([^\n]*)\n(.*?)^\2[ \t]*$", _hd, cmd,
             flags=re.S | re.M)


def _dollar(w, i, out, varmap):
    """w[i] == '$'. Expand $VAR / ${VAR} from known assignments. Returns
    (next_index, unresolved_bool); appends the resolved text (or the literal
    token, when unknown) to out."""
    n = len(w)
    if i + 1 < n and w[i + 1] == "{":
        close = w.find("}", i + 2)
        if close != -1:
            nm = w[i + 2:close]
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", nm) and nm in varmap:
                out.append(varmap[nm]); return close + 1, False
            out.append(w[i:close + 1]); return close + 1, True
        out.append("$"); return i + 1, True
    m = VAR_RE.match(w, i + 1)
    if m and m.group(0) in varmap:
        out.append(varmap[m.group(0)]); return m.end(), False
    out.append("$"); return i + 1, True


def normalize_word(w, varmap):
    """Peel quotes + backslash escapes and expand known vars, returning
    (literal, unresolved, has_glob, has_brace). unresolved is True when a $,
    $(...) or backtick could not be resolved. has_glob/has_brace are True only
    when a glob (*?[) / brace ({}) metachar appears UNQUOTED and UNESCAPED - so a
    quoted or escaped `*`/`{` is a literal filename, not an expansion, and the
    guard will not glob/brace-expand it (that was a near-miss false block)."""
    out = []
    i, n = 0, len(w)
    sq = dq = False
    unresolved = has_glob = has_brace = False
    while i < n:
        c = w[i]
        if sq:
            if c == "'":
                sq = False
            else:
                out.append(c)
            i += 1; continue
        if dq:
            if c == '"':
                dq = False; i += 1; continue
            if c == "\\" and i + 1 < n and w[i + 1] in '"\\$`':
                out.append(w[i + 1]); i += 2; continue
            if c == "`":
                unresolved = True; out.append(c); i += 1; continue
            if c == "$":
                ni, ur = _dollar(w, i, out, varmap)
                unresolved = unresolved or ur; i = ni; continue
            out.append(c); i += 1; continue
        if c == "'":
            sq = True; i += 1; continue
        if c == '"':
            dq = True; i += 1; continue
        if c == "\\" and i + 1 < n:
            out.append(w[i + 1]); i += 2; continue
        if c == "`":
            unresolved = True; out.append(c); i += 1; continue
        if c == "$":
            ni, ur = _dollar(w, i, out, varmap)
            unresolved = unresolved or ur; i = ni; continue
        if c in "*?[":
            has_glob = True
        elif c in "{}":
            has_brace = True
        out.append(c); i += 1
    return "".join(out), unresolved, has_glob, has_brace


def _words(seg):
    """Split a segment into words at UNQUOTED whitespace, keeping quotes and
    backslash escapes in the word (normalize_word peels them later)."""
    out, cur, i, n = [], "", 0, len(seg)
    sq = dq = False
    while i < n:
        c = seg[i]
        if sq:
            cur += c
            if c == "'":
                sq = False
        elif dq:
            if c == "\\" and i + 1 < n:
                cur += seg[i:i + 2]; i += 2; continue
            cur += c
            if c == '"':
                dq = False
        elif c == "'":
            sq = True; cur += c
        elif c == '"':
            dq = True; cur += c
        elif c == "\\" and i + 1 < n:
            cur += seg[i:i + 2]; i += 2; continue
        elif c in " \t\n":
            if cur:
                out.append(cur); cur = ""
        else:
            cur += c
        i += 1
    if cur:
        out.append(cur)
    return out


def _subst(t, open_idx):
    """t[open_idx] == '('. Return (index_after_close, inner), quote-aware."""
    depth, i, n = 0, open_idx, len(t)
    sq = dq = False
    while i < n:
        c = t[i]
        if sq:
            if c == "'":
                sq = False
        elif dq:
            if c == "\\" and i + 1 < n:
                i += 2; continue
            if c == '"':
                dq = False
        elif c == "'":
            sq = True
        elif c == '"':
            dq = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i + 1, t[open_idx + 1:i]
        i += 1
    return n, t[open_idx + 1:]


def _redirect_target(t, i, n):
    """t[i] == '>'. Return (index_after_target, raw_target). raw_target keeps its
    quotes / backslashes / $ so normalize_word resolves it the same way as a
    command operand. Covers >>, and the clobber-override forms >| (bash) and
    >! / >>! (zsh - this machine's shell is zsh)."""
    j = i + 1
    if j < n and t[j] == ">":
        j += 1
    if j < n and t[j] in "|!":
        j += 1
    # `>&`: `>&1` / `>&-` dupe or close an fd (no file); `>& file` / `>&file`
    # redirect BOTH stdout+stderr to a FILE. Peek past the & to tell them apart.
    if j < n and t[j] == "&":
        nxt = t[j + 1] if j + 1 < n else ""
        if nxt.isdigit() or nxt == "-":
            k = j + 1
            while k < n and (t[k].isdigit() or t[k] == "-"):
                k += 1
            return k, ""                 # fd dupe / close - not a file open
        j += 1                           # `>& file` - read the filename after &
    k = j
    while k < n and t[k] in " \t":
        k += 1
    raw = ""
    sq = dq = False
    while k < n:
        ch = t[k]
        if sq:
            raw += ch
            if ch == "'":
                sq = False
            k += 1; continue
        if dq:
            raw += ch
            if ch == "\\" and k + 1 < n:
                raw += t[k + 1]; k += 2; continue
            if ch == '"':
                dq = False
            k += 1; continue
        if ch == "'":
            sq = True; raw += ch; k += 1; continue
        if ch == '"':
            dq = True; raw += ch; k += 1; continue
        if ch == "\\" and k + 1 < n:
            raw += t[k:k + 2]; k += 2; continue
        if ch in " \t" or ch in SEPS or ch in "<>":
            break
        raw += ch; k += 1
    if not raw or raw.startswith("&"):
        return (k if raw else j), ""
    return k, raw


def split_segments(t):
    """Split at UNQUOTED separators. Returns (segments, nested_substitutions,
    redirect_targets). Redirects are recorded during the same quote-aware walk."""
    segs, nested, reds, cur = [], [], [], ""
    i, n = 0, len(t)
    sq = dq = False
    test_depth = 0
    while i < n:
        c = t[i]
        if sq:
            cur += c
            if c == "'":
                sq = False
            i += 1; continue
        if c == "$" and i + 1 < n and t[i + 1] == "(":
            j, inner = _subst(t, i + 1)
            cur += t[i:j]; nested.append(inner); i = j; continue
        if c == "`":
            j = t.find("`", i + 1)
            if j < 0:
                j = n
            nested.append(t[i + 1:j]); cur += t[i:j + 1]; i = j + 1; continue
        if dq:
            if c == "\\" and i + 1 < n:
                cur += t[i:i + 2]; i += 2; continue
            cur += c
            if c == '"':
                dq = False
            i += 1; continue
        if c == "'":
            sq = True; cur += c; i += 1; continue
        if c == '"':
            dq = True; cur += c; i += 1; continue
        if c == "\\" and i + 1 < n:
            cur += t[i:i + 2]; i += 2; continue
        if c == "[" and i + 1 < n and t[i + 1] == "[":
            test_depth += 1; cur += t[i:i + 2]; i += 2; continue
        if c == "]" and i + 1 < n and t[i + 1] == "]" and test_depth:
            test_depth -= 1; cur += t[i:i + 2]; i += 2; continue
        if c == ">" and not test_depth:
            k, tgt = _redirect_target(t, i, n)
            if tgt:
                reds.append(tgt)
            i = k; continue
        # `{` / `}` separate a GROUP COMMAND (`{ rm marker; }`) only when standalone
        # (space/tab around them). Attached to a word they are brace EXPANSION
        # (`marker{,.bak}`, `.figma-fidelity.{pending,json}`) and must stay in the
        # word so brace_expand can enumerate it - splitting there was a real bypass.
        if c == "{" and not test_depth:
            if (i + 1 >= n or t[i + 1] in " \t\n") and (not cur or cur[-1] in " \t"):
                segs.append(cur); cur = ""; i += 1; continue
            cur += c; i += 1; continue
        if c == "}" and not test_depth:
            if not cur or cur[-1] in " \t":
                segs.append(cur); cur = ""; i += 1; continue
            cur += c; i += 1; continue
        if c in SEPS:
            segs.append(cur); cur = ""; i += 1; continue
        cur += c; i += 1
    segs.append(cur)
    return [s for s in segs if s.strip()], nested, reds


def head_and_args(words, varmap):
    """The command a segment runs (past wrappers, VAR= prefixes and wrapper
    value-flags), and the words after it. Resolves a $-obfuscated head via the
    known assignments (`C=rm; $C marker`)."""
    seen_prefix = False
    cur_prefix = ""
    skip_next = False
    idx, n = 0, len(words)
    while idx < n:
        w = words[idx]
        if skip_next:
            skip_next = False; idx += 1; continue
        if ASSIGN_RE.match(w):
            idx += 1; continue
        if w.startswith("-"):
            if seen_prefix and "=" not in w and w in WRAPPER_VALUE_FLAGS.get(cur_prefix, ()):
                skip_next = True
            idx += 1; continue
        if seen_prefix and NUMARG.match(w):
            idx += 1; continue
        lit, _, _, _ = normalize_word(w, varmap)
        base = os.path.basename(lit)
        if base in PREFIX:
            seen_prefix = True; cur_prefix = base; idx += 1; continue
        return base, words[idx + 1:]
    return "", []


def record_assignments(words, varmap):
    """Record standalone VAR=value (and export/declare/... VAR=value) so a later
    `$VAR` target resolves by name."""
    if not words:
        return
    start = 0
    lit0, _, _, _ = normalize_word(words[0], varmap)
    if os.path.basename(lit0) in ASSIGN_HEADS:
        start = 1
    for w in words[start:]:
        m = ASSIGN_RE.match(w)
        if not m:
            break
        nm, rawval = m.group(1), m.group(2)
        val, ur, _, _ = normalize_word(rawval, varmap)
        if not ur:
            varmap[nm] = val


def _value_of(args, names):
    """Value of a `--opt VALUE` / `-o VALUE` / `--opt=VALUE` / `-oVALUE` flag."""
    for idx, a in enumerate(args):
        for nm in names:
            if a == nm:
                return args[idx + 1] if idx + 1 < len(args) else None
            if nm.startswith("--") and a.startswith(nm + "="):
                return a[len(nm) + 1:]
            if not nm.startswith("--") and len(nm) == 2 and a.startswith(nm) and len(a) > 2:
                return a[2:]
    return None


def classify(base, args):
    """Return (write_targets, tree_targets, mutating). write_targets are operands
    written / edited / aliased. tree_targets are directories or search-roots a
    recursive delete would take the marker down with. mutating is False when the
    command does not write at all (so a $-obfuscated NON-mutator is not blocked)."""
    flags = [a for a in args if a.startswith("-")]
    ops   = [a for a in args if not a.startswith("-")]

    def has(*names):
        return any(a in names for a in args)

    if base in MUT_EDIT:
        recursive = base == "rm" and any(
            RECURSIVE_RE.match(f) or f == "--recursive" for f in flags)
        return ops, (ops if recursive else []), True
    if base in MUT_RENAME_LINK:                       # mv / ln / link - all operands
        return ops, [], True
    if base in MUT_COPY:                              # cp / install / rsync
        # Recompute operands skipping VALUE-flags, so a flag argument that names a
        # path (`--exclude .figma-fidelity.pending`, `-m 644`) is not misread as a
        # source/dest operand.
        VALFLAGS = {
            "cp":      {"-t", "--target-directory", "-S", "--suffix"},
            "install": {"-t", "--target-directory", "-m", "--mode", "-o", "--owner",
                        "-g", "--group", "-S", "--suffix"},
            "rsync":   {"--exclude", "--include", "--exclude-from", "--include-from",
                        "--files-from", "--filter", "-f", "--compare-dest", "--copy-dest",
                        "--link-dest", "--backup-dir", "--suffix", "--chmod", "--chown",
                        "--rsync-path", "-e", "--rsh", "--out-format", "--log-file",
                        "--bwlimit", "--partial-dir", "--temp-dir", "-T",
                        "--max-size", "--min-size", "--block-size", "-B"},
        }.get(base, set())
        ops, _skip = [], False
        for a in args:
            if _skip:
                _skip = False; continue
            if a.startswith("-"):
                if a in VALFLAGS:
                    _skip = True
                continue
            ops.append(a)
        tdir = _value_of(args, ("-t", "--target-directory"))
        if tdir is not None:
            dest, srcs = tdir, ops
        else:
            dest = ops[-1] if ops else None
            srcs = ops[:-1] if len(ops) > 1 else []
        writes = []
        if dest is not None:
            writes.append(dest)
            # copying a file INTO a directory dest overwrites dest/basename(src) -
            # `cp /other/.figma-fidelity.pending .` writes ./.figma-fidelity.pending.
            dlit, dur, _, _ = normalize_word(dest, varmap)
            if not dur and dlit:
                for s in srcs:
                    slit, sur, _, _ = normalize_word(s, varmap)
                    if not sur and slit:
                        writes.append(os.path.join(dlit, os.path.basename(slit.rstrip("/"))))
        aliased = has("--link", "--symbolic-link") \
            or _value_of(args, ("--link-dest",)) is not None
        if base == "cp":                              # cp -l/-s, incl. bundled -al/-as
            aliased = aliased or any(
                not f.startswith("--") and ("l" in f[1:] or "s" in f[1:]) for f in flags)
        if aliased:                                   # aliases the SOURCE
            writes += srcs
        trees = []
        if base == "rsync":
            if has("--remove-source-files"):          # rsync deletes each source
                writes += srcs
            if any(a.startswith("--delete") for a in flags) and dest is not None:
                # ...unless the marker is explicitly --exclude'd from the delete.
                excl = []
                for k, a in enumerate(args):
                    m = re.match(r"^--exclude=(.*)$", a, re.S)
                    if m:
                        excl.append(m.group(1))
                    elif a == "--exclude" and k + 1 < len(args):
                        excl.append(args[k + 1])
                mb = os.path.basename(marker_abs) if marker_abs else MARKER_BASE
                excluded = any(fnmatch.fnmatch(mb, os.path.basename(normalize_word(e, varmap)[0]))
                               for e in excl)
                # --delete-excluded INVERTS the exclude: excluded files (the marker)
                # are the ones deleted on the receiver, so an exclude no longer protects.
                if not excluded or has("--delete-excluded"):
                    trees.append(dest)                # rsync prunes extraneous dest files
        return writes, trees, True
    if base == "sed":
        if any(INPLACE_RE.match(f) or f.startswith("--in-place") for f in flags):
            return ops, [], True
        return [], [], False                          # read-only sed
    if base in ("perl", "ruby"):
        if any(INPLACE_RE.match(f) for f in flags):   # -pi / -i in-place edit
            return ops, [], True
        return [], [], False                          # arbitrary inline = residual
    if base in ("awk", "gawk", "mawk"):
        if "inplace" in ops or _value_of(args, ("-i", "--include")) == "inplace":
            return ops, [], True
        return [], [], False
    if base == "sort":
        out = _value_of(args, ("-o", "--output"))
        return ([out] if out else []), [], True
    if base in ("tar", "bsdtar", "gtar"):
        # --remove-files DELETES each named source file after archiving it. (Plain
        # extraction that overwrites from archive CONTENTS is the accepted residual.)
        return (ops if has("--remove-files") else []), [], has("--remove-files")
    if base == "zip":
        # `zip -m`/--move deletes the named FILESYSTEM files after adding them. (`zip
        # -d` deletes an archive ENTRY, not the filesystem marker - not a mutation
        # of the marker file, so it is NOT blocked.)
        moving = has("-m", "--move") or any(
            not f.startswith("--") and "m" in f[1:] for f in flags)
        return (ops if moving else []), [], moving
    if base == "dd":
        return [m.group(1) for a in ops
                for m in (re.match(r"^of=(.*)$", a, re.S),) if m], [], True
    if base == "find":
        has_delete = has("-delete")
        # inspect the -exec/-ok payload head + whether it uses the {} placeholder.
        exec_head, exec_has_ph, execing = None, False, False
        for a in args:
            if a in ("-exec", "-execdir", "-ok", "-okdir"):
                execing, exec_head = True, None
                continue
            if execing:
                if a.strip("'\"\\") in (";", "+"):
                    execing = False
                    continue
                if exec_head is None:
                    exec_head = os.path.basename(normalize_word(a, varmap)[0])
                if "{}" in a:
                    exec_has_ph = True
        if not has_delete and exec_head is None:
            return [], [], False
        # The action mutates MATCHED files iff -delete, or -exec runs a destructive
        # command on the {} placeholder - including cp/install/ln (`-exec cp /dev/null
        # {}` overwrites, `-exec ln ... {}` aliases). A read exec (`-exec cat {}`) is
        # NOT that; a literal marker inside ANY -exec is caught by payloads().
        EXEC_DEL = {"rm", "unlink", "shred", "truncate", "mv", "ed", "ex", "tee",
                    "sponge", "cp", "install", "ln", "link"}
        if not (has_delete or (exec_head in EXEC_DEL and exec_has_ph)):
            return [], [], True
        # A find predicate that SELECTS the marker (positive -name/-path match,
        # negated pattern that does NOT exclude it, or no filter under a root that
        # contains it) means the destructive action hits the marker.
        return ([marker] if _find_matches_marker(args) else []), [], True
    if base == "git":
        sub, rest = None, []
        for k, a in enumerate(args):
            if a.startswith("-"):
                continue
            sub, rest = a, args[k + 1:]
            break
        if sub in ("rm", "mv"):
            return [a for a in rest if not a.startswith("-")], [], True
        if sub == "clean":
            forced = has("-f", "--force") or any(
                not f.startswith("--") and "f" in f[1:] for f in flags)
            # -n/--dry-run only PRINTS what would go, even alongside -f: not a delete.
            dry = has("-n", "--dry-run") or any(
                not f.startswith("--") and "n" in f[1:] for f in flags)
            if forced and not dry:                    # removes UNTRACKED files (the marker is one)
                paths = [a for a in rest if not a.startswith("-")]
                return paths, (paths if paths else [marker_dir_abs or "."]), True
        return [], [], False
    return [], [], False


def payloads(seg, head):
    """Args a segment EXECUTES as shell code (eval / bash -c / env -S / find -exec)."""
    # `env -S 'rm marker'` / `env --split-string=...` splits the string and runs it.
    # env is a PREFIX word, so head resolves past it - detect the -S form directly.
    ws = _words(seg)
    saw_env = False
    for idx, w in enumerate(ws):
        b = os.path.basename(normalize_word(w, varmap)[0])
        if not saw_env:
            if b == "env":
                saw_env = True
            elif b in PREFIX or w.startswith("-") or ASSIGN_RE.match(w):
                continue
            else:
                break
        else:
            m = re.match(r"^(?:-S|--split-string)=?(.*)$", w, re.S)
            if m:
                if m.group(1):
                    return [normalize_word(m.group(1), varmap)[0]]
                if idx + 1 < len(ws):
                    return [normalize_word(ws[idx + 1], varmap)[0]]
                return []
            if not w.startswith("-"):
                break
    if head == "eval":
        # eval CONCATENATES all its args (quotes stripped) and runs the result, so
        # `eval 'rm' marker` and `eval "rm marker"` both run `rm marker`. Analyze
        # the whole dequoted remainder - not only the quoted spans (which dropped
        # the unquoted companion operand).
        rest = re.sub(r"^.*?\beval\b\s*", "", seg, count=1, flags=re.S)
        if not rest.strip() or rest == seg:
            return []
        return [re.sub(r"['\"]", "", rest)]
    if head in ("bash", "sh", "zsh", "dash") \
            and re.search(r"(^|\s)-[a-zA-Z]*c[a-zA-Z]*(\s|$)", seg):
        # ONLY the single word after -c is the executed command string; any further
        # args are positional params ($0, $1, ...) and are NOT executed, so they must
        # not be analyzed (`bash -c 'true' ignored 'rm marker'` was false-blocked).
        ws = _words(seg)
        for i, w in enumerate(ws):
            if re.match(r"^-[a-zA-Z]*c[a-zA-Z]*$", w) and i + 1 < len(ws):
                return [normalize_word(ws[i + 1], varmap)[0]]
        return []
    if head == "find":
        # Each `-exec CMD ... ;|+` runs CMD as its own command; recurse so a
        # literal marker operand (`-exec rm .figma-fidelity.pending \;`) is caught.
        out, cur, execing = [], [], False
        for w in _words(seg):
            if w in ("-exec", "-execdir", "-ok", "-okdir"):
                execing, cur = True, []
                continue
            if execing:
                if w.strip("'\"\\") in (";", "+"):
                    if cur:
                        out.append(" ".join(cur))
                    cur, execing = [], False
                else:
                    cur.append(w)
        if cur:
            out.append(" ".join(cur))
        return out
    return []


# Seed from the hook's own environment so a real env var in a write target ($PWD,
# $HOME, $TMPDIR, ...) resolves to its value - only a TRULY unknowable var (set in
# a prior tool call, $RANDOM, a command substitution) stays unresolved and trips
# the armed conservative-deny, so `rm "$TMPDIR/scratch"` is no longer collateral.
# No bypass: an env var whose value IS the marker still matches. PWD is forced to
# the live cwd because the inherited PWD can be stale.
varmap = dict(os.environ)
varmap["PWD"] = os.getcwd()
varmap.setdefault("HOME", os.path.expanduser("~"))
BLOCK = [False]


def _same_target(word):
    """True if `word` refers to OUR marker: path-equal to it, or (when armed) a
    symlink/hardlink alias that samefile-resolves to it."""
    if not word:
        return False
    a = _abs(word)
    if marker_abs and a == marker_abs:
        return True
    if marker_exists:
        try:
            if os.path.exists(a) and os.path.samefile(a, marker):
                return True
        except OSError:
            pass
    return False


def _glob_hits(word):
    """A glob pattern that expands (against the real FS) onto the marker. Only
    meaningful while armed - an absent marker cannot be a glob match."""
    w = os.path.expanduser(word)
    pats = [w]
    if not os.path.isabs(w) and marker_dir_abs:
        pats.append(os.path.join(marker_dir_abs, w))
    for pat in pats:
        try:
            for g in _glob.glob(pat):
                try:
                    if os.path.samefile(g, marker):
                        return True
                except OSError:
                    pass
        except (OSError, re.error):
            pass
    return False


def _split_top_commas(s):
    parts, depth, cur = [], 0, ""
    for c in s:
        if c == "{":
            depth += 1; cur += c
        elif c == "}":
            depth -= 1; cur += c
        elif c == "," and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += c
    parts.append(cur)
    return parts


def brace_expand(s, depth=0):
    """Expand `{a,b}` brace lists so `mv marker{,.bak}` yields the marker itself.
    Only the comma form (no numeric ranges); comma-less braces stay literal."""
    if depth > 8 or "{" not in s:
        return [s]
    d, start = 0, -1
    for i, c in enumerate(s):
        if c == "{":
            if d == 0:
                start = i
            d += 1
        elif c == "}" and d > 0:
            d -= 1
            if d == 0:
                parts = _split_top_commas(s[start + 1:i])
                if len(parts) < 2:
                    return [s]
                pre, post = s[:start], s[i + 1:]
                out = []
                for p in parts:
                    for tail in brace_expand(post, depth + 1):
                        out.append(pre + p + tail)
                return out
    return [s]


def _write_hit(raw):
    """True if a write/edit/alias operand names the marker. Brace-expanded, and
    glob-expanded against the FS while armed. An unresolvable $/backtick/$( in a
    write target is denied conservatively ONLY while armed."""
    lit, unresolved, has_glob, has_brace = normalize_word(raw, varmap)
    if unresolved:
        return marker_exists
    if not lit:
        return False
    for word in (brace_expand(lit) if has_brace else [lit]):
        if _same_target(word):
            return True
        if has_glob and marker_exists and any(ch in word for ch in "*?[") \
                and _glob_hits(word):
            return True
    return False


def _tree_hit(raw):
    """True if OUR marker lives inside (or is) a recursive-delete root - `rm -rf .`,
    `find . -delete`, `git clean -f`. Only meaningful while armed."""
    if not marker_exists:
        return False
    lit, unresolved, has_glob, has_brace = normalize_word(raw, varmap)
    if unresolved:
        return True            # an unresolvable recursive-delete root while armed
    if not lit:
        return False
    try:
        m_real = os.path.realpath(marker)
    except OSError:
        return False
    for word in (brace_expand(lit) if has_brace else [lit]):
        try:
            root = os.path.realpath(_abs(word))
        except OSError:
            continue
        if m_real == root or m_real.startswith(root.rstrip(os.sep) + os.sep):
            return True
    return False


def _find_matches_marker(args):
    """Does a find's predicate SELECT the marker (so a -delete / destructive -exec
    would hit it, or a plain find would print it to a downstream xargs)? Handles
    `!`/`-not` negation on -name/-path and a no-filter search under a root that
    contains the marker. A find pattern is a FIND glob, matched regardless of
    shell-quoting."""
    NAME_F = ("-name", "-iname")
    PATH_F = ("-path", "-ipath", "-wholename")
    mb = os.path.basename(marker_abs) if marker_abs else MARKER_BASE
    positives, negatives, roots = [], [], []
    pred_started = False
    skip_val = False
    # find GLOBAL options (-H -L -P, -Olevel, -D debugopts) precede the paths and do
    # NOT start the predicate - `find -H /other-repo -name X` must still see the root.
    GLOBAL_OPT = re.compile(r"^-(H|L|P|O\d*|D)$")
    for i, a in enumerate(args):
        if skip_val:                                  # value of a leading -D
            skip_val = False
            continue
        if not pred_started and GLOBAL_OPT.match(a):
            if a == "-D":
                skip_val = True
            continue
        if a in NAME_F + PATH_F and i + 1 < len(args):
            neg = i >= 1 and args[i - 1] in ("!", "-not")
            (negatives if neg else positives).append((a, args[i + 1]))
            pred_started = True
        elif a.startswith("-") or a in ("!", "(", ")"):
            pred_started = True
        elif not pred_started:
            roots.append(a)

    def hits(flag, raw):
        p = normalize_word(raw, varmap)[0]
        if not p:
            return False
        if flag in NAME_F:
            return fnmatch.fnmatch(mb, os.path.basename(p))
        if fnmatch.fnmatch(marker_abs, p) or fnmatch.fnmatch(mb, os.path.basename(p)):
            return True
        if marker_exists:
            for g in _glob.glob(p) + _glob.glob(os.path.join(marker_dir_abs or ".", p)):
                try:
                    if os.path.samefile(g, marker):
                        return True
                except OSError:
                    pass
        return False

    # A find can only touch OUR marker if a search ROOT contains it. `find
    # /other-repo -name .figma-fidelity.pending -delete` cannot reach ours.
    try:
        mp = os.path.realpath(marker) if marker_exists else marker_abs
    except OSError:
        mp = marker_abs

    def root_has_marker(r):
        rp = _abs(r)
        return bool(mp) and (mp == rp or mp.startswith(rp.rstrip(os.sep) + os.sep))

    if not ((not roots) or any(root_has_marker(r) for r in roots)):
        return False                                  # no root reaches OUR marker

    has_or = any(a in ("-o", "-or") for a in args)
    if positives:
        return any(hits(f, r) for f, r in positives)
    if negatives:                                     # `! -name X` deletes all BUT X
        # ...but an -o (OR) re-orders find's Boolean so the negated term no longer
        # cleanly excludes the marker (`! -name X -o -delete` DELETES X). Full find
        # expression evaluation is out of scope for a command-text guard, so block
        # conservatively when -o is present with a negated marker term.
        if has_or:
            return True
        return not any(hits(f, r) for f, r in negatives)
    # no name/path filter -> the whole search tree, so the marker goes if a root
    # (default cwd) contains it.
    return marker_exists and (any(_tree_hit(r) for r in roots) if roots else True)


def analyze(text, depth=0):
    if BLOCK[0] or depth > 4:
        return
    segs, nested, reds = split_segments(text)
    seg_words = [_words(seg) for seg in segs]
    for words in seg_words:
        record_assignments(words, varmap)
    for tg in reds:
        if _write_hit(tg):
            BLOCK[0] = True; return
    # `PRODUCER | xargs MUTATOR` feeds the mutator its operands from stdin, so the
    # marker named in a producer segment (`echo .figma-fidelity.pending | xargs rm`,
    # `find . -name .figma-fidelity.pending | xargs rm`) never reaches the mutator
    # as its own operand. When a destructive xargs is present, check the OUTPUT of
    # producer segments only - NOT a grep pattern or an xargs `-a` input file, which
    # merely READ the marker text (those were false-blocked before).
    xargs_destructive = False
    for words in seg_words:
        if any(os.path.basename(normalize_word(x, varmap)[0]) == "xargs" for x in words):
            xb, xa = head_and_args(words, varmap)
            if classify(xb, xa)[2]:
                xargs_destructive = True
                break
    if xargs_destructive:
        PRODUCERS = {"echo", "printf", "ls", "dirname", "basename", "realpath", "readlink"}
        for words in seg_words:
            hb, ha = head_and_args(words, varmap)
            if hb == "find":
                if _find_matches_marker(ha):
                    BLOCK[0] = True; return
            elif hb in PRODUCERS:
                for w in ha:
                    if w.startswith("-"):
                        continue
                    # echo/printf emit each arg; printf interprets \n \t \0 etc., so
                    # `printf '.figma-fidelity.pending\n'` outputs the bare filename.
                    # Split on those escapes (and whitespace) and check each token.
                    lit = normalize_word(w, varmap)[0]
                    for piece in re.split(r"\\[nrt0]|\s+|\n", lit):
                        piece = piece.strip()
                        if piece and _write_hit(piece):
                            BLOCK[0] = True; return
        # a heredoc can BE the xargs stdin (`xargs rm <<EOF\nmarker\nEOF`); each
        # body line is then an operand.
        for body in heredoc_bodies:
            for ln in body.split("\n"):
                if ln.strip() and _write_hit(ln.strip()):
                    BLOCK[0] = True; return
    for words in seg_words:
        # `S='rm marker'; $S` - an UNQUOTED $VAR that holds a command word-splits and
        # runs as that command. normalize_word would fold it into one head string, so
        # re-expand a bare unquoted $VAR/${VAR} to its value and re-analyze it.
        exp, changed = [], False
        for w in words:
            m = re.match(r"^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$", w)
            if m and m.group(1) in varmap:
                exp.append(varmap[m.group(1)]); changed = True
            else:
                exp.append(w)
        if changed:
            analyze(" ".join(exp), depth + 1)
            if BLOCK[0]:
                return

    for seg in segs:
        words = _words(seg)
        base, args = head_and_args(words, varmap)
        writes, trees, mut = classify(base, args)
        if not mut and marker_exists and ("$" in base or "`" in base):
            # command name obfuscated behind an unresolved expansion; while armed,
            # treat any operand resolving to the marker as a write.
            writes = [a for a in args if not a.startswith("-")]
        for tg in writes:
            if _write_hit(tg):
                BLOCK[0] = True; return
        for tg in trees:
            if _tree_hit(tg):
                BLOCK[0] = True; return
        for p in payloads(seg, base):
            analyze(p, depth + 1)
            if BLOCK[0]:
                return
    for nt in nested:
        analyze(nt, depth + 1)
        if BLOCK[0]:
            return


try:
    analyze(cmd)
    print("BLOCK" if BLOCK[0] else "")
except Exception:
    # A parser crash must not silently open the gate during an armed build.
    print("BLOCK" if marker_exists else "")
PYEOF
}

# Attribution forbidden by CLAUDE.md
if echo "$CMD" | grep -qE 'Co-Authored-By|Generated with Claude|Co-Authored by Claude'; then
  REASON="BLOCKED: command contains forbidden attribution. CLAUDE.md mandates no Co-Authored-By or Claude attribution in commits."
fi

# Force-push to main/master.
#
# Matches command_slices, NOT the raw command and NOT CMD_CODE. This gate reads
# ARGUMENTS - which flag, which branch - so CMD_CODE (which deletes quoted spans)
# would be the wrong normalization: it is the same mistake that would have neutered
# the kill gate. command_slices keeps the arguments while dropping prose, so a beat
# or an echo naming the command passes and a real push still goes red.
#
# Reading the slice rather than the raw string also closes a hole the old regex had:
# it demanded `git` IMMEDIATELY followed by `push`, so `git -C /repo push --force
# origin main` - a real force-push - sailed straight through. The head word of the
# slice is already known to be git, so the ordering constraint is no longer load-
# bearing and the global-option shapes are covered for free.
_GIT_PUSH_SLICES=$(command_slices 'git' 'push')
if [ -z "$REASON" ] && [ -n "$_GIT_PUSH_SLICES" ] \
   && printf '%s' "$_GIT_PUSH_SLICES" | grep -qE '(--force|[[:space:]]-f([[:space:]]|$)).*(main|master)'; then
  REASON="BLOCKED: force-push to main/master requires explicit user authorization."
fi

# Destructive ops on memory dirs.
#
# Also slice-based: the gate's whole job is to read the PATH the rm acts on. The old
# raw match blocked any string containing the words, so a beat documenting this very
# rule, or a grep for it, was denied.
#
# `git rm` is included deliberately - the old regex caught it only by accident (it
# matched the bare substring `rm `), and dropping it would have quietly narrowed the
# guard while the tests still passed.
_RM_SLICES=$(printf '%s\n%s' "$(command_slices 'rm')" "$(command_slices 'git' 'rm')")
if [ -z "$REASON" ] && printf '%s' "$_RM_SLICES" | grep -qE '\.claude/memory'; then
  REASON="BLOCKED: rm against .claude/memory destroys session beats. Move to trash or rename instead."
fi

# Opting out of the Figma-fidelity gate is FORBIDDEN (hardened 2026-07-18; re-
# hardened 2026-07-17, Jonah, folding the Codex bypass review). The arming record
# .figma-fidelity.pending is written by the arm hook and cleared by the Stop gate -
# both HOOK processes, not Bash tool calls, so they are unaffected by this guard.
# The ONLY way to clear an armed node is a covering check in .figma-fidelity.json
# (the Stop gate verifies it, then rm's the marker itself). Deleting / moving /
# truncating / editing / ALIASING / redirecting-over the marker to drop an armed
# line is blocked by _figma_marker_verdict (its header explains the full parser).
# Reading it (cat/grep/head/tail, sed WITHOUT -i) stays allowed; .measuring and
# .json writes stay allowed. ROOT derived exactly as the arm/stop hooks derive it,
# so the marker path matches the file they manage. The verdict scan is skipped
# entirely unless a build is armed (marker present) OR the command mentions the
# `figma-fidelity` substring - which survives quote/backslash obfuscation and the
# split-printf form, unlike the exact filename - keeping the common Bash call
# cheap. The only way to reach the marker WITHOUT that substring is an alias,
# which cannot exist unless the marker exists (so the armed branch covers it).
if [ -z "$REASON" ]; then
  _FIGMA_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  _FIGMA_MARKER="$_FIGMA_ROOT/.figma-fidelity.pending"
  if [ -f "$_FIGMA_MARKER" ] || printf '%s' "$CMD" | grep -qF 'figma-fidelity'; then
    if [ "$(_figma_marker_verdict)" = "BLOCK" ]; then
      REASON="BLOCKED: you may not delete, move, truncate, edit, alias (symlink/hardlink), or redirect over .figma-fidelity.pending. Opting out of the Figma-fidelity gate is forbidden - cover the node with a check in .figma-fidelity.json and the Stop gate clears the marker on a pass. For a reference-only look that must not arm the gate, use get_screenshot (it does not fire the arm hook)."
    fi
  fi
fi

# Level 2 (tamper-evident ledger): the Figma-fidelity ledger's signing key
# ~/.claude/.fidelity-secret is off-limits to the Bash tool. Reading it would let
# the agent forge signed `resolve` entries and opt out of pixel validation; there
# is never a legitimate reason for a build to touch it (the arm hook and Stop gate,
# both HOOK processes, are the only readers). This is DEFENSE IN DEPTH behind the
# HMAC - tampering is already DETECTED and blocked by the Stop gate - so a plain,
# quote-surviving basename-substring match is proportionate to the threat model (a
# lazy self-opt-out, not a determined forger). Jonah, working in his own shell,
# is not gated by hooks and keeps his manual override.
if [ -z "$REASON" ]; then
  if printf '%s' "$CMD" | grep -qF '.fidelity-secret'; then
    REASON="BLOCKED: ~/.claude/.fidelity-secret is the Figma-fidelity ledger's signing key and is off-limits to the Bash tool. Reading it would let you forge signed ledger entries to opt out of pixel validation, and you never need to touch it. Cover the node with a check in .figma-fidelity.json and the Stop gate signs the ledger itself."
  fi
fi

# Legacy model IDs in any command.
#
# This used `grep -qP` with a PCRE negative lookahead. BSD grep - which is what
# /usr/bin/grep is on macOS, and what a hook actually gets - has no -P. It printed
# "invalid option -- P" to stderr and exited non-zero. `grep -q` exiting non-zero
# reads as "no match", so REASON stayed empty and this guard blocked NOTHING for
# its entire life. Verified 2026-07-10: four banned identifiers, four allows.
#
# It tested clean by hand because an interactive shell here resolves `grep` to
# ugrep, which DOES support -P. The guard was inert where it ran and healthy where
# it was tested. Same shape as validation-guard.sh reading the wrong tool_input
# key. A guard nobody has watched go red is a guard nobody has.
#
# Portable ERE has no lookahead, so neutralise the one allowed exception first,
# then match plainly. Regression tests: test-validation-guards.sh, "legacy model".
_MODELSCAN="$(printf '%s' "$CMD" | sed -e 's/gpt-4o-mini-tts/_ALLOWED_TTS_/g')"
if [ -z "$REASON" ] && printf '%s' "$_MODELSCAN" | grep -qE 'gpt-4o|gpt-4\.1|gpt-3\.5|gpt-4[^o.-]|claude-3-(opus|sonnet|haiku)'; then
  REASON="BLOCKED: legacy model ID detected. CLAUDE.md mandates latest model versions only."
fi

# Session key, shared by the memory-dirty gate and the screenshot gate below.
#
# Derivation is duplicated VERBATIM in memory-nudge.sh, screenshot-open-mandate.sh
# and screenshot-open-clear.sh (the WRITERS). If you change it, change all of them:
# a writer and a reader that disagree on the path do not error, they make the gate
# FAIL OPEN - it silently stops blocking and nobody notices, because a gate that
# never fires is indistinguishable from a gate with nothing to catch.
#
# Empty/missing session_id falls back to "global": the writers do the same, so an
# id-less session still arms and still blocks. Failing open here would turn any
# payload missing the field into a free pass through both gates.
_SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$_SESSION_KEY" ] && _SESSION_KEY=global

# Memory-before-commit gate: block git commit if memory is dirty.
# Matches CMD_CODE (see is_real_git_commit) so prose quoting the command passes.
#
# The flag is PER-SESSION (.memory-dirty.<session>). It was one global file until
# 2026-07-17, so with several sessions live one session's edit blocked every other
# session's commit, and one session's beat discharged every other session's debt.
# memory-nudge.sh is the writer. See its header for the full account.
if [ -z "$REASON" ] && is_real_git_commit; then
  if [ -f "$HOME/.claude/.memory-dirty.$_SESSION_KEY" ]; then
    REASON="BLOCKED: beats are dirty. A project file was edited but the session beat has not been written. Write a beat to .claude/memory/ FIRST, then commit."
  fi
fi

# Verification gate: block git commit if deployed code not browser-verified
# BUT: allow documentation/config-only commits (SKILL.md, *.md, JSON files, etc.)
if [ -z "$REASON" ] && is_real_git_commit; then
  if [ -f "$HOME/.claude/.needs-verification" ]; then
    # Check if staged files are documentation/config only
    STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)
    HAS_SOURCE_CODE=false

    while IFS= read -r file; do
      # Documentation files: skip verification requirement
      if echo "$file" | grep -qE '\.md$|SKILL\.md|DESIGN\.md|README|CHANGELOG'; then
        continue
      # Config files: skip verification requirement
      elif echo "$file" | grep -qE '\.json$|\.yml$|\.yaml$|\.lock$|\.eslintrc|tsconfig'; then
        continue
      # UI / FRONT-END files: require visual (browser) verification - these actually render.
      # Plain .ts/.js/.mjs (CLI, engine, hooks, scripts, tests), .sh, .py, and compiled dist
      # output are NOT browser-renderable and are EXEMPT. The old rule required verification
      # for ALL .ts/.js and false-blocked every backend/CLI/hook commit (fixed 2026-06-27).
      elif echo "$file" | grep -qE '\.(tsx|jsx|css|scss|sass|less|vue|svelte|astro|html?)$'; then
        HAS_SOURCE_CODE=true
        break
      # Plain .ts/.js/.mjs ONLY under a clearly front-end path (a real UI surface).
      elif echo "$file" | grep -qE '(^|/)(marketing-site|reference-site|components?|pages|views|ui|widgets)/.*\.(ts|js|mjs)$'; then
        HAS_SOURCE_CODE=true
        break
      fi
    done <<< "$STAGED_FILES"

    if [ "$HAS_SOURCE_CODE" = true ]; then
      REASON="BLOCKED: code was deployed but not verified in the browser. Use Chrome MCP or cmux screenshot to verify BEFORE committing."
    fi
  fi
fi

# Screenshot-open mandate: if a prior screenshot was captured to disk and not
# yet Read, block further screenshot captures and commit-style commands. The
# only way out is to Read the pending path so the image actually surfaces in
# the conversation. Mandate enforced by screenshot-open-mandate.sh (captures
# the path) and screenshot-open-clear.sh (clears on Read).
#
# The pending state is keyed by SESSION and holds a LIST of outstanding paths. It
# used to be one global file with one path, so a Read in any of the concurrent
# cmux sessions discharged every other session's obligation, and a second capture
# erased the first's. Key derivation is duplicated verbatim in
# screenshot-open-mandate.sh and screenshot-open-clear.sh; change all three.
# Reuses _SESSION_KEY (derived once above, identical logic) rather than shelling
# out to python3 a second time on every Bash call.
_SHOT_PENDING="$HOME/.claude/.screenshot-pending.$_SESSION_KEY"

if [ -z "$REASON" ] && [ -s "$_SHOT_PENDING" ]; then
  PENDING_SHOT=$(head -1 "$_SHOT_PENDING" 2>/dev/null)
  _SHOT_N=$(wc -l < "$_SHOT_PENDING" 2>/dev/null | tr -d ' ')
  if [ "${_SHOT_N:-1}" -gt 1 ]; then
    PENDING_SHOT="$PENDING_SHOT (and $((_SHOT_N - 1)) more)"
  fi
  if [ -n "$PENDING_SHOT" ]; then
    # Block additional screenshots until the pending one is opened.
    # A REAL `cmux ... screenshot` invocation only - writing a beat that says
    # "take a cmux screenshot next" is prose, and prose is not a capture.
    if [ -n "$(command_slices 'cmux' 'screenshot')" ]; then
      REASON="BLOCKED: a previous screenshot at $PENDING_SHOT was captured but never Read. Open it first with the Read tool. Capturing more screenshots without opening the prior one means the user can't see what you claim to have verified."
    fi
    # Block commit-style commands until the pending screenshot is opened
    if [ -z "$REASON" ] && is_real_git_commit; then
      REASON="BLOCKED: an unread screenshot is pending at $PENDING_SHOT. Open it (Read tool) before committing - validation claims require visible proof, not just disk-side capture."
    fi
  fi
fi

# Validation-via-cmux-eval guard. The chrome MCP javascript_tool has its own
# PreToolUse hook (validation-guard.sh) that blocks JS shortcutting real user
# interactions. cmux runs through Bash, so it can sneak past that. Mirror the
# full trigger-blocking patterns here so cmux eval can't be used to bypass.
# The blocklist must stay equivalent in scope to validation-guard.sh -
# any divergence becomes a bypass route. See CLAUDE.md Verification Protocol #2.
#
# Activates only when the command actually contains a real `cmux ... eval`
# invocation. Setup eval calls (bundle injection: document.createElement('script'),
# appendChild, delete window.__justify) don't match these patterns and are allowed.
#
# Anti-false-block: T-0003 (self-block of commit 50fc1b0). Prose mentions of the
# blocklist patterns inside HEREDOC bodies, inside `-m "..."` strings, or inside
# any other quoted argument do NOT execute as JS. The slice extraction that made
# that true now lives in command_slices() at the top of this file, shared with the
# screenshot and kill-justify gates - this gate was where it was invented, and a
# second hand-rolled copy in each of those gates would drift out of step.
if [ -z "$REASON" ] && printf '%s' "$CMD" | grep -q 'cmux'; then
  CMUX_EVAL_SLICE=$(command_slices 'cmux' 'eval')

  if [ -n "$CMUX_EVAL_SLICE" ]; then
    # Feature-detection signal: typeof checks, CSS.supports, `'feature' in window/document`,
    # navigator.userAgent, and window.matchMedia are needed for capability detection
    # (prefers-reduced-motion, prefers-color-scheme, View Transitions API, etc.) and
    # don't expose DOM state. We allow these IFF the slice also doesn't match any
    # blocked pattern below - mixing feature detection with DOM probing is still blocked.
    CMUX_FEATURE_DETECT=false
    if echo "$CMUX_EVAL_SLICE" | grep -qE "\btypeof\s|CSS\.supports\(|'[a-zA-Z][a-zA-Z0-9_]*'\s+in\s+(window|document)|\"[a-zA-Z][a-zA-Z0-9_]*\"\s+in\s+(window|document)|navigator\.userAgent|window\.matchMedia\("; then
      CMUX_FEATURE_DETECT=true
    fi

    CMUX_TRIGGER_REASON=""
    # --- write/invoke shortcuts (synthetic state mutation) ---
    if echo "$CMUX_EVAL_SLICE" | grep -qE '\.click\(\s*\)'; then
      CMUX_TRIGGER_REASON="cmux eval contains synthetic .click() - bypasses the real click event path."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.dispatchEvent\('; then
      CMUX_TRIGGER_REASON="cmux eval contains dispatchEvent - synthesizes events instead of triggering them via real input."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\._[a-zA-Z][a-zA-Z0-9_]*\s*\('; then
      CMUX_TRIGGER_REASON="cmux eval invokes a private (_underscore-prefixed) method - skips the user-facing flow that would normally fire it."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '(window\.)?__justify\.[a-zA-Z_][a-zA-Z0-9_]*\s*\('; then
      CMUX_TRIGGER_REASON="cmux eval invokes a method on the __justify application namespace - skips the user-facing path."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\._[a-zA-Z][a-zA-Z0-9_]*\.(push|splice|shift|unshift|pop)\s*\('; then
      CMUX_TRIGGER_REASON="cmux eval mutates a private application array - the user can't reach this without a real interaction."
    # --- read shortcuts (DOM inspection that isn't what a user sees) ---
    elif echo "$CMUX_EVAL_SLICE" | grep -qE 'getComputedStyle|getBoundingClientRect|\.scrollTop|\.scrollHeight|\.offsetHeight|\.offsetWidth|\.offsetLeft|\.offsetTop|\.clientWidth|\.clientHeight|\.scrollWidth|\.scrollLeft|\.textContent|\.innerHTML|\.innerText'; then
      CMUX_TRIGGER_REASON="cmux eval inspects DOM state via developer APIs (getComputedStyle/getBoundingClientRect/scroll dims/text content) - that's DevTools-grade probing, not what a user sees."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.style[\.\[]'; then
      CMUX_TRIGGER_REASON="cmux eval reads element.style - inline-style inspection is a developer shortcut. Take a screenshot and verify the visual result."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.classList'; then
      CMUX_TRIGGER_REASON="cmux eval inspects classList - CSS-class presence is a developer shortcut. Verify the visual effect via screenshot."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.className'; then
      CMUX_TRIGGER_REASON="cmux eval reads className - class-name inspection is a developer shortcut. Verify the visual result via screenshot."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.(hasAttribute|getAttribute)\('; then
      CMUX_TRIGGER_REASON="cmux eval inspects DOM attributes (hasAttribute/getAttribute) - a developer shortcut. Interact with the element and verify its behavior like a user would."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.matches\('; then
      CMUX_TRIGGER_REASON="cmux eval uses .matches() - a developer shortcut for selector validation. Verify the element visually."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.closest\('; then
      CMUX_TRIGGER_REASON="cmux eval uses .closest() - a developer shortcut for DOM structure validation. Verify structure visually."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE 'querySelectorAll\([^)]*\)\s*\.length'; then
      CMUX_TRIGGER_REASON="cmux eval counts elements via querySelectorAll.length - a developer shortcut. Look at the page to see how many items are present."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE 'querySelectorAll\([^)]*\)\s*\)\s*\.(forEach|map|filter|every|some|reduce)'; then
      CMUX_TRIGGER_REASON="cmux eval iterates DOM query results - a developer inspection pattern. Navigate the page and verify each item visually."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE 'window\.(innerWidth|innerHeight)'; then
      CMUX_TRIGGER_REASON="cmux eval checks viewport dimensions - a developer shortcut. Use resize_window then screenshot to verify."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '(!!\s*document\.querySelector|document\.querySelector[^A]*\s*(!==?|===?)\s*null|Boolean\s*\(\s*document\.querySelector)'; then
      CMUX_TRIGGER_REASON="cmux eval checks element existence via JS - a developer shortcut. Look at the page via screenshot to confirm the element is visible."
    elif echo "$CMUX_EVAL_SLICE" | grep -qE '\.(disabled|checked|selected)\b'; then
      CMUX_TRIGGER_REASON="cmux eval reads form-element state (.disabled/.checked/.selected) - a developer shortcut. Click the form element and observe its behavior like a user would."
    fi

    # Feature-detection early-exit: if the slice matched a feature-detection pattern
    # AND did NOT match any blocked pattern above, allow it through silently.
    if [ "$CMUX_FEATURE_DETECT" = true ] && [ -z "$CMUX_TRIGGER_REASON" ]; then
      : # explicitly allow read-only feature detection
    elif [ -n "$CMUX_TRIGGER_REASON" ]; then
      REASON="BLOCKED: $CMUX_TRIGGER_REASON Use cmux click/type/press/screenshot for real interactions. Use 'snapshot --interactive' for the element tree. Do not validate UI by directly invoking app methods or reading computed state - that proves nothing about what the human sees. Read-only feature detection (typeof, CSS.supports, 'feat' in window, navigator.userAgent, window.matchMedia) is allowed if the eval does only that."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Justify watch: an agent may NEVER stop the watch, and may never kill the
# worker that applies the user's changes.
#
# 2026-07-09 (Jonah): Claude ran `justify-watch-disarm` to "unblock itself" while
# a worker was mid-run, then killed the worker. The user's queued Send-All
# batches silently stopped being applied and nothing told him. The watch IS the
# product; turning it off is the user's call alone.
#
# The daemon enforces this independently (server/consent.ts requires a single-use
# token that only a TTY-attached human can mint), and the CLI refuses without a
# TTY. This hook is the third layer: it stops the agent before the request is
# even made, and explains what to do instead.
#
# Anti-false-block (precedent: T-0003, the self-block of commit 50fc1b0): a hook
# that blocks PROSE about a command is a hook someone weakens. This gate matches
# CMD_CODE (quoted spans and heredoc bodies stripped - defined at the top of the
# file and now shared with the commit gates), so writing a beat, echoing an
# instruction, or grepping for the name all pass, while an actual
# `justify-watch-disarm` in command position does not.

# Must be in COMMAND POSITION: start of line, or after ; && || | ( - optionally
# behind `sudo` and/or VAR=val prefixes. A bare space is NOT enough, or the name
# appearing as an argument (`for f in justify-watch-disarm justify-serve`,
# `cp cli/justify-watch-disarm.sh ...`) gets blocked, which is a false positive
# that teaches people to disable the guard.
if [ -z "$REASON" ] && echo "$CMD_CODE" | grep -qE '(^|[;&|()]+)[[:space:]]*(sudo[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*justify-watch-disarm([[:space:]]|;|$)'; then
  REASON="BLOCKED: only the user may disarm the Justify watch. Disarming stops Justify from receiving their changes, silently. Ask them to run 'justify-watch-disarm' themselves in their terminal - it requires a TTY and a typed confirmation, and the daemon refuses any disarm without a single-use human consent token. Do not work around this."
fi

# The disarm/consent endpoints. Slice-based for the same reason as the gates above:
# the URL is an ARGUMENT, so the gate must read what curl is actually pointed at,
# which rules out CMD_CODE (a quoted URL would be deleted outright). The old raw
# match denied any command that merely contained the URL as text - documenting the
# endpoint in a beat, or grepping for it, was a block.
_CURL_SLICES=$(command_slices 'curl')
if [ -z "$REASON" ] && [ -n "$_CURL_SLICES" ] \
   && printf '%s' "$_CURL_SLICES" | grep -qE '(localhost|127\.0\.0\.1):9[0-9]{3}/watch/(disarm|consent)'; then
  REASON="BLOCKED: the /watch/disarm and /watch/consent endpoints are the user's, not yours. The daemon will refuse an agent anyway (no consent token). If the user wants the watch stopped, they run 'justify-watch-disarm' themselves."
fi

# The state file is the watch's source of truth. Editing/deleting it is disarming
# by another name.
#
# This gate has TWO ways to be tripped, and they need two different reads:
#   - a COMMAND acting on the file (rm / mv / truncate / tee) -> command_slices,
#     because the filename is an argument;
#   - a REDIRECT into the file (`echo '{}' > watch-state.json`) -> redirect_targets,
#     because there the shell itself is the writer and the head word is only `echo`.
# The old raw regex conflated them by looking for the literal characters `>` or a
# command name anywhere near the path, which is why prose about the file - a beat
# explaining this very rule - was blocked.
_WS_SLICES=$(command_slices 'rm|mv|truncate|tee')
_WS_REDIRECTS=$(redirect_targets)
if [ -z "$REASON" ] \
   && printf '%s\n%s' "$_WS_SLICES" "$_WS_REDIRECTS" \
      | grep -qE 'justify/(watch-state|disarm-consent)\.json'; then
  REASON="BLOCKED: do not write or delete the Justify watch-state / consent files directly. That is disarming the watch behind the user's back. Ask the user to run 'justify-watch-disarm'."
fi

# Killing the worker abandons the user's queued batch mid-apply. Case-insensitive:
# the real worker matches on `claude -p You are the Justify headless...` with a
# capital J, which a case-sensitive pattern let straight through.
#
# This matched the RAW command, so it blocked PROSE about killing a worker - it
# denied me mid-session for merely typing the words while testing another gate
# (2026-07-12). Note it canNOT use CMD_CODE: that strips quoted spans, and the
# process this gate protects lives INSIDE the quotes (`pkill -f "Justify
# headless"`). De-quoting it would leave a guard that blocks nothing at all.
# command_slices keeps the arguments, so the gate reads what pkill actually
# targets while a mention of it in an echo or a beat stays inert.
_KILL_SLICES=$(command_slices 'kill|pkill|killall')
if [ -z "$REASON" ] && [ -n "$_KILL_SLICES" ] && printf '%s' "$_KILL_SLICES" | grep -qi 'justify'; then
  REASON="BLOCKED: do not kill Justify daemon or worker processes. A killed worker abandons the user's queued Send-All batch. If a worker looks stuck, wait for its watchdog (JUSTIFY_WORKER_TIMEOUT_SECS, default 1800s) or tell the user. The dispatcher retries on its own and NEVER disarms."
fi

if [ -n "$REASON" ]; then
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
else
  echo '{}'
fi
