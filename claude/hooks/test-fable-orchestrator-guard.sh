#!/bin/bash
# Regression test for fable-orchestrator-guard.sh.
#
# The guard blocks Fable's production/execution tools (Write/Edit/MultiEdit/
# NotebookEdit/Bash) so Fable stays orchestrator-only, EXCEPT it carves out
# MANDATED beat/memory writes: a Write/Edit/MultiEdit/NotebookEdit whose target
# path is under a .claude/memory/ tree or a ~/.claude/projects/*/memory/ tree is
# allowed even on Fable. Bash gets no carve-out. Non-Fable sessions are a no-op.
#
# Hermetic: builds a sandbox HOME with the guard + detect-session-model.sh and
# two fake transcripts (fable / opus), then exercises the real detector path.
# Run: bash claude/hooks/test-fable-orchestrator-guard.sh  (exit 0 = all pass)

set -u
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX"
HOOKS="$HOME/.claude/hooks"
mkdir -p "$HOOKS"
cp "$SRC_DIR/fable-orchestrator-guard.sh" "$HOOKS/"
cp "$SRC_DIR/detect-session-model.sh" "$HOOKS/"
chmod +x "$HOOKS/fable-orchestrator-guard.sh" "$HOOKS/detect-session-model.sh"
GUARD="$HOOKS/fable-orchestrator-guard.sh"

FABLE_TX="$SANDBOX/fable.jsonl"
OPUS_TX="$SANDBOX/opus.jsonl"
printf '%s\n' '{"type":"assistant","message":{"model":"claude-fable-5","content":[{"type":"text","text":"ok"}]}}' > "$FABLE_TX"
printf '%s\n' '{"type":"assistant","message":{"model":"claude-opus-4-8","content":[{"type":"text","text":"ok"}]}}' > "$OPUS_TX"

# run <tool> <file_path> <transcript> [bash_command]
# Emits the guard's stdout. Uses tool_input.file_path for file tools; for Bash a
# command is supplied instead.
run() {
  local tool="$1" fp="$2" tx="$3" cmd="${4:-}"
  TOOL="$tool" FP="$fp" TX="$tx" CMD="$cmd" python3 -c '
import json,os
tool=os.environ["TOOL"]; fp=os.environ["FP"]; tx=os.environ["TX"]; cmd=os.environ["CMD"]
ti={}
if tool=="Bash": ti={"command":cmd}
elif tool=="NotebookEdit": ti={"notebook_path":fp}
else: ti={"file_path":fp}
print(json.dumps({"tool_name":tool,"transcript_path":tx,"session_id":"S","tool_input":ti}))
' | bash "$GUARD"
}

is_deny()  { printf '%s' "$1" | grep -q '"deny"'; }

echo "--- Fable: memory-path writes are carved out (allowed) ---"
out=$(run Write "/repo/.claude/memory/session_x.md" "$FABLE_TX")
is_deny "$out" && bad "Fable .claude/memory Write blocked (should be allowed)" || ok "Fable .claude/memory Write allowed"

out=$(run Edit "/repo/.claude/memory/MEMORY.md" "$FABLE_TX")
is_deny "$out" && bad "Fable .claude/memory Edit blocked (should be allowed)" || ok "Fable .claude/memory Edit allowed"

out=$(run Write "$HOME/.claude/projects/-Users-x-proj/memory/note.md" "$FABLE_TX")
is_deny "$out" && bad "Fable projects/*/memory Write blocked (should be allowed)" || ok "Fable ~/.claude/projects/*/memory Write allowed"

out=$(run MultiEdit "/repo/.claude/memory/index.md" "$FABLE_TX")
is_deny "$out" && bad "Fable .claude/memory MultiEdit blocked (should be allowed)" || ok "Fable .claude/memory MultiEdit allowed"

out=$(run NotebookEdit "/repo/.claude/memory/nb.ipynb" "$FABLE_TX")
is_deny "$out" && bad "Fable .claude/memory NotebookEdit blocked (should be allowed)" || ok "Fable .claude/memory NotebookEdit allowed"

echo "--- Fable: non-memory writes are still blocked ---"
out=$(run Write "/repo/src/app.ts" "$FABLE_TX")
is_deny "$out" && ok "Fable src/ Write blocked" || bad "Fable src/ Write should be blocked"

out=$(run Edit "/repo/src/app.ts" "$FABLE_TX")
is_deny "$out" && ok "Fable src/ Edit blocked" || bad "Fable src/ Edit should be blocked"

# A path that merely contains the word 'memory' but is NOT under a .claude tree
# must still be blocked (no over-broad carve-out).
out=$(run Write "/repo/src/memory/cache.ts" "$FABLE_TX")
is_deny "$out" && ok "Fable non-.claude memory-named path blocked" || bad "src/memory should be blocked (not a beats path)"

# HIGH (Codex): a traversal that STARTS under .claude/memory/ but escapes it must
# be blocked - the matcher normalizes the path first, so ".." cannot smuggle a
# src write past the carve-out.
out=$(run Write "/repo/.claude/memory/../../src/app.ts" "$FABLE_TX")
is_deny "$out" && ok "Fable .claude/memory traversal escape blocked" || bad "traversal out of memory should be blocked"
out=$(run Write "$HOME/.claude/projects/proj/memory/../../../secret.ts" "$FABLE_TX")
is_deny "$out" && ok "Fable projects/memory traversal escape blocked" || bad "projects traversal escape should be blocked"

# HIGH (Codex): the projects/*/memory carve-out is anchored to the real $HOME - a
# look-alike projects/memory path OUTSIDE $HOME is not a beats path.
out=$(run Write "/tmp/.claude/projects/foo/memory/x.md" "$FABLE_TX")
is_deny "$out" && ok "Fable non-\$HOME projects/memory path blocked" || bad "/tmp projects/memory should be blocked (not under \$HOME)"

echo "--- Fable: Bash gets no carve-out ---"
out=$(run Bash "" "$FABLE_TX" "echo hi > /repo/.claude/memory/x.md")
is_deny "$out" && ok "Fable Bash blocked even when it names a memory path" || bad "Fable Bash should be blocked (no carve-out)"

out=$(run Bash "" "$FABLE_TX" "ls")
is_deny "$out" && ok "Fable Bash blocked" || bad "Fable Bash should be blocked"

echo "--- Fable: non-gated tools pass untouched ---"
out=$(run Read "/repo/src/app.ts" "$FABLE_TX")
is_deny "$out" && bad "Read should never be gated" || ok "Fable Read passes (not a gated tool)"

echo "--- Non-Fable session: guard is a no-op (honors user model choice) ---"
out=$(run Write "/repo/src/app.ts" "$OPUS_TX")
is_deny "$out" && bad "Opus src/ Write blocked (guard must be Fable-only)" || ok "Opus src/ Write allowed (no-op off Fable)"

out=$(run Bash "" "$OPUS_TX" "rm -rf /")
is_deny "$out" && bad "Opus Bash blocked (guard must be Fable-only)" || ok "Opus Bash allowed (no-op off Fable)"

echo "--- HYBRID symlink-escape check (real symlink trees on Fable) ---"
# A REAL project-local beats root with a PLANTED escape symlink pointing OUT.
PROJ="$SANDBOX/proj"
mkdir -p "$PROJ/.claude/memory" "$PROJ/src"
ln -s ../../src "$PROJ/.claude/memory/escape"          # memory/escape -> proj/src (outside)
# (a) a write THROUGH the planted escape symlink is DENIED
out=$(run Write "$PROJ/.claude/memory/escape/app.ts" "$FABLE_TX")
is_deny "$out" && ok "planted symlink escaping memory is blocked" || bad "escape symlink should be blocked"
# a normal new beat directly under the real root is still ALLOWED
out=$(run Write "$PROJ/.claude/memory/session_new.md" "$FABLE_TX")
is_deny "$out" && bad "normal beat under real root wrongly blocked" || ok "normal beat under real memory root allowed"
# a normal (non-symlink) subdir under the root is ALLOWED
mkdir -p "$PROJ/.claude/memory/sub"
out=$(run Write "$PROJ/.claude/memory/sub/x.md" "$FABLE_TX")
is_deny "$out" && bad "normal subdir under root wrongly blocked" || ok "normal subdir under memory root allowed"

# A SYMLINKED memory ROOT (dotfiles pattern): .claude/memory IS a symlink to a
# real beats dir with a different name. Beat writes there must still ALLOW.
REAL="$SANDBOX/realbeats"; PROJ2="$SANDBOX/proj2"
mkdir -p "$REAL" "$PROJ2/.claude"
ln -s "$REAL" "$PROJ2/.claude/memory"                  # symlinked ROOT
# (b) a normal new beat under the symlinked root is ALLOWED (root never realpath'd)
out=$(run Write "$PROJ2/.claude/memory/beat.md" "$FABLE_TX")
is_deny "$out" && bad "symlinked memory ROOT wrongly blocked a beat write" || ok "symlinked memory ROOT still allows a beat write"
# (c) editing an EXISTING beat under the symlinked root is ALLOWED
: > "$REAL/existing.md"
out=$(run Edit "$PROJ2/.claude/memory/existing.md" "$FABLE_TX")
is_deny "$out" && bad "existing beat under symlinked root wrongly blocked" || ok "existing beat under symlinked root allowed"
# (d) an escape PLANTED under the symlinked root is still DENIED (hybrid holds)
ln -s /etc "$REAL/escape2"
out=$(run Write "$PROJ2/.claude/memory/escape2/passwd.ts" "$FABLE_TX")
is_deny "$out" && ok "escape under a symlinked root is still blocked" || bad "inner escape under symlinked root should be blocked"

echo "--- FAIL-OPEN: a carve-out crash ALLOWS (never blocks a beat); intentional denies still DENY ---"
# (a) exception-inducing input: tool_input is NOT a dict, so the carve-out helper
# raises inside its evaluation. It MUST fail open (exit 0 -> allow) so a helper
# bug can never block a MANDATED beat write on Fable.
out=$(printf '{"tool_name":"Write","transcript_path":"%s","session_id":"S","tool_input":"NOT_A_DICT"}' "$FABLE_TX" | bash "$GUARD")
is_deny "$out" && bad "helper exception must FAIL OPEN (allow), not block a beat" || ok "(a) crash in carve-out fails open (beat write allowed)"
# (b) a real non-beats src path is an INTENTIONAL deny -> still DENIES
out=$(run Write "/repo/src/service.ts" "$FABLE_TX")
is_deny "$out" && ok "(b) real src-path write still denied (intentional deny preserved)" || bad "src path must still deny after fail-open wrap"
# (c) a real planted escape is an INTENTIONAL deny -> still DENIES
FO="$SANDBOX/failopen"; mkdir -p "$FO/.claude/memory" "$FO/out"; ln -s ../../out "$FO/.claude/memory/leak"
out=$(run Write "$FO/.claude/memory/leak/x.ts" "$FABLE_TX")
is_deny "$out" && ok "(c) real escape still denied (intentional deny preserved)" || bad "escape must still deny after fail-open wrap"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
