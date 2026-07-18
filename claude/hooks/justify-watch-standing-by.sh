#!/usr/bin/env bash
#
# justify-watch-standing-by.sh - DUAL-EVENT hook for the persistent watch owner.
# Non-blocking on Stop; reply-suppressing on UserPromptSubmit. Branches on
# hook_event_name so ONE file owns both jobs.
#
# WHY THIS HOOK EXISTS AT ALL
# ---------------------------
# justify-watch is a persistent watch owner: parked and idle IS its job. It waits
# for Justify Send-All batches to claim and apply. It NEVER finishes. When it
# parks it sends the lead a mailbox frame:
#
#   <teammate-message teammate_id="justify-watch" color="blue">
#   {"type":"idle_notification","from":"justify-watch","timestamp":"...","idleReason":"available"}
#   </teammate-message>
#
# That routine "available" ping needs no answer. Two separate problems flow from
# it, and this file addresses both.
#
# ===========================================================================
# JOB 1 (UserPromptSubmit) - THE REPLY-SUPPRESSOR  [primary; added 2026-07-17]
# ===========================================================================
# Left alone, the incoming heartbeat wakes the lead, which burns a whole turn
# replying "standing by" / "nothing to act on" to a ping that needs no reply.
# In a real ppai session the lead answered ~8 consecutive heartbeats this way and
# made no progress (Jonah, verbatim: "Idle heartbeats are NOT prompts - do not
# reply to them."). The ONLY way to stop that is to intercept BEFORE the reply is
# composed. A Stop hook cannot: Stop fires AFTER the turn, and a Stop
# {"decision":"block"} CONTINUES the turn, the opposite of suppression.
#
# So on UserPromptSubmit, if the INCOMING prompt (or, as a fallback, the newest
# user message in the transcript) carries a REAL justify-watch idle heartbeat,
# this hook returns {"decision":"block", ...} - the prompt is dropped, the lead
# never composes a reply, and the turn is never burned. Detection reuses the exact
# same envelope / from==teammate_id / exact-name / not-failed-or-interrupted guards
# as Job 2, so a quoted, mismatched, or non-watch frame never trips it and a REAL
# watch failure is never swallowed (a failed/interrupted watch DESERVES the lead's
# eyes and is passed through untouched).
#
# ===========================================================================
# JOB 2 (Stop) - THE DISPLAY CORRECTOR  [legacy; unchanged behavior]
# ===========================================================================
# THE FALSE FLAG: the lead's terminal renders that idle frame through an Ink
# component compiled into the claude binary. The verb is a hardcoded three-way
# ternary over idleReason:
#   idleReason === "failed"      -> "failed"
#   idleReason === "interrupted" -> "was interrupted"
#   anything else (incl. "available", undefined) -> "finished"
# So an idle justify-watch prints "Teammate @justify-watch finished" - a LIE. The
# verb lives in the compiled renderer (no setting, no env var, no per-agent branch
# - every teammate shares that one path), so the honest fix is to APPEND the truth
# right after the false line, scoped to the one agent for which it is false. On the
# lead's Stop this branch prints, via systemMessage, exactly one line:
#
#   Teammate justify-watch standing by.
#
# ONE LINE. Never a paragraph. This fires on every park and Jonah explicitly banned
# narrating the watch ("Don't need you wasting vertical space in the terminal
# blabbing about the justify-watch. We get it."). If Job 1's block is honored the
# heartbeat is dropped from context and this branch simply finds nothing to annotate;
# if the block is NOT honored (or Job 1 is not wired) this legacy correction still
# stands as the fallback. Narrow by construction so the true signal survives:
#   - Any other agent name        -> silent. "finished" stands. That is correct.
#   - justify-watch failed/interrupted -> silent. The harness already renders the
#     true "failed" / "was interrupted"; it must not be masked.
# Fires once per idle event (deduped on the frame's own timestamp), never blocks,
# exits 0 on every path.
#
# Watch owners: JUSTIFY_WATCH_AGENT_NAMES, a comma-separated list of EXACT names
# (default "justify-watch"). EXACT, never a prefix - a prefix match would sweep up
# an ordinary agent named justify-watchdog / justify-watch-review and either
# suppress its prompt or annotate it "standing by", destroying the true completion
# signal the lead depends on. The risk is asymmetric: over-matching breaks a
# load-bearing signal, under-matching merely leaves the status quo. So this errs
# narrow, and the env var widens it by hand.
#
# WIRING: bind this file to UserPromptSubmit (Job 1 - the suppressor) and,
# optionally, Stop (Job 2 - the legacy display correction). See app-wirings.json.
# Tests: test-justify-watch-standing-by.sh

set -uo pipefail

INPUT=$(cat 2>/dev/null)

EVENT=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    print(str(json.load(sys.stdin).get("hook_event_name","") or ""))
except Exception:
    print("")' 2>/dev/null)

# ===========================================================================
# JOB 1 - UserPromptSubmit: suppress the reply to a justify-watch heartbeat.
# ===========================================================================
if [ "$EVENT" = "UserPromptSubmit" ]; then
  HEARTBEAT=$(HOOK_INPUT="$INPUT" \
              WATCH_NAMES="${JUSTIFY_WATCH_AGENT_NAMES:-justify-watch}" \
              python3 <<'PYEOF' 2>/dev/null
import json, os, re

# EXACT names, never prefixes (see header). The env var widens by hand.
owners = {p.strip() for p in os.environ.get("WATCH_NAMES", "").split(",") if p.strip()}
if not owners:
    owners = {"justify-watch"}

# A frame only counts inside a real <teammate-message> envelope whose teammate_id
# matches the frame's own "from". Scanning loose text for the JSON would fire on a
# QUOTED frame - a pasted prompt, a DM discussing this bug - and suppress a prompt
# that never was a heartbeat.
ENVELOPE = re.compile(r'<teammate-message\b([^>]*)>(.*?)</teammate-message>', re.DOTALL)
TEAMMATE_ID = re.compile(r'teammate_id\s*=\s*"([^"]*)"')
FRAME = re.compile(r'\{[^{}]*"type"\s*:\s*"idle_notification"[^{}]*\}')

def _try(s):
    try:
        return json.loads(s)
    except Exception:
        return None

def is_watch_heartbeat(text):
    """True iff text is a BARE delivery of a REAL idle_notification from a watch
    owner whose idleReason is the routine 'available'/finished kind (NOT
    failed/interrupted - a real failure deserves the lead's eyes and must not be
    suppressed)."""
    if not text or "idle_notification" not in text:
        return False
    envs = list(ENVELOPE.finditer(text))
    if not envs:
        return False
    # The frame must be essentially the WHOLE delivery. A human pasting an envelope
    # inside their own prose (a question, a sentence, or debugging this very bug)
    # must NOT have that prompt silently eaten. For a suppression hook a false
    # negative is merely the status quo (the lead answers as before); a false
    # positive ERASES real user input. So err strict: only a bare machine delivery
    # - nothing outside the envelope, or a short single-line preamble with no
    # question mark - is eligible. (Codex Medium, 2026-07-17.)
    residual = ENVELOPE.sub("\n", text).strip()
    if residual and (len(residual) > 60 or "\n" in residual or "?" in residual):
        return False
    for m in envs:
        attrs, body = m.group(1), m.group(2)
        tid_m = TEAMMATE_ID.search(attrs)
        if not tid_m:
            continue
        tid = tid_m.group(1)
        stripped = body.strip()
        j = _try(stripped)
        if j is not None:
            candidates = [j]
        else:
            candidates = [f for f in (_try(fm.group(0)) for fm in FRAME.finditer(body)) if f is not None]
        for f in candidates:
            if not isinstance(f, dict) or f.get("type") != "idle_notification":
                continue
            name = str(f.get("from") or "")
            # The envelope and the frame must agree, or it is not a real
            # notification from that agent.
            if name != tid:
                continue
            if name not in owners:
                continue
            if str(f.get("idleReason") or "") in ("failed", "interrupted"):
                continue
            return True
    return False

try:
    data = json.loads(os.environ.get("HOOK_INPUT", "") or "{}")
except Exception:
    data = {}

# UserPromptSubmit delivers the submitted text in "prompt" - that is the single
# authoritative source for what the lead is about to answer. We deliberately do
# NOT scan the transcript for older heartbeats: a real prompt that merely follows
# an earlier park would then be blocked (Codex High, 2026-07-17).
print("1" if is_watch_heartbeat(str(data.get("prompt") or "")) else "")
PYEOF
)
  if [ "$HEARTBEAT" = "1" ]; then
    # Drop the turn entirely: the lead never composes a reply, never burns a turn.
    # ONE terse reason - Jonah's vertical-space rule applies here too. Do not
    # "helpfully" re-expand this string.
    printf '%s' '{"decision":"block","reason":"justify-watch idle heartbeat - not a prompt, no reply needed."}'
  fi
  exit 0
fi

# ===========================================================================
# JOB 2 - Stop: correct the false "finished" verb for an idle watch owner.
# ===========================================================================

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
