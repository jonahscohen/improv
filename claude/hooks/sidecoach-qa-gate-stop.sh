#!/usr/bin/env bash
#
# sidecoach-qa-gate-stop.sh - Stop hook. The FINISH-BOUNDARY teeth for the sidecoach
# QA gate (audit -> critique -> polish).
#
# sidecoach-orchestrate-edit.sh (PostToolUse) already INJECTS the QA-gate directive
# on every substantive design edit and arms ~/.claude/.needs-qa-gate.<session>. That
# is a WRITE-boundary nudge: nothing at Stop verified it was honored, so the review
# could be silently skipped. This hook is the verification. It blocks reporting a
# substantive design change "done" until it sees PROOF the QA gate actually RAN on
# this session since the flag was armed - the audit, critique, AND polish sidecoach
# Skill invocations all present since the arm.
#
# This is the FIRST instance of the escalation-ladder fork: a twice-failed mandate
# that is not mechanizable at the write boundary (you cannot force-run a multi-step
# review from a PostToolUse hook) gets a finish-boundary ARTIFACT gate instead of
# more prose - block "done" until evidence the pass ran.
#
# WHAT CLEARS THE GATE (any one):
#   - the working tree provably holds no dirty design file (nothing to review -> the
#     armed flag is stale; clear it, exactly as verify-before-done clears a visual
#     flag when there is nothing to screenshot);
#   - ALL THREE sidecoach QA stages ran as Skill tool_uses since the arm - an audit
#     AND a critique AND a polish invocation (order not enforced). A real Skill
#     tool_use is un-forgeable; a single stage does NOT clear the gate (that would
#     reopen the polish-skip hole this rung exists to close), and prose describing
#     the gate NEVER clears it - the agent authors its own transcript text, so a
#     written "ran the gate, no findings" is exactly the rationalization the gate
#     must not accept (lead ruling 2026-08-23, option a; Codex finding C/HIGH);
#   - the user replies "qa done" / "skip qa" / ... (qa-gate-manual.sh clears it).
# The tree-clean + override paths mean it can never become a permanent trap even
# though the evidence bar is all three real Skill invocations.
#
# TREE-CORROBORATION fails CLOSED, mirroring verify-before-done-stop.sh: every
# uncertainty (no cwd, git missing, non-zero exit, timeout, too many entries, a
# dir/submodule entry, undecodable output) is treated as "a design file may be
# dirty", so the gate keeps demanding the review. The only path that clears on tree
# grounds is a clean, complete status listing with provably no dirty design file.
#
# ANTI-LOOP (a Stop hook that blocks can deadlock a session - non-negotiable):
#   Layer 1  stop_hook_active -> allow (never block a stop that is a continuation).
#   Layer 2  once-per-ARM flag ~/.claude/.qa-gate-blocked.<session>. If present AND
#            no newer arm has landed since (arm-flag mtime <= burst-flag mtime) we
#            ALLOW no matter what - so a second stop never immediately re-blocks. But
#            a FRESH substantive edit re-arms the flag with a newer mtime, and that
#            supersedes the stale burst so the new change gates once too (Codex
#            finding B/MEDIUM: once-per-arm, not once-per-session). Cleared outright
#            when the gate is satisfied.
#   Layer 3  atomic claim (noclobber) on the burst flag - two concurrent Stop
#            processes cannot both block.
#   Layer 4  every failure path exits 0 (fail-open) via the EXIT trap below. The
#            block SIGNAL is the stdout {"decision":"block",...} JSON, never the exit
#            code, so forcing exit 0 cannot suppress a legitimate block.
#   Cross-gate deferral: if verify-before-done-stop will block this SAME burst (its
#   flag is armed 'visual' AND either a visual file is dirty OR the tree read was
#   uncertain), stay silent to avoid stacking two blocks on one stop. Including the
#   uncertain case keeps a non-git / unreadable tree from double-blocking, since
#   verify-before-done fail-closes and blocks there too (Codex finding D/LOW).
# When in doubt this hook ALLOWS on the loop axis and BLOCKS on the evidence axis:
# a missed review costs one un-gated change; a block loop costs the session, and an
# un-grounded clear defeats the whole gate.
#
# Subagent/teammate sessions are exempt (isSidechain or teamName in the transcript).

set -euo pipefail
trap 'exit 0' EXIT

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

# Session-scoped: block THIS session on ITS own un-reviewed design debt, not on a
# flag another concurrent session/project left set. Derivation is byte-identical to
# the arm site and every other reader so writer and reader agree on the path.
SESSION_KEY=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", "") or "")
except Exception:
    s = ""
print(re.sub(r"[^A-Za-z0-9._-]", "_", s) or "global")
' 2>/dev/null || echo global)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global

FLAG="$HOME/.claude/.needs-qa-gate.$SESSION_KEY"
BLOCKED_FLAG="$HOME/.claude/.qa-gate-blocked.$SESSION_KEY"

# Reap flags older than 24h so an abandoned session cannot mute (or ambush) a future
# one. Both the arm flag and the burst flag are reaped.
find "$HOME/.claude" -maxdepth 1 -name '.qa-gate-blocked.*' -type f -mtime +1 -delete 2>/dev/null || true
find "$HOME/.claude" -maxdepth 1 -name '.needs-qa-gate.*' -type f -mtime +1 -delete 2>/dev/null || true

# No armed flag -> nothing owed this session. Clean up any stale burst flag and allow.
if [ ! -f "$FLAG" ]; then
  rm -f "$BLOCKED_FLAG" 2>/dev/null || true
  exit 0
fi

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("transcript_path", "") or "")
except Exception:
    pass
' 2>/dev/null || true)

CWD=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("cwd", "") or "")
except Exception:
    pass
' 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Decision. Emits three lines: DECISION=<allow|clear|block>, VISUAL_DIRTY=<0|1>, and
# TREE_UNCERTAIN=<0|1>.
#   allow  - subagent/teammate turn; leave every flag untouched.
#   clear  - nothing design is dirty, or the QA gate provably ran; drop the flag.
#   block  - a design file is dirty (or the tree is uncertain) and no proof the gate
#            ran; demand the review.
# VISUAL_DIRTY / TREE_UNCERTAIN feed the cross-gate deferral in bash.
# Any parse failure prints nothing, which bash reads as "allow" (fail open).
# ---------------------------------------------------------------------------
DETECT=$(QA_FLAG="$FLAG" QA_TRANSCRIPT="$TRANSCRIPT" QA_CWD="$CWD" python3 <<'PYEOF' 2>/dev/null || true
import json, os, re, sys, subprocess

FLAG = os.environ.get("QA_FLAG", "")
TRANSCRIPT = os.environ.get("QA_TRANSCRIPT", "")
CWD = os.environ.get("QA_CWD", "")

# Design-file extensions the QA gate cares about. Kept in sync with DESIGN_EXT in
# sidecoach-orchestrate-edit.sh (the arm side) - if the arm can arm on an extension
# this set does not know, the tree scan would fail OPEN on a real design change and
# clear the flag. Widen this set whenever the arm side widens.
DESIGN_EXTS = {".html", ".htm", ".css", ".scss", ".sass", ".less",
               ".jsx", ".tsx", ".vue", ".svelte", ".astro"}
# The narrower VISUAL set verify-before-done-stop.sh uses. Only used to decide the
# cross-gate deferral (does the OTHER gate have a visual file to block on).
VISUAL_EXTS = {".css", ".scss", ".sass", ".less",
               ".html", ".htm", ".ejs", ".hbs", ".pug", ".twig",
               ".vue", ".svelte", ".jsx", ".tsx"}
# Non-app dev/test/scratch paths - the SAME notion the arm/verify sides use. Kept
# byte-identical to the copies in verify-before-done-stop.sh.
_NON_APP_DIR_RE = re.compile(
    r"(^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/")
_TEST_SPEC_RE = re.compile(r"\.(test|spec)\.[A-Za-z0-9]+$")

MAX_STATUS_ENTRIES = 20000
GIT_TIMEOUT_SECONDS = 5
MAX_TRANSCRIPT_LINES = 200000
# Small slack (seconds) so a QA run whose transcript timestamp is a hair before the
# flag mtime (clock granularity) still counts as evidence.
TS_SLACK_SECONDS = 3.0


def emit(decision, visual_dirty=0, tree_uncertain=0):
    print("DECISION=" + decision)
    print("VISUAL_DIRTY=" + ("1" if visual_dirty else "0"))
    print("TREE_UNCERTAIN=" + ("1" if tree_uncertain else "0"))
    sys.exit(0)


def is_subagent(path):
    """Mirror verify-before-done-stop.sh: a sidechain/teamName transcript is a
    teammate's turn and is exempt from the gate."""
    if not path:
        return False
    try:
        with open(path) as fh:
            for i, line in enumerate(fh):
                if i > 20:
                    break
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if isinstance(r, dict) and (r.get("isSidechain") is True or r.get("teamName")):
                    return True
    except Exception:
        return False
    return False


if is_subagent(TRANSCRIPT):
    emit("allow")


def scan_tree(cwd):
    """Return (design_dirty, visual_dirty, tree_uncertain).

    design_dirty FAILS CLOSED: every uncertainty returns True so the gate keeps
    demanding the review (no cwd, git missing, non-zero exit, timeout, too many
    entries, a dir/submodule entry, undecodable output). Only a clean, complete
    status listing with provably no dirty design file returns design_dirty False.

    visual_dirty is best-effort POSITIVE (uncertainty returns False), so the
    cross-gate deferral only fires when we are certain verify-before-done has a
    visual file to block on - never on a guess.

    tree_uncertain is True whenever we could not fully read the tree (the same set of
    fail-closed conditions). The cross-gate deferral yields to verify-before-done on
    an uncertain tree too, because verify-before-done fail-closes and blocks there as
    well, and two stacked blocks on one stop are just noise (Codex finding D/LOW)."""
    if not cwd or not os.path.isdir(cwd):
        return True, False, True
    try:
        p = subprocess.run(
            ["git", "status", "--porcelain", "-z",
             "--untracked-files=all", "--ignore-submodules=none"],
            cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=GIT_TIMEOUT_SECONDS)
    except Exception:
        return True, False, True
    if p.returncode != 0:
        return True, False, True
    try:
        # STRICT decode on purpose: a path with invalid UTF-8 bytes must RAISE so we
        # fail closed (keep gating). "replace" would substitute U+FFFD, and a
        # corrupted path that thereby loses its design extension would read as clean
        # and wrongly clear the gate (Codex 2026-08-23, High).
        raw = p.stdout.decode("utf-8")
    except Exception:
        return True, False, True
    chunks = [c for c in raw.split(chr(0)) if c]
    if len(chunks) > MAX_STATUS_ENTRIES:
        return True, False, True
    design = False
    visual = False
    uncertain = False
    for c in chunks:
        path = c
        status = ""
        if len(c) > 3 and c[2] == " ":
            status = c[:2]
            path = c[3:]
        # A deletion renders no surface and cannot be reviewed - never evidence.
        if "D" in status:
            continue
        # Non-app dev/test/scratch paths are not product UI.
        if _NON_APP_DIR_RE.search(path) or _TEST_SPEC_RE.search(path):
            continue
        ext = os.path.splitext(path)[1].lower()
        raw_ext = os.path.splitext(c)[1].lower()
        if ext in DESIGN_EXTS or raw_ext in DESIGN_EXTS:
            design = True
        if ext in VISUAL_EXTS or raw_ext in VISUAL_EXTS:
            visual = True
        try:
            if path and os.path.isdir(os.path.join(cwd, path)):
                design = True     # submodule/dir - cannot see inside -> fail closed
                uncertain = True  # and we genuinely could not enumerate it
        except Exception:
            design = True
            uncertain = True
    return design, visual, uncertain


design_dirty, visual_dirty, tree_uncertain = scan_tree(CWD)

if not design_dirty:
    # The tree PROVES there is no dirty design file: the QA gate has nothing to run
    # on, so the armed flag is stale (the change was reverted, or the arm fired on a
    # path that is not a live surface). Clear it and allow.
    emit("clear", visual_dirty, tree_uncertain)

# --- did the sidecoach QA gate actually RUN since the flag was armed? -------
try:
    flag_mtime = os.path.getmtime(FLAG)
except Exception:
    flag_mtime = 0.0

_VERB_RE = re.compile(r"\b(audit|critique|polish)\b", re.IGNORECASE)
_ALL_STAGES = frozenset(("audit", "critique", "polish"))


def parse_ts(s):
    if not isinstance(s, str) or not s:
        return None
    t = s.strip()
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    try:
        import datetime
        dt = datetime.datetime.fromisoformat(t)
    except Exception:
        return None
    # Refuse to guess a timezone for a NAIVE stamp: .timestamp() would read it as
    # local time, so an old naive UTC entry could parse as after the flag mtime and
    # wrongly clear a fresh flag (Codex 2026-08-23, Medium). Real transcripts stamp
    # tz-aware (trailing Z / offset), so genuine evidence still counts; only an
    # un-timezoned stamp is refused, which is the fail-closed direction for evidence.
    if dt.tzinfo is None:
        return None
    return dt.timestamp()


def sidecoach_qa_verbs(inp):
    """Return the set of QA stages (audit/critique/polish) named by a sidecoach Skill
    tool_use input, or empty set if this is not a sidecoach QA invocation. A real
    Skill tool_use is the ONLY un-forgeable proof a stage ran; prose describing the
    gate is deliberately NOT accepted (lead ruling 2026-08-23, option a - the agent
    authors its own transcript text, so a written 'ran the gate' would clear the very
    gate it is meant to verify; Codex finding C/HIGH)."""
    if not isinstance(inp, dict):
        return set()
    skill = str(inp.get("skill", "") or "")
    args = str(inp.get("args", "") or "")
    blob = skill + " " + args
    if "sidecoach" not in blob.lower():
        return set()
    return set(m.group(1).lower() for m in _VERB_RE.finditer(blob))


def evidence_since(path, since):
    """True iff sidecoach audit AND critique AND polish were EACH invoked as a real
    Skill tool_use at or after `since`. All three stages must be present (order is not
    enforced - enforcing order in a transcript scan is fragile and buys little; lead
    ruling on Codex finding 4). A single stage does NOT clear the gate - that would
    reopen the polish-skip hole (run audit, skip critique/polish, report done) this
    rung exists to close. An entry with no parseable timestamp never counts (an old
    run must never clear a fresh flag); the tree-clean and manual-override paths keep
    this from being a permanent trap even at the all-three bar."""
    if not path or not os.path.isfile(path):
        return False
    seen = set()
    try:
        with open(path, errors="replace") as fh:
            for i, line in enumerate(fh):
                if i > MAX_TRANSCRIPT_LINES:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if not isinstance(e, dict):
                    continue
                # Evidence must be ASSISTANT-authored. A tool_use block only ever
                # appears on an assistant entry; requiring type=="assistant" also
                # keeps a hook-injected context entry or a tool_result echo (both on
                # non-assistant entries) from ever counting, and a sidechain/meta
                # entry is not this session's own work.
                if e.get("type") != "assistant":
                    continue
                if e.get("isSidechain") or e.get("isMeta"):
                    continue
                ts = parse_ts(e.get("timestamp"))
                if ts is None or ts < (since - TS_SLACK_SECONDS):
                    continue
                msg = e.get("message", {})
                if not isinstance(msg, dict):
                    continue
                content = msg.get("content", [])
                if not isinstance(content, list):
                    continue
                for b in content:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use" and b.get("name") == "Skill":
                        seen |= sidecoach_qa_verbs(b.get("input", {}))
                        if _ALL_STAGES.issubset(seen):
                            return True
    except Exception:
        return False
    return _ALL_STAGES.issubset(seen)


if evidence_since(TRANSCRIPT, flag_mtime):
    emit("clear", visual_dirty, tree_uncertain)

# A design file is dirty (or the tree is uncertain) and there is no proof all three
# QA stages ran. Demand the review.
emit("block", visual_dirty, tree_uncertain)
PYEOF
)

# Detection failed to emit anything -> fail open (allow).
[ -z "${DETECT:-}" ] && exit 0

field() { printf '%s\n' "$DETECT" | grep "^$1=" | head -1 | cut -d= -f2-; }
DECISION=$(field DECISION || true)
VISUAL_DIRTY=$(field VISUAL_DIRTY || true)
case "$VISUAL_DIRTY" in ''|*[!0-9]*) VISUAL_DIRTY=0 ;; esac
TREE_UNCERTAIN=$(field TREE_UNCERTAIN || true)
case "$TREE_UNCERTAIN" in ''|*[!0-9]*) TREE_UNCERTAIN=0 ;; esac

case "$DECISION" in
  clear)
    # Gate satisfied (tree clean or the review ran) -> drop the arm flag and re-arm
    # the burst so a genuinely new edit can gate again.
    rm -f "$FLAG" "$BLOCKED_FLAG" 2>/dev/null || true
    exit 0
    ;;
  block)
    : # fall through to the anti-loop + emit below
    ;;
  *)
    # allow (subagent) or anything unexpected -> allow (fail open).
    exit 0
    ;;
esac

# Cross-gate deferral: if verify-before-done-stop will block this SAME burst, stay
# silent so the two gates do not stack two blocks on one stop. It blocks when its flag
# is armed 'visual' AND it has something to block on - either a dirty visual file OR
# an uncertain tree (it fail-closes on a non-git / unreadable tree just as we do).
# Deferring on the uncertain case too is the D-fix: without it, a non-git design
# session double-blocks (Codex finding D/LOW). Placed before the burst claim so
# deferring never consumes this gate's once-per-arm budget. GUARD: with no visual flag
# there is nothing to defer to, so a qa-only non-git session still blocks (fail-closed).
NV_FLAG="$HOME/.claude/.needs-verification.$SESSION_KEY"
if [ -f "$NV_FLAG" ] && { [ "$VISUAL_DIRTY" = "1" ] || [ "$TREE_UNCERTAIN" = "1" ]; }; then
  NV_CONTENT=$(tr -d '[:space:]' < "$NV_FLAG" 2>/dev/null || true)
  [ "$NV_CONTENT" = "visual" ] && exit 0
fi

# The arm flag's mtime IDENTIFIES this armed change. The burst flag stores the arm
# mtime it last blocked on, so "has a newer arm landed since the last block?" is a
# content compare, immune to the burst flag's own file mtime (which is always ~now and
# would never look newer than a future-dated arm - the bug the re-arm loop test bites).
ARM_MTIME=$(python3 -c 'import os,sys; print(int(os.path.getmtime(sys.argv[1])))' "$FLAG" 2>/dev/null || echo 0)
case "$ARM_MTIME" in ''|*[!0-9]*) ARM_MTIME=0 ;; esac

# Layer 2 (once-per-ARM, not once-per-session): a block already landed in this burst.
# Stay silent for the SAME arm - never two blocks in a row. But if the arm flag's
# mtime is NEWER than the one recorded in the burst flag, a FRESH substantive edit
# re-armed since that block, so this new change is owed its own single block: drop the
# stale burst flag and fall through to re-claim (Codex finding B/MEDIUM). Never loops:
# each distinct arm mtime yields at most one block, and re-claiming records the new arm
# mtime so the very next stop on that same arm goes silent again.
if [ -f "$BLOCKED_FLAG" ]; then
  PREV_MTIME=$(tr -dc '0-9' < "$BLOCKED_FLAG" 2>/dev/null || true)
  [ -z "$PREV_MTIME" ] && PREV_MTIME=0
  if [ "$ARM_MTIME" -gt "$PREV_MTIME" ]; then
    rm -f "$BLOCKED_FLAG" 2>/dev/null || true   # newer arm supersedes -> re-block once
  else
    exit 0                                       # same arm already blocked -> silent
  fi
fi

# Layer 3: atomic claim. Exactly one concurrent Stop can create the flag; the winner
# records the arm mtime it is blocking on so the next same-arm stop stays silent.
mkdir -p "$HOME/.claude" 2>/dev/null || true
if ! (set -o noclobber; printf '%s' "$ARM_MTIME" > "$BLOCKED_FLAG") 2>/dev/null; then
  exit 0
fi

TARGET=$(head -c 256 "$FLAG" 2>/dev/null | tr -d '\n\r' || true)
[ -z "$TARGET" ] && TARGET="the changed design file"

REASON="BLOCKED: a substantive design change to $TARGET has not been through the sidecoach QA gate. Run the gate on it before reporting the UI work done: /sidecoach audit $TARGET (address every Critical and High finding), then /sidecoach critique $TARGET (address anything above minor), then /sidecoach polish $TARGET (runs last). ALL THREE stages must run (each as a real sidecoach invocation) - a single stage does not clear this, and describing the gate in prose does not either. If this is genuinely not a UI change or the review does not apply, reply \"qa done\" or \"skip qa\" to override. This gate fires once per change, then stays quiet until all three stages run, the tree is clean, or you override."

REASON="$REASON" python3 -c '
import json, os
print(json.dumps({"decision": "block", "reason": os.environ["REASON"]}))
'
exit 0
