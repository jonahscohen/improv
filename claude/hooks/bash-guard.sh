#!/bin/bash
# PreToolUse hook for Bash. Blocks commands matching forbidden patterns.
# Reads hook input JSON from stdin, emits permissionDecision JSON to stdout.

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

REASON=""

# Attribution forbidden by CLAUDE.md
if echo "$CMD" | grep -qE 'Co-Authored-By|Generated with Claude|Co-Authored by Claude'; then
  REASON="BLOCKED: command contains forbidden attribution. CLAUDE.md mandates no Co-Authored-By or Claude attribution in commits."
fi

# Force-push to main/master
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git[[:space:]]+push.*(--force|[[:space:]]-f[[:space:]]).*(main|master)'; then
  REASON="BLOCKED: force-push to main/master requires explicit user authorization."
fi

# Destructive ops on memory dirs
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+)?(-[a-zA-Z]*f[a-zA-Z]*[[:space:]]+)?.*\.claude/memory'; then
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

# Memory-before-commit gate: block git commit if memory is dirty
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git\s+commit'; then
  if [ -f "$HOME/.claude/.memory-dirty" ]; then
    REASON="BLOCKED: beats are dirty. A project file was edited but the session beat has not been written. Write a beat to .claude/memory/ FIRST, then commit."
  fi
fi

# Verification gate: block git commit if deployed code not browser-verified
# BUT: allow documentation/config-only commits (SKILL.md, *.md, JSON files, etc.)
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git\s+commit'; then
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
    # Block additional screenshots until the pending one is opened
    if echo "$CMD" | grep -qE 'cmux\b[^|;&]*\bscreenshot\b'; then
      REASON="BLOCKED: a previous screenshot at $PENDING_SHOT was captured but never Read. Open it first with the Read tool. Capturing more screenshots without opening the prior one means the user can't see what you claim to have verified."
    fi
    # Block commit-style commands until the pending screenshot is opened
    if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'git\s+commit'; then
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
# any other quoted argument do NOT execute as JS. We strip HEREDOC bodies and
# anchor `cmux` to a real command-start position before running the inner
# blocklist checks so a commit message body that documents the rules can't trip
# the guard.
if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'cmux\b[^|;&]*\beval\b'; then
  # Pass $CMD via env var so the Python source (which contains both ' and ")
  # can be wrapped in a clean dash-D heredoc without quote-escaping headaches.
  CMUX_EVAL_SLICE=$(CMUX_EVAL_CMD="$CMD" python3 <<'PYEOF'
import os, re
cmd = os.environ.get("CMUX_EVAL_CMD", "")
# Step 1: strip HEREDOC bodies. The body text is literal data passed to another
# tool (git commit, cat, etc.) - not executed shell or executed JS. Without this
# step, a commit message that documents the blocklist trips the hook.
lines = cmd.split("\n")
kept = []
in_hd = False
delim = ""
dash = False
for line in lines:
    if in_hd:
        chk = line.lstrip() if dash else line
        if chk == delim:
            in_hd = False
        continue
    m = re.search(r"<<(-?)\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\2", line)
    if m:
        dash = (m.group(1) == "-")
        delim = m.group(3)
        in_hd = True
    kept.append(line)
stripped = "\n".join(kept)
# Step 2: extract cmux ... eval ... invocation slices, scanning quote-aware so
# shell separators inside the quoted JS argument do not truncate the slice.
# `cmux` must sit at a real command-start position (start of input, or right
# after one of ;&|()\n{}) - a prose mention inside a quoted -m string is
# preceded by space + quote-content, not by a starter, so it does not match.
slices = []
n = len(stripped)
CMD_STARTERS = ";&|()\n{}"
i = 0
while i < n:
    idx = stripped.find("cmux", i)
    if idx < 0:
        break
    j = idx - 1
    while j >= 0 and stripped[j] in " \t":
        j -= 1
    if j >= 0 and stripped[j] not in CMD_STARTERS:
        i = idx + 4
        continue
    if idx + 4 < n and (stripped[idx+4].isalnum() or stripped[idx+4] == "_"):
        i = idx + 4
        continue
    k = idx + 4
    in_sq = in_dq = False
    eval_seen = False
    while k < n:
        c = stripped[k]
        if in_sq:
            if c == "'":
                in_sq = False
            k += 1
            continue
        if in_dq:
            if c == "\\" and k + 1 < n:
                k += 2
                continue
            if c == '"':
                in_dq = False
            k += 1
            continue
        if c == "'":
            in_sq = True
            k += 1
            continue
        if c == '"':
            in_dq = True
            k += 1
            continue
        if c in ";&|\n":
            break
        if not eval_seen and stripped[k:k+4] == "eval":
            left = stripped[k-1] if k > 0 else " "
            right = stripped[k+4] if k+4 < n else " "
            if not (left.isalnum() or left == "_") and not (right.isalnum() or right == "_"):
                eval_seen = True
        k += 1
    if eval_seen:
        slices.append(stripped[idx:k])
    i = k + 1
print("\n".join(slices))
PYEOF
)

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
# that blocks PROSE about a command is a hook someone weakens. Strip quoted
# strings and heredoc bodies before looking for a bare invocation, so writing a
# beat, echoing an instruction, or grepping for the name all pass, while an
# actual `justify-watch-disarm` in command position does not.
CMD_CODE=$(printf '%s' "$CMD" | python3 -c '
import sys, re
s = sys.stdin.read()
# heredoc bodies first (their content is data, not code)
s = re.sub(r"<<-?\s*[\x27\"]?(\w+)[\x27\"]?.*?^\1\s*$", " ", s, flags=re.S | re.M)
s = re.sub(r"\x27[^\x27]*\x27", " ", s)   # single-quoted spans
s = re.sub(r"\"[^\"]*\"", " ", s)          # double-quoted spans
print(s)' 2>/dev/null || printf '%s' "$CMD")

# Must be in COMMAND POSITION: start of line, or after ; && || | ( - optionally
# behind `sudo` and/or VAR=val prefixes. A bare space is NOT enough, or the name
# appearing as an argument (`for f in justify-watch-disarm justify-serve`,
# `cp cli/justify-watch-disarm.sh ...`) gets blocked, which is a false positive
# that teaches people to disable the guard.
if [ -z "$REASON" ] && echo "$CMD_CODE" | grep -qE '(^|[;&|()]+)[[:space:]]*(sudo[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*justify-watch-disarm([[:space:]]|;|$)'; then
  REASON="BLOCKED: only the user may disarm the Justify watch. Disarming stops Justify from receiving their changes, silently. Ask them to run 'justify-watch-disarm' themselves in their terminal - it requires a TTY and a typed confirmation, and the daemon refuses any disarm without a single-use human consent token. Do not work around this."
fi

if [ -z "$REASON" ] && echo "$CMD" | grep -qE 'curl[^|;]*(localhost|127\.0\.0\.1):9[0-9]{3}/watch/(disarm|consent)'; then
  REASON="BLOCKED: the /watch/disarm and /watch/consent endpoints are the user's, not yours. The daemon will refuse an agent anyway (no consent token). If the user wants the watch stopped, they run 'justify-watch-disarm' themselves."
fi

# The state file is the watch's source of truth. Editing/deleting it is disarming
# by another name.
if [ -z "$REASON" ] && echo "$CMD" | grep -qE '(rm|mv|truncate|tee|>|>>)[^|;]*justify/(watch-state|disarm-consent)\.json'; then
  REASON="BLOCKED: do not write or delete the Justify watch-state / consent files directly. That is disarming the watch behind the user's back. Ask the user to run 'justify-watch-disarm'."
fi

# Killing the worker abandons the user's queued batch mid-apply. Case-insensitive:
# the real worker matches on `claude -p You are the Justify headless...` with a
# capital J, which a case-sensitive pattern let straight through.
if [ -z "$REASON" ] && echo "$CMD" | grep -qiE '(kill|pkill|killall)([[:space:]]+-[a-zA-Z0-9]+)*[[:space:]]+[^;|]*justify'; then
  REASON="BLOCKED: do not kill Justify daemon or worker processes. A killed worker abandons the user's queued Send-All batch. If a worker looks stuck, wait for its watchdog (JUSTIFY_WORKER_TIMEOUT_SECS, default 1800s) or tell the user. The dispatcher retries on its own and NEVER disarms."
fi

if [ -n "$REASON" ]; then
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
else
  echo '{}'
fi
