#!/usr/bin/env bash
#
# justify-watch-standing-by.sh - Stop hook, LEAD session. Non-blocking.
#
# THE FALSE FLAG
# --------------
# When a teammate goes idle it sends the lead a mailbox frame:
#
#   <teammate-message teammate_id="justify-watch" color="blue">
#   {"type":"idle_notification","from":"justify-watch","timestamp":"...","idleReason":"available"}
#   </teammate-message>
#
# The lead's terminal renders that frame through an Ink component compiled into
# the claude binary. The verb is a hardcoded three-way ternary over idleReason:
#
#   idleReason === "failed"      -> "failed"
#   idleReason === "interrupted" -> "was interrupted"
#   anything else (incl. "available", undefined) -> "finished"
#
# So an idle justify-watch prints "Teammate @justify-watch finished". That is a
# LIE. justify-watch is a persistent watch owner: parked and idle IS its job. It
# waits for Justify Send-All batches to claim and apply. It never finishes.
#
# WHY THIS HOOK CANNOT SIMPLY REWRITE THE WORD
# --------------------------------------------
# There is no interception point for that string. Verified against the shipped
# binary (2026-07-12, claude 2.1.x):
#   - The verb lives in the compiled Ink renderer. Not a setting, not an env var.
#   - TeammateIdle fires in the TEAMMATE's own process, inside its Stop pipeline.
#     Its outputs are blockingError (fed back to the teammate as "TeammateIdle
#     hook feedback: ...") and preventContinuation. Neither reaches the lead's UI.
#   - MessageDisplay is display-only for STREAMING ASSISTANT TEXT. The idle
#     notification is an attachment component, not assistant text.
#   - The renderer has no per-agent branch: every teammate shares that one code
#     path. So even patching the binary would make EVERY teammate say "standing
#     by", destroying the true completion signal the lead relies on to stand a
#     normal teammate down.
# Terminal output is append-only, so the honest fix is to APPEND the truth right
# after the false line, scoped to the one agent for which it is false.
#
# WHAT THIS DOES
# --------------
# On the lead's Stop, read the transcript, find the most recent teammate idle
# notification, and if it came from a persistent watch owner (justify-watch)
# print, via systemMessage, exactly one line:
#
#   Teammate justify-watch standing by.
#
# ONE LINE. Never a paragraph. This fires on every park, and Jonah explicitly
# banned narrating the watch ("Don't need you wasting vertical space in the
# terminal blabbing about the justify-watch. We get it."). Explaining the verb
# here would make the vertical-space problem worse while fixing the word. The
# reasoning belongs in this header and in the beat, not on his screen every idle.
#
# Narrow by construction, so the true signal survives:
#   - Any other agent name        -> silent. "finished" stands. That is correct.
#   - justify-watch idleReason failed/interrupted -> silent. The harness already
#     renders "failed" / "was interrupted", which is true and must not be masked.
#   - Only the "finished" rendering for justify-watch is corrected.
#
# Fires once per idle event (deduped on the frame's own timestamp), never blocks,
# and exits 0 on every path. A watch owner parking must never wedge the lead.
#
# Agent names treated as persistent watch owners: JUSTIFY_WATCH_AGENT_NAMES, a
# comma-separated list of EXACT names (default "justify-watch"). Exact, not
# prefix: see the note in the parser below.
# Tests: test-justify-watch-standing-by.sh

set -uo pipefail

INPUT=$(cat 2>/dev/null)

# A stop that is itself a hook continuation has already been annotated this cycle.
ACTIVE=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    print("1" if json.load(sys.stdin).get("stop_hook_active") else "0")
except Exception:
    print("0")' 2>/dev/null)
[ "$ACTIVE" = "1" ] && exit 0

TRANSCRIPT=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("transcript_path","") or "")
except Exception:
    pass' 2>/dev/null)
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c 'import json,re,sys
try:
    s = str(json.load(sys.stdin).get("session_id","") or "")
except Exception:
    s = ""
print(re.sub(r"[^A-Za-z0-9._-]", "_", s) or "global")' 2>/dev/null)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global

STATE="$HOME/.claude/.justify-watch-standing-by.$SESSION_KEY"

# Find the newest idle frame BELONGING TO A WATCH OWNER and decide.
# Prints "<frame-timestamp>|<agent-name>" when the lead just rendered a false
# "finished" for a watch owner. Prints nothing otherwise.
HIT=$(TRANSCRIPT_PATH="$TRANSCRIPT" \
      WATCH_NAMES="${JUSTIFY_WATCH_AGENT_NAMES:-justify-watch}" \
      python3 <<'PYEOF' 2>/dev/null
import json, os, re

# EXACT names, never prefixes. A prefix match would sweep up an ordinary agent
# named justify-watchdog or justify-watch-review and annotate it "standing by",
# destroying the true completion signal the lead depends on. The risk is
# asymmetric: over-matching breaks a load-bearing signal, under-matching merely
# leaves the status quo. So this errs narrow, and the env var widens it by hand.
names = {p.strip() for p in os.environ.get("WATCH_NAMES", "").split(",") if p.strip()}
if not names:
    names = {"justify-watch"}

# The frame only counts inside a real <teammate-message> envelope whose
# teammate_id matches the frame's own "from". Scanning loose text for the JSON
# would fire on a QUOTED frame - a pasted prompt, a teammate DM discussing this
# very bug - and annotate an agent that never idled.
ENVELOPE = re.compile(r'<teammate-message\b([^>]*)>(.*?)</teammate-message>', re.DOTALL)
TEAMMATE_ID = re.compile(r'teammate_id\s*=\s*"([^"]*)"')
FRAME = re.compile(r'\{[^{}]*"type"\s*:\s*"idle_notification"[^{}]*\}')

def idle_frames(text):
    """Yield (frame, envelope_teammate_id) for real envelopes only."""
    for m in ENVELOPE.finditer(text):
        attrs, body = m.group(1), m.group(2)
        tid_m = TEAMMATE_ID.search(attrs)
        if not tid_m:
            continue
        tid = tid_m.group(1)
        candidates = []
        stripped = body.strip()
        try:
            candidates.append(json.loads(stripped))
        except Exception:
            candidates = [
                f for f in (
                    _try(fm.group(0)) for fm in FRAME.finditer(body)
                ) if f is not None
            ]
        for f in candidates:
            if isinstance(f, dict) and f.get("type") == "idle_notification":
                yield f, tid

def _try(s):
    try:
        return json.loads(s)
    except Exception:
        return None

hit = None
try:
    with open(os.environ["TRANSCRIPT_PATH"], errors="replace") as fh:
        for line in fh:
            if "idle_notification" not in line:
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            # The lead receives the frame as a user-role message carrying the
            # raw <teammate-message> envelope.
            if e.get("type") != "user":
                continue
            content = e.get("message", {}).get("content", "")
            if isinstance(content, list):
                content = "\n".join(
                    b.get("text", "") for b in content
                    if isinstance(b, dict) and b.get("type") == "text"
                )
            if not isinstance(content, str):
                continue
            for f, tid in idle_frames(content):
                name = str(f.get("from") or "")
                # The envelope and the frame must agree, or it is not a real
                # notification from that agent.
                if name != tid:
                    continue
                if name not in names:
                    continue
                # The newest watch-owner frame is authoritative, WHATEVER its
                # reason. Skipping failed/interrupted frames here instead would
                # leave a stale earlier "available" frame in hand and report a
                # dead watch as standing by - masking a real failure, a worse lie
                # than the one this hook exists to correct.
                #
                # Deliberately NOT "newest frame overall": a normal agent idling
                # after the watch parked must not swallow the watch's correction.
                # Both lines are on screen, and only the watch's is false.
                hit = f
except Exception:
    hit = None

# Mirror the binary's ternary exactly: only the branches that render "finished"
# are false for a watch owner. failed and interrupted are TRUE and are left to
# stand.
if hit and str(hit.get("idleReason") or "") not in ("failed", "interrupted"):
    print(str(hit.get("timestamp") or "") + "|" + str(hit.get("from") or ""))
PYEOF
)

[ -z "$HIT" ] && exit 0

STAMP="${HIT%%|*}"
AGENT="${HIT#*|}"
[ -z "$AGENT" ] && exit 0

# Once per idle event. The frame's own timestamp is the identity of the event, so
# a re-parked watch owner (a new frame, a new stamp) is annotated again.
if [ -f "$STATE" ] && [ "$(cat "$STATE" 2>/dev/null)" = "$STAMP" ]; then
  exit 0
fi
mkdir -p "$(dirname "$STATE")" 2>/dev/null
printf '%s' "$STAMP" > "$STATE" 2>/dev/null

# ONE TERSE LINE. Nothing more.
#
# Jonah, verbatim: "Don't need you wasting vertical space in the terminal blabbing
# about the justify-watch. We get it. Prevent yourself from talking about it."
#
# This hook fires on EVERY idle, so a paragraph here (explaining the "finished"
# verb, that it is a false flag, that the watch is still armed, not to stand it
# down) would make the vertical-space problem WORSE while technically correcting
# the word. The single line IS the correction. Jonah already knows the reasoning -
# he is the one who asked for it to stop being repeated. The reasoning lives in
# the beat and in this file's header, NOT in his terminal on every park.
#
# Do not "helpfully" re-expand this string.
AGENT="$AGENT" python3 -c 'import json, os
print(json.dumps({"systemMessage": "Teammate " + os.environ["AGENT"] + " standing by."}))' 2>/dev/null
exit 0
