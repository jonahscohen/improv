#!/bin/bash
# sidecoach-orchestrate-edit.sh
#
# PostToolUse hook for Write|Edit|MultiEdit. The AUTOMATIC engagement path for
# sidecoach's orchestrator: the moment a SUBSTANTIVE design edit lands, run the
# sidecoach detection engine on the edited file AND hand the model the orchestrated
# QA gate (audit -> critique -> polish) as a directive - so the orchestration
# engages WITHOUT the model having to decide to load a skill or type a verb.
#
# WHY THIS EXISTS. sidecoach's richer flows only ran when the model chose to load
# a skill or type a verb; the keyword hook (UserPromptSubmit) only NUDGES the
# prompt and never runs the engine. This hook fires on the EDIT itself, runs the
# fast static lenses of the detect engine, and injects the multi-step QA-gate plan.
#
# RELATIONSHIP TO sidecoach-taste-gate.sh (do not confuse the two): the taste gate
# runs the STATIC ban/taste SUBSET on .html/.css UNDER a DESIGN.md project and
# issues a single "fix these" directive. THIS hook is the ORCHESTRATOR-engagement
# layer: broader design file types, no DESIGN.md required, and it hands off the
# full audit -> critique -> polish sequence rather than one check. The two use
# SEPARATE cooldown/suppress state files and never interfere.
#
# LOW NOISE (mission requirement):
#   - Fires only on a SUBSTANTIVE design edit (a real block of markup/CSS/JSX),
#     never on a trivial one-line tweak (min added size + a structural signal).
#   - Cooldown: after it engages ONCE, it stays silent for the window so an active
#     build and its follow-up edits are not re-nagged. The cooldown is touched
#     only when the hook actually emits a directive (an engagement), never on a
#     gated/silent path - so a suppressed edit does not consume the window.
#   - Manual override: `touch ~/.claude/.suppress-sidecoach-orchestrate` silences
#     it for 30 minutes.
#
# Scope guards: only design-file extensions; never node_modules / dist / .claude /
# the sidecoach engine's own source / minified / test files. Exclusions run on the
# ABSOLUTE path so a relative payload path (e.g. `sidecoach/x.html`) is caught too.
#
# ROBUSTNESS: the hook fails OPEN (emits "{}", never blocks the edit) on any bad
# input or missing engine. The payload is read from a temp FILE (path passed via
# env), not through an exported variable, so a large Write's content cannot exceed
# the environment size limit. It resolves the engine relative to its OWN location
# first, so a worktree/installed copy runs its OWN dist rather than a stale one.
#
# Tunables (env): SIDECOACH_DIR (engine location), SIDECOACH_ORCHESTRATE_COOLDOWN
# (seconds, default 1800), SIDECOACH_ORCHESTRATE_MIN_CHARS (default 160),
# SIDECOACH_ORCHESTRATE_COOLDOWN_FILE (state-file path, used by the test harness).

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

# Read the payload into a temp file and pass only its PATH to Python. Passing the
# whole payload through an exported env var breaks for large Write content (env
# size limit); a path is always tiny.
PAYLOAD_FILE="$(mktemp "${TMPDIR:-/tmp}/sidecoach-orchestrate.XXXXXX")" || { echo "{}"; exit 0; }
cat > "$PAYLOAD_FILE"
export HOOK_PAYLOAD_FILE="$PAYLOAD_FILE"
export HOOK_SCRIPT_DIR="$HOOK_DIR"

python3 <<'PYEOF'
import json, os, sys, subprocess, time, re

payload_file = os.environ.get("HOOK_PAYLOAD_FILE", "")
raw = ""
try:
    with open(payload_file, "r", encoding="utf-8") as fh:
        raw = fh.read()
finally:
    # Clean up the temp file regardless of what happens next.
    try:
        os.unlink(payload_file)
    except Exception:
        pass

def bail():
    # Fail OPEN: never block an edit, never crash the hook.
    print("{}")
    sys.exit(0)

try:
    data = json.loads(raw) if raw else {}
except Exception:
    bail()

# Valid JSON that is not the expected object shape (e.g. `[1]`) must fail open,
# not raise AttributeError on .get() below.
if not isinstance(data, dict):
    bail()

if data.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
    bail()

ti = data.get("tool_input")
if not isinstance(ti, dict):
    bail()
fp = ti.get("file_path")
if not isinstance(fp, str) or not fp:
    bail()

# --- design-file gate ------------------------------------------------------
DESIGN_EXT = (".html", ".htm", ".css", ".scss", ".sass", ".less",
              ".jsx", ".tsx", ".vue", ".svelte", ".astro")
if not fp.lower().endswith(DESIGN_EXT):
    bail()

# Normalize BEFORE the exclusion checks so a relative payload path is still caught
# (an absolute path always has slash-wrapped segments; `sidecoach/x.html` does not).
abs_fp = os.path.abspath(fp)
abs_low = abs_fp.lower()
if any(seg in abs_fp for seg in ("/node_modules/", "/sidecoach/", "/dist/", "/.claude/")):
    bail()
base = os.path.basename(abs_low)
if ".min." in base or base.endswith((".test.tsx", ".test.jsx", ".spec.tsx", ".spec.jsx")):
    bail()

# --- manual override + cooldown -------------------------------------------
ovr = os.path.expanduser("~/.claude/.suppress-sidecoach-orchestrate")
if os.path.isfile(ovr) and (time.time() - os.path.getmtime(ovr)) < 1800:
    bail()

cooldown_file = os.environ.get("SIDECOACH_ORCHESTRATE_COOLDOWN_FILE") or \
    os.path.expanduser("~/.claude/.sidecoach-orchestrate-cooldown")
try:
    cooldown_seconds = int(os.environ.get("SIDECOACH_ORCHESTRATE_COOLDOWN", "1800"))
except Exception:
    cooldown_seconds = 1800

def in_cooldown():
    if cooldown_seconds <= 0:
        return False
    try:
        with open(cooldown_file, "r", encoding="utf-8") as fh:
            ts = int((fh.read() or "0").strip() or "0")
        return (time.time() - ts) < cooldown_seconds
    except Exception:
        return False

def touch_cooldown():
    try:
        with open(cooldown_file, "w", encoding="utf-8") as fh:
            fh.write(str(int(time.time())))
    except Exception:
        pass

if in_cooldown():
    bail()

# --- substantive-edit gate -------------------------------------------------
# Extract the text this tool call ADDED, so a trivial one-line value tweak does
# not engage the orchestrator (that is the taste-gate's per-edit job, not this
# multi-step gate's).
tool = data.get("tool_name")
added = ""
if tool == "Write":
    added = ti.get("content", "") or ""
elif tool == "Edit":
    added = ti.get("new_string", "") or ""
elif tool == "MultiEdit":
    edits = ti.get("edits", []) or []
    if isinstance(edits, list):
        added = "\n".join((e.get("new_string", "") or "")
                          for e in edits if isinstance(e, dict))
if not isinstance(added, str):
    bail()

try:
    min_chars = int(os.environ.get("SIDECOACH_ORCHESTRATE_MIN_CHARS", "160"))
except Exception:
    min_chars = 160

added_stripped = added.strip()
if len(added_stripped) < min_chars:
    bail()

# A structural design signal: an actual element, or a CSS declaration block.
# Requiring one (not just size) keeps a large prose/comment edit from firing.
has_element = re.search(r"<[A-Za-z][A-Za-z0-9-]*(?:\s|/|>)", added) is not None
has_css_block = re.search(r"\{[^{}]*[A-Za-z-]+\s*:[^{}]+\}", added) is not None
if not (has_element or has_css_block):
    bail()

if not os.path.isfile(abs_fp):
    bail()

# --- locate the sidecoach engine (compiled dist) ---------------------------
# Resolve relative to THIS script first, so a worktree/installed copy runs its OWN
# dist rather than a hardcoded checkout that may be stale or absent. The env
# override and the two well-known locations are fallbacks.
hook_dir = os.environ.get("HOOK_SCRIPT_DIR", "")
cands = []
if os.environ.get("SIDECOACH_DIR"):
    cands.append(os.environ["SIDECOACH_DIR"])
if hook_dir:
    # claude/hooks -> ../../sidecoach (repo/worktree); ~/.claude/hooks -> ../sidecoach (installed).
    cands.append(os.path.realpath(os.path.join(hook_dir, "..", "..", "sidecoach")))
    cands.append(os.path.realpath(os.path.join(hook_dir, "..", "sidecoach")))
cands.append(os.path.expanduser("~/Documents/Github/improv/sidecoach"))
cands.append(os.path.expanduser("~/.claude/sidecoach"))

sc = next((c for c in cands
           if c and os.path.isfile(os.path.join(c, "bin", "sidecoach-qa-plan.js"))
           and os.path.isfile(os.path.join(c, "dist", "qa-gate.js"))), None)
if not sc:
    # The engine is not built/reachable here - stay out of the way rather than
    # emit an orchestration directive we cannot ground.
    bail()

# --- run the detect engine on the edited file (fast static lenses) ---------
# --no-render keeps this headless and quick; a render needs a live server we do
# not have at edit time. Soft-fail: a detect failure still lets the orchestration
# directive go out (grounded is better, but the engagement is the point).
detect_line = ""
try:
    out = subprocess.run(
        ["node", os.path.join(sc, "bin", "sidecoach-detect.js"), abs_fp, "--no-render", "--quiet"],
        capture_output=True, text=True, timeout=30)
    res = json.loads(out.stdout or "{}")
    verdict = res.get("verdict", "unknown")
    sc_counts = res.get("severityCounts", {}) or {}
    blocking = sc_counts.get("blocking", 0)
    warning = sc_counts.get("warning", 0)
    tops = []
    for f in (res.get("findings", []) or [])[:5]:
        where = f.get("selector") or f.get("location") or "(no location)"
        tops.append("[%s] %s @ %s%s" % (
            f.get("severity", "?"), f.get("rule", "?"), where,
            (" - " + f["detail"]) if f.get("detail") else ""))
    detect_line = ("Static detect verdict: %s (blocking %s, warning %s)." %
                   (verdict, blocking, warning))
    if tops:
        detect_line += "\n  - " + "\n  - ".join(tops)
except Exception:
    detect_line = ("Static detect did not complete on this file; run "
                   "`/sidecoach audit` for the full rendered scan.")

# --- resolve the orchestrated QA gate --------------------------------------
# Only accept the resolver's output when it SUCCEEDS (exit 0 + non-empty). The
# resolver is fail-loud: an unroutable stage exits nonzero with empty stdout. On
# any failure we fall back to the three canonical gate verbs WITHOUT a flow-chain
# annotation - the audit->critique->polish ORDER is the CLAUDE.md contract and does
# not drift, and the fallback deliberately omits the registry-derived chains that
# could. This keeps the resolver's fail-loud guarantee intact.
qa_text = ""
try:
    out = subprocess.run(
        ["node", os.path.join(sc, "bin", "sidecoach-qa-plan.js"), "--target", abs_fp],
        capture_output=True, text=True, timeout=15)
    if out.returncode == 0 and out.stdout.strip():
        qa_text = out.stdout.strip()
except Exception:
    qa_text = ""
if not qa_text:
    qa_text = ("Sidecoach QA gate (audit -> critique -> polish):\n"
               "  1. /sidecoach audit %s\n  2. /sidecoach critique %s\n  3. /sidecoach polish %s\n"
               "Run the three in order to completion; do not stop after audit." % (abs_fp, abs_fp, abs_fp))

# --- engage: touch cooldown + inject the directive -------------------------
# We only reach here on a genuine engagement (a substantive design edit that
# passed every gate), so touching the cooldown here - once per window - is the
# intended low-noise behaviour. The window is global on purpose: engage once, then
# stay quiet while the build and its follow-ups proceed.
touch_cooldown()

# ARM the QA-gate finish-boundary rung (session_2026-08-23). A substantive design
# edit now OWES a sidecoach QA gate (audit -> critique -> polish) before the turn
# can report the UI work done. sidecoach-qa-gate-stop.sh reads this flag at Stop and
# blocks ONCE until it sees the gate actually ran (or the tree goes clean, or the
# user overrides). This arm is the write-boundary nudge's finish-boundary teeth: the
# directive below is a hint, this flag is what a later Stop hook verifies was honored.
# Only reached on a GENUINE engagement (every bail() path returns before here), so a
# gated/suppressed edit never arms. SESSION_KEY derivation is byte-identical to
# verify-before-done-stop.sh / verify-manual.sh / qa-gate-manual.sh so the arm site
# and the gate/override agree on the exact flag path. The flag body is the target
# basename, which the block reason echoes back to the model.
try:
    # Arm ONLY on paths the gate would actually block on. The Stop gate's tree scan
    # skips non-app dev/test/scratch paths (docs/, any fixtures/, eval/, *.test.*,
    # ...), so arming on one of those would write a flag that self-clears on the next
    # Stop - an arm/gate scope drift (Codex 2026-08-23, Medium). These two patterns
    # are byte-identical to _NON_APP_DIR_RE / _TEST_SPEC_RE in sidecoach-qa-gate-stop.sh
    # so the arm and the gate agree on what counts as a live product surface.
    _qa_nonapp = re.compile(
        r"(^|/)(eval|fixtures|__fixtures__|test-fixtures|__tests__|[A-Za-z0-9._-]*corpus|docs|reference|dependency-map|scratchpad)/")
    _qa_testspec = re.compile(r"\.(test|spec)\.[A-Za-z0-9]+$")
    if not (_qa_nonapp.search(abs_fp) or _qa_testspec.search(os.path.basename(abs_fp))):
        _qa_sk = re.sub(r"[^A-Za-z0-9._-]", "_",
                        str(data.get("session_id", "") or "")) or "global"
        _qa_flag = os.path.expanduser("~/.claude/.needs-qa-gate." + _qa_sk)
        os.makedirs(os.path.dirname(_qa_flag), exist_ok=True)
        with open(_qa_flag, "w", encoding="utf-8") as _fh:
            _fh.write(os.path.basename(abs_fp))
except Exception:
    # Arming is best-effort: never let a flag-write failure break the directive
    # emit or the edit. A missed arm costs one un-gated review, not a broken hook.
    pass

msg = (
    "SIDECOACH ORCHESTRATION - a substantive design edit just landed on "
    + os.path.basename(abs_fp) + ". The detection engine already ran on it:\n"
    + detect_line + "\n\n"
    "Now engage the sidecoach QA gate on this change before you report the UI "
    "work done. This is the orchestrated multi-step review, not a single check - "
    "run all three stages in order to completion:\n"
    + qa_text + "\n\n"
    "Address Critical/High audit findings and anything above 'minor' from critique; "
    "polish runs last. Do not declare the design change done until the gate is clear. "
    "To silence this for 30 min: touch ~/.claude/.suppress-sidecoach-orchestrate"
)

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": msg,
}}))
PYEOF

rm -f "$PAYLOAD_FILE" 2>/dev/null
exit 0
