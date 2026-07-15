#!/bin/bash
# Regression test for push-ahead-check.sh.
#
# The SessionStart hook surfaces a committed-but-unpushed ahead-count for the
# repo at SESSION_CWD: it emits additionalContext naming the branch and the
# number of commits ahead of the tracked upstream, and stays SILENT ({}) when
# the branch is in sync, has no upstream, or the dir is not a git repo.
# Run: bash claude/hooks/test-push-ahead-check.sh  (exit 0 = all pass)

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/push-ahead-check.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
# Isolate git from the real user's global/system config.
export HOME="$SANDBOX"
export GIT_CONFIG_GLOBAL="$SANDBOX/gitconfig"; : > "$GIT_CONFIG_GLOBAL"
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_TERMINAL_PROMPT=0

git config --global user.email "t@test"
git config --global user.name  "Test"
git config --global init.defaultBranch main
git config --global commit.gpgsign false

REM="$SANDBOX/rem.git"; WORK="$SANDBOX/work"; PLAIN="$SANDBOX/plain"
mkdir -p "$PLAIN"
git init --bare "$REM"           >/dev/null 2>&1
git init -b main "$WORK"         >/dev/null 2>&1
( cd "$WORK" && echo one > a.txt && git add a.txt && git commit -m c1 >/dev/null 2>&1 && git remote add origin "$REM" )

run() { SESSION_CWD="$1" bash "$HOOK" </dev/null; }
mentions_ahead() { printf '%s' "$1" | grep -qi 'ahead'; }

echo "--- not a git repo -> silent ---"
out=$(run "$PLAIN"); mentions_ahead "$out" && bad "non-git dir must stay silent" || ok "non-git dir -> silent ({})"

echo "--- git repo with NO upstream -> silent ---"
out=$(run "$WORK"); mentions_ahead "$out" && bad "no-upstream must stay silent" || ok "branch without upstream -> silent"

echo "--- in sync with upstream (0 ahead) -> silent ---"
( cd "$WORK" && git push -u origin main >/dev/null 2>&1 )
out=$(run "$WORK"); mentions_ahead "$out" && bad "in-sync must stay silent" || ok "0 commits ahead -> silent"

echo "--- 2 commits ahead of upstream -> surfaces the count ---"
( cd "$WORK" && echo two > b.txt && git add b.txt && git commit -m c2 >/dev/null 2>&1 \
             && echo three > c.txt && git add c.txt && git commit -m c3 >/dev/null 2>&1 )
out=$(run "$WORK")
mentions_ahead "$out" || bad "2-ahead should mention 'ahead' (got: $out)"
printf '%s' "$out" | grep -q '2'        || bad "2-ahead should report the count 2 (got: $out)"
printf '%s' "$out" | grep -qi 'not pushed\|unpushed\|push' || bad "2-ahead should mention pushing (got: $out)"
if mentions_ahead "$out" && printf '%s' "$out" | grep -q '2'; then ok "2 commits ahead -> surfaced with count"; fi
# It must be valid JSON carrying additionalContext.
printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["hookSpecificOutput"]["additionalContext"], "no additionalContext"' 2>/dev/null \
  && ok "2-ahead output is valid SessionStart JSON with additionalContext" || bad "output not valid additionalContext JSON (got: $out)"

echo "--- disable switch ---"
out=$(PUSH_AHEAD_DISABLE=1 bash -c 'SESSION_CWD="$1" bash "$0" </dev/null' "$HOOK" "$WORK")
mentions_ahead "$out" && bad "PUSH_AHEAD_DISABLE=1 must silence output" || ok "PUSH_AHEAD_DISABLE=1 -> silent"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
