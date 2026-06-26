#!/usr/bin/env zsh
# Hermetic test for cmux-claude-launch.sh.
# Fully sandboxed: stub claude/cmux/security on a temp PATH, and a sandbox HOME
# with the two launchers symlinked in - so the test does NOT depend on the real
# machine's markers, Discord token, or installed binaries. No real launches.
# Run: zsh claude/cmux/test-cmux-claude-launch.sh
set -u
HERE="${0:A:h}"                       # .../claude/cmux
REPO="${HERE:h:h}"                    # repo root
WRAP="$HERE/cmux-claude-launch.sh"
DISCORD_LAUNCHER="$REPO/claude/discord-chat-launcher.sh"
TEAMS_LAUNCHER="$REPO/bin/claude-teams-launcher.sh"
pass=0; fail=0
ok() { print "PASS: $1"; pass=$((pass+1)); return 0; }
no() { print "FAIL: $1"; fail=$((fail+1)); return 0; }

# --- sandbox (dir name must NOT contain 'cmux' so $SBX/claude is seen as real) ---
SBX="$(mktemp -d "${TMPDIR:-/tmp}/ccltest.XXXXXX")"
SHIM="$SBX/cmux-cli-shims"; mkdir -p "$SHIM"
HOMEDIR="$SBX/home"; mkdir -p "$HOMEDIR/.claude/channels/discord"
ln -s "$DISCORD_LAUNCHER" "$HOMEDIR/.claude/discord-chat-launcher.sh"
ln -s "$TEAMS_LAUNCHER"   "$HOMEDIR/.claude/claude-teams-launcher.sh"
RES="$SBX/result.log"
stub() { print "#!/bin/sh\n$2" > "$1"; chmod +x "$1"; }
stub "$SBX/claude"   "echo \"REALCLAUDE argv:\$*\" >> \"$RES\""
stub "$SHIM/claude"  "echo \"SHIMCLAUDE-RAN\" >> \"$RES\""
stub "$SBX/cmux"     "echo \"CMUX argv:\$*\" >> \"$RES\""
stub "$SBX/security" "exit 1"          # no discord token -> COLD
TPATH="$SBX:$SHIM:/usr/bin:/bin"

# python PTY runner (real tty -> exercises the actual [ -t 0 ] && [ -t 1 ] gate)
cat > "$SBX/pty_run.py" <<'PY'
import os, pty, sys, select, time
answers = sys.argv[1].encode().decode("unicode_escape").encode()
wrap, args = sys.argv[2], sys.argv[3:]
m, s = pty.openpty()
p = __import__("subprocess").Popen([wrap, *args], stdin=s, stdout=s, stderr=s,
        env=os.environ, close_fds=True, preexec_fn=os.setsid)
os.close(s); os.write(m, answers)
end = time.time() + 8
while time.time() < end:
    r,_,_ = select.select([m],[],[],0.3)
    if r:
        try: c = os.read(m, 4096)
        except OSError: break
        if not c: break
        sys.stdout.buffer.write(c)
    if p.poll() is not None: break
p.wait(timeout=3)
PY

run()    { : >"$RES"; env -i HOME="$HOMEDIR" USER="$USER" PATH="$TPATH" TMPDIR="$SBX" "$@" zsh "$WRAP" >/dev/null 2>&1; }
run_arg(){ : >"$RES"; local stdin="$1"; shift; printf '%s' "$stdin" | env -i HOME="$HOMEDIR" USER="$USER" PATH="$TPATH" TMPDIR="$SBX" zsh "$WRAP" "$@" >/dev/null 2>&1; }
run_pty(){ : >"$RES"; local ans="$1"; shift; env -i HOME="$HOMEDIR" USER="$USER" PATH="$TPATH" TMPDIR="$SBX" CMUX_WORKSPACE_ID=test python3 "$SBX/pty_run.py" "$ans" "$WRAP" "$@" 2>/dev/null; }

# --- passthrough guards (exit before sourcing; tty not needed) ---
run _CMUX_CLAUDE_WRAP_ACTIVE=1
{ grep -q "REALCLAUDE argv:" "$RES" && ! grep -q "SHIMCLAUDE-RAN" "$RES" && ! grep -q "CMUX argv:" "$RES"; } \
  && ok "recursion guard -> exec real claude (no shim, no prompt)" || no "recursion guard"

run_arg "" --teammate-mode auto --agent-id x@y
grep -q "REALCLAUDE argv:--teammate-mode auto --agent-id x@y" "$RES" && ok "teammate flags (space form) -> passthrough, flags intact" || no "teammate space form"

run_arg "" --agent-id=x@y
grep -q "REALCLAUDE argv:--agent-id=x@y" "$RES" && ok "teammate flags (=value form) -> passthrough" || no "teammate =value form"

run CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
grep -q "REALCLAUDE argv:" "$RES" && ! grep -q "CMUX argv:" "$RES" && ok "teams env flag -> passthrough" || no "teams env flag"

run_arg "" --version
grep -q "REALCLAUDE argv:--version" "$RES" && ok "--version probe -> passthrough (no prompt)" || no "--version probe"

run_arg "" -p "do a thing"
grep -q "REALCLAUDE argv:-p do a thing" "$RES" && ok "-p headless -> passthrough (no prompt)" || no "-p headless"

run_arg "n\nn\nk\n" CMUX_WORKSPACE_ID=test   # piped stdin = NOT a tty -> gate forces passthrough
grep -q "REALCLAUDE argv:" "$RES" && ! grep -q "CMUX argv:" "$RES" && ok "non-tty -> passthrough (prompts skipped)" || no "non-tty"

run _CMUX_CLAUDE_WRAP_ACTIVE=1
! grep -q "SHIMCLAUDE-RAN" "$RES" && ok "resolution skips the cmux-cli-shims claude" || no "resolution skipped shim"

# --- REAL pty cases (exercise the actual tty gate; full launcher logic runs) ---
out="$(run_pty "n\nn\nk\n")"
{ print -r -- "$out" | grep -q "Enable Claude Code Teams?" && print -r -- "$out" | grep -q "Remote Control" \
    && grep -q "REALCLAUDE argv:" "$RES" && ! grep -q "CMUX argv:" "$RES" && ! grep -q "SHIMCLAUDE-RAN" "$RES"; } \
  && ok "PTY decline-all -> prompts render, plain real claude launched" \
  || { no "PTY decline-all"; print -r -- "  out: ${out//$'\n'/ | }"; print "  res: $(cat "$RES")"; }

# Teams=y -> RC prompt -> (RC=n) -> plain `cmux claude-teams`
out="$(run_pty "y\nn\n")"
{ grep -q "CMUX argv:claude-teams" "$RES" && ! grep -q -- "--remote-control" "$RES"; } \
  && ok "PTY Teams=y, RC=n -> 'cmux claude-teams'" \
  || { no "PTY Teams=y RC=n"; print -r -- "  out: ${out//$'\n'/ | }"; print "  res: $(cat "$RES")"; }

# Teams=y -> RC=y -> `cmux claude-teams --remote-control` (RC short-circuits Discord)
out="$(run_pty "y\ny\n")"
grep -q "CMUX argv:claude-teams --remote-control" "$RES" \
  && ok "PTY Teams=y, RC=y -> 'cmux claude-teams --remote-control'" \
  || { no "PTY Teams=y RC=y"; print -r -- "  out: ${out//$'\n'/ | }"; print "  res: $(cat "$RES")"; }

rm -rf "$SBX"
print "---"; print "PASS=$pass FAIL=$fail"
[[ $fail -eq 0 ]]
