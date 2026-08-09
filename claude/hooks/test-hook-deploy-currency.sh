#!/usr/bin/env bash
# Falsification suite for hook-deploy-currency.sh (SessionStart deploy-lag check).
#
# The check answers one question: is every DEPLOYED wired hook's settings.json entry
# actually live? The three assertions the task pins:
#   (a) a deployed wired hook whose command is MISSING from settings.json -> WARN, named.
#   (b) every deployed wired hook's command present -> SILENT.
#   (c) a hook whose component is NOT installed (no file on disk) -> never warned about.
#
# Every case runs under a FAKE $HOME, so no test can read or mutate the real
# ~/.claude/settings.json or ~/.claude/hooks. The hook still resolves the REAL repo (via
# BASH_SOURCE) to read the wiring tables - only the DEPLOYED state (settings.json + the
# hooks dir) is sandboxed, which is exactly the surface a deploy lag lives on.

# The `cond && ok "..." || bad "..."` idiom below is deliberate and repo-standard for
# these suites (ok/bad always succeed, so bad never runs on an ok). Silence SC2015.
# shellcheck disable=SC2015
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/hook-deploy-currency.sh"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

# newhome -> fresh fake $HOME with an empty ~/.claude/hooks
newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude/hooks"; echo "$FH"; }

# deploy <home> <hookname>  -> pretend this hook is installed on disk
deploy() { : > "$1/.claude/hooks/$2"; }

# decl_cmds <hookname>  -> the exact command strings the repo wiring declares for it
decl_cmds() {
  HERE="$HERE" NAME="$1" python3 - <<'PY'
import json, os
here=os.environ["HERE"]; name=os.environ["NAME"]
out=[]
for wf in ("cluster-wirings.json","app-wirings.json"):
    p=os.path.join(here,wf)
    try: w=json.load(open(p))
    except Exception: continue
    for e in w.get(name,[]):
        c=(e.get("hook") or {}).get("command")
        if c: out.append(c)
print("\n".join(out))
PY
}

# settings_with <home> <cmd>...  -> write a settings.json whose hooks carry exactly
# the given command strings (all under one SessionStart group; the check scans every
# event, so placement does not matter).
settings_with() {
  local home="$1"; shift
  HOME_DIR="$home" python3 - "$@" <<'PY'
import json, os, sys
cmds=sys.argv[1:]
d={"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":c} for c in cmds]}]}}
open(os.path.join(os.environ["HOME_DIR"],".claude","settings.json"),"w").write(json.dumps(d,indent=2))
PY
}

# run <home> [env...] -> stdout of the hook under that fake HOME
run() { HOME="$1" bash "$HOOK"; }

is_json()  { python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1; }
is_silent(){ [ "$1" = '{}' ]; }
ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])' 2>/dev/null; }

# Pull the real declared commands for the two probe hooks so the fixtures stay in sync
# with the wiring tables no matter how they are edited.
ELIAS_CMDS=(); while IFS= read -r l; do [ -n "$l" ] && ELIAS_CMDS+=("$l"); done < <(decl_cmds elias-mandate.sh)
PUSH_CMDS=();  while IFS= read -r l; do [ -n "$l" ] && PUSH_CMDS+=("$l");  done < <(decl_cmds push-ahead-check.sh)

echo "=== sanity: the probe hooks are really wired (else the suite proves nothing) ==="
{ [ "${#ELIAS_CMDS[@]}" -ge 2 ] && [ "${#PUSH_CMDS[@]}" -ge 1 ]; } \
  && ok "0. elias-mandate.sh (${#ELIAS_CMDS[@]} cmds) + push-ahead-check.sh (${#PUSH_CMDS[@]} cmd) are declared in the wiring" \
  || bad "0. probe hooks not found in wiring (elias=${#ELIAS_CMDS[@]} push=${#PUSH_CMDS[@]})"

echo
echo "=== (a) deployed wired hook, entry MISSING -> WARN naming it ==="

FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
OUT=$(run "$FH"); RC=$?
{ [ "$RC" = 0 ] && ! is_silent "$OUT" && printf '%s' "$OUT" | is_json; } \
  && ok "1. missing elias -> non-empty valid JSON, exit 0" \
  || bad "1. missing elias -> non-empty valid JSON, exit 0 (rc=$RC out=$OUT)"

FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
CTX=$(run "$FH" | ctx)
{ [[ "$CTX" == *"elias-mandate.sh"* ]] && [[ "$CTX" == *"settings.json"* ]] && [[ "$CTX" == *"install.sh"* ]]; } \
  && ok "2. warning names the hook and the remedy (install.sh)" \
  || bad "2. warning names the hook and the remedy (got: $CTX)"

echo
echo "=== (a') distinguishes missing from current AMONG deployed hooks ==="

# push-ahead current, elias missing: warn must name elias only, not push-ahead.
FH=$(newhome); deploy "$FH" elias-mandate.sh; deploy "$FH" push-ahead-check.sh
settings_with "$FH" "${PUSH_CMDS[@]}"
CTX=$(run "$FH" | ctx)
{ [[ "$CTX" == *"elias-mandate.sh"* ]] && [[ "$CTX" != *"push-ahead-check.sh"* ]]; } \
  && ok "3. names only the missing hook (elias), not the current one (push-ahead)" \
  || bad "3. should name elias only (got: $CTX)"

echo
echo "=== (a'') per-command granularity: one of two entries missing -> WARN ==="

# Deploy elias, but wire ONLY its first command (drop the PostCompact one).
FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH" "${ELIAS_CMDS[0]}"
OUT=$(run "$FH")
{ ! is_silent "$OUT" && [[ "$(printf '%s' "$OUT" | ctx)" == *"elias-mandate.sh"* ]]; } \
  && ok "4. a hook with ANY missing declared command is flagged" \
  || bad "4. partial wiring should still warn (out=$OUT)"

echo
echo "=== (b) every deployed wired hook current -> SILENT ==="

FH=$(newhome); deploy "$FH" elias-mandate.sh; deploy "$FH" push-ahead-check.sh
settings_with "$FH" "${ELIAS_CMDS[@]}" "${PUSH_CMDS[@]}"
OUT=$(run "$FH"); RC=$?
{ is_silent "$OUT" && [ "$RC" = 0 ]; } \
  && ok "5. all deployed hooks current -> exactly {} exit 0" \
  || bad "5. all current should be silent (rc=$RC out=$OUT)"

echo
echo "=== (c) component NOT installed (no file on disk) -> never warned about ==="

# elias missing from settings AND not deployed: must stay silent.
FH=$(newhome); settings_with "$FH"
OUT=$(run "$FH")
is_silent "$OUT" && ok "6. nothing deployed -> silent (no false alarm on uninstalled hooks)" \
                 || bad "6. nothing deployed should be silent (out=$OUT)"

# A deployed file that is NOT a wired hook is not the check's business.
FH=$(newhome); deploy "$FH" zz-not-a-wired-hook.sh; settings_with "$FH"
OUT=$(run "$FH")
is_silent "$OUT" && ok "7. a deployed non-wired file is ignored" \
                 || bad "7. non-wired deployed file should be ignored (out=$OUT)"

echo
echo "=== robustness: never cry wolf ==="

# No settings.json at all -> cannot judge -> silent, not a warning.
FH=$(newhome); deploy "$FH" elias-mandate.sh   # settings.json absent on purpose
OUT=$(run "$FH")
is_silent "$OUT" && ok "8. unreadable/absent settings.json -> silent" \
                 || bad "8. absent settings.json should be silent (out=$OUT)"

# Disable switch wins even with a real deploy lag present.
FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
OUT=$(HOME="$FH" HOOK_DEPLOY_CURRENCY_DISABLE=1 bash "$HOOK")
is_silent "$OUT" && ok "9. HOOK_DEPLOY_CURRENCY_DISABLE=1 -> silent" \
                 || bad "9. disable switch should silence (out=$OUT)"

# Malformed settings.json (hooks is a LIST, not a dict) must fail QUIET, not traceback.
FH=$(newhome); deploy "$FH" elias-mandate.sh
printf '%s' '{"hooks":[{"matcher":"x"}]}' > "$FH/.claude/settings.json"
OUT=$(run "$FH"); RC=$?
{ is_silent "$OUT" && [ "$RC" = 0 ]; } \
  && ok "9a. malformed settings (hooks is a list) -> silent, exit 0 (no traceback)" \
  || bad "9a. malformed settings should be silent (rc=$RC out=$OUT)"

# Non-dict group / non-dict hook entries must also be swallowed, not crash.
FH=$(newhome); deploy "$FH" elias-mandate.sh
printf '%s' '{"hooks":{"SessionStart":["not-a-dict",{"hooks":["also-not-a-dict"]}]}}' > "$FH/.claude/settings.json"
OUT=$(run "$FH"); RC=$?
{ [ "$RC" = 0 ] && printf '%s' "$OUT" | is_json; } \
  && ok "9b. malformed group/hook entries -> valid JSON, exit 0 (no traceback)" \
  || bad "9b. malformed group/hook entries should not crash (rc=$RC out=$OUT)"

# python3 unavailable -> silent (design-pinned branch). Run with a PATH that omits
# python3; the pre-python walk needs only dirname/readlink, which we symlink in. Invoke
# via an ABSOLUTE bash path so the restricted PATH does not also hide bash itself.
BASH_ABS="$(command -v bash)"
TBIN=$(mktemp -d); ln -s "$(command -v dirname)" "$TBIN/dirname"; ln -s "$(command -v readlink)" "$TBIN/readlink"
FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
OUT=$(HOME="$FH" PATH="$TBIN" "$BASH_ABS" "$HOOK"); RC=$?
{ is_silent "$OUT" && [ "$RC" = 0 ]; } \
  && ok "9c. python3 unavailable -> silent, exit 0" \
  || bad "9c. python3 unavailable should be silent (rc=$RC out=$OUT)"
rm -rf "$TBIN"

# Repo/wiring not locatable -> silent. Copy the hook OUTSIDE any checkout, run with
# CLAUDE_PROJECT_DIR unset and a cwd that has no claude/hooks/cluster-wirings.json.
NOREPO=$(mktemp -d); mkdir -p "$NOREPO/a/b"; cp "$HOOK" "$NOREPO/a/b/hook.sh"
FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
OUT=$(cd "$NOREPO" && HOME="$FH" CLAUDE_PROJECT_DIR="" bash "$NOREPO/a/b/hook.sh"); RC=$?
{ is_silent "$OUT" && [ "$RC" = 0 ]; } \
  && ok "9d. repo/wiring not locatable -> silent, exit 0" \
  || bad "9d. repo not locatable should be silent (rc=$RC out=$OUT)"
rm -rf "$NOREPO"

echo
echo "=== MUTANT (a gate that cannot go red is not a gate) ==="
# Cases 1/4 (warn) and 5 (silent) already prove the gate swings both ways; assert the
# warn path emits when it should so a future "always {}" regression is caught.
FH=$(newhome); deploy "$FH" elias-mandate.sh; settings_with "$FH"
[ -n "$(run "$FH")" ] && [ "$(run "$FH")" != '{}' ] \
  && ok "10. deploy lag present -> output is a real warning (proves case 5 is a real gate)" \
  || bad "10. deploy lag present -> expected a warning"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
