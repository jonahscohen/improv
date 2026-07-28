#!/bin/bash
# probe-codex-invoke.sh - two-direction probe for codex-failure-watcher.sh's
# invocation detector.
#
# Feeds the hook a REAL capacity-failure tool_response and a command string, then
# records whether the watcher spoke. Every FIRE case is a genuine codex
# invocation whose failure must never be silently swallowed; every SILENT case
# merely MENTIONS codex and must not over-fire.
#
# Usage: /bin/bash probe-codex-invoke.sh [path-to-watcher]
# Exit 0 all cases behave, 1 at least one case wrong, 2 harness error.

set -uo pipefail

HOOK="${1:-$(cd "$(dirname "$0")/.." && pwd)/codex-failure-watcher.sh}"
[ -f "$HOOK" ] || { echo "HARNESS ERROR: no watcher at $HOOK" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "HARNESS ERROR: python3 required" >&2; exit 2; }

FAILOUT='ERROR: Selected model is at capacity. Please try again.'
pass=0; fail=0; inert=0

run_case() {  # $1 = expect (FIRE|SILENT), $2 = label, $3 = command
  local expect="$1" label="$2" cmd="$3" payload out got
  payload=$(CMD="$cmd" OUT="$FAILOUT" python3 -c '
import json, os
print(json.dumps({
    "tool_name": "Bash",
    "tool_input": {"command": os.environ["CMD"]},
    "tool_response": {"stdout": os.environ["OUT"]},
}))')
  out=$(printf '%s' "$payload" | /bin/bash "$HOOK" 2>/dev/null)
  case "$out" in
    *"CODEX FAILURE DETECTED"*) got=FIRE ;;
    # INERT is a THIRD state, not silence: the watcher could not run at all (no
    # python3, no writable temp dir). Folding it into SILENT made every FIRE row
    # look like a detector bug in a read-only sandbox. Codex review 2026-07-28.
    *"CODEX WATCHER INERT"*)    got=INERT ;;
    *)                          got=SILENT ;;
  esac
  if [ "$got" = "INERT" ] && [ "$expect" != "INERT" ]; then
    inert=$((inert + 1))
    printf 'HARNESS want=%-6s got=INERT  %s\n    the watcher could not run here; this is not a detector result\n' "$expect" "$label"
    return
  fi
  if [ "$got" = "$expect" ]; then
    pass=$((pass + 1)); printf 'ok   %-6s %s\n' "$expect" "$label"
  else
    fail=$((fail + 1)); printf 'FAIL want=%-6s got=%-6s %s\n    cmd: %s\n' "$expect" "$got" "$label" "$cmd"
  fi
}

echo "=== DIRECTION 1: genuine invocations that MUST fire ==="
run_case FIRE "bare"                  'codex exec "review this diff"'
run_case FIRE "sudo"                  'sudo codex exec "review this diff"'
run_case FIRE "env wrapper"           'env OPENAI_API_KEY=sk-x codex exec "review"'
run_case FIRE "inline assignment"     'OPENAI_API_KEY="$K" codex exec "review"'
run_case FIRE "command builtin"       'command codex exec "review"'
run_case FIRE "timeout wrapper"       'timeout 600 codex exec "review"'
run_case FIRE "pipe into codex"       'git diff HEAD | codex exec "review"'
run_case FIRE "and-and chain"         'npm test && codex exec "review"'
run_case FIRE "subshell"              '(cd /tmp && codex exec "review")'
run_case FIRE "command substitution"  'out=$(codex exec "review")'
run_case FIRE "backtick substitution" 'result=`codex exec "review"`'
run_case FIRE "absolute path"         '/usr/local/bin/codex exec "review"'
run_case FIRE "tilde path"            '~/.nvm/versions/node/v20.19.6/bin/codex exec "review"'
run_case FIRE "output redirect"       'codex exec "review" > /tmp/out.txt 2>&1'
run_case FIRE "nohup background"      'nohup codex exec "review" &'
run_case FIRE "bash -c nested"        'bash -c "codex exec review"'
run_case FIRE "semicolon chain"       'cd /tmp; codex exec "review"'
run_case FIRE "newline chain"         'cd /tmp
codex exec "review"'
run_case FIRE "sudo with -u operand"  'sudo -u builder codex exec "review"'
run_case FIRE "then-branch"           'if [ -f p.txt ]; then codex exec "review"; fi'
run_case FIRE "shell-fed heredoc"     'bash <<'"'"'EOF'"'"'
codex exec "review"
EOF'
run_case FIRE "brace group"           '{ codex exec "review"; }'

echo
echo "=== DIRECTION 2: mere mentions that MUST stay silent ==="
run_case SILENT "quoted BRE alternation" 'grep -n "codex-rescue-guard\|codex-failure-watcher" claude/settings.json'
run_case SILENT "quoted ERE group"       'grep -rE "(codex|ERROR)" /tmp/logs'
run_case SILENT "heredoc body"           'cat <<'"'"'EOF'"'"' > /tmp/notes.md
codex exec is the review command
EOF'
run_case SILENT "path argument"          'ls -la ~/.claude/hooks/codex-review.py'
run_case SILENT "trailing comment"       'echo hello   # codex exec reminder'
run_case SILENT "whole-line comment"     '# codex exec is documented here'
run_case SILENT "ripgrep pattern"        'rg "codex" claude/hooks/'
run_case SILENT "python string literal"  'python3 -c "print('"'"'codex exec'"'"')"'
run_case SILENT "grep after pipe"        'git log --oneline | grep codex'
run_case SILENT "sudo grep"              'sudo grep codex /var/log/system.log'
run_case SILENT "codex in a filename"    'cat claude/hooks/codex-failure-watcher.sh'
run_case SILENT "bash -c grep"           'bash -c "grep codex /tmp/x"'
run_case SILENT "command -v lookup"      'command -v codex >/dev/null 2>&1 && echo ok'
run_case SILENT "command -V lookup"      'command -V codex'
run_case SILENT "which lookup"           'which codex'
run_case SILENT "type lookup"            'type codex'
run_case FIRE   "command -p invocation"  'command -p codex exec "review"'

echo
echo "=== DIRECTION 3: shapes found by cross-model review (Codex, 2026-07-28) ==="
run_case FIRE   "leading fd redirect"    '2>/tmp/err codex exec "review"'
run_case FIRE   "expandable heredoc"     'cat <<EOF
$(codex exec "review")
EOF'
run_case FIRE   "here-string into shell" 'bash <<< '"'"'codex exec "review"'"'"''
run_case FIRE   "quoted paren in subst"  'out=$(printf ")" ; codex exec "review")'
run_case FIRE   "hyphenated heredoc tag" 'cat <<EOF-1
body
EOF-1
codex exec "review"'
run_case FIRE   "eval string"            'eval '"'"'codex exec "review"'"'"''
run_case FIRE   "find -exec"             'find . -name "*.py" -exec codex exec {} \;'
run_case FIRE   "env -S split string"    'env -S '"'"'codex exec "review"'"'"''
run_case FIRE   "coproc"                 'coproc codex exec "review"'
run_case FIRE   "shell opt before -c"    'bash -O extglob -c '"'"'codex exec "review"'"'"''
run_case FIRE   "exec -a argv0"          'exec -a argv0 codex exec "review"'
run_case FIRE   "deeply nested subst"    'a=$(echo $(echo $(echo $(echo $(codex exec "review")))))'
run_case SILENT "arithmetic expansion"   'echo $((codex + 1))'
run_case SILENT "bash -c with heredoc"   'bash -c '"'"'echo ok'"'"' <<'"'"'EOF'"'"'
codex exec "review"
EOF'

echo
echo "=== DIRECTION 4: second cross-model review pass (Codex, 2026-07-28) ==="
run_case FIRE   "colon heredoc tag"      'cat <<EOF:1
body
EOF:1
codex exec "review"'
run_case FIRE   "subst inside arithmetic" 'echo $(( $(codex exec "review") + 0 ))'
run_case FIRE   "eval joins arguments"   'eval '"'"'echo ok;'"'"' '"'"'codex exec "review"'"'"''
run_case FIRE   "find -exec sh -c"       'find . -exec sh -c '"'"'codex exec "review"'"'"' \;'
run_case FIRE   "named coproc"           'coproc REVIEW codex exec "review"'
run_case SILENT "shell with script file" 'bash ./process-input.sh <<EOF
codex exec "review"
EOF'

echo
echo "== $pass passed, $fail failed, $inert inert =="
if [ "$inert" -gt 0 ]; then
  echo "HARNESS ERROR: the watcher was INERT on $inert case(s) - no python3 or no" >&2
  echo "writable temp dir. That is an environment failure, not a detector verdict." >&2
  exit 2
fi
[ "$fail" -eq 0 ] || exit 1
exit 0
