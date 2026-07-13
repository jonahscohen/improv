#!/usr/bin/env bash
# Hermetic tests for the `node` PATH shim (claude/cmux/node).
#
# The bug it fixes: cmux sets NODE_OPTIONS=--require=$TMPDIR/cmux-claude-node-options/
# restore-node-options.cjs. macOS purges $TMPDIR, and every node process in the session
# (node-based hooks, npx, npm) then dies at startup with MODULE_NOT_FOUND.
#
# Includes a MUTATION test (control_red): the same broken NODE_OPTIONS run against the
# REAL node, bypassing the shim, MUST fail - proving these tests can go red and that the
# green results below are the shim doing work, not the bug being absent.
#
# Run: bash claude/cmux/test-node-shim.sh
set -u

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"   # <repo>/claude/cmux
SHIM="$HERE/node"
pass=0; fail=0
ok() { printf 'PASS: %s\n' "$1"; pass=$((pass+1)); }
no() { printf 'FAIL: %s\n' "$1"; fail=$((fail+1)); }

[ -x "$SHIM" ] || { printf 'FATAL: %s is not executable\n' "$SHIM"; exit 1; }

# Resolve the REAL node from a PATH that cannot contain the shim.
REAL_NODE="$(PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin command -v node)"
[ -n "$REAL_NODE" ] || { echo "FATAL: no real node found"; exit 1; }
REAL_DIR="$(dirname -- "$REAL_NODE")"

SBX="$(mktemp -d "${TMPDIR:-/tmp}/nodeshim.XXXXXX")"
trap 'rm -rf "$SBX"' EXIT

# A fake "purgeable temp" that we can delete at will, standing in for macOS's $TMPDIR.
FAKE_TMP="$SBX/purgeable/cmux-claude-node-options"
PRELOAD="$FAKE_TMP/restore-node-options.cjs"
CANON="$HERE/../node-shims/restore-node-options.cjs"
[ -r "$CANON" ] || { echo "FATAL: canonical copy missing at $CANON"; exit 1; }

plant()  { mkdir -p "$FAKE_TMP"; cp "$CANON" "$PRELOAD"; }
purge()  { rm -rf "$SBX/purgeable"; }

# PATH as a real Claude/cmux session sees it: the shim dir AHEAD of the real node dir.
SHIM_PATH="$HERE:$REAL_DIR:/usr/bin:/bin"
BROKEN_NO="--require=$PRELOAD --max-old-space-size=4096"

# --- 1. MUTATION / control: the bug is real and these tests can go RED ---------------
purge
if out=$(env NODE_OPTIONS="$BROKEN_NO" "$REAL_NODE" -e 'console.log("ran")' 2>&1); then
  no "control_red: real node should DIE on a purged preload, but it succeeded"
else
  case "$out" in
    *MODULE_NOT_FOUND*|*"Cannot find module"*) ok "control_red: real node dies with MODULE_NOT_FOUND (bug reproduced)" ;;
    *) no "control_red: real node failed, but not with MODULE_NOT_FOUND: ${out:0:80}" ;;
  esac
fi

# --- 2. the shim makes the SAME invocation succeed ------------------------------------
purge
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e 'console.log("ran")' 2>&1)
[ "$out" = "ran" ] && ok "purged preload: node runs through the shim" \
                   || no "purged preload: expected 'ran', got: ${out:0:120}"

# --- 3. the shim re-plants the preload so non-shim callers recover too ----------------
[ -r "$PRELOAD" ] && ok "purged preload: shim re-planted the canonical file" \
                  || no "purged preload: file was NOT re-planted at $PRELOAD"

# --- 4. re-planted file is byte-identical to canonical --------------------------------
if cmp -s "$CANON" "$PRELOAD"; then ok "re-planted file is byte-identical to canonical"
else no "re-planted file differs from canonical"; fi

# --- 5. the real failing hook shapes: require(.cjs) and import(.mjs) ------------------
# These mirror the two hooks that failed on 2026-07-13 (nyx hook-bridge.cjs at Stop
# position 1, codex stop-review-gate-hook.mjs at position 12).
printf 'console.log("cjs-hook-ok");\n' > "$SBX/hook.cjs"
printf 'console.log("mjs-hook-ok");\n' > "$SBX/hook.mjs"
purge
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node "$SBX/hook.cjs" 2>&1)
[ "$out" = "cjs-hook-ok" ] && ok "cjs hook runs on a purged preload" || no "cjs hook: ${out:0:120}"
purge
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node "$SBX/hook.mjs" 2>&1)
[ "$out" = "mjs-hook-ok" ] && ok "mjs hook runs on a purged preload" || no "mjs hook: ${out:0:120}"

# --- 6. npx / npm (the wider blast radius) --------------------------------------------
purge
if out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" npx --version 2>&1); then
  ok "npx survives a purged preload (resolves node via the shim)"
else
  no "npx still fails on a purged preload: ${out:0:120}"
fi

# --- 7. space form: `--require <path>` -------------------------------------------------
purge
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="--require $PRELOAD --max-old-space-size=4096" \
      node -e 'console.log("space-form-ok")' 2>&1)
[ "$out" = "space-form-ok" ] && ok "space form (--require <path>) is repaired" \
                             || no "space form: ${out:0:120}"

# --- 8. canonical unreachable -> drop the token, KEEP the other flags ------------------
# Copy the shim somewhere with no ../node-shims sibling and point HOME at an empty dir,
# so neither canonical lookup can succeed. node must STILL run, and --max-old-space-size
# must survive.
mkdir -p "$SBX/orphan" "$SBX/emptyhome"
cp "$SHIM" "$SBX/orphan/node"; chmod +x "$SBX/orphan/node"
purge
out=$(env PATH="$SBX/orphan:$REAL_DIR:/usr/bin:/bin" HOME="$SBX/emptyhome" \
      NODE_OPTIONS="$BROKEN_NO" node -e 'console.log(process.env.NODE_OPTIONS || "<unset>")' 2>&1)
case "$out" in
  *"--max-old-space-size=4096"*)
    case "$out" in
      *restore-node-options.cjs*) no "no-canonical: preload token was NOT dropped: ${out:0:120}" ;;
      *) ok "no-canonical: preload token dropped, --max-old-space-size preserved" ;;
    esac ;;
  *) no "no-canonical: node failed or lost its flags: ${out:0:120}" ;;
esac

# --- 9. happy path is untouched (preload present) --------------------------------------
plant
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e 'console.log("happy-ok")' 2>&1)
[ "$out" = "happy-ok" ] && ok "healthy preload: node runs normally" || no "healthy preload: ${out:0:120}"

# --- 10. no NODE_OPTIONS at all --------------------------------------------------------
shim_ver=$(env PATH="$SHIM_PATH" node --version 2>&1)
real_ver=$("$REAL_NODE" --version 2>&1)
[ "$shim_ver" = "$real_ver" ] && ok "no NODE_OPTIONS: shim execs the real node ($real_ver)" \
                              || no "no NODE_OPTIONS: version mismatch ($shim_ver vs $real_ver)"

# --- 11. transparency: argv, stdin, exit code ------------------------------------------
# Assert the shim's argv is IDENTICAL to real node's for the same invocation (stronger
# than checking a hardcoded index: node puts `-e` script args at argv[1], not argv[2]).
argv_script='console.log(JSON.stringify(process.argv.slice(1)))'
shim_argv=$(env PATH="$SHIM_PATH" node -e "$argv_script" arg-one arg-two 2>&1)
real_argv=$("$REAL_NODE" -e "$argv_script" arg-one arg-two 2>&1)
[ "$shim_argv" = "$real_argv" ] && [ "$shim_argv" = '["arg-one","arg-two"]' ] \
  && ok "argv is passed through verbatim (identical to real node)" \
  || no "argv: shim=$shim_argv real=$real_argv"

out=$(printf 'piped-in' | env PATH="$SHIM_PATH" node -e \
  'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(d))' 2>&1)
[ "$out" = "piped-in" ] && ok "stdin is passed through" || no "stdin: ${out:0:80}"

env PATH="$SHIM_PATH" node -e 'process.exit(7)' 2>/dev/null
[ "$?" -eq 7 ] && ok "exit code is preserved" || no "exit code was not preserved"

# --- 12. recursion guard: shim never execs itself ---------------------------------------
# PATH contains ONLY the shim dir (plus coreutils). It must fall back to an absolute real
# node rather than loop forever.
out=$(env PATH="$HERE:/usr/bin:/bin" NODE_OPTIONS="" node -e 'console.log("no-recursion")' 2>&1)
[ "$out" = "no-recursion" ] && ok "recursion guard: shim resolves a real node without looping" \
                            || no "recursion guard: ${out:0:120}"

# --- 13. the shim leaks NOTHING into the real node's environment ------------------------
# Regression (cross-model review): the first draft exported a _CMUX_NODE_SHIM_ACTIVE guard,
# which every descendant `node` then inherited - tripping the guard and sending them down a
# degraded path that skipped both PATH resolution and the NODE_OPTIONS repair.
plant
leaked=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e \
  'console.log(Object.keys(process.env).filter(k=>/_CMUX_NODE_SHIM|_SHIM_ACTIVE/.test(k)).join(",")||"none")' 2>&1)
[ "$leaked" = "none" ] && ok "shim leaks no env var into node" || no "shim leaked env: $leaked"

# --- 14. node-spawns-node (npm scripts, test runners) still works on a purged preload ----
# The descendant resolves `node` through PATH -> hits the shim again -> must get the FULL
# treatment (repair + correct resolution), not a degraded fallback.
purge
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e \
  'const{execFileSync}=require("child_process");process.stdout.write(execFileSync("node",["-e","process.stdout.write(\"grandchild-ok\")"],{encoding:"utf8"}))' 2>&1)
[ "$out" = "grandchild-ok" ] && ok "node-spawns-node works on a purged preload" \
                             || no "descendant node: ${out:0:120}"

# --- 15. concurrent heals are atomic (no truncated preload, no temp litter) --------------
# The whole reason this shim exists is that hooks run CONCURRENTLY. Fire a burst of shims
# at a purged preload at once; every one must succeed and the file must end up complete.
purge
for _i in 1 2 3 4 5 6 7 8; do
  env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e 'console.log("c")' >>"$SBX/conc.out" 2>&1 &
done
wait
concurrent_ok=$(grep -c '^c$' "$SBX/conc.out" 2>/dev/null || echo 0)
[ "$concurrent_ok" -eq 8 ] && ok "8 concurrent shims on a purged preload all succeeded" \
                           || no "concurrent: only $concurrent_ok/8 succeeded"
cmp -s "$CANON" "$PRELOAD" && ok "after concurrent heal the preload is complete (byte-identical)" \
                           || no "after concurrent heal the preload is corrupt/partial"
litter=$(find "$(dirname "$PRELOAD")" -name '.restore-node-options.*.tmp' 2>/dev/null | wc -l | tr -d ' ')
[ "$litter" -eq 0 ] && ok "atomic replant leaves no temp litter" || no "left $litter temp files behind"

# --- 16. two DIFFERENT copies of the shim on PATH must not ping-pong forever -------------
# -ef only catches inode identity; a genuine COPY in another PATH dir would be missed, and
# two copies could exec each other endlessly. The content marker prevents that.
mkdir -p "$SBX/copyA" "$SBX/copyB"
cp "$SHIM" "$SBX/copyA/node"; cp "$SHIM" "$SBX/copyB/node"
chmod +x "$SBX/copyA/node" "$SBX/copyB/node"
plant
out=$(env PATH="$SBX/copyA:$SBX/copyB:$REAL_DIR:/usr/bin:/bin" \
      node -e 'console.log("no-pingpong")' 2>&1)
[ "$out" = "no-pingpong" ] && ok "two shim copies on PATH resolve to real node (no ping-pong)" \
                           || no "ping-pong guard: ${out:0:120}"

# --- 17. a legitimate wrapper script named `node` is NOT mistaken for the shim -----------
# nvm/mise/asdf/volta shims are shell scripts. The marker check must only skip OUR shim.
mkdir -p "$SBX/wrapper"
printf '#!/bin/sh\necho "wrapper-ran"\n' > "$SBX/wrapper/node"; chmod +x "$SBX/wrapper/node"
out=$(env PATH="$HERE:$SBX/wrapper:/usr/bin:/bin" node 2>&1)
[ "$out" = "wrapper-ran" ] && ok "a real wrapper script named node is honored, not skipped" \
                           || no "wrapper: ${out:0:120}"

# --- 18. heal hook is silent + clean with NODE_OPTIONS unset under `set -u` --------------
HEAL="$HERE/../hooks/node-shim-heal.sh"
if [ -x "$HEAL" ]; then
  out=$(env -u NODE_OPTIONS SHELLOPTS=nounset bash "$HEAL" </dev/null 2>&1)
  case "$out" in
    *"unbound variable"*) no "heal hook: unbound variable under set -u" ;;
    "") ok "heal hook: silent and clean with NODE_OPTIONS unset under set -u" ;;
    *) no "heal hook printed unexpected output: ${out:0:80}" ;;
  esac
else
  no "heal hook not found at $HEAL"
fi

# --- 19. a FIFO named `node` on PATH must not hang the shim ------------------------------
# (round-2 review) An executable FIFO would block head/grep forever. Regular-file guards
# must skip it entirely and still reach the real node.
mkdir -p "$SBX/fifodir"
mkfifo "$SBX/fifodir/node" 2>/dev/null && chmod +x "$SBX/fifodir/node"
if [ -p "$SBX/fifodir/node" ]; then
  plant
  out=$(env PATH="$SBX/fifodir:$HERE:$REAL_DIR:/usr/bin:/bin" node -e 'console.log("fifo-skipped")' 2>&1 &
        bgpid=$!; ( sleep 10; kill -9 $bgpid 2>/dev/null ) >/dev/null 2>&1 &
        wait $bgpid 2>/dev/null)
  [ "$out" = "fifo-skipped" ] && ok "FIFO named node on PATH is skipped without hanging" \
                              || no "FIFO: hung or failed: ${out:0:80}"
else
  ok "FIFO test skipped (mkfifo unavailable)"
fi

# --- 20. a zero-byte / stale preload is re-planted, not trusted --------------------------
# (round-2 review) `-r` alone accepted an empty leftover forever, keeping node broken.
purge
mkdir -p "$FAKE_TMP"; : > "$PRELOAD"          # zero-byte stale file
out=$(env PATH="$SHIM_PATH" NODE_OPTIONS="$BROKEN_NO" node -e 'console.log("stale-fixed")' 2>&1)
if [ "$out" = "stale-fixed" ] && cmp -s "$CANON" "$PRELOAD"; then
  ok "zero-byte stale preload is re-planted, not trusted"
else
  no "stale preload: out=${out:0:60} (file restored? $(cmp -s "$CANON" "$PRELOAD" && echo yes || echo no))"
fi

# --- 21. empty PATH component (= cwd, per execvp) is honored -----------------------------
# (round-2 review) The shim must select the same node the shell would have.
mkdir -p "$SBX/cwdtest"
printf '#!/bin/sh\necho "cwd-node-ran"\n' > "$SBX/cwdtest/node"; chmod +x "$SBX/cwdtest/node"
out=$(cd "$SBX/cwdtest" && env PATH="$HERE:" node 2>&1)
[ "$out" = "cwd-node-ran" ] && ok "empty PATH component resolves to cwd (execvp semantics)" \
                            || no "empty PATH component: ${out:0:80}"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
