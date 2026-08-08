#!/usr/bin/env bash
#
# declared-broken-guard.sh - Stop hook. Curbs "declared a capability dead without
# diagnosing it."
#
# FIELD ORIGIN (2026-08-07, session_2026-08-07_tool-declared-broken-direct-order-
# failure.md): Jonah ordered "spawn an agent." Two identical Agent spawns 404'd, and
# instead of tracing the delta (a resumed session whose team dir was never created -
# a ~30s fix) the assistant DECLARED "agent spawning is broken this session" and did
# the whole task by hand. The unifying failure mode: treating first resistance from a
# user-named tool as license to abandon it, rather than as the start of a diagnosis.
#
# WHAT THIS GATE DOES: at Stop it reads the finished response. If that response
# asserts a capability is DEAD (a tight, anchored lexicon below) AND the current turn
# shows NO diagnostic effort against it - no Bash call, no file-inspection call, no
# varied retry of the failing tool - it BLOCKS ONCE with a diagnose-first nudge.
#
# WHAT IT DELIBERATELY DOES NOT DO: judge whether a Bash call was "really" aimed at
# the failing tool. That is a semantic call this repo has scars from making too
# broadly (session_2026-07-26_visual-gate-narrowed.md). Diagnostic effort here is a
# SHAPE check: did the turn contain any inspection tool at all, or a second differing
# attempt at some tool. A turn with even one Bash call passes. This is a speed-bump at
# the moment of rationalization, not a semantic judge - the honest limit noted in the
# field beat is that no hook makes the model WANT to diagnose; H1 (the team-file auto-
# heal) removes the discretion for the specific bug, and this gate raises the cost of
# the general rationalization.
#
# CARVE-OUTS (all PASS, no block):
#   1. The USER themselves called the tool broken/unavailable this session.
#   2. The response cites external outage evidence (a status page, a probed outage) -
#      the GitHub-Actions-outage case earlier that same session was a LEGIT declared-
#      broken because githubstatus was curled and returned major_outage.
#   3. No capability-dead assertion at all -> nothing to enforce.
#   Plus: if the response ALSO says the capability was fixed/now works, that is a
#   diagnosis that succeeded - pass.
#
# ANTI-LOOP (a Stop hook that blocks on prose shape can deadlock a session):
#   Layer 1  stop_hook_active - never block a stop that is already a hook continuation.
#   Layer 2  once-per-burst flag keyed by session id. If it exists we ALLOW. Cleared
#            only by a CLEAN stop, so at most one block lands per violation burst.
#   Layer 2a CROSS-GATE DEFERRAL. concise-detect-stop.sh and elias-detect-stop.sh run
#            at the same Stop event and each tells the model to re-send its previous
#            message a DIFFERENT way. The model can only re-send once, so if either has
#            already claimed this burst we stay silent (wire this gate AFTER those two
#            in the Stop array so the deferral is effective). Their gates do not check
#            our flag, which is why the deferral is one-directional and ordering-based.
#   Layer 3  atomic claim (noclobber) on the flag, so two concurrent Stop processes
#            cannot both block.
#   Layer 4  every failure path exits 0 (fail-open) via the EXIT trap below.
# When in doubt this hook ALLOWS. A missed declaration costs one nudge; a block loop
# costs the session.
#
# The lexicons live INLINE below on purpose: the grounding cluster deploys .sh files
# only, so a sibling .txt lexicon would install inert on any other machine.

set -euo pipefail
# Fail-open, always. The block signal for a Stop hook is the stdout JSON decision,
# never the exit code, so forcing exit 0 on every path cannot suppress a legitimate
# block - it can only prevent a hook error from wedging every Stop.
trap 'exit 0' EXIT

LOG_FILE="$HOME/.claude/.declared-broken-blocks.log"

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

BLOCKED_FLAG="$HOME/.claude/.declared-broken-stop-blocked.$SESSION_KEY"
CONCISE_FLAG="$HOME/.claude/.concise-stop-blocked.$SESSION_KEY"
ELIAS_FLAG="$HOME/.claude/.elias-stop-blocked.$SESSION_KEY"

# Reap flags older than 24h so an abandoned session cannot mute (or ambush) a future one.
find "$HOME/.claude" -maxdepth 1 -name '.declared-broken-stop-blocked.*' -type f -mtime +1 -delete 2>/dev/null || true

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
# Detection. Emits six lines: SKIP=, BROKEN=, DIAG=, USERBROKE=, EVIDENCE=,
# SAMPLE=. SAMPLE is emitted LAST and newline-stripped/truncated so the bash-side
# cut -d= -f2- can never be confused by an "=" inside it. Any parse failure prints
# nothing, which bash reads as "allow".
# ---------------------------------------------------------------------------
DETECT=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null || true
import json, os, re, sys

# --- TUNABLE LEXICON --------------------------------------------------------
# A capability-dead assertion. The generic "broken / not working" forms are anchored
# to a CAPABILITY subject so "the old approach is broken" (subject = approach, not a
# tool) never matches; the session/action-scoped forms are specific enough to stand
# alone. Every phrase is a direct sibling of one in the field report's H2 spec.
CAP = (r"(?:spawn(?:ing)?|agent[- ]?spawn(?:ing)?|the\s+agent\s+tool|agents?|"
       r"subagents?|teammates?|the\s+tool|this\s+tool|that\s+tool|the\s+command|"
       r"the\s+capability|the\s+feature|the\s+mcp(?:\s+\w+)?|\bmcp\b|the\s+browser|"
       r"the\s+server|the\s+skill|the\s+hook|the\s+api|the\s+endpoint)")

BROKEN_RE = re.compile(
    r"(?ix)("
    # capability-anchored "is broken / down / dead / not working / unavailable"
    r"\b" + CAP + r"\s+(?:is|are|'?s|seems?\s+(?:to\s+be\s+)?|appears?\s+(?:to\s+be\s+)?|"
    r"looks?\s+(?:to\s+be\s+)?)\s*(?:currently\s+|completely\s+|totally\s+|just\s+|"
    r"apparently\s+|now\s+)?(?:broken|dead|down|busted|unavailable|failing|"
    r"non[- ]?functional|not\s+working|not\s+available)\b"
    r"|\b" + CAP + r"\s+(?:is\s?n['’]?t|are\s?n['’]?t|is\s+not|are\s+not)\s+working\b"
    # standalone session/action-scoped declarations
    r"|\bnot\s+working\s+(?:this\s+session|right\s+now|at\s+the\s+moment|currently)\b"
    r"|\b(?:un)?available\s+this\s+session\b"
    r"|\bunavailable\s+(?:right\s+now|currently)\b"
    r"|\b(?:is\s+)?broken\s+this\s+session\b"
    r"|\bca(?:n['’]?t|nnot)\s+(?:spawn|use|run|invoke|launch|start|reach|call|access)\b"
    r"|\bunable\s+to\s+(?:spawn|use|run|invoke|launch|start|reach|call|access)\b"
    r"|\bcapability\s+is\s+broken\b"
    r"|\bhad\s+to\s+(?:do|handle|complete|finish)\s+(?:it|this|the\s+\w+)\s+(?:myself|manually|by\s+hand)\b"
    r"|\bhad\s+to\s+work\s+around\b"
    r")"
)

# If the response ALSO reports the capability recovered, the model diagnosed and fixed
# it - that is exactly the behavior the gate wants, so it passes. Kept narrow (past-
# tense resolution) so "couldn't fix it" / "worked around it" do NOT count as resolved.
RESOLVED_RE = re.compile(
    r"(?ix)("
    r"\b(?:but|then|so|and|,)\s+(?:i\s+|we\s+)?(?:fixed|repaired|resolved|patched|healed)\b"
    r"|\b(?:fixed|repaired|resolved|patched|healed)\s+it\b"
    r"|\bnow\s+works?\b|\bworks?\s+now\b|\bworking\s+now\b|\bworking\s+again\b"
    r"|\bback\s+(?:up|online|working)\b"
    r"|\bgot\s+it\s+(?:working|running)\b"
    r"|\bup\s+and\s+running\b"
    r"|\bafter\s+(?:the\s+)?(?:fix|repair|repairing|reinit|recreating)\b"
    r"|\bonce\s+(?:i|we)\s+(?:fixed|repaired|recreated|reinitialized)\b"
    r")"
)

# Carve-out 2: the response cites EXTERNAL outage evidence. A real status probe is a
# legitimate basis for declaring-broken, so this passes.
EVIDENCE_RE = re.compile(
    r"(?ix)("
    r"\bstatus\s*page\b|\bstatuspage\b|\bgithubstatus\b|\bstatus\.[a-z]"
    r"|\bmajor[_\s]outage\b|\bpartial[_\s]outage\b|\bdegraded[_\s]performance\b"
    r"|\bincident\s+report\b|\bknown\s+(?:outage|incident)\b|\breported\s+outage\b"
    r"|\bstatus\s+(?:page\s+)?(?:shows|reports|confirms)\b|\bshows\s+(?:a\s+)?(?:major\s+)?outage\b"
    r"|\bdown\s+for\s+everyone\b|\bofficial\s+status\b|\bservice\s+(?:is\s+)?down\b"
    r")"
)

# Carve-out 1: the USER's own words called it broken/unavailable. Deliberately looser
# than BROKEN_RE - this is a pass condition, so erring toward "the user flagged it"
# is the safe direction.
USER_BROKE_RE = re.compile(
    r"(?ix)("
    r"\bis\s+broken\b|\bis\s+down\b|\bis\s+dead\b|\bnot\s+working\b|\bisn['’]?t\s+working\b"
    r"|\bunavailable\b|\bbroken\s+this\s+session\b|\bit['’]?s\s+broken\b"
    r"|\bca(?:n['’]?t|nnot)\s+(?:spawn|use|run|invoke|launch|access)\b"
    r")"
)

# Tools that constitute diagnostic effort when they appear in the turn.
DIAG_TOOLS = {"Bash", "BashOutput", "Read", "Grep", "Glob", "LS", "NotebookRead"}
# A couple of obviously-diagnostic MCP inspection tools (console / network / page reads).
DIAG_TOOL_RE = re.compile(r"(?i)(read_console|read_network|read_page|get_page_text)")

FENCE_RE = re.compile(r"(?ms)^[ \t]{0,3}(?:```|~~~).*?(?:^[ \t]{0,3}(?:```|~~~)[ \t]*$|\Z)")


def emit(skip="", broken=0, diag=0, userbroke=0, evidence=0, sample=""):
    print("SKIP=" + str(skip).replace("\n", " "))
    print("BROKEN=" + str(int(broken)))
    print("DIAG=" + str(int(diag)))
    print("USERBROKE=" + str(int(userbroke)))
    print("EVIDENCE=" + str(int(evidence)))
    print("SAMPLE=" + str(sample).replace("\n", " ")[:120])
    sys.exit(0)


def block_text(blocks):
    if not isinstance(blocks, list):
        return ""
    return "\n".join(
        b.get("text", "") for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    )


def tool_uses(blocks):
    """(name, canonical-input) for every tool_use block in an assistant message."""
    out = []
    if not isinstance(blocks, list):
        return out
    for b in blocks:
        if isinstance(b, dict) and b.get("type") == "tool_use":
            name = b.get("name", "") or ""
            try:
                canon = json.dumps(b.get("input", {}), sort_keys=True, default=str)
            except Exception:
                canon = ""
            out.append((name, canon))
    return out


last_assistant = ""
last_assistant_line = -1
# Genuine user prompts (line_no, text). A tool_result echo carries no text and is not
# a prompt, so it never resets the turn boundary mid-turn.
user_prompts = []
# Every assistant turn's tool_use blocks, tagged with the line they appeared on, so we
# can slice out just the CURRENT turn after finding the last user prompt.
tool_events = []
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
                    last_assistant_line = line_no
                    last_ok_assistant_line = line_no
                for tu in tool_uses(content):
                    tool_events.append((line_no, tu[0], tu[1]))
            elif e.get("type") == "user":
                text = content if isinstance(content, str) else block_text(content)
                if text.strip():
                    user_prompts.append((line_no, text))
except Exception:
    emit(skip="unreadable-transcript")

if not last_assistant.strip():
    emit(skip="no-assistant-text")

# A parse failure AFTER the judged response means the final text may be truncated.
if last_bad_line > last_ok_assistant_line:
    emit(skip="unparseable-line-after-response")

# Turn boundary = the last genuine user prompt. Everything after it is this turn.
turn_start = user_prompts[-1][0] if user_prompts else -1

# --- Detection 1: capability-dead assertion in the finished response ---------
# Grade prose only: a broken-looking string inside a fenced code block (e.g. a pasted
# error line) is not the response's own assertion.
prose = FENCE_RE.sub(" ", last_assistant)
m = BROKEN_RE.search(prose)
if not m:
    emit(broken=0)  # carve-out 3: nothing asserted dead.

# The recovered-capability carve-out.
if RESOLVED_RE.search(prose):
    emit(broken=1, diag=1, sample=(m.group(0).strip()[:120]))

sample = m.group(0).strip()[:120]

# --- Carve-out 1: the user's own words ---------------------------------------
recent_user = "\n".join(t for _, t in user_prompts[-2:])
userbroke = 1 if USER_BROKE_RE.search(recent_user) else 0

# --- Carve-out 2: external outage evidence -----------------------------------
evidence = 1 if EVIDENCE_RE.search(prose) else 0

# --- Detection 2: diagnostic effort this turn --------------------------------
turn_tools = [(name, canon) for (ln, name, canon) in tool_events if ln > turn_start]
diag = 0
seen = {}
for name, canon in turn_tools:
    if name in DIAG_TOOLS or DIAG_TOOL_RE.search(name or ""):
        diag = 1
    seen.setdefault(name, set()).add(canon)
# A second DIFFERING attempt at any one tool is a varied retry (two identical attempts
# are not - that is the field failure: two identical Agent spawns, then "broken").
if diag == 0:
    for name, inputs in seen.items():
        if len(inputs) >= 2:
            diag = 1
            break

emit(broken=1, diag=diag, userbroke=userbroke, evidence=evidence, sample=sample)
PYEOF
)

# No output at all -> detection failed -> allow.
[ -z "${DETECT:-}" ] && exit 0

field() { printf '%s\n' "$DETECT" | grep "^$1=" | head -1 | cut -d= -f2-; }

SKIP_REASON=$(field SKIP || true)
BROKEN=$(field BROKEN || true);       case "$BROKEN"    in ''|*[!0-9]*) BROKEN=0 ;; esac
DIAG=$(field DIAG || true);           case "$DIAG"      in ''|*[!0-9]*) DIAG=0 ;; esac
USERBROKE=$(field USERBROKE || true); case "$USERBROKE" in ''|*[!0-9]*) USERBROKE=0 ;; esac
EVIDENCE=$(field EVIDENCE || true);   case "$EVIDENCE"  in ''|*[!0-9]*) EVIDENCE=0 ;; esac
SAMPLE=$(field SAMPLE || true)

[ -n "$SKIP_REASON" ] && exit 0

# Violation = a capability-dead assertion with NO diagnosis and NO carve-out.
VIOLATION=0
if [ "$BROKEN" = "1" ] && [ "$DIAG" = "0" ] && [ "$USERBROKE" = "0" ] && [ "$EVIDENCE" = "0" ]; then
  VIOLATION=1
fi

# Clean stop -> re-arm the gate for the next burst.
if [ "$VIOLATION" -eq 0 ]; then
  rm -f "$BLOCKED_FLAG" 2>/dev/null || true
  exit 0
fi

# Layer 2a: CROSS-GATE DEFERRAL. If concise or elias already claimed this burst, stay
# silent - the model can only re-send its previous message one way. Placed AFTER the
# clean-stop re-arm above so a clean response still clears this gate's own flag.
[ -f "$CONCISE_FLAG" ] && exit 0
[ -f "$ELIAS_FLAG" ] && exit 0

# Layer 2: a block already landed in this burst. Allow, and keep the flag.
[ -f "$BLOCKED_FLAG" ] && exit 0

# Layer 3: atomic claim. Exactly one concurrent Stop can create the flag.
mkdir -p "$HOME/.claude" 2>/dev/null || true
if ! (set -o noclobber; : > "$BLOCKED_FLAG") 2>/dev/null; then
  exit 0
fi

CAP_LABEL="a capability"
[ -n "$SAMPLE" ] && CAP_LABEL="\"$SAMPLE\""
REASON="BLOCKED (declared-broken without diagnosis). You declared $CAP_LABEL broken, but the turn shows no diagnostic effort against it - no Bash or inspection call, no varied retry. A tool that errors is a diagnosis target, not a verdict. Trace the delta first (what changed since it last worked, where the tool looks, one varied retry), or retry it - do not route around a user-named tool on first resistance. Re-send your previous message only after you have run those steps, or after retrying the tool. Do not comment on this block. If the user themselves called it broken, or an external status probe confirms an outage, say so plainly. This gate fires once, then stays quiet until a clean response."

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
printf '%s  DECLARED-BROKEN-BLOCK  sample=%s  session=%s\n' \
  "$(date '+%Y-%m-%d %H:%M:%S')" "${SAMPLE:-none}" "$SESSION_KEY" >> "$LOG_FILE" 2>/dev/null || true

REASON="$REASON" python3 -c '
import json, os
print(json.dumps({"decision": "block", "reason": os.environ["REASON"]}))
'
exit 0
