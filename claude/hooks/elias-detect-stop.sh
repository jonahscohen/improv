#!/usr/bin/env bash
#
# elias-detect-stop.sh - Stop hook. Mechanical enforcement for ELIAS mode.
#
# elias-mandate.sh injects the stakeholder ruleset when ELIAS is on. This gate reads the
# finished response at Stop and blocks ONCE when it still carries an engineering artifact a
# stakeholder response can never legitimately contain: a fenced code block, a filesystem
# path, a shell command line, or two-or-more code-cased identifiers in backticks. It
# enforces ruleset rules 1, 3 and 4.
#
# WHAT THIS HOOK DELIBERATELY DOES NOT DO: judge jargon by a curated technical-term
# wordlist. A wordlist is the wrong first build, and not merely because it is false-positive
# prone: it fires HARDEST on the exact behavior the ruleset ASKS for. Ruleset rule 4
# explicitly permits naming an unavoidable term once and defining it in the same breath, and
# a wordlist cannot tell "we hit a race condition, meaning two things ran at once and
# collided" from a jargon dump, so it would punish compliance. This repo already has the scar
# (session_2026-07-26_visual-gate-narrowed.md). What IS mechanically checkable with near-zero
# ambiguity is artifact SHAPE, which is what this gate keys on. Prose that is merely
# technical in flavour passes untouched. The jargon wordlist is deferred to phase 2, after a
# real corpus of ELIAS-on responses is measured (the way concise's volume gate was).
#
# ONE DELIBERATE INVERSION versus concise-detect-stop.sh: that gate SKIPS a response that is
# predominantly code. This gate must NOT. Under ELIAS, a wall of code the reader did not ask
# for IS the violation. The legitimate "user wanted code" case is handled one level up, at
# the PROMPT (TECH_REQUEST_RE / PROMPT_ARTIFACT_RE below), which is higher precision.
#
# ANTI-LOOP (a Stop hook that blocks on prose shape can deadlock a session):
#   Layer 1  stop_hook_active - never block a stop that is already a hook continuation.
#   Layer 2  once-per-burst flag keyed by session id. If it exists we ALLOW. Cleared only
#            by a CLEAN stop, so at most one block lands per violation burst.
#   Layer 2a CROSS-GATE DEFERRAL (the fifth layer, unique to the two-gate arrangement).
#            concise-detect-stop.sh runs at the same Stop event and can block the same
#            response with a contradictory instruction. Whichever gate claims the burst
#            first owns it; the other stays silent when it sees the other's flag. Exactly one
#            block lands regardless of hook ordering, which is not guaranteed.
#   Layer 3  atomic claim (noclobber) on the flag, so two concurrent Stop processes cannot
#            both block.
#   Layer 4  every failure path exits 0 (fail-open) via the EXIT trap below.
# When in doubt this hook ALLOWS.
#
# SKIPS ENTIRELY when: ELIAS mode is off (~/.claude/.elias-enabled absent), or the user's
# last two prompts asked for the technical layer or already contained a path or a code fence.
#
# The lexicons live INLINE below. They are not sibling data files on purpose: the grounding
# cluster deploys .sh files only, so a .txt lexicon would install inert on any other machine.

set -euo pipefail
# Fail-open, always. The block signal for a Stop hook is the stdout JSON decision, never the
# exit code, so forcing exit 0 on every path cannot suppress a legitimate block.
trap 'exit 0' EXIT

LOG_FILE="$HOME/.claude/.elias-blocks.log"

STDIN_JSON=$(cat)

# Layer 1: never block a stop that is itself a hook continuation.
ACTIVE=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print("1" if json.load(sys.stdin).get("stop_hook_active") else "0")
except Exception:
    print("0")
' 2>/dev/null || echo 0)
[ "$ACTIVE" = "1" ] && exit 0

# ELIAS mode off -> this gate has nothing to enforce. Note: "||", not "&&" - ABSENT is off.
[ -f "$HOME/.claude/.elias-enabled" ] || exit 0

SESSION_KEY=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s if s not in ("", ".", "..") else "global")
' 2>/dev/null || echo global)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global

BLOCKED_FLAG="$HOME/.claude/.elias-stop-blocked.$SESSION_KEY"
CONCISE_FLAG="$HOME/.claude/.concise-stop-blocked.$SESSION_KEY"

# Reap flags older than 24h so an abandoned session cannot mute (or ambush) a future one.
find "$HOME/.claude" -maxdepth 1 -name '.elias-stop-blocked.*' -type f -mtime +1 -delete 2>/dev/null || true

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("transcript_path", "") or "")
except Exception:
    pass
' 2>/dev/null || true)
[ -z "$TRANSCRIPT" ] && exit 0
[ -f "$TRANSCRIPT" ] || exit 0

# ---------------------------------------------------------------------------
# Detection. Emits six lines: SKIP=, FENCE=, PATHS=, CMDS=, IDENTS=, SAMPLE=.
# SAMPLE is emitted LAST and is newline-stripped and truncated, so the bash-side
# cut -d= -f2- can never be confused by an "=" inside it. Any parse failure prints
# nothing, which bash reads as "allow".
# ---------------------------------------------------------------------------
DETECT=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null || true
import json, os, re, sys

# Phrases in the user's recent prompts that request the technical layer. When present the
# whole gate stands down - the user explicitly asked for code / paths / logs.
TECH_REQUEST_RE = re.compile(r"""(
      \bcode\b | \bsnippet\b | \bdiff\b | \bpatch\b | \bstack\s*trace\b
    | \blog\s+(?:line|output|file)\b | \bthe\s+logs?\b
    | \berror\s+(?:message|string|text)\b
    | \bcommand\b | \bterminal\b | \bshell\b | \bscript\b
    | \bfile\s+(?:path|name)\b | \bwhich\s+file\b | \bwhat\s+file\b | \bshow\s+me\b
    | \bpaste\b | \bverbatim\b | \bexact(?:ly)?\s+(?:string|text|output|wording)\b
    | \bgrep\b | \bregex\b | \brepo\b | \bbranch\b | \bcommit\b | \bpull\s+request\b
    | \btechnical(?:ly)?\b | \bunder\s+the\s+hood\b | \bimplementation\b
    | \bhow\s+(?:does|did)\s+(?:it|that|this)\s+work\b
    | \bdebug\b | \bapi\b | \bendpoint\b | \bquery\b
)""", re.IGNORECASE | re.VERBOSE)

# A literal backtick imbalances macOS bash 3.2's $(...) parser: it scans this
# heredoc body for command substitution, an odd count of literal backticks leaves
# a substitution "open", and it runs to EOF (a "matching backtick" error on every
# stop). Build every backtick below from its codepoint so NONE appears in this
# script - same fix documented in surface-visual-gate.sh. Behavior is identical.
_bt = chr(96)
PROMPT_ARTIFACT_RE = re.compile(r"(?:" + _bt * 3 + r"|~~~|(?<![\w./])/[\w.@+-]+/[\w.@+-]+)")

FENCE_OPEN_RE = re.compile(r"(?m)^[ \t]{0,3}(?:" + _bt * 3 + r"|~~~)")
URL_RE   = re.compile(r"https?://\S+|\bwww\.\S+")
BRAND_RE = re.compile(r"\b(?:node|next|three|vue|d3|express|nuxt|ember|nest|remix|alpine|chart)\.js\b",
                      re.IGNORECASE)

PATH_RE = re.compile(r"""(?:
      (?<![\w.])(?:~|\.{1,2})/[\w.@+-]+(?:/[\w.@+-]+)*
    | (?<![\w./])/[\w.@+-]+/[\w.@+-]+
    | \b[\w-]+(?:/[\w.@+-]+)*\.(?:sh|bash|zsh|py|rb|go|rs|ts|tsx|jsx|mjs|cjs|json|jsonl|ya?ml|toml|ini|cfg|conf|env|lock|md|css|scss|sass|less|html?|xml|sql|java|kt|swift|cpp|hpp|php|pl|lua|vim|plist|log|tsv)\b
)""", re.VERBOSE)

CMD_TOOLS = (r"npm|npx|yarn|pnpm|bun|git|grep|rg|sed|awk|curl|wget|chmod|chown|mkdir|rmdir|rm|"
             r"python3?|deno|bash|zsh|docker|kubectl|brew|pip3?|cargo|rustc|ssh|scp|rsync|"
             r"unzip|xargs|psql|mysql|redis-cli|terraform|ansible|gh|jq|tsc|eslint|prettier|"
             r"pytest|jest|vitest|shellcheck")
CMD_LINE_RE = re.compile(r"^\s*(?:\$\s+)?(?:" + CMD_TOOLS + r")\s+[\w./@-]", re.IGNORECASE)

BACKTICK_RE   = re.compile(_bt + r"([^" + _bt + r"\n]{1,80})" + _bt)
CODE_SHAPE_RE = re.compile(r"""(
      \w+\(\s*\)
    | [a-z0-9]+_[a-z0-9_]+
    | \b[a-z]+[A-Z][A-Za-z0-9]*
    | ^--?[A-Za-z][\w-]*$
    | [{}<>;=]
    | \$\w
)""", re.VERBOSE)


def emit(skip="", fence=0, paths=0, cmds=0, idents=0, sample=""):
    print("SKIP=" + str(skip).replace("\n", " "))
    print("FENCE=" + str(fence))
    print("PATHS=" + str(paths))
    print("CMDS=" + str(cmds))
    print("IDENTS=" + str(idents))
    print("SAMPLE=" + str(sample).replace("\n", " ")[:120])
    sys.exit(0)


def block_text(blocks):
    if not isinstance(blocks, list):
        return ""
    return "\n".join(
        b.get("text", "") for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    )


last_assistant = ""
user_texts = []
# Parse-failure bookkeeping: an unparseable line is not uniformly fatal, but a parse failure
# AFTER the assistant turn we are about to judge means the final response may be truncated,
# so we would be grading the wrong text.
last_ok_assistant_line = -1
last_bad_line = -1
line_no = 0
try:
    with open(os.environ["TRANSCRIPT_PATH"], errors="replace") as f:
        for line in f:
            line_no += 1
            try:
                e = json.loads(line)
            except Exception:
                if line.strip():
                    last_bad_line = line_no
                continue
            if not isinstance(e, dict):
                continue
            # A sidechain entry is a subagent's turn, not this session's response.
            if e.get("isSidechain"):
                continue
            msg = e.get("message", {})
            if not isinstance(msg, dict):
                continue
            content = msg.get("content", [])
            if e.get("type") == "assistant":
                text = block_text(content)
                if text.strip():
                    last_assistant = text
                    last_ok_assistant_line = line_no
            elif e.get("type") == "user":
                # A real prompt is a string or carries text blocks. A tool_result echo has
                # neither, so it never counts as the user's last word.
                text = content if isinstance(content, str) else block_text(content)
                if text.strip():
                    user_texts.append(text)
except Exception:
    emit(skip="unreadable-transcript")

if not last_assistant.strip():
    emit(skip="no-assistant-text")

if last_bad_line > last_ok_assistant_line:
    emit(skip="unparseable-line-after-response")

# The last TWO user texts: a UserPromptSubmit hook's injected context can land as its own
# user entry after the real prompt, and losing sight of the prompt would cost the override.
recent = "\n".join(user_texts[-2:])
if TECH_REQUEST_RE.search(recent) or PROMPT_ARTIFACT_RE.search(recent):
    emit(skip="user-asked-for-the-technical-layer")

# There is NO predominantly-code skip and NO too-little-prose skip. Both are deliberate (D5).
# A one-line answer containing a path is still a violation.

text  = last_assistant
fence = 1 if FENCE_OPEN_RE.search(text) else 0

scrub = URL_RE.sub(" ", text)          # a link to a staging site is fine to give a stakeholder
scrub = BRAND_RE.sub(" ", scrub)       # "Node.js" is a product name, not a filename
scrub = "\n".join(ln for ln in scrub.split("\n") if not ln.lstrip().startswith(">"))

paths  = PATH_RE.findall(scrub)
cmds   = [ln.strip() for ln in scrub.split("\n")
          if CMD_LINE_RE.match(ln) and not ln.rstrip().endswith((".", "!", "?", ":"))]
idents = [m for m in BACKTICK_RE.findall(scrub) if CODE_SHAPE_RE.search(m)]

sample = paths[0] if paths else (cmds[0] if cmds else (idents[0] if idents else ""))
emit(fence=fence, paths=len(paths), cmds=len(cmds),
     idents=(len(idents) if len(idents) >= 2 else 0), sample=sample)
PYEOF
)

# No output at all -> detection failed -> allow.
[ -z "${DETECT:-}" ] && exit 0

field() { printf '%s\n' "$DETECT" | grep "^$1=" | head -1 | cut -d= -f2-; }
SKIP_REASON=$(field SKIP || true)
FENCE=$(field FENCE  || true); case "$FENCE"  in ''|*[!0-9]*) FENCE=0 ;; esac
PATHS=$(field PATHS  || true); case "$PATHS"  in ''|*[!0-9]*) PATHS=0 ;; esac
CMDS=$(field CMDS    || true); case "$CMDS"   in ''|*[!0-9]*) CMDS=0 ;; esac
IDENTS=$(field IDENTS|| true); case "$IDENTS" in ''|*[!0-9]*) IDENTS=0 ;; esac
SAMPLE=$(field SAMPLE || true)

[ -n "$SKIP_REASON" ] && exit 0

# Clean stop -> re-arm this gate for the next burst.
if [ "$FENCE" -eq 0 ] && [ "$PATHS" -eq 0 ] && [ "$CMDS" -eq 0 ] && [ "$IDENTS" -eq 0 ]; then
  rm -f "$BLOCKED_FLAG" 2>/dev/null || true
  exit 0
fi

# Layer 2: a block already landed in this burst. Allow, and keep the flag.
[ -f "$BLOCKED_FLAG" ] && exit 0
# Layer 2a: CROSS-GATE DEFERRAL. If concise already claimed this burst, stay silent.
[ -f "$CONCISE_FLAG" ] && exit 0
# Layer 3: atomic claim. Exactly one concurrent Stop can create the flag.
mkdir -p "$HOME/.claude" 2>/dev/null || true
if ! (set -o noclobber; : > "$BLOCKED_FLAG") 2>/dev/null; then
  exit 0
fi

REASON=""
add() { REASON="${REASON:+$REASON }$1"; }
if [ "$FENCE" -gt 0 ]; then
  add "Rule 3 (no code, paths, commands, or identifiers): your response contains a code block. The reader cannot use it and will not read it. Say what the code changes for them instead."
fi
if [ "$PATHS" -gt 0 ]; then
  add "Rule 3: your response names a file or path (\"$SAMPLE\"). Name the capability or the screen it affects, not the file."
fi
if [ "$CMDS" -gt 0 ]; then
  add "Rule 3: your response contains a command line (\"$SAMPLE\"). Describe the effect, not the invocation."
fi
if [ "$IDENTS" -gt 0 ]; then
  add "Rules 3 and 4: $IDENTS code-shaped names in backticks. Replace each with the plain-language thing it does."
fi
add "Re-send your previous message rewritten for the stakeholder: same facts, same honesty, no engineering artifacts, leading with the outcome. Do not comment on this block. This gate fires once, then stays quiet until a clean response. If the technical layer is genuinely needed, the user can ask for it or say \"elias off\"."

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
printf '%s  ELIAS-BLOCK  fence=%s paths=%s cmds=%s idents=%s  session=%s\n' \
  "$(date '+%Y-%m-%d %H:%M:%S')" "$FENCE" "$PATHS" "$CMDS" "$IDENTS" "$SESSION_KEY" >> "$LOG_FILE" 2>/dev/null || true

REASON="$REASON" python3 -c '
import json, os
print(json.dumps({"decision": "block", "reason": os.environ["REASON"]}))
'
exit 0
