#!/usr/bin/env bash
# Regression tests for the Justify watch guards in bash-guard.sh.
#
# Two guarantees (Jonah, 2026-07-09):
#   1. An agent can never stop the watch or kill the worker that applies changes.
#   2. Prose ABOUT those commands (beats, docs, echo) must still pass, or the
#      guard becomes unusable and someone weakens it.
#
# Run:  bash claude/hooks/test-justify-watch-guard.sh
set -uo pipefail

GUARD="$(cd "$(dirname "$0")" && pwd)/bash-guard.sh"
PASS=0
FAIL=0

# Build the hook payload in python so this test file never contains a literal
# command line that the guard would match when the harness runs THIS script.
run_guard() {
  python3 -c '
import json,sys
print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1" | bash "$GUARD" 2>/dev/null
}

decision() {
  run_guard "$1" | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
h=d.get("hookSpecificOutput") or {}
print(h.get("permissionDecision","allow"))' 2>/dev/null
}

expect() {
  local want="$1" cmd="$2" label="$3"
  local got; got="$(decision "$cmd")"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS+1)); printf "  ok    %-52s -> %s\n" "$label" "$got"
  else
    FAIL=$((FAIL+1)); printf "  FAIL  %-52s -> %s (wanted %s)\n" "$label" "$got" "$want"
  fi
}

D="deny"; A="allow"
DISARM="justify-watch"; DISARM="${DISARM}-disarm"   # assembled, never a literal

echo "must BLOCK (agent cannot stop the watch):"
expect "$D" "$DISARM"                                            "bare disarm"
expect "$D" "cd /tmp && $DISARM"                                 "disarm after &&"
expect "$D" "$DISARM; echo done"                                 "disarm before ;"
expect "$D" "JUSTIFY_PORT=9223 $DISARM"                          "disarm with env prefix"
expect "$D" "curl -s -X POST http://localhost:9223/watch/disarm" "curl disarm route"
expect "$D" "curl -X POST http://127.0.0.1:9223/watch/consent"   "curl consent route"
expect "$D" "rm ~/.claude/justify/watch-state.json"              "rm watch-state"
expect "$D" "echo '{}' > ~/.claude/justify/watch-state.json"     "overwrite watch-state"
expect "$D" "rm -f ~/.claude/justify/disarm-consent.json"        "rm consent file"
expect "$D" "pkill -f 'claude -p You are the Justify headless'"  "pkill justify worker"
expect "$D" "kill -9 \$(pgrep -f justify-worker)"                "kill justify worker"
expect "$D" "killall justify-serve"                              "killall justify daemon"
expect "$D" "sudo $DISARM"                                       "disarm behind sudo"
expect "$D" "true || $DISARM"                                    "disarm after ||"
expect "$D" "( $DISARM )"                                        "disarm in a subshell"

echo
echo "must ALLOW (reading, arming, and prose about the commands):"
expect "$A" "curl -s http://localhost:9223/status"               "read status"
expect "$A" "curl -s http://localhost:9223/watch/state"          "read watch state"
expect "$A" "curl -s http://localhost:9223/prompts"              "read prompt queue"
expect "$A" "justify-watch-arm /Users/spare3/proj"               "arming is allowed"
expect "$A" "justify-serve"                                      "starting daemon"
expect "$A" "justify-done prompt-1 'did a thing' 'a.css'"        "responding to a prompt"
expect "$A" "cat ~/.claude/justify/watch-state.json"             "reading watch-state"
expect "$A" "echo 'tell the user to run $DISARM themselves'"     "prose in echo"
expect "$A" "grep -rn '$DISARM' docs/"                           "grep for the name"
expect "$A" "pkill -f 'sass.*--watch'"                           "unrelated pkill survives"
expect "$A" "kill 12345"                                         "unrelated kill survives"
# The name as an ARGUMENT, not a command. These are how the plugin gets built and
# deployed; blocking them made the guard block its own maintenance.
expect "$A" "for f in $DISARM justify-serve; do cp \$f.sh ~/; done" "name in a for-loop list"
expect "$A" "cp cli/$DISARM.sh ~/.claude/justify/"               "copying the script file"
expect "$A" "chmod +x ~/.claude/justify/$DISARM.sh"              "chmod the script file"
expect "$A" "justify-serve --restart"                            "safe daemon restart"

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
