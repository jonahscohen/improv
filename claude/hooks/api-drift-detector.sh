#!/bin/bash
# PostToolUse (all tools): detect breaking API / tool-contract DRIFT in tool
# results and force an accommodation, so a changed tool API never silently
# breaks a workflow/guard the way the cmux-teams break did on 2026-06-22.
#
# Two jobs:
#   1. DETECT - if a NON-Bash tool result carries a breaking-contract signal
#      (deprecated / removed / unknown-parameter / InputValidationError /
#      "should have been initialized" / ...), append to ~/.claude/.api-drift.log,
#      set ~/.claude/.api-drift-pending, and inject a directive. The Stop hook
#      (api-drift-stop.sh) then blocks the turn until the flag clears.
#   2. CLEAR-ON-ACCOMMODATE - an Edit/Write to a guard/wrapper/config
#      (claude/hooks/, settings.json, *launcher*.sh, install.sh) IS the
#      accommodation, so it clears the pending flag.
#
# Bash is skipped for DETECT on purpose (its stdout is too noisy: grep "not
# found", curl 404s, etc.). Drift shows up in tool-API results, not shell output.
# Manual dismiss for a false positive: say "drift handled" (api-drift-ack.sh).

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re, time

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = d.get("tool_name", "") or ""
home = os.path.expanduser("~")
pending = os.path.join(home, ".claude", ".api-drift-pending")
logf = os.path.join(home, ".claude", ".api-drift.log")

# 1. Clear-on-accommodate: editing a guard/wrapper/config resolves the drift.
if tool in ("Edit", "Write", "MultiEdit"):
    fp = (d.get("tool_input") or {}).get("file_path", "") or ""
    accom = ("/claude/hooks/" in fp or fp.endswith("settings.json")
             or "launcher" in fp or fp.endswith("install.sh"))
    if accom and os.path.exists(pending):
        try:
            det = open(pending).read().strip()
        except Exception:
            det = ""
        try:
            os.remove(pending)
        except FileNotFoundError:
            pass
        try:
            with open(logf, "a") as fh:
                fh.write("%s ACCOMMODATED via %s (was: %s)\n" % (time.strftime("%Y-%m-%dT%H:%M:%S"), fp, det))
        except Exception:
            pass
    print("{}"); sys.exit(0)

# 2. Detect - tool-API results only (Bash stdout is too noisy).
if tool == "Bash" or not tool:
    print("{}"); sys.exit(0)

resp = d.get("tool_response", d.get("tool_result", ""))
try:
    blob = resp if isinstance(resp, str) else json.dumps(resp)
except Exception:
    blob = str(resp)

SIG = re.compile(
    r"deprecated|no longer (supported|available|exists)|has been removed|was removed|"
    r"unknown (parameter|argument|option|field)|unexpected keyword|InputValidationError|"
    r"should have been initialized|not a valid tool|is not a recognized|no such tool",
    re.IGNORECASE)
m = SIG.search(blob or "")
if not m:
    print("{}"); sys.exit(0)

sig = m.group(0)
snippet = (blob or "")[:300].replace("\n", " ")
try:
    with open(logf, "a") as fh:
        fh.write("%s DRIFT tool=%s sig=%s :: %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%S"), tool, sig, snippet))
except Exception:
    pass
try:
    with open(pending, "w") as fh:
        fh.write("tool=%s sig=%s" % (tool, sig))
except Exception:
    pass

msg = ("API DRIFT DETECTED: tool " + tool + " returned a breaking-contract signal (\"" + sig + "\"). "
       "A workflow/guard/wrapper may be enforcing a deprecated contract. STOP and investigate what "
       "changed in the tool API, then write an ACCOMMODATION - update the affected guard/launcher/"
       "settings to match the new contract and record a beat. Do not just retry the same call. "
       "Editing a guard/wrapper/config clears this; say \"drift handled\" if it is a false positive.")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": msg}}))
'
