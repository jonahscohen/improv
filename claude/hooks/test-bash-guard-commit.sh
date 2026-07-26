#!/bin/bash
# Regression tests for bash-guard.sh's three GIT COMMIT gates:
#   1. beats-dirty        (~/.claude/.memory-dirty.<session>)
#   2. browser-verify     (~/.claude/.needs-verification + staged front-end file)
#   3. unread-screenshot  (~/.claude/.screenshot-pending.<session>)
#
# Run: bash ~/.claude/hooks/test-bash-guard-commit.sh
#
# The bug (observed live 2026-07-12): all three gates grepped the RAW command for
# 'git\s+commit', so they FALSE-BLOCKED any command that merely QUOTED the words -
# an echo, a Codex prompt string, a heredoc writing a beat that documents the gate.
# Fix: match CMD_CODE (heredoc bodies + quoted spans stripped) in COMMAND POSITION,
# reusing the T-0003 normalization the justify-watch gate already had.
#
# The suite proves BOTH directions. A gate that can no longer go red is not a fix,
# so every prose-ALLOW case is paired with a real-invocation BLOCK case under the
# exact same trigger state.
#
# Each case runs the hook with an isolated HOME so the gate flags can be forced
# without touching the developer's live ~/.claude state.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
BASH_HOOK="$HOOK_DIR/bash-guard.sh"

PASS=0
FAIL=0
FAIL_LABELS=()

FAKE_HOME=$(mktemp -d) || { echo "mktemp failed"; exit 1; }
[ -n "$FAKE_HOME" ] && [ -d "$FAKE_HOME" ] || { echo "no fixture HOME"; exit 1; }
mkdir -p "$FAKE_HOME/.claude"

# A temp git repo with a STAGED front-end file - the browser-verification gate
# only fires when staged files include something that actually renders.
REPO=$(mktemp -d) || { echo "mktemp failed"; exit 1; }
(
  cd "$REPO" || exit 1
  git init -q . || exit 1
  printf '.a{color:red}\n' > style.scss || exit 1
  git add style.scss || exit 1
) >/dev/null 2>&1 || { echo "fixture repo setup failed"; exit 1; }

cleanup() { rm -rf "$FAKE_HOME" "$REPO"; }
trap cleanup EXIT

# Run bash-guard against a Bash tool_input.command, with $HOME pointed at the
# fixture home. $2 (optional) is a cwd to run from (for the staged-files check).
run_hook() {
  local cmd="$1"
  local cwd="${2:-$PWD}"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$cmd")
  (cd "$cwd" && printf '%s' "$input" | HOME="$FAKE_HOME" bash "$BASH_HOOK" 2>/dev/null)
}

assert_blocks() {
  local label="$1" cmd="$2" cwd="${3:-$PWD}"
  local out
  out=$(run_hook "$cmd" "$cwd")
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label  (expected DENY, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

assert_allows() {
  local label="$1" cmd="$2" cwd="${3:-$PWD}"
  local out
  out=$(run_hook "$cmd" "$cwd")
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "FAIL: $label  (expected ALLOW, got DENY: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  else
    echo "PASS: $label"
    ((PASS++))
  fi
}

# The beats-dirty flag is PER-SESSION (.memory-dirty.<session>) as of 2026-07-17.
# run_hook feeds no session_id, so the guard derives the "global" fallback key -
# these fixtures must arm that same bucket or gate 1 tests silently stop firing.
set_dirty()   { : > "$FAKE_HOME/.claude/.memory-dirty.global"; }
clear_dirty() { rm -f "$FAKE_HOME/.claude/.memory-dirty.global"; }

# ---------------------------------------------------------------------------
echo "===== gate 1: beats-dirty - REAL commit must STILL BLOCK ====="
# If these ever go green-as-allow, the gate has been neutered rather than fixed.
set_dirty

assert_blocks "bare git commit"                 'git commit'
assert_blocks "git commit -m with message"      'git commit -m "fix: the thing"'
assert_blocks "git commit --amend --no-edit"    'git commit --amend --no-edit'
assert_blocks "commit after && chain"           'git add -A && git commit -m "wip"'
assert_blocks "commit after ; separator"        'git add -A; git commit -m "wip"'
assert_blocks "commit on its own line"          'git add -A
git commit -m "wip"'
assert_blocks "commit in a subshell"            '(cd repo && git commit -m "x")'
assert_blocks "commit behind a shell keyword"   'if [ -n "$X" ]; then git commit -m "x"; fi'
assert_blocks "commit with VAR= prefix"         'GIT_EDITOR=true git commit --amend'
assert_blocks "commit piped to a pager"         'git commit -m "x" | cat'

echo ""
echo "===== gate 1: beats-dirty - evasive-but-REAL commit shapes must BLOCK ====="
# Every shape below is a genuine commit. The raw-string match caught most of them
# by accident; command-position anchoring only stays honest if it recognises them
# deliberately. Surfaced by an independent Codex review of the fix, 2026-07-12.

# git's own global options sit between `git` and `commit`.
assert_blocks "git -C dir commit"               'git -C /tmp/repo commit -m "x"'
assert_blocks "git -c cfg commit"               'git -c user.name=x commit -m "x"'
assert_blocks "git --git-dir/--work-tree"       'git --git-dir=.git --work-tree=. commit -m "x"'
assert_blocks "git --no-pager commit"           'git --no-pager commit -m "x"'

# Wrapper words in front of git.
assert_blocks "env VAR=1 git commit"            'env GIT_EDITOR=true git commit --amend'
assert_blocks "command git commit"              'command git commit -m "x"'
assert_blocks "exec git commit"                 'exec git commit -m "x"'
assert_blocks "time git commit"                 'time git commit -m "x"'
assert_blocks "sudo -E git commit"              'sudo -E git commit -m "x"'
assert_blocks "xargs git commit"                'echo x | xargs git commit -m'

# Backslash-newline continuation: the shell splices this into one command.
assert_blocks "line-continuation git \\ commit" 'git \
commit -m "x"'

# Quoted-but-EXECUTED strings. These are the dangerous direction: a naive
# de-quote would treat them as prose and let a real commit through.
assert_blocks "bash -lc with a commit inside"   'bash -lc '"'"'git commit -m "x"'"'"''
assert_blocks "sh -c with a commit inside"      'sh -c "git commit -m x"'
assert_blocks "eval of a commit string"         'eval "git commit -m x"'
assert_blocks "commit in \$( ) substitution"     'echo "$(git commit -m x)"'
assert_blocks "commit in backticks"             'echo "`git commit -m x`"'

echo ""
echo "===== gate 1: beats-dirty - PROSE quoting the command must ALLOW ====="
# The false-block. Same dirty state as above; only the command shape differs.

assert_allows "echo single-quoted prose" \
  "echo 'remember to git commit -m foo'"
assert_allows "echo double-quoted prose" \
  'echo "remember to git commit -m foo"'
assert_allows "unquoted echo prose (git not in command position)" \
  'echo remember to git commit later'
assert_allows "grep for the words in the hooks dir" \
  'grep -rn "git commit" ~/.claude/hooks'
assert_allows "codex-style prompt string naming the command" \
  'codex exec "review the staged diff, then git commit -m '"'"'fix'"'"' when it is green"'
assert_allows "comment mentioning the command" \
  'echo hi # then git commit -m "x"'
assert_allows "comment containing a fake separator" \
  'echo hi # ; git commit -m "x"'
assert_allows "a path that merely contains the words" \
  'cat notes/git-commit-policy.md'
# The substitution runs `date`, not a commit - only the SUBSTITUTION is code, the
# surrounding string is still prose. Distinguishes real $( ) execution from text.
assert_allows "prose around a benign \$( ) substitution" \
  'echo "$(date) - remember to git commit"'
# A shell invocation whose executed string is itself only an echo of the words.
assert_allows "bash -c whose payload is just an echo" \
  'bash -c '"'"'echo "remember to git commit"'"'"''

# A heredoc writing a beat body that documents the commit gate - the exact shape
# that self-blocked. The body is DATA handed to cat, not a command.
HEREDOC_BEAT="cat > /tmp/beat.md <<'EOF'
The beats-dirty gate blocks \`git commit\` until a beat is written.
Run git commit -m \"x\" only after the beat lands.
EOF"
assert_allows "heredoc beat body containing git commit" "$HEREDOC_BEAT"

# A QUOTED heredoc delimiter makes the body fully literal - even a $( ) in it is
# text, so a beat documenting the substitution form must still pass.
HEREDOC_SUBST="cat > /tmp/beat.md <<'EOF'
Do not smuggle a commit through \$(git commit -m x) - the guard catches it.
EOF"
assert_allows "quoted heredoc documenting a \$( ) commit" "$HEREDOC_SUBST"

echo ""
echo "===== gate 1: beats-dirty - flag OFF means even a real commit passes ====="
# Proves the gate keys on the dirty flag, not on the fix: with beats clean, the
# same real commit that blocked above must sail through.
clear_dirty
assert_allows "real commit allowed when beats are clean" 'git commit -m "fix: the thing"'

echo ""
echo "===== gate 2: browser-verification (.needs-verification + staged .scss) ====="
: > "$FAKE_HOME/.claude/.needs-verification.global"
assert_blocks "real commit with unverified staged .scss" 'git commit -m "style: tweak"' "$REPO"
assert_allows "prose quoting the command, same state"    "echo 'now git commit -m x'"  "$REPO"
rm -f "$FAKE_HOME/.claude/.needs-verification.global"

echo ""
echo "===== gate 2 NARROWING: deletions + non-app paths must NOT block the commit (2026-07-26) ====="
# The gate re-derives "is this renderable source" from the STAGED files. A staged DELETION of a
# visual file, or a staged file under docs//fixtures//eval//scratchpad/ or a *.test.*, cannot be
# screenshotted and must NOT block - these false-blocked commits and cost manual overrides. Real
# product UI staged in the same repo MUST still block (recall). Each case builds its own repo so the
# staged set is exactly the file under test.
mk_repo_staged() {  # $1=path $2=content ; stages an ADD of the file, echoes the repo dir
  local d; d=$(mktemp -d)
  ( cd "$d" && git init -q . && git config user.email t@t && git config user.name t \
    && mkdir -p "$(dirname "$1")" && printf '%s' "$2" > "$1" && git add -A ) >/dev/null 2>&1
  echo "$d"
}
mk_repo_deleted() {  # $1=path $2=content ; commits the file then stages its DELETION
  local d; d=$(mktemp -d)
  ( cd "$d" && git init -q . && git config user.email t@t && git config user.name t \
    && mkdir -p "$(dirname "$1")" && printf '%s' "$2" > "$1" && git add -A \
    && git commit -qm seed && git rm -q "$1" ) >/dev/null 2>&1
  echo "$d"
}
REPO_DEL_HTML=$(mk_repo_deleted page.html '<html></html>')
REPO_DEL_FIX=$(mk_repo_deleted sidecoach/eval/fixtures/f.html '<i>')
REPO_DOCS=$(mk_repo_staged docs/dependency-map/index.html '<html>')
REPO_FIXNEW=$(mk_repo_staged sidecoach/eval/fixtures/new.html '<html>')
REPO_SCRATCH=$(mk_repo_staged scratchpad/x.html '<html>')
REPO_TESTF=$(mk_repo_staged src/Button.test.tsx 'x')
REPO_REAL_TSX=$(mk_repo_staged src/components/Foo.tsx 'x')
REPO_REFSITE=$(mk_repo_staged reference-site/pages/Home.tsx 'x')

: > "$FAKE_HOME/.claude/.needs-verification.global"
assert_allows "staged DELETION of page.html does not block"        'git commit -m x' "$REPO_DEL_HTML"
assert_allows "staged DELETION of eval fixture does not block"     'git commit -m x' "$REPO_DEL_FIX"
assert_allows "staged docs/dependency-map/index.html does not block" 'git commit -m x' "$REPO_DOCS"
assert_allows "staged NEW eval/fixtures/new.html does not block"   'git commit -m x' "$REPO_FIXNEW"
assert_allows "staged scratchpad/x.html does not block"            'git commit -m x' "$REPO_SCRATCH"
assert_allows "staged src/Button.test.tsx does not block"          'git commit -m x' "$REPO_TESTF"
# RECALL: real product UI (and a segment look-alike of the exemptions) MUST still block.
assert_blocks "staged real src/components/Foo.tsx STILL blocks"    'git commit -m x' "$REPO_REAL_TSX"
assert_blocks "staged reference-site/Home.tsx STILL blocks (not 'reference/')" 'git commit -m x' "$REPO_REFSITE"
rm -f "$FAKE_HOME/.claude/.needs-verification.global"
rm -rf "$REPO_DEL_HTML" "$REPO_DEL_FIX" "$REPO_DOCS" "$REPO_FIXNEW" "$REPO_SCRATCH" "$REPO_TESTF" "$REPO_REAL_TSX" "$REPO_REFSITE"

echo ""
echo "===== gate 2 CROSS-SESSION ISOLATION (the 2026-07-18 all-projects leak) ====="
# Before keying, .needs-verification was ONE global file: session A arming it (a .css edit in
# project A) blocked commits in session B / project B. Now the flag is session-keyed, so the
# debt of session A is invisible to session B. Feed session_id explicitly to prove isolation.
run_hook_sid() {
  local cmd="$1" sid="$2" cwd="${3:-$PWD}"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"session_id":sys.argv[2],"tool_input":{"command":sys.argv[1]}}))' "$cmd" "$sid")
  (cd "$cwd" && printf '%s' "$input" | HOME="$FAKE_HOME" bash "$BASH_HOOK" 2>/dev/null)
}
: > "$FAKE_HOME/.claude/.needs-verification.AAA"   # session A armed a visual change
# Session B commits an unrelated staged .scss - the debt of session A must NOT block it.
OUT=$(run_hook_sid 'git commit -m "b"' BBB "$REPO")
if echo "$OUT" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
  echo "FAIL: cross-session leak - session B blocked by the session-A verify flag  ($OUT)"; FAIL_LABELS+=("cross-session leak"); ((FAIL++))
else
  echo "PASS: session B commit NOT blocked by the session-A verify flag"; ((PASS++))
fi
# Session A committing its OWN unverified staged .scss MUST still block (gate intact, not neutered).
OUT=$(run_hook_sid 'git commit -m "a"' AAA "$REPO")
if echo "$OUT" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
  echo "PASS: session A still blocked on its OWN unverified change (gate intact)"; ((PASS++))
else
  echo "FAIL: session A NOT blocked on its own unverified change - gate failed open  ($OUT)"; FAIL_LABELS+=("gate A open"); ((FAIL++))
fi
rm -f "$FAKE_HOME/.claude/.needs-verification.AAA"

echo ""
echo "===== gate 3: unread-screenshot (.screenshot-pending) ====="
# No session_id in the fixture input, so the hook's key derivation lands on "global".
printf '/tmp/shot.png\n' > "$FAKE_HOME/.claude/.screenshot-pending.global"
assert_blocks "real commit with an unread screenshot"  'git commit -m "feat: x"'
assert_allows "prose quoting the command, same state"  'echo "then git commit -m x"'
rm -f "$FAKE_HOME/.claude/.screenshot-pending.global"

echo ""
echo "===== gate 4: kill-justify - REAL kill of a justify process must BLOCK ====="
# This gate canNOT use the de-quoted CMD_CODE: the process it protects lives
# INSIDE the quotes (pkill -f "Justify headless"). command_slices keeps the
# arguments, so these must all still go red.
assert_blocks "pkill -f justify-worker"        'pkill -f justify-worker'
assert_blocks "pkill -f quoted Justify (capital)" 'pkill -f "Justify headless"'
assert_blocks "pkill -f single-quoted justify" "pkill -f 'justify-serve'"
assert_blocks "killall justify"                'killall justify-serve'
assert_blocks "kill with flags"                'pkill -9 -f justify'
assert_blocks "kill of a pgrep substitution"   'kill $(pgrep -f justify)'
assert_blocks "kill after && chain"            'echo prep && pkill -f justify'
assert_blocks "sudo pkill justify"             'sudo pkill -f justify'
assert_blocks "kill via bash -c payload"       'bash -c "pkill -f justify"'

echo ""
echo "===== gate 4: kill-justify - PROSE about killing must ALLOW ====="
# The false-block that denied this very session mid-fix.
assert_allows "echo prose about pkill justify" \
  'echo "do not pkill -f justify - the worker owns the queue"'
assert_allows "single-quoted prose about pkill" \
  "echo 'never run pkill -f justify'"
assert_allows "grep for the words" \
  'grep -rn "pkill -f justify" ~/.claude/hooks'
assert_allows "codex prompt naming the kill" \
  'codex exec "explain why pkill -f justify is blocked"'
HEREDOC_KILL="cat > /tmp/beat.md <<'EOF'
The guard denies pkill -f justify and killall justify-serve.
A killed worker abandons the queued batch.
EOF"
assert_allows "heredoc beat body about killing justify" "$HEREDOC_KILL"
# Non-justify kills are none of this gate's business - must still pass.
assert_allows "unrelated kill by pid" 'kill -9 12345'
assert_allows "unrelated pkill"       'pkill -f some-other-daemon'

echo ""
echo "===== gate 5: cmux screenshot (only fires with a screenshot pending) ====="
printf '/tmp/shot.png\n' > "$FAKE_HOME/.claude/.screenshot-pending.global"
# REAL capture attempts - must still block while a prior shot is unread.
assert_blocks "real cmux screenshot"           'cmux browser --surface surface:2 screenshot --out /tmp/a.png'
assert_blocks "cmux screenshot after && chain" 'echo prep && cmux browser --surface surface:2 screenshot --out /tmp/a.png'
assert_blocks "cmux screenshot in a subshell"  '(cmux browser --surface surface:2 screenshot --out /tmp/a.png)'
# PROSE about screenshotting - must pass.
assert_allows "echo prose about cmux screenshot" \
  'echo "next: cmux browser --surface surface:2 screenshot --out /tmp/a.png"'
assert_allows "grep for the screenshot command" \
  'grep -rn "cmux .* screenshot" ~/.claude/hooks'
HEREDOC_SHOT="cat > /tmp/beat.md <<'EOF'
Verified with cmux browser --surface surface:2 screenshot --out /tmp/a.png
then Read the PNG.
EOF"
assert_allows "heredoc beat body about a screenshot" "$HEREDOC_SHOT"
# A cmux call that is NOT a screenshot must pass even with one pending.
assert_allows "cmux navigate is not a capture" 'cmux browser --surface surface:2 navigate "http://localhost:8080"'
rm -f "$FAKE_HOME/.claude/.screenshot-pending.global"
# With NO screenshot pending, a real capture is fine - the gate keys on the flag.
assert_allows "real cmux screenshot, none pending" 'cmux browser --surface surface:2 screenshot --out /tmp/a.png'

echo ""
echo "===== gate 6: force-push to main/master - REAL push must BLOCK ====="
# All four gates below read ARGUMENTS (which branch, which path, which URL, which
# file), so all four use command_slices, never CMD_CODE. A CMD_CODE rewrite would
# delete the quoted spans these gates have to read and leave guards that pass their
# prose tests while protecting nothing.
assert_blocks "force-push --force to main"      'git push --force origin main'
assert_blocks "force-push -f to master"         'git push -f origin master'
assert_blocks "force-with-lease to main"        'git push --force-with-lease origin main'
assert_blocks "force-push after && chain"       'git add -A && git push --force origin main'
assert_blocks "force-push via bash -c payload"  'bash -c "git push --force origin main"'
# NEW coverage: the old raw regex demanded git IMMEDIATELY followed by push, so a
# real force-push behind a git global option went straight through.
assert_blocks "git -C dir push --force main"    'git -C /tmp/repo push --force origin main'

echo ""
echo "===== gate 6: force-push - PROSE and non-triggers must ALLOW ====="
assert_allows "echo prose about force-pushing" \
  'echo "never git push --force origin main"'
assert_allows "grep for the force-push words" \
  'grep -rn "git push --force origin main" ~/.claude/hooks'
assert_allows "codex prompt naming a force-push" \
  'codex exec "explain why git push --force origin main is blocked"'
HEREDOC_PUSH="cat > /tmp/beat.md <<'EOF'
The guard denies git push --force origin main.
Force-pushing main requires the user to do it themselves.
EOF"
assert_allows "heredoc beat body about force-push" "$HEREDOC_PUSH"
# Real pushes that are NOT the trigger - the gate must stay narrow.
assert_allows "ordinary push to main"           'git push origin main'
assert_allows "force-push to a feature branch"  'git push --force origin feature/x'

echo ""
echo "===== gate 7: rm against .claude/memory - REAL rm must BLOCK ====="
assert_blocks "rm -rf the memory dir"       'rm -rf .claude/memory'
assert_blocks "rm a single beat file"       'rm .claude/memory/session_x.md'
assert_blocks "rm -rf under HOME"           'rm -rf ~/.claude/memory/'
assert_blocks "sudo rm the memory dir"      'sudo rm -rf .claude/memory'
assert_blocks "rm after && chain"           'echo prep && rm -rf .claude/memory'
# git rm was caught by the old regex only by accident (bare substring 'rm '). Kept
# deliberately, so the fix cannot quietly narrow the guard.
assert_blocks "git rm a beat file"          'git rm .claude/memory/session_x.md'

echo ""
echo "===== gate 7: rm against memory - PROSE and non-triggers must ALLOW ====="
assert_allows "echo prose about rm-ing memory" \
  'echo "never rm -rf .claude/memory - it destroys the beats"'
assert_allows "grep for the rm words" \
  'grep -rn "rm -rf .claude/memory" ~/.claude/hooks'
HEREDOC_RM="cat > /tmp/beat.md <<'EOF'
The guard denies rm -rf .claude/memory. Move to trash or rename instead.
EOF"
assert_allows "heredoc beat body about rm memory" "$HEREDOC_RM"
assert_allows "rm of an unrelated path"     'rm -rf /tmp/scratch'
assert_allows "reading a beat is not an rm" 'cat .claude/memory/MEMORY.md'

echo ""
echo "===== gate 8: curl to /watch/disarm|consent - REAL curl must BLOCK ====="
assert_blocks "curl POST to /watch/disarm"     'curl -X POST http://localhost:9876/watch/disarm'
assert_blocks "curl to /watch/consent"         'curl http://127.0.0.1:9911/watch/consent'
# The QUOTED URL is the shape a CMD_CODE rewrite would have silently dropped.
assert_blocks "curl with a quoted disarm URL"  'curl -s "http://localhost:9876/watch/disarm"'
assert_blocks "curl disarm piped to jq"        'curl -s http://localhost:9999/watch/disarm | jq .'

echo ""
echo "===== gate 8: curl watch endpoint - PROSE and non-triggers must ALLOW ====="
assert_allows "echo prose about the endpoint" \
  'echo "the agent may not curl http://localhost:9876/watch/disarm"'
assert_allows "grep for the endpoint" \
  'grep -rn "curl.*:9876/watch/disarm" ~/.claude/hooks'
HEREDOC_CURL="cat > /tmp/beat.md <<'EOF'
The guard denies curl -X POST http://localhost:9876/watch/disarm.
Only the user may disarm the watch.
EOF"
assert_allows "heredoc beat body about the endpoint" "$HEREDOC_CURL"
assert_allows "curl to a non-disarm endpoint"  'curl -s http://localhost:9876/watch/status'
assert_allows "curl to an unrelated host"      'curl -s http://localhost:3000/api/health'

echo ""
echo "===== gate 9: watch-state / disarm-consent file - REAL write must BLOCK ====="
# Two trip paths, two reads: a COMMAND acting on the file (command_slices) and a
# REDIRECT into it (redirect_targets), where the shell is the writer and the head
# word is only `echo`.
assert_blocks "rm the watch-state file"        'rm ~/.justify/watch-state.json'
assert_blocks "mv the watch-state file away"   'mv ~/.justify/watch-state.json /tmp/x.json'
assert_blocks "truncate the watch-state file"  'truncate -s 0 ~/.justify/watch-state.json'
assert_blocks "tee into the watch-state file"  "echo '{}' | tee ~/.justify/watch-state.json"
assert_blocks "redirect > into watch-state"    "echo '{}' > ~/.justify/watch-state.json"
assert_blocks "append >> into disarm-consent"  "echo '{}' >> ~/.justify/disarm-consent.json"
# A QUOTED redirect target: the shell still opens it. CMD_CODE deletes quoted spans,
# so a CMD_CODE-based gate would go quiet on exactly this - the raw regex caught it,
# and the fix must not lose it.
assert_blocks "redirect to a quoted path"      'cat /dev/null > "$HOME/.justify/watch-state.json"'
assert_blocks "redirect inside bash -c"        'bash -c "echo {} > ~/.justify/watch-state.json"'

echo ""
echo "===== gate 9: watch-state file - PROSE and non-triggers must ALLOW ====="
assert_allows "echo prose about the state file" \
  'echo "do not rm ~/.justify/watch-state.json behind the users back"'
# The '>' lives INSIDE the quotes here, so it is prose, not an open(). This is the
# case that separates quote-state tracking from a regex hunting for the character.
assert_allows "prose containing a > and the path" \
  'echo "never write > ~/.justify/watch-state.json directly"'
assert_allows "grep for the state file" \
  'grep -rn "justify/watch-state.json" ~/.claude/hooks'
HEREDOC_WS="cat > /tmp/beat.md <<'EOF'
The guard denies rm ~/.justify/watch-state.json and any > redirect into it.
Editing the state file is disarming the watch by another name.
EOF"
assert_allows "heredoc beat body about the state file" "$HEREDOC_WS"
assert_allows "reading the state file is fine"  'cat ~/.justify/watch-state.json'
assert_allows "redirect to an unrelated file"   "echo '{}' > /tmp/other.json"
assert_allows "rm of an unrelated json"         'rm /tmp/other.json'

echo ""
echo "===== gate 10: BYPASS shapes found by Codex review, 2026-07-12 ====="
# Every case here is a REAL invocation that the old raw regex caught and the first
# cut of the slice-based rewrite let straight through. They are the whole reason a
# prose fix has to be falsified against the BLOCK direction, not just the ALLOW one:
# each one passed its prose tests while protecting nothing.

# (a) A redirect may PRECEDE the command word. The operator was left in the segment,
#     so head_name read the redirect FILE as the command name.
assert_blocks "leading redirect + force-push"  '>/tmp/out git push --force origin main'
assert_blocks "leading redirect + rm memory"   '>/tmp/out rm -rf .claude/memory'
assert_blocks "leading redirect + curl disarm" '>/tmp/out curl http://localhost:9876/watch/disarm'
assert_blocks "leading redirect + pkill"       '>/tmp/out pkill -f justify'

# (b) A quoted assignment VALUE containing a space is not a word boundary. seg.split()
#     tokenized FOO="x y" as two words and read `y` as the command.
assert_blocks "quoted VAR= prefix + force-push" 'FOO="x y" git push --force origin main'
assert_blocks "quoted VAR= prefix + rm memory"  'FOO="x y" rm -rf .claude/memory'
assert_blocks "quoted VAR= prefix + pkill"      'FOO="x y" pkill -f justify'

# (c) eval runs its argument whether or not it is quoted. Only the quoted form was scanned.
assert_blocks "bare eval + force-push"         'eval git push --force origin main'
assert_blocks "bare eval + rm memory"          'eval rm -rf .claude/memory'
assert_blocks "bare eval + curl disarm"        'eval curl http://localhost:9876/watch/disarm'

# (d) Paren counting inside $( ) ignored quote state, so a literal ')' truncated the
#     inner text before the real command. Pre-existing in the shared scanner - it hit
#     the kill gate too.
assert_blocks "\$( ) with a literal ) then push"  'echo "$(printf '"'"')'"'"'; git push --force origin main)"'
assert_blocks "\$( ) with a literal ) then pkill" 'echo "$(printf '"'"')'"'"'; pkill -f justify)"'

# (e) Wrapper commands that take a numeric argument.
assert_blocks "timeout 10 pkill justify"       'timeout 10 pkill -f justify'
assert_blocks "timeout 10 rm memory"           'timeout 10 rm -rf .claude/memory'

# (f) The >| clobber form is a real file open.
assert_blocks "clobber >| into watch-state"    ': >| ~/.justify/watch-state.json'

echo ""
echo "===== gate 10: the fixes must not create NEW false-blocks ====="
# An escaped > is a printed character, not an open(). A > inside [[ ]] is a string
# comparison. Neither writes the file, so neither may block.
assert_allows "escaped > before the path"      'echo \> ~/.justify/watch-state.json'
assert_allows "> inside a [[ ]] comparison"    '[[ x > ~/.justify/watch-state.json ]] && echo yes'
# Redirects are dropped from the segment, so an innocent redirect must not hide - nor
# invent - a command.
assert_allows "innocent redirect after a read" 'cat ~/.justify/watch-state.json > /tmp/copy.json'
assert_allows "timeout on an unrelated command" 'timeout 10 curl -s http://localhost:3000/health'
assert_blocks "redirect does not hide the rm"  'rm -rf .claude/memory > /tmp/out 2>&1'

echo ""
echo "===== gate 11: second Codex pass - wrapper shapes that hid the command ====="
# `env -S` / `env --split-string` splits its quoted argument and RUNS it. Because the
# whole command is one quoted word, head_name read the entire string as the command
# NAME and matched nothing. The old raw regex caught these, so they were regressions.
assert_blocks "env -S force-push"          'env -S "git push --force origin main"'
assert_blocks "env -S rm memory"           'env -S "rm -rf .claude/memory"'
assert_blocks "env -S pkill justify"       'env -S "pkill -f justify"'
assert_blocks "env --split-string= pkill"  'env --split-string="pkill -f justify"'
assert_blocks "sudo env -S rm memory"      'sudo env -S "rm -rf .claude/memory"'
# A wrapper flag that CONSUMES the next word: the flag's VALUE became the head word.
assert_blocks "timeout -s TERM 10 pkill"   'timeout -s TERM 10 pkill -f justify'
assert_blocks "timeout -k 5 -s KILL rm"    'timeout -k 5 -s KILL 10 rm -rf .claude/memory'
assert_blocks "nice -n 5 rm memory"        'nice -n 5 rm -rf .claude/memory'
# ...without breaking the wrapper shapes that were already working.
assert_allows "env with a plain VAR= and a safe cmd" 'env FOO=1 curl -s http://localhost:3000/health'
assert_allows "env -u UNSET with a safe cmd"         'env -u LANG ls /tmp'
assert_allows "prose about env -S"                   'echo "env -S \"git push --force origin main\" is blocked"'

echo ""
echo "===== KNOWN LIMITS - documented, not silently shipped ====="
# These are gaps in BOTH the old raw regex and the new slice scan. They are asserted
# so the suite states the guard's real boundary out loud; if a future change closes
# one, this assertion flips to a FAIL and forces the beat to be updated.
#
# An argument delivered through a PIPE is invisible to any static scan of the
# command that consumes it: the path never appears in the `rm` invocation at all.
# Identical in kind to the already-documented `pgrep -f justify | xargs kill` gap.
# These gates are self-discipline, not an adversarial sandbox.
assert_allows "KNOWN GAP: path piped into xargs rm" 'echo .claude/memory | xargs rm -rf'

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed cases:"
  for label in "${FAIL_LABELS[@]}"; do
    echo "  - $label"
  done
  exit 1
fi
echo "All tests pass."
exit 0
