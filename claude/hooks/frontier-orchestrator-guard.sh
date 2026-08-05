#!/bin/bash
# PreToolUse hook (matcher: Write|Edit|MultiEdit|NotebookEdit|Bash).
#
# When the SESSION model is a FRONTIER model (claude-fable-5, claude-opus-5,
# claude-sonnet-5), it is orchestrator-only: it may NOT produce or execute on its
# own. It blocks the frontier model's file-authoring and shell tools and directs
# it to delegate production to a PREFERRED model (Opus 4.8 / Sonnet 4.6 / Haiku
# 4.5) and review to Codex. For every preferred model this hook is a no-op - the
# user's model choice is honored, per the standing "model choice is the user's"
# rule. Originally Fable-only (Jonah 2026-07-06, cost control); expanded to the
# .5 frontier generation + a user "confirm" override (Jonah 2026-08-05). Paired
# with the frontier exception in model-router-guard.sh (frontier session may
# delegate to a preferred producer) and the frontier-confirm.sh token contract.
# See session_2026-07-06_fable-orchestrator-hook-conflict.md.
#
# OVERRIDE: a single user-typed "confirm" (armed by frontier-confirm-arm.sh) lifts
# this block for exactly one action. The model can never lift it itself.

INPUT=$(cat)

TOOL=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name",""))' 2>/dev/null)

# Only gate the production/execution tools; everything else passes untouched.
case "$TOOL" in
  Write|Edit|MultiEdit|NotebookEdit|Bash) ;;
  *) echo '{}'; exit 0 ;;
esac

TP=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("transcript_path","") or "")' 2>/dev/null)
SID=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","") or "")' 2>/dev/null)

MODEL=$("$HOME/.claude/hooks/detect-session-model.sh" "$TP" "$SID")

case "$MODEL" in
  *fable-5*|*opus-5*|*sonnet-5*) ;;   # frontier session -> enforce orchestrator-only
  *) echo '{}'; exit 0 ;;             # preferred/indeterminate -> allow (fail-open)
esac

# Beat/memory carve-out (Jonah, per CLAUDE.md beats discipline): writes to a
# beats/memory location are MANDATED for every model, so they must succeed even
# on Fable - otherwise the orchestrator (and any in-process delegated scribe that
# inherits this block) cannot record the session, which is a hard rule, not an
# optional one. Allow only the file-authoring tools whose TARGET PATH resolves
# under a `.claude/memory/` tree or a `~/.claude/projects/*/memory/` tree. Bash
# gets NO carve-out: it has no single target path and beat writes go through
# Write/Edit; everything else on Fable stays blocked.
case "$TOOL" in
  Write|Edit|MultiEdit|NotebookEdit)
    if printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re

def escapes_root(target, root_lex):
    # HYBRID symlink guard. The lexical match already decided the target is
    # NOMINALLY a beats path. Reject it if an EXISTING path component BENEATH the
    # memory root resolves (through real symlinks) OUTSIDE that root - a symlink
    # PLANTED inside a beats dir (e.g. .claude/memory/escape -> ../../src) must
    # not smuggle a non-beat write past the carve-out. We compare against the
    # roots OWN realpath and never inspect the root itself, so a symlinked ROOT
    # (dotfiles setups symlink .claude/memory to a real dir with another name) is
    # still ALLOWED. Fail-safe: nothing existing beneath the root - the common
    # new-file case - stays allowed by the lexical decision.
    root_real = os.path.realpath(root_lex)
    probe = target
    while len(probe) > len(root_lex):
        if os.path.lexists(probe):
            pr = os.path.realpath(probe)
            if pr == root_real or pr.startswith(root_real + os.sep):
                return False   # deepest existing component stays inside -> ok
            return True         # it resolves outside the memory root -> reject
        probe = os.path.dirname(probe)
    return False   # reached the root with nothing existing beneath it -> allow

# FAIL-OPEN wrapper (lead review): beat writes are NEVER blocked, so a bug or
# crash anywhere in this carve-out evaluation must ALLOW (exit 0), never fall
# through to the Fable DENY. Only the INTENTIONAL decisions - "not a beats path"
# and "escape detected" - deny, via sys.exit(1). SystemExit is NOT an Exception,
# so both the intentional allow(0) and deny(1) exits pass through the guard below
# unchanged; only a genuine crash is caught and turned into a fail-open allow.
try:
    d = json.load(sys.stdin)
    ti = d.get("tool_input") or {}
    p = ti.get("file_path") or ti.get("notebook_path") or ""
    if not p:
        sys.exit(1)   # no target path -> not a beats write (intentional deny)
    # NORMALIZE (lexical) first so a written-out traversal target like
    # ".claude/memory/../../src/app.py" cannot smuggle a non-beat write past the
    # substring test - normpath collapses "." and ".." without touching the disk.
    q = os.path.normpath(os.path.expanduser(str(p)).replace("\\", "/"))
    cand = q if q.startswith("/") else "/" + q
    tail = cand if cand.endswith("/") else cand + "/"
    # Match the two mandated beat locations exactly - not any path merely
    # containing "memory" (src/memory/ is NOT a beats path) - then apply the
    # hybrid symlink-escape check to the matched memory root.
    # (a) project-local beats tree: <anything>/.claude/memory/...
    pos = tail.find("/.claude/memory/")
    if pos != -1:
        root_lex = cand[:pos] + "/.claude/memory"
        if not escapes_root(cand, root_lex):
            sys.exit(0)
        sys.exit(1)   # escape detected (intentional deny)
    # (b) global per-project beats: ~/.claude/projects/<seg>/memory/... ANCHORED
    # to the real $HOME - a /tmp/.claude/projects/.../memory path is NOT a beat.
    home_proj = os.path.normpath(os.path.expanduser("~/.claude/projects")).replace("\\", "/")
    if cand == home_proj or cand.startswith(home_proj + "/"):
        m = re.match(re.escape(home_proj) + r"/([^/]+)/memory(?:/|$)", cand)
        if m:
            root_lex = home_proj + "/" + m.group(1) + "/memory"
            if not escapes_root(cand, root_lex):
                sys.exit(0)   # memory/beat target -> allow the mandated write
    sys.exit(1)   # not a beats path (intentional deny)
except SystemExit:
    raise         # intentional allow(0) / deny(1) decisions pass through
except Exception:
    sys.exit(0)   # any bug/crash in evaluation -> FAIL OPEN (never block a beat)
'; then
      echo '{}'; exit 0
    fi
    ;;
esac

# OVERRIDE: a single user-typed "confirm" lifts the block for THIS one action.
# Checked AFTER the beats carve-out so a mandated beat write never spends a token,
# and BEFORE the deny so a confirmed action proceeds. The token is armed only by
# the user (frontier-confirm-arm.sh), never by the model.
# shellcheck source=/dev/null
. "$HOME/.claude/hooks/frontier-confirm.sh" 2>/dev/null || true
if type frontier_check_confirm >/dev/null 2>&1 && frontier_check_confirm "$MODEL"; then
  echo '{}'; exit 0
fi

REASON="This session is on a frontier model (${MODEL:-unknown}); frontier models are orchestrator-only (cost control, Jonah 2026-08-05): direct ${TOOL} calls are blocked. Delegate production to a PREFERRED model (Agent tool with model: opus/sonnet/haiku = the 4.x generation) and review to Codex (codex:codex-rescue agent or /code-review). You may still Read/Grep/Glob, spawn teammates, SendMessage, ask questions, and track tasks. To produce directly this once, reply 'confirm'. To do all work yourself, switch the session model to a preferred one (Opus 4.8 / Sonnet 4.6 / Haiku 4.5)."

python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
