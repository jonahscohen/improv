#!/bin/bash

# --- per-project sidecoach opt-out (Jonah 2026-08-27) -------------------------
# A repo carrying a `.sidecoach-off` file at its root disables sidecoach hooks for
# that project only. cwd is the project working dir when Claude runs a hook; fall
# back to $PWD outside a git tree. Other projects (no marker) are unaffected.
_sc_off_root="$(git rev-parse --show-toplevel 2>/dev/null || printf %s "$PWD")"
if [ -n "$_sc_off_root" ] && [ -f "$_sc_off_root/.sidecoach-off" ]; then exit 0; fi
# -----------------------------------------------------------------------------
# PostToolUse (Write|Edit|MultiEdit) advisory scanner - the REAL detect path (Stage 3b).
#
# After a UI file is written, run the sidecoach detect CLI over it and surface any
# findings back to context. This replaces the removed fake hook that reported a false
# clean by conflating "could not scan" with "clean".
#
# HONEST COUNT, PERMISSIVE DECISION (the load-bearing split - do not blur it):
#   * The finding COUNT is the CLI's fail-closed verdict. A scan that did not run comes
#     back `inconclusive`, NEVER `clean`. This hook never fabricates a clean.
#   * The hook DECISION is fail-OPEN. Real findings (CLI exit 1) surface advisorily; an
#     inconclusive render (exit 3), a load/IO error (exit 2), a timeout, a missing build,
#     or a missing CLI all surface as an explicit NOT-CLEAN warning - none of them block
#     or wedge the edit. The hook ALWAYS exits 0.
#   * Advisory only: it reports findings to context. It never auto-fixes and never blocks.
#
# Only CLI exit 0 (verdict clean) is silent. Every other outcome is surfaced as
# explicitly not-clean, so absence of a warning can only ever mean a scan really ran
# and really found nothing.
#
# Scope: only a local file with a plausibly-UI extension is scanned; any other local
# edit is skipped silently (exit 0, no output). An http(s):// target is forwarded to the
# CLI as a URL scan (the CLI is target-agnostic) - the normal edit path only ever passes
# local file paths, so the URL branch is inert there and exercised by tests / manual use.
#
# CLI resolution is script-relative and portable: the CLI is found next to this hook in
# the repo via the resolved (symlink-followed) script path, NOT a hardcoded home dir.
#   Overrides: SIDECOACH_DETECT_CLI (explicit path to sidecoach-detect.js),
#              SIDECOACH_DIR (a sidecoach dir whose bin/ holds the CLI).
#   Tunables:  SIDECOACH_DETECT_TIMEOUT (seconds, default 90), SIDECOACH_NODE (node bin).
#
# NOT auto-registered into settings.json. Registration is left to a human; see the
# registration note in test-sidecoach-detect.sh.

INPUT=$(cat)
export HOOK_INPUT="$INPUT"
export HOOK_SELF="${BASH_SOURCE[0]}"

# The logic runs in python3 (house style). If python3 is somehow absent we must still
# honor both invariants: exit 0 (never block) AND never imply a clean (a missing runtime
# is not a passing scan). So emit an explicit not-clean advisory rather than a raw non-zero.
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"SIDECOACH DETECT (advisory) - python3 is unavailable, so the scan did NOT run. This is not a clean result; it does not block the edit."}}'
  exit 0
fi

python3 <<'PYEOF'
import json, os, sys, subprocess

TAG = "SIDECOACH DETECT (advisory)"

def emit_silent():
    # `{}` is the PostToolUse no-op: adds no context, does not block. Reserved for the
    # two honest silences - a skipped non-UI edit, and a CLI-certified clean scan.
    print("{}")
    sys.exit(0)

def emit_context(msg):
    # Surface advisory context and ALWAYS exit 0 - the hook decision is fail-open, so no
    # scanner outcome (findings, inconclusive, or infra error) ever blocks the edit.
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": msg,
    }}))
    sys.exit(0)

raw = os.environ.get("HOOK_INPUT", "")
try:
    data = json.loads(raw)
except Exception:
    emit_silent()
if not isinstance(data, dict):
    emit_silent()

if data.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
    emit_silent()

tool_input = data.get("tool_input")
if not isinstance(tool_input, dict):
    emit_silent()
target = tool_input.get("file_path") or ""
if not isinstance(target, str) or not target:
    emit_silent()

UI_EXT = (".html", ".htm", ".css", ".scss", ".sass", ".less",
          ".tsx", ".jsx", ".vue", ".svelte", ".astro")

is_url = target.startswith("http://") or target.startswith("https://")
if is_url:
    scan_target = target
    label = target
else:
    # Local file. The silences below are SCOPE skips ("not this hook's target"), NOT clean
    # verdicts - the scanner is never invoked, so nothing is being certified. That is a
    # different thing from a scan that ran and could not certify (which is surfaced as an
    # explicit not-clean advisory). Only the CLI's own exit 0 ever emits a clean silence.
    if not os.path.isfile(target):
        emit_silent()  # no target on disk to scan (post-write the file normally exists)
    if not target.lower().endswith(UI_EXT):
        emit_silent()  # a non-UI edit (.py/.md/.json/...) is not this scanner's job
    if "/node_modules/" in target:
        emit_silent()  # build artifacts / deps are never hand-authored UI
    scan_target = os.path.abspath(target)
    label = os.path.basename(target)

# --- Resolve the detect CLI, script-relative (portable, no hardcoded home dir). ---
def resolve_cli():
    env_cli = os.environ.get("SIDECOACH_DETECT_CLI", "")
    if env_cli and os.path.isfile(env_cli):
        return env_cli
    self_path = os.environ.get("HOOK_SELF", "")
    if self_path:
        # Follow the ~/.claude/hooks symlink back into the repo, then step up from
        # <repo>/claude/hooks/sidecoach-detect.sh to <repo>.
        real = os.path.realpath(self_path)
        repo = os.path.dirname(os.path.dirname(os.path.dirname(real)))
        cand = os.path.join(repo, "sidecoach", "bin", "sidecoach-detect.js")
        if os.path.isfile(cand):
            return cand
    sc_dir = os.environ.get("SIDECOACH_DIR", "")
    if sc_dir:
        cand = os.path.join(sc_dir, "bin", "sidecoach-detect.js")
        if os.path.isfile(cand):
            return cand
    return None

cli = resolve_cli()
if not cli:
    emit_context(TAG + " - could not locate the detect CLI "
                 "(sidecoach/bin/sidecoach-detect.js). The scan did NOT run, so this is not a clean "
                 "result. It does not block the edit. Set SIDECOACH_DETECT_CLI or SIDECOACH_DIR if "
                 "sidecoach lives elsewhere.")

# --- Run the CLI. Portable timeout via subprocess (macOS ships no coreutils `timeout`). ---
try:
    timeout = float(os.environ.get("SIDECOACH_DETECT_TIMEOUT", "90"))
except ValueError:
    timeout = 90.0
node = os.environ.get("SIDECOACH_NODE", "") or "node"

try:
    proc = subprocess.run([node, cli, scan_target, "--quiet"],
                          capture_output=True, text=True, timeout=timeout)
except subprocess.TimeoutExpired:
    emit_context(TAG + " - the scan of " + label + " timed out after " + str(int(timeout))
                 + "s and did NOT complete. Not a clean result; it does not block the edit. "
                 "Raise SIDECOACH_DETECT_TIMEOUT for larger targets.")
except FileNotFoundError:
    emit_context(TAG + " - could not run node ('" + node + "') to scan " + label + ". The scan "
                 "did NOT run, so this is not a clean result; it does not block the edit. Set "
                 "SIDECOACH_NODE if node lives elsewhere.")
except Exception as err:
    emit_context(TAG + " - the scanner failed to launch on " + label + " (" + str(err) + "). "
                 "Not a clean result; it does not block the edit.")

code = proc.returncode
try:
    result = json.loads(proc.stdout)
except Exception:
    result = None
if not isinstance(result, dict):
    result = None

def reasons_from(res):
    # Defensive: the CLI always emits a list, but a malformed payload must never crash the
    # hook (a crash is a non-zero exit, which would violate the fail-open contract).
    if not res:
        return ""
    rs = res.get("unavailableReasons")
    if not isinstance(rs, list):
        return ""
    return "; ".join(str(r).replace("\n", " ").strip() for r in rs[:4])

# CLI exit contract: 0 clean, 1 findings, 2 usage/IO/load, 3 inconclusive.
if code == 0:
    # Clean is the ONLY silent outcome, and only the CLI's own exit 0 earns it. Every
    # non-zero code below is surfaced, so silence can never mean "could not scan".
    emit_silent()

if code == 1:
    # Exit 1 means the CLI found something. Normalize defensively: a null/string/non-list
    # findings payload, or non-dict items, must never crash the hook (a crash is a non-zero
    # exit that would break fail-open) and must never collapse exit 1 into a clean silence.
    raw_findings = result.get("findings") if result else None
    findings = [f for f in raw_findings if isinstance(f, dict)] if isinstance(raw_findings, list) else []
    verdict = (result.get("verdict") if result else None) or "findings"
    lines = []
    for f in findings[:12]:
        sev = f.get("severity", "?")
        lens = f.get("lens", "?")
        rule = f.get("rule", "?")
        where = f.get("selector") or f.get("location") or "(no location)"
        detail = str(f.get("detail") or "").strip()
        if len(detail) > 200:
            detail = detail[:197] + "..."
        lines.append("  - [" + str(sev) + "] " + str(lens) + "/" + str(rule) + " @ " + str(where)
                     + (" - " + detail if detail else ""))
    more = len(findings) - 12
    if more > 0:
        lines.append("  ...(+" + str(more) + " more)")
    count = len(findings)
    head = (str(count) + " finding(s)") if count else "findings reported (detail unparseable)"
    body = "\n".join(lines) if lines else "  (the scanner reported findings; see the detect output)"
    emit_context(TAG + " - " + head + " in " + label + " (verdict: " + str(verdict) + "). These are "
                 "real detector results, not auto-fixed. Address them before reporting this UI change "
                 "done. This hook does not block the edit:\n" + body)

if code == 3:
    why = reasons_from(result) or "at least one lens did not run"
    emit_context(TAG + " - the scan of " + label + " was INCONCLUSIVE, not clean. The scanner could "
                 "not complete every lens, so the absence of findings here is NOT a pass. This does "
                 "not block the edit. Reason(s): " + why)

# code == 2 (usage/IO/load error), any other unexpected non-zero, or unparseable output.
detail = reasons_from(result)
if not detail and proc.stderr and proc.stderr.strip():
    detail = proc.stderr.strip().splitlines()[-1][:200]
detail = (" Reason(s): " + detail) if detail else ""
emit_context(TAG + " - the scanner could not complete on " + label + " (exit " + str(code)
             + "). It certified nothing, so this is not a clean result; it does not block the edit. "
             "If sidecoach/dist is missing, run `npm run build` in sidecoach/." + detail)
PYEOF
