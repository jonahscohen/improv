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

# Memory-before-commit gate: block git commit if memory is dirty.
# Matches CMD_CODE (see is_real_git_commit) so prose quoting the command passes.
if [ -z "$REASON" ] && is_real_git_commit; then
  if [ -f "$HOME/.claude/.memory-dirty" ]; then
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
_SHOT_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$_SHOT_KEY" ] && _SHOT_KEY=global
_SHOT_PENDING="$HOME/.claude/.screenshot-pending.$_SHOT_KEY"

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
