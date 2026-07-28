#!/bin/bash
# Regression tests for the grounding gate + guard.
#   bash ~/.claude/hooks/test-grounding-guard.sh
# Exercises:
#   GATE  (grounding-gate.sh): diagnostic build-behavior question arms+injects;
#         informational framing and trivial asks do NOT.
#   GUARD (grounding-guard.sh): armed + no grounding -> DENY a probe; armed +
#         a grep/Read since arm -> ALLOW (+disarm); not armed -> ALLOW;
#         non-probe tool -> ALLOW; subagent -> ALLOW.
# Uses temp arm/cooldown files (env overrides) so the real flag is untouched.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
GATE="$HOOK_DIR/grounding-gate.sh"
GUARD="$HOOK_DIR/grounding-guard.sh"
PASS=0; FAIL=0; FAILS=()

TMP=$(mktemp -d /tmp/grounding-test-XXXX)
ARM="$TMP/armed"; COOL="$TMP/cool"
trap 'rm -rf "$TMP"' EXIT

jprompt() { python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$1"; }

gate() { jprompt "$1" | GROUNDING_ARM_FILE="$ARM" GROUNDING_COOLDOWN_FILE="$COOL" bash "$GATE" 2>/dev/null; }

# guard <tool> <command-or-empty> <transcript-path>
guard() {
  python3 -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"tool_input":{"command":sys.argv[2]},"transcript_path":sys.argv[3]}))' "$1" "$2" "$3" \
    | GROUNDING_ARM_FILE="$ARM" GROUNDING_COOLDOWN_FILE="$COOL" bash "$GUARD" 2>/dev/null
}

# Build a transcript JSONL with one tool_use at a given epoch offset from now.
mk_transcript() {  # mk_transcript <file> <toolName> <bashcmd> <epoch>
  local f="$1" name="$2" cmd="$3" ep="$4"
  local iso; iso=$(python3 -c "import sys,datetime; print(datetime.datetime.fromtimestamp(int(sys.argv[1]),datetime.timezone.utc).isoformat().replace('+00:00','Z'))" "$ep")
  python3 -c 'import json,sys; print(json.dumps({"timestamp":sys.argv[1],"message":{"content":[{"type":"tool_use","name":sys.argv[2],"input":{"command":sys.argv[3]}}]}}))' "$iso" "$name" "$cmd" > "$f"
}

ok() { echo "PASS: $1"; PASS=$((PASS+1)); }
no() { echo "FAIL: $1 (got: $2)"; FAILS+=("$1"); FAIL=$((FAIL+1)); }

# ---- GATE ----
rm -f "$ARM" "$COOL"
out=$(gate "why aren't my changes showing in the bottom-left panel?")
{ echo "$out" | grep -q "Ground" || echo "$out" | grep -q "grep"; } && [ -f "$ARM" ] && ok "gate arms on diagnostic build question" || no "gate arms on diagnostic build question" "$out armfile=$([ -f "$ARM" ] && echo yes || echo no)"

rm -f "$ARM" "$COOL"
out=$(gate "what is the changes panel")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on informational 'what is X'" || no "gate informational suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "make the hero button blue")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a trivial build request" || no "gate trivial request" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "why isn't the watch loop firing")
[ -f "$ARM" ] && ok "gate arms on 'why isn't the watch loop firing'" || no "gate arms on watch-loop question" "$out"

# ---- GATE: agent/system envelopes must never arm (2026-07-28 live-traffic audit) ----
# Each string below is a VERBATIM head of a real prompt that fired the gate before
# the `exempt` list landed. Measured: 121 of 1231 envelopes fired (9.83%) versus 13
# of 671 genuine prompts (1.94%), an inverted signal. Removing "exempt" from
# grounding-intent.json turns all three of these red.
# Each case is a VERBATIM real envelope head followed by BODY. BODY is asserted
# below to arm on its own, so these three cannot pass vacuously: with `exempt`
# removed from grounding-intent.json all three go red.
BODY="why isn't the watch loop firing in the changes panel"

rm -f "$ARM" "$COOL"
out=$(gate "Another Claude session sent a message: <teammate-message teammate_id=\"coverage\" color=\"green\" summary=\"HALTED\"> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a teammate relay envelope" || no "gate teammate-envelope suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "<task-notification> <task-id>a409fb8177816426a</task-id> <status>completed</status> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a task-notification envelope" || no "gate task-notification suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "This session is being continued from a previous conversation that ran out of context. Summary: $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a context-continuation summary" || no "gate continuation suppression" "$out"

# The control that makes the three above non-vacuous: the shared BODY arms alone,
# AND emits the nudge (arm-file-only would not prove the injection still happens).
rm -f "$ARM" "$COOL"
out=$(gate "$BODY")
[ -f "$ARM" ] && echo "$out" | grep -q 'additionalContext' \
  && ok "control: the envelope BODY arms AND emits the nudge on its own" \
  || no "control BODY arms and nudges" "$out"

# TIGHTNESS (Codex 2026-07-28): the exemption keys on the STRUCTURAL envelope
# marker, not on the opening prose. A genuine prompt that merely opens with
# similar words - no <teammate-message tag, no <task-notification element, no
# canonical "ran out of context." phrase - must still arm. Loosening any pattern
# back to a prose-only head turns these three red.
rm -f "$ARM" "$COOL"
out=$(gate "Another Claude session sent a message saying the panel broke - $BODY")
[ -f "$ARM" ] && ok "tightness: prose-only teammate opener still arms" || no "tightness teammate prose" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "This session is being continued from a previous conversation I pasted below: $BODY")
[ -f "$ARM" ] && ok "tightness: non-canonical continuation opener still arms" || no "tightness continuation prose" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "<task-notification-example> $BODY")
[ -f "$ARM" ] && ok "tightness: a lookalike task-notification tag still arms" || no "tightness tasknotif lookalike" "$out"

# A malformed lexicon must FAIL OPEN, never silently disarm the gate. If "exempt"
# is a STRING, a char-wise loop would match "^" against every prompt and take
# recall to zero with no signal.
rm -f "$ARM" "$COOL"
BADLEX="$TMP/badlex"; mkdir -p "$BADLEX"
cp "$HOOK_DIR/grounding-gate.sh" "$BADLEX/grounding-gate.sh"
python3 - "$HOOK_DIR/grounding-intent.json" "$BADLEX/grounding-intent.json" <<'PYEOF'
import json, sys
d = json.load(open(sys.argv[1]))
d["exempt"] = "^\\s*<task-notification"   # a string, not a list
json.dump(d, open(sys.argv[2], "w"))
PYEOF
out=$(jprompt "$BODY" | GROUNDING_ARM_FILE="$ARM" GROUNDING_COOLDOWN_FILE="$COOL" bash "$BADLEX/grounding-gate.sh" 2>/dev/null)
[ -f "$ARM" ] && ok "malformed exempt (string not list) fails OPEN, gate still arms" || no "malformed exempt fails open" "$out"

# The exemption is HEAD-anchored: a genuine question that merely MENTIONS a
# teammate must still arm, or the exemption would become a silent kill switch.
rm -f "$ARM" "$COOL"
out=$(gate "the teammate relay says it halted - why isn't the watch loop firing on my machine")
[ -f "$ARM" ] && ok "gate still arms on a genuine question mentioning a teammate" || no "gate head-anchored exemption" "$out"

# ---- GUARD ----
NOW=$(date +%s)

# armed, NO grounding since arm -> DENY a screenshot probe
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
EMPTY="$TMP/empty.jsonl"; : > "$EMPTY"
out=$(guard "mcp__claude-in-chrome__computer" "" "$EMPTY")
echo "$out" | grep -q '"permissionDecision": "deny"' && ok "guard DENIES probe when armed + no grounding" || no "guard denies ungrounded probe" "$out"

# armed, a grep Bash AFTER arm -> ALLOW + disarm
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
TG="$TMP/grounded.jsonl"; mk_transcript "$TG" "Bash" "grep -ri changes-panel justify/core" "$((NOW+1))"
out=$(guard "mcp__claude-in-chrome__computer" "" "$TG")
{ [ -z "$out" ] || echo "$out" | grep -q '{}'; } && [ ! -f "$ARM" ] && ok "guard ALLOWS + disarms after a grep since arm" || no "guard allows after grounding" "$out armfile=$([ -f "$ARM" ] && echo present || echo gone)"

# armed, a Read AFTER arm -> ALLOW
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
TR="$TMP/read.jsonl"; mk_transcript "$TR" "Read" "" "$((NOW+1))"
out=$(guard "mcp__claude-in-chrome__computer" "" "$TR")
{ [ -z "$out" ] || echo "$out" | grep -q '{}'; } && ok "guard ALLOWS after a Read since arm" || no "guard allows after Read" "$out"

# armed, grounding BEFORE arm (stale) -> still DENY
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
TS="$TMP/stale.jsonl"; mk_transcript "$TS" "Grep" "" "$((NOW-120))"
out=$(guard "mcp__claude-in-chrome__computer" "" "$TS")
echo "$out" | grep -q '"permissionDecision": "deny"' && ok "guard ignores grounding from BEFORE the arm (still denies)" || no "guard ignores pre-arm grounding" "$out"

# not armed -> ALLOW
rm -f "$ARM" "$COOL"
out=$(guard "mcp__claude-in-chrome__computer" "" "$EMPTY")
{ [ -z "$out" ] || echo "$out" | grep -q '{}'; } && ok "guard ALLOWS when not armed" || no "guard allows unarmed" "$out"

# armed but tool is NOT a probe (a normal Read) -> ALLOW (never gate grounding tools)
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
out=$(guard "Read" "" "$EMPTY")
{ [ -z "$out" ] || echo "$out" | grep -q '{}'; } && ok "guard never gates a non-probe tool (Read)" || no "guard allows non-probe" "$out"

# armed + subagent transcript -> ALLOW (teammates not gated)
rm -f "$ARM" "$COOL"; echo "$NOW" > "$ARM"
SUB="$TMP/sub.jsonl"; python3 -c 'import json; print(json.dumps({"teamName":"justify-grounding","timestamp":"2026-06-05T00:00:00Z"}))' > "$SUB"
out=$(guard "mcp__claude-in-chrome__computer" "" "$SUB")
{ [ -z "$out" ] || echo "$out" | grep -q '{}'; } && ok "guard ALLOWS in a subagent/teammate context" || no "guard allows subagent" "$out"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then printf '  - %s\n' "${FAILS[@]}"; exit 1; fi
echo "All grounding tests pass."
