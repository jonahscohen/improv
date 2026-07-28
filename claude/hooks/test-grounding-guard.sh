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

# python3 is this suite's only measuring instrument: every payload, every fixture and
# every assertion below is built with it. Without it the suite would not fail loudly -
# it would skip silently and still print a green summary, which is worse than no suite.
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 not found - this suite cannot verify anything without it." >&2
  exit 2
}
GATE="$HOOK_DIR/grounding-gate.sh"
GUARD="$HOOK_DIR/grounding-guard.sh"
PASS=0; FAIL=0; FAILS=()

TMP=$(mktemp -d /tmp/grounding-test-XXXX) || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
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
# the `exempt` list landed. Re-derive the rate with
# `python3 claude/hooks/_tests/measure-hook-corpus.py --gate` rather than trusting a
# number in a comment; the previous 9.83%-vs-1.94% claim had no committed corpus and
# has been struck. Removing "exempt" from
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

# ---- BOTH DIRECTIONS OF THE EXEMPT LIST (2026-07-28 repair) ----------------
# The exempt list had three patterns and four defects, two per direction.
#
# TOO NARROW (an envelope arms the gate):
#   1. <system-reminder> was never listed at all, though it is the single most
#      common system envelope on UserPromptSubmit.
#   2. A BOM or zero-width character at the head is not \s, so one invisible
#      byte defeated every ^\s* anchor and the envelope armed.
# TOO WIDE (a genuine prompt is silenced - a fail-CLOSED hole in a gate):
#   3. <teammate-message\b matched <teammate-message-example>, because \b ends a
#      word at a hyphen. task-notification already used the tight (?:>|\s) form;
#      the two are now consistent.
#   4. The continuation exemption keyed on the canonical SENTENCE alone, so any
#      genuine question that opened with it was silenced. It now also requires
#      the structural "Summary:" section that a real continuation always carries
#      (verified against ~/.claude/projects transcripts, where the real form is
#      "...ran out of context. The summary below covers the earlier portion of
#      the conversation. Summary: 1. Primary Request and Intent").
rm -f "$ARM" "$COOL"
out=$(gate "<system-reminder> As you answer the user's questions, you can use the following context: $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a system-reminder envelope" || no "gate system-reminder suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "$(printf '\xef\xbb\xbf')<task-notification> <task-id>a409fb</task-id> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "a BOM does not smuggle a task-notification past the anchor" || no "BOM-prefixed envelope suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "$(printf '\xe2\x80\x8b')Another Claude session sent a message: <teammate-message teammate_id=\"x\"> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "a zero-width space does not smuggle a teammate envelope past the anchor" || no "ZWSP-prefixed envelope suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "Another Claude session sent a message: <teammate-message-example> $BODY")
[ -f "$ARM" ] && ok "tightness: a lookalike teammate-message tag still arms" || no "tightness teammate lookalike" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "<system-reminder-example> $BODY")
[ -f "$ARM" ] && ok "tightness: a lookalike system-reminder tag still arms" || no "tightness system-reminder lookalike" "$out"

# TWO MORE ENVELOPE SHAPES, found by measuring instead of reasoning
# (_tests/measure-hook-corpus.py over ~/.claude/projects, 2026-07-28).
# The exempt list only ever covered a teammate relay behind the prose head
# "Another Claude session sent a message:". Real traffic delivers the tag on its
# own far more often: of 207 gate fires across 4019 real prompts, 124 were a BARE
# <teammate-message ...> head and 34 were a skill body injected as a prompt. That
# is 158 of 207 - three quarters of everything this gate said - spent on envelopes
# no human wrote. Both markers below are STRUCTURAL (a literal tag, and the
# literal skill-injection preamble plus its path), per the standing rule that a
# prose-only head must never silence a prompt.
rm -f "$ARM" "$COOL"
out=$(gate "<teammate-message teammate_id=\"team-lead\" color=\"green\"> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on a BARE teammate-message envelope" || no "bare teammate envelope suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "Base directory for this skill: /Users/x/.claude/skills/icon-source

# Icon Source

$BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "gate stays silent on an injected skill body" || no "skill-injection suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "<teammate-messages-digest> $BODY")
[ -f "$ARM" ] && ok "tightness: a bare lookalike teammate tag still arms" || no "tightness bare teammate lookalike" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "the base directory for this skill is wrong, and $BODY")
[ -f "$ARM" ] && ok "tightness: prose about a skill base directory still arms" || no "tightness skill prose" "$out"

# CROSS-MODEL REVIEW ROUND 2 (Codex, 2026-07-28). Two holes in the fixes above:
#   - "base directory for this skill:" plus any non-space silenced a REAL question
#     that happened to open with those words. The marker now requires the actual
#     injected shape: the phrase followed by a PATH.
#   - the invisible-character strip was a hand-picked list, so U+200E LRM (and every
#     other Cf character it did not name) still defeated the ^\s* anchor.
rm -f "$ARM" "$COOL"
out=$(gate "Base directory for this skill: $BODY")
[ -f "$ARM" ] && ok "tightness: the skill marker needs a PATH, not just the phrase" || no "tightness skill marker needs a path" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "$(printf '\xe2\x80\x8e')<task-notification> <task-id>a409fb</task-id> $BODY")
[ -z "$out" ] && [ ! -f "$ARM" ] && ok "a left-to-right mark does not smuggle an envelope past the anchor" || no "LRM-prefixed envelope suppression" "$out"

rm -f "$ARM" "$COOL"
out=$(gate "This session is being continued from a previous conversation that ran out of context. $BODY")
[ -f "$ARM" ] && ok "tightness: the continuation sentence alone does not silence a real question" || no "tightness continuation without summary" "$out"

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
