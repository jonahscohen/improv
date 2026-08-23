#!/usr/bin/env bash
# Falsification suite for sidecoach-qa-gate-stop.sh (Stop-event QA-gate finish gate).
#
# The gate BLOCKS reporting a substantive DESIGN change "done" until the sidecoach
# QA gate (audit -> critique -> polish) provably ran on it since the flag was armed.
# It is ARMED by sidecoach-orchestrate-edit.sh (writes ~/.claude/.needs-qa-gate.<KEY>
# = target basename on a substantive design edit) and CLEARED by: transcript
# evidence the gate ran (a timestamped sidecoach QA Skill tool_use, or an assistant
# report carrying the full gate signature), a fail-CLOSED tree-corroboration that
# proves nothing design is dirty, or the override hook qa-gate-manual.sh.
#
# Every case runs under a FAKE $HOME with stubbed transcripts and throwaway git
# repos, so no test can read or mutate real session state. Both directions are
# covered: the gate must FIRE when a design change was never QA-gated, and must stay
# SILENT everywhere a false fire would be expensive (no flag, a loop, a subagent
# turn, a second stop in a burst, a proven-clean tree, another session's flag, a
# burst verify-before-done already owns).
#
# The anti-loop contract it MUST replicate (from concise-detect-stop.sh):
#   Layer 1  stop_hook_active     - never block a stop that is a hook continuation.
#   Layer 2  once-per-burst flag  - at most one block per armed cycle.
#   Layer 3  atomic noclobber claim on that flag.
#   Layer 4  fail-open trap       - every error path exits 0 / allows.
# A missed gate costs one unreviewed design change; a block loop costs the session.
#
# ---------------------------------------------------------------------------
# CONTRACT (verified against the live hooks 2026-08-23). Kept in ONE place so a
# builder-side change is a one-line test edit.
#   arm flag   : ~/.claude/.needs-qa-gate.<KEY>   body = target basename
#   burst flag : ~/.claude/.qa-gate-blocked.<KEY>
#   SESSION_KEY: re.sub(r'[^A-Za-z0-9._-]','_', session_id) or 'global'
#   evidence   : a transcript entry with a parseable ISO `timestamp` >= (flag mtime
#                - 3s) carrying a Skill tool_use whose input.skill contains
#                "sidecoach" and input.args matches \b(audit|critique|polish)\b.
#                Untimestamped or pre-mtime entries never count. As of the C-fix
#                (lead ruling 2026-08-23, option a) an assistant TEXT block NEVER
#                clears the flag - a prose-clearable gate defeats its own purpose,
#                so only a real Skill tool_use / tree-clean / override clears it.
#   override   : whole-message lowercase in {qa done, qa gate done, skip qa,
#                qa override, gate override, looks good, verified}
# ---------------------------------------------------------------------------

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/sidecoach-qa-gate-stop.sh"
ARM="$HERE/sidecoach-orchestrate-edit.sh"
MANUAL="$HERE/qa-gate-manual.sh"

SID="qa-gate-test-session"

flag_path()  { printf '%s/.claude/.needs-qa-gate.%s' "$1" "$2"; }
burst_path() { printf '%s/.claude/.qa-gate-blocked.%s' "$1" "$2"; }

# ARM the gate exactly as the arm side does: write the target basename to the flag.
arm_flag() { # <fake-home> <session-key> [design-file-path]
  mkdir -p "$1/.claude"
  local fp="${3:-/proj/src/components/Card.tsx}"
  printf '%s' "$(basename "$fp")" > "$(flag_path "$1" "$2")"
}

# transcript <path> <mode> [verb] [sidechain:yes|no] [ts_offset_seconds]
#   mode = yes         : a real sidecoach QA Skill tool_use (timestamped now+offset)
#   mode = yes-nots    : the same Skill tool_use but WITH NO timestamp field
#   mode = no          : a normal turn, no evidence
#   mode = prose       : a bare prose mention of the verbs (no marker/struct) - must NOT clear
#   mode = signature   : a full gate REPORT in text (marker + 3 verbs + struct token) - clears
#   sidechain = yes    : mark the evidence entry as a subagent turn
#   ts_offset_seconds  : seconds relative to now for the evidence entry (default +2)
transcript() {
  python3 - "$1" "$2" "${3:-audit}" "${4:-no}" "${5:-2}" <<'PY'
import json, sys, datetime
path, mode, verb, sidechain, off_s = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
now = datetime.datetime.now(datetime.timezone.utc)
def iso(delta):
    return (now + datetime.timedelta(seconds=delta)).isoformat().replace("+00:00", "Z")
off = None if off_s == "none" else float(off_s)
rows = []
rows.append({"type": "user", "timestamp": iso(-30),
             "message": {"role": "user", "content": "restyle the pricing card"}})
rows.append({"type": "assistant", "timestamp": iso(-20),
             "message": {"role": "assistant",
                         "content": [{"type": "text", "text": "Done restyling the card."}]}})
if mode in ("yes", "yes-nots", "multi"):
    # `verb` is a comma-separated list of sidecoach QA verbs; emit ONE real Skill
    # tool_use per verb (each its own assistant entry, as real transcripts record
    # separate /sidecoach calls). mode yes-nots or ts_offset "none" omit the
    # timestamp so the entry cannot count as evidence.
    verbs = [v.strip() for v in verb.split(",") if v.strip()]
    for i, vb in enumerate(verbs):
        entry = {"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "name": "Skill",
             "input": {"skill": "sidecoach", "args": vb + " /proj/src/components/Card.tsx"}}]}}
        if mode != "yes-nots" and off is not None:
            entry["timestamp"] = iso(off + i * 0.1)
        if sidechain == "yes":
            entry["isSidechain"] = True
        rows.append(entry)
elif mode == "prose":
    # verbs present, but NO sidecoach/qa-gate marker -> the signature predicate rejects it.
    rows.append({"type": "assistant", "timestamp": iso(off),
                 "message": {"role": "assistant", "content": [
                   {"type": "text",
                    "text": "I ran the audit, the critique, and the polish steps and it looks good."}]}})
elif mode == "signature":
    rows.append({"type": "assistant", "timestamp": iso(off),
                 "message": {"role": "assistant", "content": [
                   {"type": "text",
                    "text": ("Sidecoach QA gate complete on Card.tsx: the audit found two "
                             "high-severity contrast findings, the critique flagged nothing "
                             "above minor, and polish addressed the spacing. No issues remain.")}]}})
elif mode == "claim-text":
    # The exact former-gaming string: a marker + all three verbs + a struct token,
    # authored by the agent with NO tool call. Post C-fix this must NOT clear.
    rows.append({"type": "assistant", "timestamp": iso(off),
                 "message": {"role": "assistant", "content": [
                   {"type": "text",
                    "text": "Done. Ran the sidecoach qa-gate: audit, critique, polish - no findings, contrast passes."}]}})
with open(path, "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
PY
}

subagent_transcript() {
  python3 - "$1" <<'PY'
import json, sys
with open(sys.argv[1], "w") as f:
    f.write(json.dumps({"type": "assistant", "isSidechain": True,
            "message": {"role": "assistant",
                        "content": [{"type": "text", "text": "teammate turn"}]}}) + "\n")
PY
}
teamname_transcript() {
  python3 - "$1" <<'PY'
import json, sys
with open(sys.argv[1], "w") as f:
    f.write(json.dumps({"type": "assistant", "teamName": "qa-gate",
            "message": {"role": "assistant",
                        "content": [{"type": "text", "text": "teammate turn"}]}}) + "\n")
PY
}

# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------
pass=0; fail=0; FAILED=()
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); FAILED+=("$1"); printf '  FAIL %s\n' "$1"; }
chk() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (want=[$2] got=[$3])"; fi; }
contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }

newhome() { local d; d="$(mktemp -d)"; mkdir -p "$d/.claude"; printf '%s' "$d"; }
gmk() { local d="$1/repo_$2"; mkdir -p "$d"; ( cd "$d" && git init -q . ) >/dev/null 2>&1; printf '%s' "$d"; }

run() { # <fake-home> <transcript> <cwd> [stop_hook_active] [session-id]
  local sh="${4:-false}" sid="${5:-$SID}"
  printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","stop_hook_active":%s}' \
    "$sid" "$2" "$3" "$sh" | HOME="$1" bash "$HOOK" 2>/dev/null
}
run_rc() {
  local sh="${4:-false}" sid="${5:-$SID}"
  printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","stop_hook_active":%s}' \
    "$sid" "$2" "$3" "$sh" | HOME="$1" bash "$HOOK" >/dev/null 2>&1; echo $?
}
blocked() { contains "$1" '"decision": "block"' && echo block || echo allow; }
present() { [ -f "$1" ] && echo present || echo absent; }

mk_dirty()   { local d; d="$(gmk "$1" "$2")"; mkdir -p "$d/src/components"; printf '<div/>' > "$d/src/components/Card.tsx"; printf '%s' "$d"; }
mk_clean()   { local d; d="$(gmk "$1" "$2")"; printf 'x' > "$d/util.ts"; printf 'x' > "$d/README.md"; printf '%s' "$d"; }
# Pin <file>'s mtime to an exact epoch-second. The gate identifies an armed change by
# int(arm-flag mtime), so a re-arm must land on a STRICTLY greater integer second than
# the last block recorded. The suite runs inside one wall-clock second, so we set the
# arm mtime explicitly rather than relying on time passing (which made this flaky).
set_mtime() { python3 - "$1" "$2" <<'PY'
import os, sys
t = int(sys.argv[2])
os.utime(sys.argv[1], (t, t))
PY
}

echo "================================================================"
echo " sidecoach-qa-gate-stop.sh falsification suite"
echo "================================================================"

if [ ! -f "$HOOK" ]; then
  echo "PRECONDITION FAIL: $HOOK does not exist yet. Nothing to verify."
  exit 2
fi

echo
echo "=== BLOCK: a design change that was never QA-gated ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" b1)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" no
OUT="$(run "$FH" "$T" "$D")"
chk "armed + dirty design tree + no gate evidence -> BLOCK" block "$(blocked "$OUT")"
contains "$OUT" "Card.tsx" && ok "  ...block reason names the target basename" || bad "  ...block reason names the target basename"
contains "$OUT" "qa done" && ok "  ...block reason names the override phrase" || bad "  ...block reason names the override phrase"

echo
echo "=== CLEAR requires ALL THREE stages (audit AND critique AND polish) ==="
# Lead ruling 2026-08-23 (finding 4): a SINGLE QA verb must NOT clear the gate - one
# audit invocation clearing the whole rung reopens the polish-skip hole this gate
# exists to close. The gate must accumulate verbs across post-arm sidecoach Skill
# tool_uses and clear only when {audit, critique, polish} are ALL present.
for verb in audit critique polish; do
  FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" "one_$verb")"
  arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "$verb"
  chk "armed + ONLY sidecoach $verb -> BLOCK (one stage is not the whole gate)" \
    block "$(blocked "$(run "$FH" "$T" "$D")")"
done
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" two)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "audit,critique"
chk "armed + audit+critique but NO polish -> BLOCK (a stage is missing)" \
  block "$(blocked "$(run "$FH" "$T" "$D")")"
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" three)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "audit,critique,polish"
OUT="$(run "$FH" "$T" "$D")"
chk "armed + audit+critique+polish ALL present -> ALLOW" allow "$(blocked "$OUT")"
chk "  ...arm flag cleared after the full three-stage run" absent "$(present "$(flag_path "$FH" "$SID")")"

echo
echo "=== C-FIX: assistant TEXT never clears - only a real Skill tool_use does ==="
# Lead ruling 2026-08-23 (option a): the text-signature clear path is DROPPED because
# the agent authors its own transcript text, so a prose claim of "I ran the gate"
# would let a rationalizing agent skip the very review the gate verifies. These four
# cases pin that: no shape of prose clears the flag; only a real Skill invocation.
# The exact string below is the one that USED to clear before the C-fix.
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" ctext)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" claim-text
chk "armed + agent's own 'I ran the sidecoach qa-gate: audit/critique/polish, no findings' text -> BLOCK" \
  block "$(blocked "$(run "$FH" "$T" "$D")")"

FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" sig)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" signature
chk "armed + full sidecoach report text (marker+3 verbs+struct) -> BLOCK (text never clears)" \
  block "$(blocked "$(run "$FH" "$T" "$D")")"

FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" prose)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" prose
chk "armed + dirty + prose verbs only (no marker) -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$D")")"

# The un-forgeable path still clears (control): the full three-stage Skill run.
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" ctrl)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "audit,critique,polish"
chk "  control: a REAL full three-stage Skill run still clears -> ALLOW" allow "$(blocked "$(run "$FH" "$T" "$D")")"

echo
echo "=== ANTI-REPLAY: an OLD gate run cannot clear a FRESH flag ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" stale)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "audit,critique,polish" no -3600
chk "armed + full three-stage run timestamped 1h BEFORE arm -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$D")")"
# The full three stages present but with NO timestamps likewise cannot clear.
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" nots)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" multi "audit,critique,polish" no none
chk "armed + full three-stage run with NO timestamps -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$D")")"

echo
echo "=== NOT A TRAP: a block, then a real run on the NEXT stop, clears ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" trap)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" no
chk "  first stop (no evidence) -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$D")")"
transcript "$T" multi "audit,critique,polish"     # the full review now runs
OUT="$(run "$FH" "$T" "$D")"
chk "  next stop after the full review -> ALLOW (block was not permanent)" allow "$(blocked "$OUT")"
chk "  ...both flags cleared" absent "$(present "$(flag_path "$FH" "$SID")")"
chk "  ...burst flag cleared too" absent "$(present "$(burst_path "$FH" "$SID")")"

echo
echo "=== B-FIX: a fresh re-arm after an ignored block re-blocks (once-per-ARM, not once-per-session) ==="
BASE=$(date +%s)
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" barm)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" no
set_mtime "$(flag_path "$FH" "$SID")" "$BASE"           # arm-1 at a fixed second
chk "  first stop -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$D")")"
chk "  second stop (SAME arm) -> allow (once-per-burst)" allow "$(blocked "$(run "$FH" "$T" "$D")")"
# A genuine new substantive design edit re-arms with a STRICTLY newer mtime-second.
printf 'Modal.tsx' > "$(flag_path "$FH" "$SID")"; printf '<span/>' > "$D/src/components/Modal.tsx"
set_mtime "$(flag_path "$FH" "$SID")" "$((BASE + 10))"  # arm-2, 10s newer
chk "  fresh re-arm (newer arm mtime) -> BLOCK again (2nd change is gated)" \
  block "$(blocked "$(run "$FH" "$T" "$D")")"
# LOOP GUARD: re-blocking on a fresh re-arm MUST record the new arm mtime, or the next
# stop sees a newer arm forever and blocks every stop. Same arm-2 now -> silent again.
chk "  ...next stop after the re-arm block -> allow (re-block recorded the new arm; no loop)" \
  allow "$(blocked "$(run "$FH" "$T" "$D")")"

echo
echo "=== ALLOW: nothing armed ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" nf)"; transcript "$T" no
chk "no flag at all -> ALLOW" allow "$(blocked "$(run "$FH" "$T" "$D")")"
# A stale burst flag with no arm flag must be reaped, not left to mute a future arm.
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" nf2)"; transcript "$T" no
: > "$(burst_path "$FH" "$SID")"
run "$FH" "$T" "$D" >/dev/null
chk "no arm flag -> stale burst flag reaped" absent "$(present "$(burst_path "$FH" "$SID")")"

echo
echo "=== ALLOW+CLEAR: tree proves nothing design is dirty (fail-closed corroboration, clean side) ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_clean "$FH" c1)"
arm_flag "$FH" "$SID" "/proj/src/components/Card.tsx"; transcript "$T" no
chk "armed but tree holds no design file -> ALLOW" allow "$(blocked "$(run "$FH" "$T" "$D")")"
chk "  ...stale arm flag cleared" absent "$(present "$(flag_path "$FH" "$SID")")"

echo
echo "=== BLOCK: tree uncertainty fails CLOSED (opposite of error fail-open) ==="
FH="$(newhome)"; T="$FH/t.jsonl"; arm_flag "$FH" "$SID"; transcript "$T" no
NOGIT="$FH/not-a-repo"; mkdir -p "$NOGIT"; printf 'x' > "$NOGIT/a.sh"
chk "armed + cwd is NOT a git repo -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$NOGIT")")"
FH="$(newhome)"; T="$FH/t.jsonl"; arm_flag "$FH" "$SID"; transcript "$T" no
chk "armed + nonexistent cwd -> BLOCK" block "$(blocked "$(run "$FH" "$T" "$FH/nope")")"
FH="$(newhome)"; T="$FH/t.jsonl"; arm_flag "$FH" "$SID"; transcript "$T" no
chk "armed + empty cwd -> BLOCK" block "$(blocked "$(run "$FH" "$T" "")")"

echo
echo "=== ANTI-LOOP ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" l1)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" no
chk "stop_hook_active true -> ALLOW (hook continuation)" allow "$(blocked "$(run "$FH" "$T" "$D" true)")"

FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" l2)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; transcript "$T" no
OUT1="$(run "$FH" "$T" "$D")"; OUT2="$(run "$FH" "$T" "$D")"
{ contains "$OUT1" '"decision": "block"' && ! contains "$OUT2" '"decision": "block"'; } \
  && ok "second Stop in the same burst -> ALLOW (never two blocks in a row)" \
  || bad "second Stop in the same burst -> ALLOW (never two blocks in a row)"
chk "  ...burst flag written on the block" present "$(present "$(burst_path "$FH" "$SID")")"

echo
echo "=== SUBAGENT / teammate turns are exempt ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" s1)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; subagent_transcript "$T"
OUT="$(run "$FH" "$T" "$D")"
chk "isSidechain transcript -> ALLOW" allow "$(blocked "$OUT")"
chk "  ...subagent path leaves the flag untouched (parent still owes)" present "$(present "$(flag_path "$FH" "$SID")")"
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" s2)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"; teamname_transcript "$T"
chk "teamName transcript -> ALLOW" allow "$(blocked "$(run "$FH" "$T" "$D")")"

echo
echo "=== SESSION SCOPING: another session's flag must not block this one ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" sc)"
arm_flag "$FH" "other-session" "$D/src/components/Card.tsx"; transcript "$T" no
chk "flag for session B, Stop for session A -> ALLOW" allow "$(blocked "$(run "$FH" "$T" "$D" false "$SID")")"
chk "  ...session B's flag untouched" present "$(present "$(flag_path "$FH" other-session)")"

echo
echo "=== DOUBLE-BLOCK DEFERRAL: yield when verify-before-done-stop owns the burst ==="
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" db)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"
printf 'visual' > "$FH/.claude/.needs-verification.$SID"
transcript "$T" no
OUT="$(run "$FH" "$T" "$D")"
chk "qa armed + visual gate armed + dirty visual tree -> qa DEFERS (ALLOW)" allow "$(blocked "$OUT")"
chk "  ...deferral does NOT consume the burst budget (no burst flag)" absent "$(present "$(burst_path "$FH" "$SID")")"
# Control: same state but the visual flag is NOT 'visual' -> no deferral, qa blocks.
FH="$(newhome)"; T="$FH/t.jsonl"; D="$(mk_dirty "$FH" db2)"
arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"
printf 'code' > "$FH/.claude/.needs-verification.$SID"
transcript "$T" no
chk "  control: needs-verification=code (not visual) -> qa still BLOCKS" block "$(blocked "$(run "$FH" "$T" "$D")")"
# D-FIX: on an UNREADABLE tree qa cannot compute visual_dirty, but verify-before-done
# will ALSO fail-closed BLOCK (its flag is 'visual'), so qa must still DEFER rather
# than stack a second block. The tightened deferral keys off the visual flag being
# armed, not off a certain visual_dirty read.
FH="$(newhome)"; T="$FH/t.jsonl"; arm_flag "$FH" "$SID"
printf 'visual' > "$FH/.claude/.needs-verification.$SID"; transcript "$T" no
NG="$FH/notrepo-defer"; mkdir -p "$NG"; printf 'x' > "$NG/a.sh"
chk "  D-fix: both flags armed + UNREADABLE tree -> qa DEFERS (no double-block)" allow "$(blocked "$(run "$FH" "$T" "$NG")")"
# Guard the fail-CLOSED direction survives the tightening: with NO visual flag, an
# unreadable tree must STILL block (qa owes the review and cannot prove otherwise).
FH="$(newhome)"; T="$FH/t.jsonl"; arm_flag "$FH" "$SID"; transcript "$T" no
NG2="$FH/notrepo-solo"; mkdir -p "$NG2"; printf 'x' > "$NG2/a.sh"
chk "  guard: ONLY qa armed (no visual flag) + unreadable tree -> still BLOCK" block "$(blocked "$(run "$FH" "$T" "$NG2")")"

echo
echo "=== OVERRIDE HOOK: qa-gate-manual.sh clears the flag ==="
if [ -f "$MANUAL" ]; then
  clear_phrase() { printf '{"session_id":"%s","prompt":"%s"}' "$2" "$3" | HOME="$1" bash "$MANUAL" >/dev/null 2>&1; }
  for phrase in "qa done" "qa gate done" "skip qa" "qa override" "gate override" "looks good" "verified"; do
    FH="$(newhome)"; arm_flag "$FH" "$SID"; : > "$(burst_path "$FH" "$SID")"
    clear_phrase "$FH" "$SID" "$phrase"
    chk "override '$phrase' clears the arm flag" absent "$(present "$(flag_path "$FH" "$SID")")"
  done
  # burst flag is cleared too so the next genuine edit can gate again.
  FH="$(newhome)"; arm_flag "$FH" "$SID"; : > "$(burst_path "$FH" "$SID")"
  clear_phrase "$FH" "$SID" "qa done"
  chk "override also clears the burst flag" absent "$(present "$(burst_path "$FH" "$SID")")"
  # A phrase used MID-SENTENCE, or an ordinary message, must NOT clear.
  FH="$(newhome)"; arm_flag "$FH" "$SID"
  clear_phrase "$FH" "$SID" "the qa done part is tricky, keep going"
  chk "phrase mid-sentence does NOT clear" present "$(present "$(flag_path "$FH" "$SID")")"
  FH="$(newhome)"; arm_flag "$FH" "$SID"
  clear_phrase "$FH" "$SID" "please continue the build"
  chk "ordinary message does NOT clear" present "$(present "$(flag_path "$FH" "$SID")")"
  # Session-scoped: clearing A leaves B armed.
  FH="$(newhome)"; arm_flag "$FH" "$SID"; arm_flag "$FH" "other-session"
  clear_phrase "$FH" "$SID" "skip qa"
  chk "override is session-scoped (B's flag survives)" present "$(present "$(flag_path "$FH" other-session)")"
else
  bad "qa-gate-manual.sh missing - override cases not verified"
fi

echo
echo "=== FAIL-OPEN: malformed / empty stdin never crashes, always allows ==="
FH="$(newhome)"
chk "garbage stdin -> exit 0" 0 "$(printf 'not json at all' | HOME="$FH" bash "$HOOK" >/dev/null 2>&1; echo $?)"
chk "garbage stdin -> not a block" allow "$(blocked "$(printf 'not json at all' | HOME="$FH" bash "$HOOK" 2>/dev/null)")"
FH="$(newhome)"
chk "empty stdin -> exit 0" 0 "$(printf '' | HOME="$FH" bash "$HOOK" >/dev/null 2>&1; echo $?)"
FH="$(newhome)"; D="$(mk_dirty "$FH" fo)"; arm_flag "$FH" "$SID" "$D/src/components/Card.tsx"
chk "missing transcript file -> exit 0" 0 "$(run_rc "$FH" "$FH/does-not-exist.jsonl" "$D")"
FH="$(newhome)"
chk "valid JSON of the wrong shape (a list) -> allow" allow "$(blocked "$(printf '[1,2,3]' | HOME="$FH" bash "$HOOK" 2>/dev/null)")"

echo
echo "=== COUPLING: shared literals must not drift across the arm/stop/verify sides ==="
# The arm side (DESIGN_EXT tuple) and this Stop gate (DESIGN_EXTS set) must agree on
# what counts as a design file. If the arm can arm on an extension the Stop tree-scan
# does not know, a real design change fails OPEN and clears the flag. Assert the Stop
# set is a SUPERSET of the arm tuple (mirrors the VISUAL_EXTS coupling in
# test-verify-visual-gate.sh).
EXT_SYNC=$(python3 - "$ARM" "$HOOK" <<'PY'
import re, sys
def tup(p):   # DESIGN_EXT = (".html", ...)
    m = re.search(r"DESIGN_EXT\s*=\s*\((.*?)\)", open(p).read(), re.S)
    return set(re.findall(r'"([^"]+)"', m.group(1))) if m else set()
def st(p):    # DESIGN_EXTS = {".html", ...}
    m = re.search(r"DESIGN_EXTS\s*=\s*\{(.*?)\}", open(p).read(), re.S)
    return set(re.findall(r'"([^"]+)"', m.group(1))) if m else set()
arm, stop = tup(sys.argv[1]), st(sys.argv[2])
print("ok" if arm and stop and not (arm - stop) else "MISSING:" + ",".join(sorted(arm - stop)))
PY
)
chk "Stop DESIGN_EXTS is a superset of the arm side DESIGN_EXT" ok "$EXT_SYNC"

# The non-app dir pattern is carried independently by this gate and verify-before-done-stop.sh.
# If they drift, the two gates disagree on what is product UI. Assert byte-identity.
NON_APP_SYNC=$(python3 - "$HOOK" "$HERE/verify-before-done-stop.sh" <<'PY'
import sys
want = r"(^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/"
hits = [want in open(p).read() for p in sys.argv[1:] if p]
print("ok" if hits and all(hits) else "DRIFT")
PY
)
chk "non-app dir pattern byte-identical with verify-before-done-stop" ok "$NON_APP_SYNC"

echo
echo "=== bash -n: every script parses clean ==="
for s in "$HOOK" "$ARM" "$MANUAL" "$HERE/test-sidecoach-qa-gate-stop.sh"; do
  if [ -f "$s" ]; then
    if bash -n "$s" 2>/dev/null; then ok "bash -n clean: $(basename "$s")"; else bad "bash -n FAILED: $(basename "$s")"; fi
  fi
done

echo
echo "================================================================"
echo "RESULTS: $pass passed, $fail failed"
if [ "$fail" -gt 0 ]; then printf '  - %s\n' "${FAILED[@]}"; exit 1; fi
echo "All tests pass."
exit 0
