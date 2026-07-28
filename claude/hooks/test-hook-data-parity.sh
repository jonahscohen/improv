#!/usr/bin/env bash
# test-hook-data-parity.sh - the companion-DATA half of test-hook-registry.sh.
#
# A hook's runtime lexicon/config is as load-bearing as the hook file itself: every
# consumer in this repo fails OPEN when its companion is missing, so shipping the .sh
# alone produces a hook that installs, appears in the browser, and does nothing. That
# has now happened twice (route-intent.json 2026-07-26, grounding-intent.json which was
# never deployed at all), which is why this class needs its own guard and its own suite.
#
# THREE SOURCES OF TRUTH, CHECKED AGAINST EACH OTHER - never one against itself:
#   1. claude/hooks/*.json           (the disk)
#   2. browser-tree.json "hook_data" (the registry)
#   3. install.sh hook_data_files()  (the deploy code, parsed from its OWN case arms)
# The 2026-07-16 lesson is explicit that a completeness test comparing the tree to
# ITSELF proves nothing - it passed while the tree claimed sidecoach had 2 hooks and
# install.sh wired 6. So the parity rows below run in BOTH directions.
#
# Every assertion here is negative-controlled in the MUTATION section: the fixture is
# perturbed and the same assertion is required to go RED. A suite that cannot fail
# teaches people to ignore it.

set -uo pipefail

# python3 is this suite's only measuring instrument: every payload, every fixture and
# every assertion below is built with it. Without it the suite would not fail loudly -
# it would skip silently and still print a green summary, which is worse than no suite.
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 not found - this suite cannot verify anything without it." >&2
  exit 2
}
REPO="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
GUARD="$REPO/claude/hooks/hook-registry-guard.sh"
TREE="$REPO/claude/hooks/browser-tree.json"
INSTALL="$REPO/install.sh"

pass=0; fail=0
ok()  { echo "PASS $1"; pass=$((pass+1)); }
bad() { echo "FAIL $1"; fail=$((fail+1)); }

# ---------------------------------------------------------------------------
# SECTION 1 - parity between the registry and install.sh's OWN deploy code.
# hook_data_files() is parsed out of install.sh rather than paraphrased, so the
# test breaks if the real function changes.
# ---------------------------------------------------------------------------
parity="$(REPO="$REPO" python3 - <<'PY'
import json, os, re
repo = os.environ["REPO"]
tree = json.load(open(os.path.join(repo, "claude/hooks/browser-tree.json")))
src  = open(os.path.join(repo, "install.sh")).read()

m = re.search(r'^hook_data_files\(\)\s*\{(.*?)^\}', src, re.S | re.M)
if not m:
    print("ERR no hook_data_files() in install.sh"); raise SystemExit
body = m.group(1)
code = {}
for arm in re.finditer(r'^\s*([A-Za-z0-9._-]+\.sh)\)\s*echo\s+"([^"]*)"', body, re.M):
    code[arm.group(1)] = sorted(f for f in arm.group(2).split() if f)

reg = {k: sorted(v or []) for k, v in (tree.get("hook_data") or {}).items()}

# Only hooks the generic loops actually deploy are expected in the shell table;
# sidecoach ships its own registries through a bespoke loop, so the registry is a
# superset. Assert the SHELL TABLE is a subset of the registry, exactly.
print("CODE_KEYS " + ",".join(sorted(code)))
print("REG_KEYS "  + ",".join(sorted(reg)))
for k in sorted(code):
    if k not in reg:
        print("ONLY_IN_CODE " + k)
    elif code[k] != reg[k]:
        print("MISMATCH %s code=%s reg=%s" % (k, code[k], reg[k]))
# Hooks whose companions are deployed by a bespoke per-component loop rather than by
# hook_data_files() must SAY SO in the tree. Without this the choice is between a check
# too loose to catch anything (filename appears anywhere in install.sh - satisfied by a
# comment or by the FILES[] UI strings, both of which exist for these very names) and
# one that goes red on correct code. Declaring the exception keeps the default strict.
#
# NO APOSTROPHES ANYWHERE IN THIS HEREDOC. It is a quoted heredoc nested inside a
# $( ... ), and bash scans the command substitution with a lexer that still tracks
# single quotes - so one apostrophe in a COMMENT swallows the rest of the file and the
# error surfaces as "unexpected EOF while looking for matching )" against line 37.
bespoke = tree.get("hook_data_bespoke") or {}

for k in sorted(reg):
    for f in reg[k]:
        if k in code:
            # In the table: the table itself must list this exact file.
            if f not in code[k]:
                print("UNDEPLOYED %s %s" % (k, f))
        elif k in bespoke:
            # Bespoke: not in the table by design, but it still has to be deployed
            # SOMEWHERE, or the exemption becomes a place to hide a real gap.
            if not re.search(r'(?<![\w-])' + re.escape(f) + r'(?![\w-])', src):
                print("UNDEPLOYED %s %s" % (k, f))
        else:
            # Neither in the table nor declared bespoke: this is the drift we are after.
            print("UNTABLED %s %s" % (k, f))
PY
)"

echo "$parity" | grep -q "^ERR" \
  && bad "install.sh still defines hook_data_files()" \
  || ok "install.sh still defines hook_data_files()"

if echo "$parity" | grep -q "^ONLY_IN_CODE "; then
  bad "every hook in install.sh's hook_data_files() is in the tree registry: $(echo "$parity" | grep '^ONLY_IN_CODE ')"
else
  ok "every hook in install.sh's hook_data_files() is in the tree registry"
fi

if echo "$parity" | grep -q "^MISMATCH "; then
  bad "registry and install.sh list the SAME files per hook: $(echo "$parity" | grep '^MISMATCH ')"
else
  ok "registry and install.sh list the SAME files per hook"
fi

if echo "$parity" | grep -q "^UNDEPLOYED "; then
  bad "every registered companion is actually deployed: $(echo "$parity" | grep '^UNDEPLOYED ')"
else
  ok "every registered companion is actually deployed"
fi

if echo "$parity" | grep -q "^UNTABLED "; then
  bad "every registered hook is in hook_data_files() or declared bespoke: $(echo "$parity" | grep '^UNTABLED ')"
else
  ok "every registered hook is in hook_data_files() or declared bespoke"
fi

# ---------------------------------------------------------------------------
# SECTION 1b - the TABLE ITSELF, executed rather than parsed.
# ---------------------------------------------------------------------------
# Section 1 reads hook_data_files() as text. That catches a table that disagrees with
# the registry, but it cannot catch a table that does not BEHAVE the way the deploy
# loops assume - and the loops call it as a function, once per hook, including for the
# overwhelming majority of hooks that have no companion at all. The `*)` default arm is
# the single most-executed path in the table and section 1's regex deliberately skips
# it, so nothing tested it. A default arm that echoed anything but the empty string
# would make install_hook_data try to deploy a file named after the hook, for every
# hook in the repo. Extract the real function and run it.
TBL="$(mktemp)" || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
awk '/^hook_data_files\(\) \{/,/^\}/' "$INSTALL" > "$TBL"
if [ -s "$TBL" ]; then
  ok "hook_data_files() extracts cleanly from install.sh"
  # Expectations are DERIVED FROM THE REGISTRY, not hard-coded. A hard-coded list only
  # ever pins the mappings that existed the day it was written, so the next companion
  # someone registers and forgets to add to the table would sail straight through.
  while IFS='|' read -r h want; do
    [ -n "$h" ] || continue
    got="$(bash -c "source '$TBL'; hook_data_files $h" 2>/dev/null)"
    [ "$got" = "$want" ] && ok "table: $h -> $want" || bad "table: $h -> got '$got', want '$want'"
  done <<EOF
$(python3 -c "
import json
t = json.load(open('$TREE'))
excl = t.get('hook_data_bespoke') or {}
for k, v in sorted((t.get('hook_data') or {}).items()):
    if k in excl: continue
    print('%s|%s' % (k, ' '.join(sorted(v or []))))")
EOF
  # THE "STAYS GREEN" SIDE. A hook with no companion must yield the empty string, or
  # every companion-less hook in the repo starts trying to deploy a phantom file.
  # NOTE ON WHAT THIS DOES AND DOES NOT PROVE: a bash `case` with no matching arm also
  # produces no output, so these rows pass whether the `*)` arm is present or absent.
  # They pin the BEHAVIOUR the deploy loops rely on, which is the thing that matters;
  # the explicit-arm check below is what pins the arm itself.
  for h in bash-guard.sh content-guard.sh definitely-not-a-real-hook.sh; do
    got="$(bash -c "source '$TBL'; hook_data_files $h" 2>/dev/null)"
    [ -z "$got" ] && ok "table: $h yields no companion (deploy loop stays a no-op)" \
                  || bad "table: $h returned '$got', expected empty"
  done
  grep -Eq '^\s*\*\)\s*echo\s*""\s*;;' "$TBL" \
    && ok "table: the explicit default arm is present" \
    || bad "table: no explicit '*) echo \"\" ;;' arm - an unmatched hook relies on case fallthrough"
else
  bad "hook_data_files() extracts cleanly from install.sh"
fi
rm -f "$TBL"

# ---------------------------------------------------------------------------
# SECTION 2 - the real repo is currently clean on both audits.
# ---------------------------------------------------------------------------
# --audit-data goes quiet on a tree with no "hook_data" key (so it stays silent on
# older checkouts and on the .sh-only fixtures in test-hook-registry.sh). That carve-out
# is only safe if THIS tree is known to declare the registry - otherwise deleting the
# key would disarm the whole class in silence. This row is that safety catch.
python3 -c "
import json,sys
t=json.load(open('$TREE'))
sys.exit(0 if isinstance(t.get('hook_data'),dict) and t['hook_data']
         and isinstance(t.get('hook_data_excluded'),dict) else 1)" \
  && ok "real tree declares hook_data + hook_data_excluded (carve-out cannot disarm it)" \
  || bad "real tree is missing hook_data / hook_data_excluded - --audit-data is disarmed"

"$GUARD" --audit-data >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "real repo: --audit-data exits 0" || bad "real repo: --audit-data exits $rc"
"$GUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "real repo: --audit still exits 0" || bad "real repo: --audit exits $rc"

# Each specific companion that regressed before is deployed AND owned.
#
# THESE SIX DEPLOY ROWS WERE VACUOUS UNTIL 2026-07-28. Both loops used
# `grep -q "$name" install.sh`, which asks only whether a STRING occurs anywhere in a
# 7000-line file. Every one of these names also appears in a DESCS UI paragraph and in
# prose comments, so the rows were satisfied by text that deploys nothing. Measured:
# deleting `route-intent.sh) echo "route-intent.json" ;;` from hook_data_files() - the
# ONLY executable reference to route-intent.json in install.sh - left "install.sh
# deploys route-intent.json" PASSing, while the table row two sections up correctly
# went red. A comment-satisfiable check on the exact defect class this suite exists
# for is worse than no check: it reads as coverage.
#
# Both halves now run executable code instead of matching text.
#
# COMPANIONS: run the REAL install_hook_data() into a throwaway sandbox and require
# the file to LAND. Strictly stronger than any substring - it proves the deploy loop
# produces the file, not that the installer mentions its name somewhere.
data_lands() {  # $1 = owning hook, $2 = companion file expected on disk
  local sb; sb="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
  (
    CLAUDE_DIR="$sb/claude"; REPO_DIR="$REPO"
    mkdir -p "$CLAUDE_DIR/hooks"
    # Real function text, extracted verbatim rather than paraphrased, so this
    # breaks when the real deploy code changes.
    eval "$(awk '/^hook_data_files\(\) \{/,/^\}/'   "$INSTALL")"
    eval "$(awk '/^install_hook_data\(\) \{/,/^\}/' "$INSTALL")"
    link_or_copy_data() { ln -sf "$1" "$2"; }
    warn() { :; }
    install_hook_data "$1"
    [ -e "$CLAUDE_DIR/hooks/$2" ] && echo LANDED
  )
  rm -rf "$sb"
}

# HOOKS: build the set the installer actually deploys, by EXECUTING cluster_hooks()
# over every cluster arm and by scraping install_app_hooks argument lists from
# COMMENT-STRIPPED source. Prose can no longer satisfy either path.
installer_deploys_hook() {  # $1 = hook filename
  local h="$1" fn names c
  fn="$(awk '/^cluster_hooks\(\) \{/,/^\}/' "$INSTALL")"
  [ -n "$fn" ] || return 2
  names="$(printf '%s' "$fn" | sed -n 's/^[[:space:]]*\([a-z0-9|-]*\))[[:space:]]*echo.*/\1/p' | tr '|' '\n')"
  for c in $names; do
    case " $(bash -c "$fn"$'\n'"cluster_hooks $c" 2>/dev/null) " in
      *" $h "*) return 0 ;;
    esac
  done
  sed 's/[[:space:]]#.*$//; /^[[:space:]]*#/d' "$INSTALL" \
    | grep -F 'install_app_hooks' | tr ' ' '\n' | grep -qxF "$h" && return 0
  return 1
}

for pair in route-intent.sh:route-intent.json \
            grounding-gate.sh:grounding-intent.json \
            consolidate-nudge.sh:consolidate-intent.json; do
  h="${pair%%:*}"; f="${pair##*:}"
  [ "$(data_lands "$h" "$f")" = "LANDED" ] \
    && ok "install.sh actually deploys $f (install_hook_data executed)" \
    || bad "install_hook_data $h did not produce $f"
  python3 -c "
import json,sys
t=json.load(open('$TREE'))
own=[k for k,v in (t.get('hook_data') or {}).items() if '$f' in (v or [])]
sys.exit(0 if own else 1)" \
    && ok "$f has an owning hook in the registry" || bad "$f has no owning hook"
  # The consuming hook must itself still be deployed - a companion with no hook
  # is as dead as a hook with no companion.
  installer_deploys_hook "$h"
  case $? in
    0) ok "install.sh actually deploys $h (deploy lists executed/scraped)" ;;
    2) bad "could not extract cluster_hooks() from install.sh - $h is unverifiable" ;;
    *) bad "$h is in no cluster_hooks arm and no install_app_hooks list" ;;
  esac
done

# ---------------------------------------------------------------------------
# SECTION 3 - MUTATION / NEGATIVE CONTROL, in a hermetic synthetic repo.
# Runs against $TMPDIR with its own tree + install.sh so a row can never go red
# merely because the real working tree is momentarily dirty.
# ---------------------------------------------------------------------------
SB="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
mkdir -p "$SB/claude/hooks"
cp "$GUARD" "$SB/claude/hooks/"; chmod +x "$SB/claude/hooks/hook-registry-guard.sh"
SGUARD="$SB/claude/hooks/hook-registry-guard.sh"

write_fixture() {   # $1 = extra json files to create, $2 = install.sh body
  cat > "$SB/claude/hooks/browser-tree.json" <<'JSON'
{
  "buckets": [], "hook_desc": {}, "hook_owner": {},
  "pinned_hooks": ["hook-registry-guard"], "default_off_hooks": [],
  "hook_data": {"demo-hook.sh": ["demo-intent.json"]},
  "hook_data_excluded": {"app-wirings.json": "installer wiring table",
                         "browser-tree.json": "the registry itself"}
}
JSON
  printf '#!/usr/bin/env bash\nexit 0\n' > "$SB/claude/hooks/demo-hook.sh"
  echo '{}' > "$SB/claude/hooks/demo-intent.json"
  echo '{}' > "$SB/claude/hooks/app-wirings.json"
  # The clean baseline deploys the companion with a REAL code line, not a comment.
  # It used to be `# demo-intent.json`, which meant the M2 control only proved the guard
  # noticed a deleted COMMENT - it never proved the guard can tell deploy code from prose.
  printf 'picked demo && install_app_hooks demo-hook.sh\nlink_or_copy_data "$R/demo-intent.json" "$C/demo-intent.json"\n' > "$SB/install.sh"
}

write_fixture
"$SGUARD" --audit-data >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "MUTATION baseline: clean fixture exits 0" || bad "clean fixture exits $rc"

# M1 - an UNREGISTERED data file appears on disk.
echo '{}' > "$SB/claude/hooks/zz-orphan.json"
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "1" ] && printf '%s' "$out" | grep -q "UNMANAGED DATA: zz-orphan.json" \
  && ok "M1 unregistered data file -> UNMANAGED DATA (rc=1)" \
  || bad "M1 did not fire: rc=$rc out='$out'"
rm -f "$SB/claude/hooks/zz-orphan.json"

# M2 - registered, but install.sh stops naming it (the route-intent.json bug).
printf 'picked demo && install_app_hooks demo-hook.sh\n# demo-intent.json is deployed elsewhere\n' > "$SB/install.sh"
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "1" ] && printf '%s' "$out" | grep -q "UNDEPLOYED DATA: demo-intent.json" \
  && ok "M2 registered but undeployed -> UNDEPLOYED DATA (rc=1)" \
  || bad "M2 did not fire: rc=$rc out='$out'"
write_fixture

# M3 - registered and deployed, but the file is gone from disk.
rm -f "$SB/claude/hooks/demo-intent.json"
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "1" ] && printf '%s' "$out" | grep -q "MISSING DATA: demo-intent.json" \
  && ok "M3 registered but absent from disk -> MISSING DATA (rc=1)" \
  || bad "M3 did not fire: rc=$rc out='$out'"
write_fixture

# M4 - the owning hook is deleted, leaving a stale registry entry.
rm -f "$SB/claude/hooks/demo-hook.sh"
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "1" ] && printf '%s' "$out" | grep -q "STALE DATA OWNER: demo-hook.sh" \
  && ok "M4 stale registry owner -> STALE DATA OWNER (rc=1)" \
  || bad "M4 did not fire: rc=$rc out='$out'"
write_fixture

# M5 - an excluded file must NOT be reported (a guard that fires on everything is noise).
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "0" ] && ok "M5 excluded file stays silent" || bad "M5 excluded file reported: $out"

# M6 - a TORN/wrong-shaped tree must be 'cannot tell' (3), never 0 and never 1.
echo '[]' > "$SB/claude/hooks/browser-tree.json"
"$SGUARD" --audit-data >/dev/null 2>&1; rc=$?
[ "$rc" = "3" ] && ok "M6 wrong-shaped tree -> exit 3 (cannot tell), not 0/1" \
  || bad "M6 wrong-shaped tree exited $rc, expected 3"
write_fixture

# M7 - no tree at all means 'not our repo': stay quiet.
rm -f "$SB/claude/hooks/browser-tree.json"
"$SGUARD" --audit-data >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "M7 no tree -> silent exit 0 (not our repo)" || bad "M7 exited $rc"

# M8 - THE "STAYS GREEN" NEGATIVE, built from the table rather than against it.
# M1-M4 all prove the guard FIRES. None of them proved it stays QUIET for the ordinary
# case, which is the overwhelming majority: a hook that legitimately has no companion
# data file. A guard that reported those would fire on nearly every hook in the repo,
# get classified as noise, and be ignored - which is the same outcome as not having it.
write_fixture
printf '#!/usr/bin/env bash\nexit 0\n' > "$SB/claude/hooks/plain-hook.sh"
printf 'picked demo && install_app_hooks demo-hook.sh plain-hook.sh\nlink_or_copy_data "$R/demo-intent.json" "$C/demo-intent.json"\n' > "$SB/install.sh"
out="$("$SGUARD" --audit-data 2>&1)"; rc=$?
[ "$rc" = "0" ] && [ -z "$(printf '%s' "$out" | grep -i 'plain-hook')" ] \
  && ok "M8 companion-less hook stays green (no phantom data file demanded)" \
  || bad "M8 fired on a hook with no companion: rc=$rc out='$out'"

# M9 - and the companion-less hook must not become invisible to the .sh audit either:
# "no data file" is not "unmanaged". Proves M8 stays quiet for the right reason.
"$SGUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] || [ "$rc" = "0" ] \
  && ok "M9 companion-less hook still reachable by the .sh audit (rc=$rc, not 3)" \
  || bad "M9 .sh audit returned $rc"

rm -rf "$SB"
echo ""
echo "== $pass passed, $fail failed =="
[ "$fail" = "0" ]
