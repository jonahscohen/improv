#!/usr/bin/env bash
# Falsification suite for justify-watch-standing-by.sh.
#
# The crux is two-directional. It is not enough that justify-watch reads
# "standing by": a NORMAL teammate must still read "finished". The lead uses that
# completion signal to know when to stand a teammate down, so a hook that
# annotates everything has destroyed the signal, not fixed it.
#
# Every run uses a FAKE $HOME so no test touches real session state.
# Mutants at the bottom prove each branch is load-bearing: a guard that cannot go
# red is not a guard.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/justify-watch-standing-by.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

SID="test-session-jw"

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

# Build a transcript line exactly as the lead records it: the idle frame arrives
# as a user-role message wrapping the raw <teammate-message> envelope.
# $1 agent name, $2 idleReason, $3 frame timestamp
frame_line() {
  AGENT="$1" REASON="$2" STAMP="$3" python3 -c '
import json, os
agent = os.environ["AGENT"]; reason = os.environ["REASON"]; stamp = os.environ["STAMP"]
frame = {"type": "idle_notification", "from": agent, "timestamp": stamp}
if reason:
    frame["idleReason"] = reason
text = ("Another Claude session sent a message:\n"
        "<teammate-message teammate_id=\"" + agent + "\" color=\"blue\">\n"
        + json.dumps(frame) + "\n</teammate-message>\n")
print(json.dumps({"type": "user", "message": {"role": "user", "content": text},
                  "timestamp": stamp, "sessionId": "s"}))'
}

# $1 fake home, $2 transcript path, $3 stop_hook_active -> stdout of hook
run() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":%s}' \
    "$SID" "$2" "${3:-false}" | HOME="$1" bash "$HOOK" 2>/dev/null
}

# $1 fake home, $2 transcript -> exit code
rc() {
  printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' \
    "$SID" "$2" | HOME="$1" bash "$HOOK" >/dev/null 2>&1; echo $?
}

says_standing_by() { printf '%s' "$1" | grep -q "standing by"; }
is_silent()        { [ -z "$(printf '%s' "$1" | tr -d '[:space:]')" ]; }

echo "=== DIRECTION 1: justify-watch going idle reports standing by ==="

FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T10:00:00.000Z" > "$T"
OUT=$(run "$FH" "$T")
says_standing_by "$OUT" && ok "justify-watch idle -> standing by" || bad "justify-watch idle -> standing by"

# It must be valid JSON carrying systemMessage, or the harness shows the user nothing.
printf '%s' "$OUT" | python3 -c 'import json,sys
d = json.load(sys.stdin)
sys.exit(0 if isinstance(d.get("systemMessage"), str) and "standing by" in d["systemMessage"] else 1)' 2>/dev/null \
  && ok "output is valid JSON with a systemMessage field" \
  || bad "output is valid JSON with a systemMessage field"

# TERSENESS IS A REQUIREMENT, NOT A STYLE CHOICE.
# Jonah: "Don't need you wasting vertical space in the terminal blabbing about the
# justify-watch. We get it." This hook fires on EVERY park, so the message must be
# exactly one short line. These assertions exist to stop a future agent from
# "helpfully" re-expanding it into an explanatory paragraph.
printf '%s' "$OUT" | python3 -c 'import json,sys
d = json.load(sys.stdin)
sys.exit(0 if d.get("systemMessage") == "Teammate justify-watch standing by." else 1)' 2>/dev/null \
  && ok "systemMessage is EXACTLY \"Teammate justify-watch standing by.\"" \
  || bad "systemMessage is EXACTLY \"Teammate justify-watch standing by.\" (got: $OUT)"

printf '%s' "$OUT" | python3 -c 'import json,sys
m = json.load(sys.stdin).get("systemMessage","")
# One sentence, one line, no lecturing.
bad_words = ["false flag", "armed", "stand it down", "has not finished", "its job", "harness"]
sys.exit(0 if ("\n" not in m and len(m) <= 60 and not any(w in m for w in bad_words)) else 1)' 2>/dev/null \
  && ok "message stays terse: one line, no explanation (vertical space is the point)" \
  || bad "message re-expanded into a paragraph - Jonah banned narrating the watch"

# The harness omits idleReason entirely on some idle paths; that still renders
# "finished", so it must still be corrected.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "" "2026-07-12T10:05:00.000Z" > "$T"
OUT=$(run "$FH" "$T")
says_standing_by "$OUT" && ok "no idleReason (still renders finished) -> standing by" || bad "no idleReason -> standing by"

echo
echo "=== DIRECTION 2 (THE CRUX): a normal agent completing still reports finished ==="

# The hook must stay SILENT for an ordinary teammate. Silence means the harness's
# own "Teammate @x finished" line stands untouched, which is the true signal.
for agent in codex-arch-review researcher builder reviewer justifier; do
  FH=$(newhome); T="$FH/t.jsonl"
  frame_line "$agent" "available" "2026-07-12T11:00:00.000Z" > "$T"
  OUT=$(run "$FH" "$T")
  is_silent "$OUT" && ok "normal agent '$agent' -> silent (harness 'finished' survives)" \
                   || bad "normal agent '$agent' -> silent (LEAKED: $OUT)"
done

# Names must match EXACTLY. A prefix match would sweep up ordinary agents whose
# names merely START with justify-watch and annotate them "standing by" - which
# is precisely how this fix would destroy the signal it exists to protect.
# (Caught by Codex review, 2026-07-12.)
for agent in justify justify-send justifywatch watch-justify justify-watchdog justify-watch-review justify-watch-2; do
  FH=$(newhome); T="$FH/t.jsonl"
  frame_line "$agent" "available" "2026-07-12T11:10:00.000Z" > "$T"
  OUT=$(run "$FH" "$T")
  is_silent "$OUT" && ok "non-exact name '$agent' -> silent" || bad "non-exact name '$agent' -> silent (LEAKED: $OUT)"
done

echo
echo "=== both agents idle: each line judged on its own truth ==="

# A normal agent idling AFTER the watch parked must not swallow the watch's
# correction: both lines are on screen and only the watch's is false. Taking the
# newest frame overall would silently miss the park. (Caught by Codex review.)
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T12:00:00.000Z" >  "$T"
frame_line "researcher"    "available" "2026-07-12T12:01:00.000Z" >> "$T"
OUT=$(run "$FH" "$T")
says_standing_by "$OUT" && ok "watch parked, then normal agent finished -> watch still annotated" \
                        || bad "watch parked, then normal agent finished -> watch still annotated (MISSED)"

# ...and the correction must name the watch, never the agent that truly finished.
printf '%s' "$OUT" | grep -q "justify-watch" && ! printf '%s' "$OUT" | grep -q "researcher" \
  && ok "correction names justify-watch, not the agent that truly finished" \
  || bad "correction names justify-watch, not the agent that truly finished"

# Reverse ordering.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "researcher"    "available" "2026-07-12T12:00:00.000Z" >  "$T"
frame_line "justify-watch" "available" "2026-07-12T12:01:00.000Z" >> "$T"
OUT=$(run "$FH" "$T")
says_standing_by "$OUT" && ok "normal agent finished, then watch parked -> standing by" \
                        || bad "normal agent finished, then watch parked -> standing by"

echo
echo "=== only a REAL envelope counts: a quoted frame must not fire ==="

# Debugging this very bug means pasting the frame into a prompt. Scanning loose
# text for the JSON would annotate an agent that never idled. (Caught by Codex.)
FH=$(newhome); T="$FH/t.jsonl"
python3 -c '
import json
text = ("Here is the frame the harness sends, for reference:\n"
        "{\"type\":\"idle_notification\",\"from\":\"justify-watch\",\"timestamp\":\"2026-07-12T19:00:00.000Z\"}\n"
        "Why does it print finished?")
print(json.dumps({"type":"user","message":{"role":"user","content":text},"sessionId":"s"}))' > "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "frame quoted in a plain prompt (no envelope) -> silent" \
                 || bad "frame quoted in a plain prompt -> silent (FIRED SPURIOUSLY: $OUT)"

# An envelope whose teammate_id disagrees with the frame's "from" is not a real
# notification from that agent.
FH=$(newhome); T="$FH/t.jsonl"
python3 -c '
import json
text = ("<teammate-message teammate_id=\"researcher\" color=\"blue\">\n"
        "{\"type\":\"idle_notification\",\"from\":\"justify-watch\",\"timestamp\":\"2026-07-12T19:01:00.000Z\"}\n"
        "</teammate-message>")
print(json.dumps({"type":"user","message":{"role":"user","content":text},"sessionId":"s"}))' > "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "envelope teammate_id disagrees with frame 'from' -> silent" \
                 || bad "envelope/frame mismatch -> silent (LEAKED: $OUT)"

echo
echo "=== a REAL justify-watch failure must not be masked as standing by ==="

# The harness renders "failed" / "was interrupted" for these, which is TRUE.
# Claiming "standing by" over a dead watch would be a worse lie than the original.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "failed" "2026-07-12T13:00:00.000Z" > "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "justify-watch FAILED -> silent (real failure survives)" \
                 || bad "justify-watch FAILED -> silent (MASKED: $OUT)"

FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "interrupted" "2026-07-12T13:01:00.000Z" > "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "justify-watch INTERRUPTED -> silent" || bad "justify-watch INTERRUPTED -> silent"

# The watch parks, then genuinely DIES, both before the lead's next Stop. The
# NEWEST watch frame is authoritative: reporting the stale "available" park as
# standing by would mask a real failure, a worse lie than the one being fixed.
# (Caught by Codex on the second review pass, 2026-07-12.)
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T13:10:00.000Z" >  "$T"
frame_line "justify-watch" "failed"    "2026-07-12T13:11:00.000Z" >> "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "parked then FAILED -> silent (stale park does not mask the death)" \
                 || bad "parked then FAILED -> silent (MASKED A REAL FAILURE: $OUT)"

FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available"   "2026-07-12T13:20:00.000Z" >  "$T"
frame_line "justify-watch" "interrupted" "2026-07-12T13:21:00.000Z" >> "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "parked then INTERRUPTED -> silent" || bad "parked then INTERRUPTED -> silent (MASKED: $OUT)"

# ...and the watch recovering after a failure must speak again.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "failed"    "2026-07-12T13:30:00.000Z" >  "$T"
frame_line "justify-watch" "available" "2026-07-12T13:31:00.000Z" >> "$T"
OUT=$(run "$FH" "$T")
says_standing_by "$OUT" && ok "failed then re-parked -> standing by (newest frame wins)" \
                        || bad "failed then re-parked -> standing by"

echo
echo "=== safety: the hook never blocks and never wedges the lead ==="

FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T14:00:00.000Z" > "$T"
[ "$(rc "$FH" "$T")" = "0" ] && ok "exit 0 on annotate (non-blocking)" || bad "exit 0 on annotate"

FH=$(newhome); T="$FH/t.jsonl"
frame_line "researcher" "available" "2026-07-12T14:00:00.000Z" > "$T"
[ "$(rc "$FH" "$T")" = "0" ] && ok "exit 0 on silence" || bad "exit 0 on silence"

FH=$(newhome)
[ "$(rc "$FH" "$FH/missing.jsonl")" = "0" ] && ok "exit 0 on missing transcript" || bad "exit 0 on missing transcript"

FH=$(newhome); T="$FH/t.jsonl"; : > "$T"
OUT=$(run "$FH" "$T")
is_silent "$OUT" && ok "empty transcript -> silent" || bad "empty transcript -> silent"

FH=$(newhome); T="$FH/t.jsonl"; printf 'not json at all\n{"type":"user"}\n' > "$T"
OUT=$(run "$FH" "$T")
{ is_silent "$OUT" && [ "$(rc "$FH" "$T")" = "0" ]; } && ok "garbage transcript -> silent, exit 0" \
                                                      || bad "garbage transcript -> silent, exit 0"

echo
echo "=== dedupe: once per idle event, not once per stop ==="

FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T15:00:00.000Z" > "$T"
OUT1=$(run "$FH" "$T")
OUT2=$(run "$FH" "$T")
{ says_standing_by "$OUT1" && is_silent "$OUT2"; } && ok "same idle event annotated once, second stop silent" \
                                                  || bad "same idle event annotated once, second stop silent"

# A NEW park (new frame, new timestamp) is a new event and must speak again.
frame_line "justify-watch" "available" "2026-07-12T15:30:00.000Z" >> "$T"
OUT3=$(run "$FH" "$T")
says_standing_by "$OUT3" && ok "re-parked watch (new frame) annotated again" || bad "re-parked watch annotated again"

# stop_hook_active means this stop is already a hook continuation.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T16:00:00.000Z" > "$T"
OUT=$(run "$FH" "$T" true)
is_silent "$OUT" && ok "stop_hook_active -> silent" || bad "stop_hook_active -> silent"

echo
echo "=== env override: the watch-owner list is tunable ==="

FH=$(newhome); T="$FH/t.jsonl"
frame_line "my-watcher" "available" "2026-07-12T17:00:00.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" JUSTIFY_WATCH_AGENT_NAMES="justify-watch,my-watcher" bash "$HOOK" 2>/dev/null)
says_standing_by "$OUT" && ok "JUSTIFY_WATCH_AGENT_NAMES adds an owner" || bad "JUSTIFY_WATCH_AGENT_NAMES adds an owner"

# A second watch owner is opted in BY EXACT NAME, which is how justify-watch-2
# would be covered if it ever exists. No prefix magic.
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch-2" "available" "2026-07-12T17:02:00.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" JUSTIFY_WATCH_AGENT_NAMES="justify-watch,justify-watch-2" bash "$HOOK" 2>/dev/null)
says_standing_by "$OUT" && ok "second owner opted in by exact name" || bad "second owner opted in by exact name"

FH=$(newhome); T="$FH/t.jsonl"
frame_line "researcher" "available" "2026-07-12T17:01:00.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" JUSTIFY_WATCH_AGENT_NAMES="justify-watch,my-watcher" bash "$HOOK" 2>/dev/null)
is_silent "$OUT" && ok "override does not widen to unrelated agents" || bad "override does not widen to unrelated agents"

echo
echo "=== MUTANTS: prove each branch is load-bearing (these must go RED) ==="

MUT="$(mktemp -d)/mutant.sh"

# Mutant 1: drop the name filter. Everything would say "standing by", which is
# exactly the failure the crux forbids: the true completion signal is destroyed.
sed 's|if name not in names:|if False:|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "researcher" "available" "2026-07-12T18:00:00.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (no name filter) annotates a normal agent -> suite catches it" \
                        || bad "mutant (no name filter) NOT caught - the name filter is untested"

# Mutant 1b: exact match relaxed to a prefix match. This is the Codex finding
# made executable: justify-watchdog is a normal agent and must keep "finished".
sed 's|if name not in names:|if not any(name == p or name.startswith(p) for p in names):|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watchdog" "available" "2026-07-12T18:00:30.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (prefix match) annotates justify-watchdog -> suite catches it" \
                        || bad "mutant (prefix match) NOT caught - exact matching is untested"

# Mutant 1c: drop the envelope/frame agreement check. A quoted frame would fire.
sed 's|if name != tid:|if False:|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
python3 -c '
import json
text = ("<teammate-message teammate_id=\"researcher\" color=\"blue\">\n"
        "{\"type\":\"idle_notification\",\"from\":\"justify-watch\",\"timestamp\":\"2026-07-12T18:00:45.000Z\"}\n"
        "</teammate-message>")
print(json.dumps({"type":"user","message":{"role":"user","content":text},"sessionId":"s"}))' > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (no envelope check) fires on a mismatched frame -> suite catches it" \
                        || bad "mutant (no envelope check) NOT caught - the envelope check is untested"

# Mutant 2: drop the failed/interrupted guard. A dead watch would be reported as
# standing by, masking a real failure.
sed 's|if hit and str(hit.get("idleReason") or "") not in ("failed", "interrupted"):|if hit:|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "failed" "2026-07-12T18:01:00.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (no failure guard) masks a failure -> suite catches it" \
                        || bad "mutant (no failure guard) NOT caught - the failure guard is untested"

# Mutant 2b: judge the reason per-frame instead of on the newest frame, i.e. skip
# failed frames while scanning. A stale earlier park then masks a real death.
sed 's|                hit = f|                if str(f.get("idleReason") or "") in ("failed", "interrupted"):\n                    continue\n                hit = f|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T18:01:30.000Z" >  "$T"
frame_line "justify-watch" "failed"    "2026-07-12T18:01:40.000Z" >> "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (stale park survives a later failure) -> suite catches it" \
                        || bad "mutant (stale park) NOT caught - newest-frame-authoritative is untested"

# Mutant 2c: re-expand the message into an explanatory paragraph. This is the
# regression the terseness assertions exist to catch: it fires on every park, so
# a paragraph makes the vertical-space problem Jonah banned WORSE.
sed 's|print(json.dumps({"systemMessage": "Teammate " + os.environ\["AGENT"\] + " standing by."}))|print(json.dumps({"systemMessage": "Teammate " + os.environ["AGENT"] + " standing by. It is a false flag: the watch is still armed and you should not stand it down."}))|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T18:01:50.000Z" > "$T"
OUT=$(printf '{"session_id":"%s","transcript_path":"%s","stop_hook_active":false}' "$SID" "$T" \
      | HOME="$FH" bash "$MUT" 2>/dev/null)
printf '%s' "$OUT" | python3 -c 'import json,sys
m = json.load(sys.stdin).get("systemMessage","")
bad_words = ["false flag", "armed", "stand it down"]
sys.exit(0 if any(w in m for w in bad_words) else 1)' 2>/dev/null \
  && ok "mutant (re-expanded paragraph) is detectable -> terseness guard is load-bearing" \
  || bad "mutant (re-expanded paragraph) NOT caught - terseness is untested"

# Mutant 3: break the dedupe. The lead would be nagged on every single stop.
sed 's|if \[ -f "$STATE" \] && \[ "$(cat "$STATE" 2>/dev/null)" = "$STAMP" \]; then|if false; then|' "$HOOK" > "$MUT"
FH=$(newhome); T="$FH/t.jsonl"
frame_line "justify-watch" "available" "2026-07-12T18:02:00.000Z" > "$T"
J='{"session_id":"'"$SID"'","transcript_path":"'"$T"'","stop_hook_active":false}'
printf '%s' "$J" | HOME="$FH" bash "$MUT" >/dev/null 2>&1
OUT=$(printf '%s' "$J" | HOME="$FH" bash "$MUT" 2>/dev/null)
says_standing_by "$OUT" && ok "mutant (no dedupe) repeats on every stop -> suite catches it" \
                        || bad "mutant (no dedupe) NOT caught - dedupe is untested"

echo
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
