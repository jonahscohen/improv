#!/usr/bin/env bash
# test-delegated-installer-writes.sh - every write the DELEGATED installers make
# (justify/install.sh and lotus/install.sh) is proven to (a) not follow a symlink out of
# the directory the installer owns, (b) not destroy the destination before a complete
# replacement exists, and (c) not report success over a failure.
#
# WHY A THIRD FILE. test-zshrc-safe-edit.sh proved the property for ~/.zshrc and
# test-userfile-safe-edit.sh proved it for ~/.claude/CLAUDE.md - both against the
# TOP-LEVEL install.sh. The same hazard class was still live across the entire write
# surface of the two installers that run UNDER it: a cp -r into ~/.claude/justify, two
# json.dump(open(p,'w')) calls on ~/.claude.json, a cat > SKILL.md heredoc, a plist
# write, and two builds whose failure was warned about and then ignored. Commit 8d19b7cc
# fixed ONE line in each of these files. This suite covers the rest of them.
#
# THE DEFECTS, each reproduced against committed code before being fixed. The rows named
# HAZARD-DEMO run the OLD idiom verbatim and assert the damage HAPPENS; the FIXED row
# beside each one runs the new primitive on an identical fixture and asserts it does not.
# A suite that only proves the new code is green cannot tell you it changed anything.
#
#   1. json.dump(d, open(p, 'w'), indent=2) on ~/.claude.json TRUNCATES the user's whole
#      Claude Code configuration at open() and then writes. Worse, the file object is
#      never closed explicitly, so the buffered write is flushed during interpreter
#      finalization where CPython PRINTS the OSError and swallows it. Reproduced under
#      `ulimit -f 1`: a 4 KB config came back 512 bytes and python exited 0, with the
#      installer's next line printing that the server was registered.
#   2. cp -r "$SCRIPT_DIR/server" "$JUSTIFY_DIR/" FOLLOWS a symlink at the destination.
#      Reproduced: an entire source tree landed in a directory outside ~/.claude.
#   3. cp / cat > for SKILL.md follow a destination symlink and truncate before writing.
#      Reproduced: a victim file outside the installer's tree was overwritten, and an
#      empty producer left a 0-byte SKILL.md where a good one had been.
#   4. A destination that resolves back INTO this checkout was never checked, so the
#      placeholder rewrite could bake an absolute path into tracked source and destroy
#      the __LOTUS_SRC__ marker the next install needs. Reproduced.
#   5. Failed builds were warned about, then the installer registered an MCP server
#      pointing at the entrypoint the build had not produced and exited 0. Reproduced.
#
# MUTATION CONTROL. Every assertion above is mutation-controlled: the product code the
# assertion guards is edited in a staged copy, the row is re-run and must go RED, then
# the unmutated copy must go GREEN. Each mutation asserts its anchor EXISTS first - a
# mutation that silently matched nothing is indistinguishable from an uncaught defect and
# fails in the confident direction.
#
# NEGATIVE CONTROL. Point the suite at a pristine tree and the FIXED rows must fail:
#   git archive HEAD | (mkdir -p /tmp/pristine && tar -x -C /tmp/pristine)
#   IMPROV_TEST_TARGET_REPO=/tmp/pristine bash test-delegated-installer-writes.sh
# A harness that is green against both the broken and the fixed tree proves nothing.
#
# CONTAINMENT. Nothing here writes to the live ~/.claude.json, ~/.claude/ or ~/.zshrc.
# Every row runs against a sandbox $HOME under $TMPROOT, every installer run drives a
# STAGED COPY under $TMPROOT, and the last section proves the target checkout's two
# installers are byte-identical to what they were when the suite started.
#
# Run:  bash test-delegated-installer-writes.sh
# Exit: 0 all green / 1 an assertion failed / 2 the harness itself could not set up
set -u

TARGET_REPO="${IMPROV_TEST_TARGET_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
JUSTIFY_INSTALLER="$TARGET_REPO/justify/install.sh"
LOTUS_INSTALLER="$TARGET_REPO/lotus/install.sh"
[ -f "$JUSTIFY_INSTALLER" ] || { echo "HARNESS: not found: $JUSTIFY_INSTALLER" >&2; exit 2; }
[ -f "$LOTUS_INSTALLER" ]   || { echo "HARNESS: not found: $LOTUS_INSTALLER" >&2; exit 2; }

pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); [ $# -gt 1 ] && echo "     hint: $2"; return 0; }

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/improv-delegated.XXXXXX")" \
  || { echo "HARNESS: mktemp -d failed" >&2; exit 2; }
trap 'rm -rf "$TMPROOT"' EXIT
# PHYSICAL path, not the logical one. On macOS $TMPDIR is /var/folders/... which is a
# symlink into /private/var/folders/..., and the installers resolve their own root with
# `pwd -P`. A harness that hands them a logical path is comparing two spellings of the
# same directory and gets the wrong answer from every containment row.
TMPROOT="$(cd "$TMPROOT" && pwd -P)" || { echo "HARNESS: could not resolve $TMPROOT" >&2; exit 2; }

# A missing hash tool would make every content-comparison row vacuous (empty == empty is
# true), so it aborts the harness instead of passing quietly. Overridable for one reason:
# so this fail-loud path is itself provable.
#   IMPROV_TEST_HASH_TOOLS=nope bash test-delegated-installer-writes.sh   -> exit 2
HASH_TOOLS="${IMPROV_TEST_HASH_TOOLS:-shasum sha256sum md5sum cksum}"
HASHER=""
for _c in $HASH_TOOLS; do command -v "$_c" >/dev/null 2>&1 && { HASHER="$_c"; break; }; done
[ -n "$HASHER" ] || { echo "HARNESS: no hash tool on PATH (tried: $HASH_TOOLS)" >&2; exit 2; }
hash_of(){ [ -f "$1" ] || { echo "MISSING:$1"; return 0; }; "$HASHER" "$1" | awk '{print $1}'; }

# Taken before anything runs, compared in section H. A suite that edits the files it is
# reporting on is measuring itself.
JUSTIFY_HASH_AT_START="$(hash_of "$JUSTIFY_INSTALLER")"
LOTUS_HASH_AT_START="$(hash_of "$LOTUS_INSTALLER")"
MARKER="$TMPROOT/.started-at"
: > "$MARKER"

# EVERY justify shim in BOTH shared bins, before a single row runs.
#
# The SHIM_STAGE_SAFE gate below is a grep, and a grep is a heuristic - it can be satisfied
# by a string in a comment. This is the behavioural backstop that does not care why the
# gate was wrong: if any of these entries changes while the suite runs, the suite says so.
# The first version snapshotted justify-init alone, which would have missed damage to the
# other seven. Flagged by independent review of this harness.
shim_snapshot(){
  local d n
  for d in /usr/local/bin /opt/homebrew/bin; do
    for n in justify-init justify-remove justify-watch justify-done justify-serve \
             justify-watch-arm justify-watch-disarm justify-worker; do
      if [ -L "$d/$n" ]; then
        printf '%s -> %s\n' "$d/$n" "$(readlink "$d/$n")"
      elif [ -e "$d/$n" ]; then
        printf '%s (not a symlink)\n' "$d/$n"
      else
        printf '%s (absent)\n' "$d/$n"
      fi
    done
  done
}
SHIMS_AT_START="$(shim_snapshot)"

# ------------------------------------------------------------
# Extract the primitives under test.
#
# The installers are standalone and cannot be sourced (each runs a full install), so the
# sentinel-delimited helper block is lifted out and sourced on its own. On a tree where
# the block does not exist - the negative control - extraction produces nothing and every
# row that needs it FAILS. That is the intended outcome: those rows are asserting a
# property the pristine tree does not have.
# ------------------------------------------------------------
LIB_J="$TMPROOT/lib-justify.sh"
LIB_L="$TMPROOT/lib-lotus.sh"
awk '/^# BEGIN improv shared safe-write helpers$/,/^# END improv shared safe-write helpers$/' \
  "$JUSTIFY_INSTALLER" > "$LIB_J"
awk '/^# BEGIN improv shared safe-write helpers$/,/^# END improv shared safe-write helpers$/' \
  "$LOTUS_INSTALLER" > "$LIB_L"
# atomic_install_tree is justify-only, so it lives outside the shared block - and so does
# its interrupt handler and the three globals the handler reads. Extracting the function
# without them left the trap calling a command that did not exist, which the D6 row caught
# by resuming past a signal it was supposed to stop on.
printf '_ait_dst=""; _ait_stash=""; _ait_tmp=""\n' >> "$LIB_J"
awk '/^_atomic_install_tree_interrupted\(\) \{/,/^\}/' "$JUSTIFY_INSTALLER" >> "$LIB_J"
awk '/^atomic_install_tree\(\) \{/,/^\}/' "$JUSTIFY_INSTALLER" >> "$LIB_J"

LIB_OK=0
if [ -s "$LIB_J" ] && grep -q '^atomic_install_file() {' "$LIB_J"; then LIB_OK=1; fi

# drive.sh <lib> <repo-phys> <fn> [args...] - source the extracted primitives and call one.
cat > "$TMPROOT/drive.sh" <<'DRIVE'
lib="$1"; REPO_PHYS="$2"; fn="$3"; shift 3
# shellcheck disable=SC1090
. "$lib" || exit 90
"$fn" "$@"
DRIVE

drive(){ bash "$TMPROOT/drive.sh" "$@"; }

# Fault injection at the seam: shadow `mv` so ONE rename to a chosen destination fails.
# This is how the rollback path in atomic_install_tree gets exercised - there is no way
# to make a same-directory rename fail for real, and an untested rollback is a rollback
# that has never run.
cat > "$TMPROOT/drive-faulty-mv.sh" <<'FAULTY'
lib="$1"; REPO_PHYS="$2"; failtarget="$3"; fn="$4"; shift 4
_mv_failed=0
mv() {
  local last="${!#}"
  if [ "$last" = "$failtarget" ] && [ "$_mv_failed" = 0 ]; then
    _mv_failed=1
    return 1
  fi
  command mv "$@"
}
# shellcheck disable=SC1090
. "$lib" || exit 90
"$fn" "$@"
FAULTY

need_lib(){
  if [ "$LIB_OK" = 1 ]; then return 0; fi
  bad "$1" "the shared safe-write helper block is not present in $TARGET_REPO - nothing to exercise"
  return 1
}

# mutate <file> <literal-old> <literal-new> <expected-anchor-count>
#
# Edits a STAGED COPY, never the checkout. Counts the anchor first and refuses to
# proceed unless it appears exactly the expected number of times: a mutation that
# silently matched nothing produces a NOT-CAUGHT result indistinguishable from an
# uncaught defect, and fails in the confident direction. Counted with perl on the whole
# file rather than `grep -Fc`, because grep -F treats a multi-line literal as several
# independent patterns and would report 3 for a three-line anchor that occurs once.
mutate(){
  local file="$1" old="$2" new="$3" want="$4"
  OLD="$old" NEW="$new" WANT="$want" perl -e '
    my $f = shift;
    open my $fh, "<", $f or do { print "MUTATE-FAILED(open)"; exit 0 };
    local $/; my $t = <$fh>; close $fh;
    my ($o, $n, $want) = ($ENV{OLD}, $ENV{NEW}, $ENV{WANT});
    my $count = () = ($t =~ /\Q$o\E/g);
    if ($count != $want) { print "ANCHOR-MISSING(found $count, wanted $want)"; exit 0 }
    $t =~ s/\Q$o\E/$n/g;
    open my $out, ">", $f or do { print "MUTATE-FAILED(write)"; exit 0 };
    print $out $t; close $out;
    print "OK";
  ' "$file"
}

# mutation_row <name> <result-of-mutate> <violated>
#
# `violated` is 1 when the assertion the mutation targets NO LONGER HOLDS against the
# mutated code - which is the result being demanded. A mutation that leaves the
# assertion satisfied means the assertion was not watching the code that was broken.
mutation_row(){
  local name="$1" mres="$2" violated="$3"
  case "$mres" in
    ANCHOR-MISSING*) bad "$name" "the mutation anchor does not exist ($mres) - the row proves nothing" ;;
    MUTATE-FAILED*)  bad "$name" "the mutation could not be applied ($mres)" ;;
    OK)
      if [ "$violated" = 1 ]; then
        ok "$name"
      else
        bad "$name" "the assertion still held against mutated code - it is not load-bearing"
      fi
      ;;
    *) bad "$name" "unknown mutation result: $mres" ;;
  esac
}

echo "=== target: $TARGET_REPO"
echo "=== sandbox: $TMPROOT"
echo

# ============================================================
# A. Structure and drift
# ============================================================
echo "--- A. structure and drift"

BLK_J="$TMPROOT/blk-j.txt"; BLK_L="$TMPROOT/blk-l.txt"
awk '/^# BEGIN improv shared safe-write helpers$/,/^# END improv shared safe-write helpers$/' \
  "$JUSTIFY_INSTALLER" > "$BLK_J"
awk '/^# BEGIN improv shared safe-write helpers$/,/^# END improv shared safe-write helpers$/' \
  "$LOTUS_INSTALLER" > "$BLK_L"
if [ -s "$BLK_J" ] && [ -s "$BLK_L" ]; then
  ok "A1 both installers carry the shared safe-write helper block"
else
  bad "A1 both installers carry the shared safe-write helper block" \
      "justify block $(wc -l < "$BLK_J") lines, lotus block $(wc -l < "$BLK_L") lines"
fi

# The block is duplicated because neither script can source the 6600-line install.sh.
# Duplication is only safe while the copies are identical, so drift is an assertion.
if [ -s "$BLK_J" ] && cmp -s "$BLK_J" "$BLK_L"; then
  ok "A2 the two copies of the shared block are byte-identical"
else
  bad "A2 the two copies of the shared block are byte-identical" \
      "diff justify/install.sh and lotus/install.sh helper blocks"
fi

# Structural row: the raw idioms must not come back at a call site. Restricted to the
# lines OUTSIDE the helper block, because the block's own comments quote them verbatim.
outside_block(){ awk '/^# BEGIN improv shared safe-write helpers$/{s=1} /^# END improv shared safe-write helpers$/{s=0;next} !s' "$1"; }
banned_hits=""
for f in "$JUSTIFY_INSTALLER" "$LOTUS_INSTALLER"; do
  while IFS= read -r line; do
    # Leading whitespace stripped first: anchored patterns missed every indented call
    # site, so a raw `cp -r` inside an `if` or a loop walked straight past this row.
    # Flagged by independent review of this harness.
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      *"json.dump("*"open("*)          banned_hits="$banned_hits $f:json.dump-open" ;;
      *"sed -i.bak"*)                  banned_hits="$banned_hits $f:sed-i-bak" ;;
      'cp -r '*|'cp -R '*)             banned_hits="$banned_hits $f:cp-r" ;;
      'cat > "$SKILL_DIR'*)            banned_hits="$banned_hits $f:cat-skill" ;;
    esac
  done < <(outside_block "$f" | grep -v '^[[:space:]]*#')
done
if [ -z "$banned_hits" ]; then
  ok "A3 no unguarded cp -r / cat > / json.dump(open()) / sed -i.bak at any call site"
else
  bad "A3 no unguarded cp -r / cat > / json.dump(open()) / sed -i.bak at any call site" "$banned_hits"
fi

# ============================================================
# B. ~/.claude.json - the user-owned file both installers write
# ============================================================
echo
echo "--- B. ~/.claude.json"

# A realistic config: >512 bytes, so `ulimit -f 1` can interrupt a write to it, and
# carrying keys that have nothing to do with either installer.
seed_config(){
  python3 - "$1" <<'PY'
import json, sys
d = {
    "numStartups": 412,
    "installMethod": "native",
    "oauthAccount": {"accountUuid": "u-" + "0" * 32, "emailAddress": "user@example.com"},
    "mcpServers": {"pencil": {"type": "stdio", "command": "node", "args": ["/opt/pencil/server.js"]}},
    "projects": {"/Users/someone/code/%s" % n: {"history": ["one", "two", "three"]} for n in "abcdefgh"},
}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(d, fh, indent=2)
    fh.write("\n")
PY
}

# ---- B0 HAZARD-DEMO: the committed idiom, verbatim, with a write that cannot finish.
HAZ="$TMPROOT/haz"; mkdir -p "$HAZ"
seed_config "$HAZ/.claude.json" || { echo "HARNESS: python3 seed failed" >&2; exit 2; }
before_bytes=$(wc -c < "$HAZ/.claude.json" | tr -d ' ')
demo_out="$TMPROOT/b0.out"
( ulimit -f 1
  cd "$HAZ" || exit 99
  python3 -c "
import json, os
p = os.path.join('$HAZ', '.claude.json')
d = json.load(open(p))
if 'mcpServers' not in d:
    d['mcpServers'] = {}
d['mcpServers']['justify'] = {'type': 'stdio', 'command': 'node', 'args': ['/x/index.js']}
json.dump(d, open(p, 'w'), indent=2)
print('MCP server registered in ~/.claude.json')
" ) > "$demo_out" 2>&1
demo_rc=$?
after_bytes=$(wc -c < "$HAZ/.claude.json" | tr -d ' ')
if [ "$demo_rc" = 0 ] && [ "$after_bytes" -lt "$before_bytes" ]; then
  ok "B0 HAZARD-DEMO the old json.dump(open(p,'w')) truncated the config ($before_bytes -> $after_bytes bytes) and still exited 0"
else
  bad "B0 HAZARD-DEMO the old json.dump(open(p,'w')) truncated the config and still exited 0" \
      "rc=$demo_rc bytes $before_bytes -> $after_bytes; the fixture did not reach the hazard, so the B1 row below proves nothing"
fi
if grep -q "MCP server registered" "$demo_out"; then
  ok "B0b HAZARD-DEMO the old idiom printed its success line over the destroyed file"
else
  bad "B0b HAZARD-DEMO the old idiom printed its success line over the destroyed file" "$(cat "$demo_out")"
fi

# ---- B1 FIXED: identical fixture, identical interruption, through register_mcp_server.
if need_lib "B1 register_mcp_server leaves the config byte-identical when the write cannot finish"; then
  FIX="$TMPROOT/fix1"; mkdir -p "$FIX"
  seed_config "$FIX/.claude.json"
  before_hash=$(hash_of "$FIX/.claude.json")
  ( ulimit -f 1
    drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$FIX/.claude.json" justify node /x/index.js
  ) > "$TMPROOT/b1.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$FIX/.claude.json")
  if [ "$rc" != 0 ] && [ "$before_hash" = "$after_hash" ]; then
    ok "B1 register_mcp_server exits $rc and leaves the config byte-identical when the write cannot finish"
  else
    bad "B1 register_mcp_server exits non-zero and leaves the config byte-identical when the write cannot finish" \
        "rc=$rc hash $before_hash -> $after_hash; $(cat "$TMPROOT/b1.out")"
  fi
  if grep -q "NOT been modified" "$TMPROOT/b1.out"; then
    ok "B1b the failure says the file was not modified"
  else
    bad "B1b the failure says the file was not modified" "$(cat "$TMPROOT/b1.out")"
  fi
  strays=$(find "$FIX" -name '.claude.json.*' | wc -l | tr -d ' ')
  if [ "$strays" = 0 ]; then
    ok "B1c no staged sidecar left beside the config after the failed write"
  else
    bad "B1c no staged sidecar left beside the config after the failed write" "$(find "$FIX" -name '.claude.json.*')"
  fi
fi

# ---- B2 FIXED: happy path preserves everything it did not come to change.
if need_lib "B2 registration lands without disturbing the rest of the config"; then
  H="$TMPROOT/b2"; mkdir -p "$H"
  seed_config "$H/.claude.json"
  chmod 600 "$H/.claude.json"
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" justify node /home/u/.claude/justify/dist/server/index.js \
    > "$TMPROOT/b2.out" 2>&1
  rc=$?
  verdict=$(python3 - "$H/.claude.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
problems = []
if d.get("numStartups") != 412: problems.append("numStartups lost")
if len(d.get("projects", {})) != 8: problems.append("projects lost")
if d.get("mcpServers", {}).get("pencil", {}).get("command") != "node": problems.append("pencil registration lost")
j = d.get("mcpServers", {}).get("justify")
if j != {"type": "stdio", "command": "node", "args": ["/home/u/.claude/justify/dist/server/index.js"]}:
    problems.append("justify entry wrong: %r" % (j,))
print(";".join(problems) if problems else "CLEAN")
PY
)
  mode=$(stat -f '%Lp' "$H/.claude.json" 2>/dev/null || stat -c '%a' "$H/.claude.json")
  if [ "$rc" = 0 ] && [ "$verdict" = CLEAN ] && [ "$mode" = 600 ]; then
    ok "B2 registration lands, every unrelated key survives, mode stays 600"
  else
    bad "B2 registration lands, every unrelated key survives, mode stays 600" "rc=$rc verdict=$verdict mode=$mode"
  fi
  if [ "$(tail -c 1 "$H/.claude.json" | od -An -c | tr -d ' ')" = '\n' ]; then
    ok "B2b the rewritten config ends with a newline"
  else
    bad "B2b the rewritten config ends with a newline"
  fi
fi

# ---- B3 FIXED: a symlinked ~/.claude.json keeps its link.
# The user's link is THEIR wiring. Renaming a staged file over the link path would
# silently replace it with a regular file and detach the config from the dotfiles repo
# they manage it in. This is the opposite of the ~/.claude/skills rule two sections down.
if need_lib "B3 a symlinked config keeps the link and the target gets the write"; then
  H="$TMPROOT/b3"; mkdir -p "$H/dotfiles"
  seed_config "$H/dotfiles/claude.json"
  ln -s "$H/dotfiles/claude.json" "$H/.claude.json"
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" lotus /usr/bin/node /repo/lotus/mcp-server/dist/server.js \
    > "$TMPROOT/b3.out" 2>&1
  rc=$?
  linked=0; [ -L "$H/.claude.json" ] && linked=1
  landed=$(python3 -c "
import json,sys
d=json.load(open('$H/dotfiles/claude.json'))
print(d.get('mcpServers',{}).get('lotus',{}).get('args',[None])[0])
" 2>/dev/null)
  if [ "$rc" = 0 ] && [ "$linked" = 1 ] && [ "$landed" = "/repo/lotus/mcp-server/dist/server.js" ]; then
    ok "B3 the symlink survives and the registration landed in its target"
  else
    bad "B3 the symlink survives and the registration landed in its target" \
        "rc=$rc still-a-link=$linked landed=$landed"
  fi
fi

# ---- B4 FIXED: an unparseable config is refused, never rewritten from scratch.
if need_lib "B4 an unparseable config is refused and left untouched"; then
  H="$TMPROOT/b4"; mkdir -p "$H"
  printf '{ "numStartups": 412, this is not json\n' > "$H/.claude.json"
  before_hash=$(hash_of "$H/.claude.json")
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" justify node /x.js > "$TMPROOT/b4.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/.claude.json")
  if [ "$rc" = 3 ] && [ "$before_hash" = "$after_hash" ]; then
    ok "B4 an unparseable config exits 3 and is left byte-identical"
  else
    bad "B4 an unparseable config exits 3 and is left byte-identical" "rc=$rc hash $before_hash -> $after_hash"
  fi
fi

# ---- B5 FIXED: a config that is valid JSON but not an object.
if need_lib "B5 a non-object config is refused"; then
  H="$TMPROOT/b5"; mkdir -p "$H"
  printf '[1, 2, 3]\n' > "$H/.claude.json"
  before_hash=$(hash_of "$H/.claude.json")
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" justify node /x.js > "$TMPROOT/b5.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/.claude.json")
  if [ "$rc" = 3 ] && [ "$before_hash" = "$after_hash" ]; then
    ok "B5 a top-level JSON array exits 3 and is left byte-identical"
  else
    bad "B5 a top-level JSON array exits 3 and is left byte-identical" "rc=$rc hash $before_hash -> $after_hash"
  fi
  printf '{"mcpServers": "not-an-object"}\n' > "$H/.claude.json"
  before_hash=$(hash_of "$H/.claude.json")
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" justify node /x.js > "$TMPROOT/b5b.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/.claude.json")
  if [ "$rc" = 3 ] && [ "$before_hash" = "$after_hash" ]; then
    ok "B5b a non-object mcpServers exits 3 and is left byte-identical"
  else
    bad "B5b a non-object mcpServers exits 3 and is left byte-identical" "rc=$rc hash $before_hash -> $after_hash"
  fi
fi

# ---- B6 FIXED: no config yet, and a config that is a directory.
if need_lib "B6 a missing config is created and a directory is refused"; then
  H="$TMPROOT/b6"; mkdir -p "$H"
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" justify node /x.js > "$TMPROOT/b6.out" 2>&1
  rc=$?
  mode=$(stat -f '%Lp' "$H/.claude.json" 2>/dev/null || stat -c '%a' "$H/.claude.json" 2>/dev/null)
  if [ "$rc" = 0 ] && [ -f "$H/.claude.json" ] && [ "$mode" = 600 ]; then
    ok "B6 a missing config is created 0600 with the registration"
  else
    bad "B6 a missing config is created 0600 with the registration" "rc=$rc mode=$mode"
  fi
  mkdir -p "$H/dir.json"
  drive "$LIB_J" "$TMPROOT/norepo" register_mcp_server "$H/dir.json" justify node /x.js > "$TMPROOT/b6b.out" 2>&1
  rc=$?
  if [ "$rc" = 2 ] && [ -z "$(ls -A "$H/dir.json")" ]; then
    ok "B6b a directory destination exits 2 and nothing is written inside it"
  else
    bad "B6b a directory destination exits 2 and nothing is written inside it" "rc=$rc contents: $(ls -A "$H/dir.json")"
  fi
fi

# ---- B7 HAZARD-DEMO + FIXED: a path containing a quote.
# lotus interpolated $NODE_BIN and $SERVER_JS into the python SOURCE with single quotes
# around them. A checkout at a path containing an apostrophe made that a syntax error at
# best. The fixed helper passes both through argv.
HAZ2="$TMPROOT/haz2"; mkdir -p "$HAZ2"
seed_config "$HAZ2/.claude.json"
QUOTED="/tmp/jonah's repo/mcp-server/dist/server.js"
demo_rc=0
python3 -c "
import json, os
p = os.path.join('$HAZ2', '.claude.json')
d = json.load(open(p)) if os.path.exists(p) else {}
d.setdefault('mcpServers', {})
d['mcpServers']['lotus'] = {'type': 'stdio', 'command': 'node', 'args': ['$QUOTED']}
json.dump(d, open(p, 'w'), indent=2)
" > "$TMPROOT/b7demo.out" 2>&1 || demo_rc=$?
if [ "$demo_rc" != 0 ]; then
  ok "B7 HAZARD-DEMO the old shell-interpolated python failed on a path containing a quote (rc=$demo_rc)"
else
  bad "B7 HAZARD-DEMO the old shell-interpolated python failed on a path containing a quote" \
      "it succeeded, so the fixture did not reach the hazard"
fi
if need_lib "B7b register_mcp_server handles a path containing a quote"; then
  H="$TMPROOT/b7"; mkdir -p "$H"
  seed_config "$H/.claude.json"
  drive "$LIB_L" "$TMPROOT/norepo" register_mcp_server "$H/.claude.json" lotus /usr/bin/node "$QUOTED" > "$TMPROOT/b7.out" 2>&1
  rc=$?
  landed=$(python3 -c "
import json
d=json.load(open('$H/.claude.json'))
print(d['mcpServers']['lotus']['args'][0])
" 2>/dev/null)
  if [ "$rc" = 0 ] && [ "$landed" = "$QUOTED" ]; then
    ok "B7b register_mcp_server stores a quoted path verbatim through argv"
  else
    bad "B7b register_mcp_server stores a quoted path verbatim through argv" "rc=$rc landed=$landed"
  fi
fi

# ============================================================
# C. Installer-owned FILES (SKILL.md, payload files, CLI scripts)
# ============================================================
echo
echo "--- C. installer-owned file writes"

# ---- C0 HAZARD-DEMO: plain cp follows a destination symlink.
H="$TMPROOT/c0"; mkdir -p "$H/skills" "$H/elsewhere"
printf 'the user precious file\n' > "$H/elsewhere/victim.md"
printf 'installed skill content\n' > "$H/source.md"
ln -s "$H/elsewhere/victim.md" "$H/skills/SKILL.md"
cp "$H/source.md" "$H/skills/SKILL.md" 2>/dev/null
if grep -q "installed skill content" "$H/elsewhere/victim.md"; then
  ok "C0 HAZARD-DEMO plain cp followed the symlink and overwrote a file outside the install dir"
else
  bad "C0 HAZARD-DEMO plain cp followed the symlink and overwrote a file outside the install dir" \
      "victim: $(cat "$H/elsewhere/victim.md")"
fi

# ---- C1 FIXED: same fixture through atomic_install_file.
if need_lib "C1 atomic_install_file replaces a destination symlink instead of following it"; then
  H="$TMPROOT/c1"; mkdir -p "$H/skills" "$H/elsewhere"
  printf 'the user precious file\n' > "$H/elsewhere/victim.md"
  printf 'installed skill content\n' > "$H/source.md"
  ln -s "$H/elsewhere/victim.md" "$H/skills/SKILL.md"
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_file "$H/source.md" "$H/skills/SKILL.md" > "$TMPROOT/c1.out" 2>&1
  rc=$?
  victim_intact=0; grep -q "the user precious file" "$H/elsewhere/victim.md" && victim_intact=1
  is_link=0; [ -L "$H/skills/SKILL.md" ] && is_link=1
  content_ok=0; grep -q "installed skill content" "$H/skills/SKILL.md" && content_ok=1
  if [ "$rc" = 0 ] && [ "$victim_intact" = 1 ] && [ "$is_link" = 0 ] && [ "$content_ok" = 1 ]; then
    ok "C1 the victim outside the install dir is untouched, the link is replaced by a real file"
  else
    bad "C1 the victim outside the install dir is untouched, the link is replaced by a real file" \
        "rc=$rc victim_intact=$victim_intact still_link=$is_link content_ok=$content_ok"
  fi
fi

# ---- C2 HAZARD-DEMO: cat > destroys the destination when the producer yields nothing.
H="$TMPROOT/c2"; mkdir -p "$H"
printf 'a good SKILL.md that took a session to write\n' > "$H/SKILL.md"
cat > "$H/SKILL.md" < /dev/null
if [ ! -s "$H/SKILL.md" ]; then
  ok "C2 HAZARD-DEMO cat > left a 0-byte SKILL.md where a good one had been"
else
  bad "C2 HAZARD-DEMO cat > left a 0-byte SKILL.md where a good one had been" "size $(wc -c < "$H/SKILL.md")"
fi

# ---- C3 FIXED: atomic_write_from_stdin refuses the empty write and keeps the old file.
if need_lib "C3 atomic_write_from_stdin refuses an empty write and preserves the destination"; then
  H="$TMPROOT/c3"; mkdir -p "$H"
  printf 'a good SKILL.md that took a session to write\n' > "$H/SKILL.md"
  before_hash=$(hash_of "$H/SKILL.md")
  drive "$LIB_J" "$TMPROOT/norepo" atomic_write_from_stdin "$H/SKILL.md" < /dev/null > "$TMPROOT/c3.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/SKILL.md")
  strays=$(find "$H" -name '.SKILL.md.*' | wc -l | tr -d ' ')
  if [ "$rc" != 0 ] && [ "$before_hash" = "$after_hash" ] && [ "$strays" = 0 ]; then
    ok "C3 an empty write is refused, the destination is byte-identical, no sidecar remains"
  else
    bad "C3 an empty write is refused, the destination is byte-identical, no sidecar remains" \
        "rc=$rc hash $before_hash -> $after_hash strays=$strays"
  fi
  # and the real heredoc case still lands
  printf 'new content for the skill\n' | drive "$LIB_J" "$TMPROOT/norepo" atomic_write_from_stdin "$H/SKILL.md" >/dev/null 2>&1
  rc=$?
  if [ "$rc" = 0 ] && grep -q "new content for the skill" "$H/SKILL.md"; then
    ok "C3b a non-empty write lands"
  else
    bad "C3b a non-empty write lands" "rc=$rc content: $(cat "$H/SKILL.md")"
  fi
fi

# ---- C4 FIXED: atomic_write_from_stdin does not follow a destination symlink either.
if need_lib "C4 atomic_write_from_stdin replaces a destination symlink"; then
  H="$TMPROOT/c4"; mkdir -p "$H/skills" "$H/elsewhere"
  printf 'victim\n' > "$H/elsewhere/victim.md"
  ln -s "$H/elsewhere/victim.md" "$H/skills/SKILL.md"
  printf 'skill body\n' | drive "$LIB_J" "$TMPROOT/norepo" atomic_write_from_stdin "$H/skills/SKILL.md" >/dev/null 2>&1
  rc=$?
  if [ "$rc" = 0 ] && grep -q '^victim$' "$H/elsewhere/victim.md" && [ ! -L "$H/skills/SKILL.md" ]; then
    ok "C4 the heredoc write replaced the link and left the victim alone"
  else
    bad "C4 the heredoc write replaced the link and left the victim alone" \
        "rc=$rc victim: $(cat "$H/elsewhere/victim.md")"
  fi
fi

# ---- C5 FIXED: refusals that must not silently do nothing.
if need_lib "C5 missing source and directory destinations are refused"; then
  H="$TMPROOT/c5"; mkdir -p "$H/dstdir" "$H/realdir"
  printf 'content\n' > "$H/src.md"
  printf 'existing\n' > "$H/keep.md"
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_file "$H/nope.md" "$H/keep.md" > "$TMPROOT/c5a.out" 2>&1
  rc_a=$?
  intact=0; grep -q '^existing$' "$H/keep.md" && intact=1
  if [ "$rc_a" != 0 ] && [ "$intact" = 1 ]; then
    ok "C5 a missing source is refused and the destination is untouched"
  else
    bad "C5 a missing source is refused and the destination is untouched" "rc=$rc_a intact=$intact"
  fi
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_file "$H/src.md" "$H/realdir" > "$TMPROOT/c5b.out" 2>&1
  rc_b=$?
  if [ "$rc_b" != 0 ] && [ -z "$(ls -A "$H/realdir")" ]; then
    ok "C5b a directory destination is refused and nothing is written inside it"
  else
    bad "C5b a directory destination is refused and nothing is written inside it" "rc=$rc_b contents: $(ls -A "$H/realdir")"
  fi
  # The safe_cp lesson: a symlink TO a directory tests -d and -L, and `mv tmp link`
  # would move the file INSIDE the directory while returning 0 - silent success with
  # nothing written where the caller asked.
  ln -s "$H/dstdir" "$H/linktodir"
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_file "$H/src.md" "$H/linktodir" > "$TMPROOT/c5c.out" 2>&1
  rc_c=$?
  if [ "$rc_c" != 0 ] && [ -z "$(ls -A "$H/dstdir")" ]; then
    ok "C5c a symlink-to-directory destination is refused, not silently written into"
  else
    bad "C5c a symlink-to-directory destination is refused, not silently written into" \
        "rc=$rc_c contents: $(ls -A "$H/dstdir")"
  fi
fi

# ============================================================
# D. Installer-owned TREES (justify payload directories)
# ============================================================
echo
echo "--- D. installer-owned tree writes"

# ---- D0 HAZARD-DEMO: cp -r cannot get past a symlinked destination.
#
# The fixture mirrors the committed call exactly - `cp -r "$SCRIPT_DIR/server"
# "$JUSTIFY_DIR/"` lands on $JUSTIFY_DIR/server, so the planted link carries the source
# directory's own name.
#
# WHAT WAS ACTUALLY MEASURED, which is not what the hazard was first written up as: BSD
# cp does not follow the link and quietly write elsewhere. It FAILS - "Not a directory"
# for a link to a directory, "Permission denied" for a link to a file inside an existing
# destination. Under the installer's `set -euo pipefail` that failure aborts the run
# partway through the payload, and it aborts the same way on every re-run because nothing
# removes the link. GNU cp resolves the same shape by writing through the link instead.
# The row asserts the measured behaviour rather than the dramatic one.
H="$TMPROOT/d0"; mkdir -p "$H/server/nested" "$H/install" "$H/elsewhere"
printf 'source file\n' > "$H/server/a.ts"
printf 'nested\n' > "$H/server/nested/b.ts"
ln -s "$H/elsewhere" "$H/install/server"
cp -r "$H/server" "$H/install/" > "$TMPROOT/d0.out" 2>&1
demo_rc=$?
still_link=0; [ -L "$H/install/server" ] && still_link=1
if [ "$demo_rc" != 0 ] && [ "$still_link" = 1 ] && [ ! -f "$H/install/server/a.ts" ]; then
  ok "D0 HAZARD-DEMO cp -r hit the symlinked destination, failed (rc=$demo_rc), and left the link in place for the next run to fail on"
else
  bad "D0 HAZARD-DEMO cp -r hit the symlinked destination and failed" \
      "rc=$demo_rc still_link=$still_link; $(cat "$TMPROOT/d0.out")"
fi
# and the same shape one level down: a symlinked FILE inside an existing destination.
H2="$TMPROOT/d0b"; mkdir -p "$H2/server" "$H2/install/server" "$H2/elsewhere"
printf 'NEW SOURCE\n' > "$H2/server/index.ts"
printf 'the user own file\n' > "$H2/elsewhere/victim.ts"
ln -s "$H2/elsewhere/victim.ts" "$H2/install/server/index.ts"
cp -r "$H2/server" "$H2/install/" > "$TMPROOT/d0b.out" 2>&1
demo_rc=$?
if [ "$demo_rc" != 0 ]; then
  ok "D0b HAZARD-DEMO cp -r into a destination holding a symlinked file failed (rc=$demo_rc), aborting the install"
else
  bad "D0b HAZARD-DEMO cp -r into a destination holding a symlinked file failed, aborting the install" \
      "rc=$demo_rc; $(cat "$TMPROOT/d0b.out")"
fi

# ---- D1 FIXED: atomic_install_tree replaces the link.
if need_lib "D1 atomic_install_tree replaces a symlinked destination instead of following it"; then
  H="$TMPROOT/d1"; mkdir -p "$H/src/nested" "$H/install" "$H/elsewhere"
  printf 'source file\n' > "$H/src/a.ts"
  printf 'nested\n' > "$H/src/nested/b.ts"
  printf 'the users own thing\n' > "$H/elsewhere/keep.txt"
  ln -s "$H/elsewhere" "$H/install/server"
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_tree "$H/src" "$H/install/server" > "$TMPROOT/d1.out" 2>&1
  rc=$?
  victim_files=$(find "$H/elsewhere" -type f | wc -l | tr -d ' ')
  landed=0; [ -f "$H/install/server/a.ts" ] && [ -f "$H/install/server/nested/b.ts" ] && landed=1
  still_link=0; [ -L "$H/install/server" ] && still_link=1
  if [ "$rc" = 0 ] && [ "$victim_files" = 1 ] && [ "$landed" = 1 ] && [ "$still_link" = 0 ]; then
    ok "D1 the tree landed in the install dir, the link is gone, the victim dir still holds only its own file"
  else
    bad "D1 the tree landed in the install dir, the link is gone, the victim dir still holds only its own file" \
        "rc=$rc victim_files=$victim_files landed=$landed still_link=$still_link"
  fi
fi

# ---- D2 FIXED: the destination is REPLACED, so a file deleted upstream stops shipping.
if need_lib "D2 a file removed from the source stops appearing in the install"; then
  H="$TMPROOT/d2"; mkdir -p "$H/src" "$H/install/server"
  printf 'current\n' > "$H/src/a.ts"
  printf 'current\n' > "$H/install/server/a.ts"
  printf 'deleted upstream three releases ago\n' > "$H/install/server/stale.ts"
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_tree "$H/src" "$H/install/server" > "$TMPROOT/d2.out" 2>&1
  rc=$?
  if [ "$rc" = 0 ] && [ -f "$H/install/server/a.ts" ] && [ ! -e "$H/install/server/stale.ts" ]; then
    ok "D2 the stale file is gone and the current one is present"
  else
    bad "D2 the stale file is gone and the current one is present" \
        "rc=$rc contents: $(ls -A "$H/install/server" | tr '\n' ' ')"
  fi
fi

# ---- D3 FIXED: a missing source never removes what is already installed.
if need_lib "D3 a missing source leaves the installed tree in place"; then
  H="$TMPROOT/d3"; mkdir -p "$H/install/server"
  printf 'the working install\n' > "$H/install/server/a.ts"
  before_hash=$(hash_of "$H/install/server/a.ts")
  drive "$LIB_J" "$TMPROOT/norepo" atomic_install_tree "$H/nosuchdir" "$H/install/server" > "$TMPROOT/d3.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/install/server/a.ts")
  strays=$(find "$H/install" -maxdepth 1 -name '.server.*' | wc -l | tr -d ' ')
  if [ "$rc" != 0 ] && [ "$before_hash" = "$after_hash" ] && [ "$strays" = 0 ]; then
    ok "D3 a missing source is refused, the installed tree survives, no staging dir remains"
  else
    bad "D3 a missing source is refused, the installed tree survives, no staging dir remains" \
        "rc=$rc hash $before_hash -> $after_hash strays=$strays"
  fi
fi

# ---- D4 FIXED: the previous tree comes BACK if the swap-in fails.
# The first version of this helper ran `rm -rf "$dst"` and then `mv`. Independent review
# flagged the window between them: anything that stops the mv leaves the user with no
# installed tree at all. The helper now moves the old tree aside and restores it.
if need_lib "D4 a failed swap-in restores the previous tree"; then
  H="$TMPROOT/d4"; mkdir -p "$H/src" "$H/install/server"
  printf 'new\n' > "$H/src/a.ts"
  printf 'the working install\n' > "$H/install/server/a.ts"
  before_hash=$(hash_of "$H/install/server/a.ts")
  bash "$TMPROOT/drive-faulty-mv.sh" "$LIB_J" "$TMPROOT/norepo" "$H/install/server" \
    atomic_install_tree "$H/src" "$H/install/server" > "$TMPROOT/d4.out" 2>&1
  rc=$?
  after_hash=$(hash_of "$H/install/server/a.ts")
  strays=$(find "$H/install" -maxdepth 1 -name '.server.*' | wc -l | tr -d ' ')
  if [ "$rc" != 0 ] && [ "$before_hash" = "$after_hash" ] && [ "$strays" = 0 ]; then
    ok "D4 a failed swap-in put the previous tree back and left no staging directories"
  else
    bad "D4 a failed swap-in put the previous tree back and left no staging directories" \
        "rc=$rc hash $before_hash -> $after_hash strays=$strays; $(cat "$TMPROOT/d4.out")"
  fi
fi

# ---- D5 FIXED: the interrupt trap does not leak past the swap.
# The rollback for a ctrl-C between the two renames is an INT/TERM/HUP trap. A trap that
# is still armed after the helper returns would fire during a LATER stage of the install
# and try to restore a directory that is no longer being replaced, so every exit path
# clears it. This row is the reason that clearing is not on trust.
if need_lib "D5 atomic_install_tree leaves no trap armed"; then
  cat > "$TMPROOT/drive-traps.sh" <<'TRAPS'
lib="$1"; REPO_PHYS="$2"; src="$3"; dst="$4"
# shellcheck disable=SC1090
. "$lib" || exit 90
atomic_install_tree "$src" "$dst" || exit 91
trap -p INT TERM HUP
TRAPS
  H="$TMPROOT/d5"; mkdir -p "$H/src" "$H/install/server"
  printf 'new\n' > "$H/src/a.ts"
  printf 'old\n' > "$H/install/server/a.ts"
  leftover=$(bash "$TMPROOT/drive-traps.sh" "$LIB_J" "$TMPROOT/norepo" "$H/src" "$H/install/server" 2>&1)
  if [ -z "$leftover" ]; then
    ok "D5 no INT/TERM/HUP trap is left armed after the swap"
  else
    bad "D5 no INT/TERM/HUP trap is left armed after the swap" "$leftover"
  fi
fi

# ---- D6 FIXED: a signal landing between the two renames restores and STOPS.
#
# Driven with a real SIGTERM, not a call to the handler. `mv` is shadowed to sleep after
# the first rename, which is the seam - it holds the window open long enough to signal
# into, without changing which renames happen or in what order.
#
# The version this row was written against only RESTORED and let the shell resume, so
# `mv "$tmp" "$dst"` moved the staged tree INSIDE the directory it had just put back and
# the helper returned 0 - a success report over the old install. Hence the two assertions:
# the tree comes back AND the run does not continue.
if need_lib "D6 an interrupt between the renames restores the tree and stops the run"; then
  cat > "$TMPROOT/drive-slow-swap.sh" <<'SLOW'
lib="$1"; REPO_PHYS="$2"; src="$3"; dst="$4"
# Hold the window open on the SWAP-IN, not on the move-aside. The trap is armed between
# those two renames, so sleeping in the first one signals into a window where the handler
# does not exist yet and the process just dies on the default disposition - which is what
# the first version of this driver measured, and it looked like a missing rollback.
# The sleep happens once, so the handler's own restore rename is not delayed.
_held=0
mv() {
  if [ "$_held" = 0 ] && [ "${!#}" = "$dst" ]; then
    _held=1
    sleep 5
  fi
  command mv "$@"
}
# shellcheck disable=SC1090
. "$lib" || exit 90
atomic_install_tree "$src" "$dst"
echo "RESUMED-AND-RETURNED-$?"
SLOW
  H="$TMPROOT/d6"; mkdir -p "$H/src" "$H/install/server"
  printf 'new\n' > "$H/src/a.ts"
  printf 'the working install\n' > "$H/install/server/a.ts"
  bash "$TMPROOT/drive-slow-swap.sh" "$LIB_J" "$TMPROOT/norepo" "$H/src" "$H/install/server" \
    > "$TMPROOT/d6.out" 2>&1 &
  d6_pid=$!
  # WAIT FOR THE WINDOW TO OPEN. The window is the moment the destination does NOT exist,
  # so this spins while it still does. Written the other way round first, which made the
  # row a race that happened to pass once - exactly the shape of evidence this suite is
  # supposed to refuse.
  d6_wait=0
  while [ -e "$H/install/server" ] && [ "$d6_wait" -lt 40 ]; do
    d6_wait=$((d6_wait + 1))
    sleep 0.1
  done
  d6_window=1; [ "$d6_wait" -lt 40 ] || d6_window=0
  d6_killed=1; kill -TERM "$d6_pid" 2>/dev/null || d6_killed=0
  wait "$d6_pid" 2>/dev/null
  d6_rc=$?
  restored=0; grep -q 'the working install' "$H/install/server/a.ts" 2>/dev/null && restored=1
  resumed=0; grep -q 'RESUMED-AND-RETURNED' "$TMPROOT/d6.out" && resumed=1
  strays=$(find "$H/install" -maxdepth 1 -name '.server.*' | wc -l | tr -d ' ')
  # d6_window and d6_killed are the row's own honesty check. If the child had already
  # exited before the destination disappeared, the wait loop would time out, the kill would
  # hit nothing, the old tree would still be in place - and every other assertion here
  # would be satisfied by a run that never entered the window at all. Flagged by
  # independent review of this harness.
  if [ "$d6_window" = 1 ] && [ "$d6_killed" = 1 ] \
     && [ "$restored" = 1 ] && [ "$resumed" = 0 ] && [ "$d6_rc" != 0 ] && [ "$strays" = 0 ]; then
    ok "D6 SIGTERM delivered inside the window put the tree back, stopped the run (rc=$d6_rc), and left no staging directories"
  else
    bad "D6 SIGTERM delivered inside the window put the tree back, stopped the run, and left no staging directories" \
        "window-open=$d6_window killed=$d6_killed restored=$restored resumed=$resumed rc=$d6_rc strays=$strays; $(cat "$TMPROOT/d6.out")"
  fi
fi

# ============================================================
# E. Repo containment - no write may land in tracked source
# ============================================================
echo
echo "--- E. repo containment"

if need_lib "E1 refuse_repo_write refuses destinations that RESOLVE into the checkout"; then
  FAKEREPO="$TMPROOT/e1/repo"; mkdir -p "$FAKEREPO/claude/skills/lotus" "$TMPROOT/e1/home/skills"
  printf 'source with __LOTUS_SRC__\n' > "$FAKEREPO/claude/skills/lotus/SKILL.md"
  # a. a path spelled directly inside the repo
  drive "$LIB_L" "$FAKEREPO" refuse_repo_write "$FAKEREPO/claude/skills/lotus/SKILL.md" "test" >/dev/null 2>&1
  rc_direct=$?
  # b. a path OUTSIDE the repo whose parent is a symlink INTO it - the shape that
  #    string-matching the spelled path misses entirely
  ln -s "$FAKEREPO/claude/skills/lotus" "$TMPROOT/e1/home/skills/lotus"
  drive "$LIB_L" "$FAKEREPO" refuse_repo_write "$TMPROOT/e1/home/skills/lotus/SKILL.md" "test" >/dev/null 2>&1
  rc_linked=$?
  # c. an ordinary destination that must be allowed
  drive "$LIB_L" "$FAKEREPO" refuse_repo_write "$TMPROOT/e1/home/skills/SKILL.md" "test" >/dev/null 2>&1
  rc_ok=$?
  if [ "$rc_direct" != 0 ] && [ "$rc_linked" != 0 ] && [ "$rc_ok" = 0 ]; then
    ok "E1 direct and symlinked repo destinations are refused, an ordinary one is allowed"
  else
    bad "E1 direct and symlinked repo destinations are refused, an ordinary one is allowed" \
        "direct=$rc_direct linked=$rc_linked ordinary=$rc_ok"
  fi
fi

# ---- E2 HAZARD-DEMO: what the unguarded path did to tracked source.
H="$TMPROOT/e2"; mkdir -p "$H/repo/claude/skills/lotus" "$H/home/skills"
printf 'The source lives at __LOTUS_SRC__ (the repo dir).\n' > "$H/repo/claude/skills/lotus/SKILL.md"
ln -s "$H/repo/claude/skills/lotus" "$H/home/skills/lotus"
cp "$H/repo/claude/skills/lotus/SKILL.md" "$H/home/skills/lotus/SKILL.md" 2>/dev/null
perl -pe 's/\Q__LOTUS_SRC__\E/\/some\/abs\/path/g' "$H/home/skills/lotus/SKILL.md" > "$H/tmp.md" 2>/dev/null \
  && cp "$H/tmp.md" "$H/home/skills/lotus/SKILL.md"
if ! grep -q '__LOTUS_SRC__' "$H/repo/claude/skills/lotus/SKILL.md"; then
  ok "E2 HAZARD-DEMO the unguarded skill install baked an absolute path into TRACKED SOURCE"
else
  bad "E2 HAZARD-DEMO the unguarded skill install baked an absolute path into TRACKED SOURCE" \
      "tracked file still has the placeholder, so the fixture did not reach the hazard"
fi

# ---- E3 FIXED: the containment check answers BEFORE the directory is created.
# A guard that runs after `mkdir -p` has already made a directory in tracked source is a
# report, not a guard. Flagged by independent review.
if need_lib "E3 refuse_repo_mkdir answers for a directory that does not exist yet"; then
  FAKEREPO="$TMPROOT/e3/repo"; mkdir -p "$FAKEREPO/claude"
  drive "$LIB_L" "$FAKEREPO" refuse_repo_mkdir "$FAKEREPO/claude/skills/lotus" "test" >/dev/null 2>&1
  rc_deep=$?
  drive "$LIB_L" "$FAKEREPO" refuse_repo_mkdir "$TMPROOT/e3/home/.claude/skills/lotus" "test" >/dev/null 2>&1
  rc_ok=$?
  created=$(find "$FAKEREPO/claude" -type d | wc -l | tr -d ' ')
  if [ "$rc_deep" != 0 ] && [ "$rc_ok" = 0 ] && [ "$created" = 1 ]; then
    ok "E3 a not-yet-created directory inside the checkout is refused, an outside one allowed, and nothing was created either way"
  else
    bad "E3 a not-yet-created directory inside the checkout is refused, an outside one allowed, and nothing was created either way" \
        "inside=$rc_deep outside=$rc_ok dirs-under-repo=$created"
  fi
fi

# ============================================================
# F. The installers themselves, end to end, in a sandbox HOME
# ============================================================
echo
echo "--- F. end-to-end installer runs (sandbox HOME, stubbed toolchain)"

# A stub toolchain: node/npm/npx succeed and do nothing, so a run can reach the stages
# after the build without a network. python3 and the coreutils pass through.
STUBBIN="$TMPROOT/stubbin"; mkdir -p "$STUBBIN"
# EVERY STUB RECORDS THAT IT RAN. Without this, a row asserting "refused BEFORE the build"
# proves only that the run exited 3 at some point - a regression that moved the guard to
# AFTER the build would still exit 3, with the victim file untouched only because the stub
# writes nothing. Flagged by independent review of this harness. $STUB_SENTINEL is set
# per-row; when it is unset the stubs record nothing and behave exactly as before.
for t in node npm npx; do
  cat > "$STUBBIN/$t" <<STUB
#!/bin/sh
[ -n "\${STUB_SENTINEL:-}" ] && echo "$t \$*" >> "\$STUB_SENTINEL"
exit 0
STUB
  chmod +x "$STUBBIN/$t"
done
STUBPATH="$STUBBIN:/usr/bin:/bin:/usr/sbin:/sbin"

# PRECONDITION FOR EVERY ROW THAT DRIVES justify/install.sh PAST ITS BUILD GATE.
#
# The installer picks the first writable of /usr/local/bin, /opt/homebrew/bin,
# ~/.local/bin and plants shims there. Its temp-HOME guard is what stops a sandboxed run
# from planting them in a SHARED bin - and on 2026-07-28 that guard had a /private blind
# spot, so an early version of this suite planted eight shims in /opt/homebrew/bin
# pointing into $TMPROOT. They had to be restored by hand.
#
# So the guard is verified BEFORE any row is allowed to reach the shim stage - and that
# means EVERY justify run, not the ones that obviously get that far. The first version of
# this gate covered only the two rows whose fixtures were designed to reach the shim
# stage; then the negative control ran the suite against pristine HEAD, where there is no
# build gate at all, so the very first justify row marched straight through to the shims
# and planted eight of them again. A harness that can damage the machine when the code it
# tests regresses is not a harness, and "regressed" includes "older".
shim_guard_ok(){
  local f="$1"
  grep -q '/private/var/folders/\*' "$f" && grep -q 'JUSTIFY_DIR_PHYS=' "$f"
}
SHARED_BIN_WRITABLE=0
for d in /usr/local/bin /opt/homebrew/bin; do
  [ -d "$d" ] && [ -w "$d" ] && SHARED_BIN_WRITABLE=1
done
if shim_guard_ok "$JUSTIFY_INSTALLER"; then
  ok "F0 justify's temp-HOME shim guard resolves the physical path and covers the /private spellings"
  SHIM_STAGE_SAFE=1
elif [ "$SHARED_BIN_WRITABLE" = 0 ]; then
  bad "F0 justify's temp-HOME shim guard resolves the physical path and covers the /private spellings" \
      "no shared bin is writable here, so the rows below still run"
  SHIM_STAGE_SAFE=1
else
  bad "F0 justify's temp-HOME shim guard resolves the physical path and covers the /private spellings" \
      "a shared bin IS writable and the guard is not verifiable - refusing to run the rows that reach the shim stage"
  SHIM_STAGE_SAFE=0
fi

# --- F1/F2: justify. Stage a minimal source tree next to a copy of the real installer.
stage_justify(){   # <dest-root>
  local root="$1"
  mkdir -p "$root/justify/server" "$root/justify/core" "$root/justify/adapters" \
           "$root/justify/assets" "$root/justify/cli"
  printf 'export const x = 1;\n' > "$root/justify/server/index.ts"
  printf 'export const c = 1;\n' > "$root/justify/core/core.ts"
  printf 'export const a = 1;\n' > "$root/justify/adapters/adapter.ts"
  printf '<svg></svg>\n' > "$root/justify/assets/spark-idle.svg"
  printf '{ "name": "justify" }\n' > "$root/justify/package.json"
  for t in tsconfig.json tsconfig.server.json tsconfig.core.json; do
    printf '{}\n' > "$root/justify/$t"
  done
  printf 'console.log("build");\n' > "$root/justify/build.js"
  for c in init remove justify-watch justify-done justify-serve justify-worker \
           justify-watch-arm justify-watch-disarm; do
    printf '#!/bin/bash\necho %s\n' "$c" > "$root/justify/cli/$c.sh"
  done
  cp "$JUSTIFY_INSTALLER" "$root/justify/install.sh"
}

FJ="$TMPROOT/f1-repo"; FJH="$TMPROOT/f1-home"; mkdir -p "$FJH"
stage_justify "$FJ"
out="$TMPROOT/f1.out"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJH" PATH="$STUBPATH" bash "$FJ/justify/install.sh" > "$out" 2>&1
  rc=$?
else
  printf 'SKIPPED - the shim guard could not be verified\n' > "$out"
fi
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F1 justify exits 4 when the build produced no dist artifacts" "not run - see F0"
  bad "F1b the gate stopped the run before the CLI install, the shims and the registration" "not run - see F0"
  bad "F1c the payload trees still installed before the gate fired" "not run - see F0"
elif [ "$rc" = 4 ] && grep -q "did not produce" "$out"; then
  ok "F1 justify exits 4 when the build produced no dist artifacts"
else
  bad "F1 justify exits 4 when the build produced no dist artifacts" "rc=$rc; $(tail -5 "$out")"
fi
# NOT an assertion that ~/.claude.json is absent: a sandboxed justify run always stops at
# the temp-HOME shim guard before the registration, so that would be green whatever the
# gate did. What the gate is proven to do is stop the run BEFORE the stages after it -
# the CLI install is the first of them.
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  :
elif [ ! -e "$FJH/.claude/justify/init.sh" ] && [ ! -e "$FJH/.claude.json" ]; then
  ok "F1b the gate stopped the run before the CLI install, the shims and the registration"
else
  bad "F1b the gate stopped the run before the CLI install, the shims and the registration" \
      "found: $(find "$FJH/.claude" -type f 2>/dev/null | head -4 | tr '\n' ' ')"
fi
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  :
elif [ -f "$FJH/.claude/justify/server/index.ts" ]; then
  ok "F1c the payload trees still installed before the gate fired"
else
  bad "F1c the payload trees still installed before the gate fired" "$(find "$FJH/.claude/justify" -maxdepth 1 2>/dev/null | tr '\n' ' ')"
fi

# F2: same run with the artifacts present. The installer must clear the gate and reach
# the shim stage, where the pre-existing temp-HOME guard stops it - which is also the
# proof that this suite never plants a symlink in a shared bin.
FJ2="$TMPROOT/f2-repo"; FJ2H="$TMPROOT/f2-home"; mkdir -p "$FJ2H"
stage_justify "$FJ2"
mkdir -p "$FJ2H/.claude/justify/dist/server"
printf '// core\n' > "$FJ2H/.claude/justify/dist/justify-core.js"
printf '// server\n' > "$FJ2H/.claude/justify/dist/server/index.js"
real_shim_before="$(shim_snapshot)"
out="$TMPROOT/f2.out"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ2H" PATH="$STUBPATH" bash "$FJ2/justify/install.sh" > "$out" 2>&1
  rc=$?
else
  printf 'SKIPPED - the shim guard could not be verified\n' > "$out"
fi
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F2 justify clears the artifact gate when the build output exists" "not run - see F0"
  bad "F2b the pre-existing temp-HOME shim guard stopped the run before any shared bin was touched" "not run - see F0"
elif grep -q "did not produce" "$out"; then
  bad "F2 justify clears the artifact gate when the build output exists" "$(grep 'did not produce' "$out")"
else
  ok "F2 justify clears the artifact gate when the build output exists"
fi
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  :
elif [ "$rc" = 1 ] && grep -q "Refusing to plant shims" "$out"; then
  ok "F2b the temp-HOME shim guard stopped the run before any shared bin was touched"
else
  bad "F2b the temp-HOME shim guard stopped the run before any shared bin was touched" \
      "rc=$rc; $(tail -5 "$out")"
fi
real_shim_after="$(shim_snapshot)"
if [ "$real_shim_before" = "$real_shim_after" ]; then
  ok "F2c all sixteen shared-bin shim entries are unchanged across the justify runs"
else
  bad "F2c all sixteen shared-bin shim entries are unchanged across the justify runs" \
      "$(printf '%s\n' "$real_shim_before" | diff - <(printf '%s\n' "$real_shim_after") | head -6)"
fi

# --- F3..F6: lotus runs to completion, so it gets the full end-to-end assertions.
stage_lotus(){   # <dest-root>
  local root="$1"
  mkdir -p "$root/lotus/mcp-server/dist" "$root/lotus/dist" "$root/claude/skills/lotus"
  printf '{ "name": "lotus" }\n' > "$root/lotus/package.json"
  printf '{ "name": "lotus-mcp" }\n' > "$root/lotus/mcp-server/package.json"
  printf 'The source lives at __LOTUS_SRC__ and the bridge is on 9527.\n' \
    > "$root/claude/skills/lotus/SKILL.md"
  cp "$LOTUS_INSTALLER" "$root/lotus/install.sh"
}
seed_lotus_artifacts(){   # <dest-root>
  printf '// plugin\n' > "$1/lotus/dist/code.js"
  printf '<html></html>\n' > "$1/lotus/dist/ui.html"
  printf '// mcp\n' > "$1/lotus/mcp-server/dist/server.js"
}

FL="$TMPROOT/f3-repo"; FLH="$TMPROOT/f3-home"; mkdir -p "$FLH"
stage_lotus "$FL"
out="$TMPROOT/f3.out"
HOME="$FLH" PATH="$STUBPATH" bash "$FL/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 4 ] && grep -q "did not produce" "$out"; then
  ok "F3 lotus exits 4 when the builds produced no artifacts"
else
  bad "F3 lotus exits 4 when the builds produced no artifacts" "rc=$rc; $(tail -5 "$out")"
fi
if [ ! -e "$FLH/.claude.json" ] && [ ! -e "$FLH/.claude/skills/lotus/SKILL.md" ]; then
  ok "F3b nothing downstream of the failed build was written"
else
  bad "F3b nothing downstream of the failed build was written" "$(find "$FLH/.claude" "$FLH/.claude.json" -type f 2>/dev/null | head -4 | tr '\n' ' ')"
fi

FL2="$TMPROOT/f4-repo"; FL2H="$TMPROOT/f4-home"; mkdir -p "$FL2H"
stage_lotus "$FL2"; seed_lotus_artifacts "$FL2"
seed_config "$FL2H/.claude.json"
out="$TMPROOT/f4.out"
HOME="$FL2H" PATH="$STUBPATH" bash "$FL2/lotus/install.sh" > "$out" 2>&1
rc=$?
verdict=$(python3 - "$FL2H/.claude.json" "$FL2/lotus/mcp-server/dist/server.js" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
problems = []
if len(d.get("projects", {})) != 8: problems.append("projects lost")
if d.get("mcpServers", {}).get("pencil", {}).get("command") != "node": problems.append("pencil lost")
e = d.get("mcpServers", {}).get("lotus")
if not e: problems.append("lotus missing")
elif e.get("args") != [sys.argv[2]]: problems.append("lotus args wrong: %r" % (e.get("args"),))
print(";".join(problems) if problems else "CLEAN")
PY
)
if [ "$rc" = 0 ] && [ "$verdict" = CLEAN ]; then
  ok "F4 lotus installs end to end and merges into the config without losing a key"
else
  bad "F4 lotus installs end to end and merges into the config without losing a key" "rc=$rc verdict=$verdict; $(tail -5 "$out")"
fi
if grep -q "$FL2/lotus" "$FL2H/.claude/skills/lotus/SKILL.md" 2>/dev/null \
   && ! grep -q '__LOTUS_SRC__' "$FL2H/.claude/skills/lotus/SKILL.md" 2>/dev/null; then
  ok "F4b the skill installed with the source path baked in and no placeholder left"
else
  bad "F4b the skill installed with the source path baked in and no placeholder left" \
      "$(head -2 "$FL2H/.claude/skills/lotus/SKILL.md" 2>/dev/null)"
fi
if grep -q '__LOTUS_SRC__' "$FL2/claude/skills/lotus/SKILL.md"; then
  ok "F4c the tracked source SKILL.md still holds its placeholder"
else
  bad "F4c the tracked source SKILL.md still holds its placeholder" "the install rewrote its own source"
fi

# F5: the skill destination is a symlink pointing at a file the installer does not own.
FL3="$TMPROOT/f5-repo"; FL3H="$TMPROOT/f5-home"; mkdir -p "$FL3H/.claude/skills/lotus" "$TMPROOT/f5-victim"
stage_lotus "$FL3"; seed_lotus_artifacts "$FL3"
printf 'a file the user wrote\n' > "$TMPROOT/f5-victim/notes.md"
ln -s "$TMPROOT/f5-victim/notes.md" "$FL3H/.claude/skills/lotus/SKILL.md"
out="$TMPROOT/f5.out"
HOME="$FL3H" PATH="$STUBPATH" bash "$FL3/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 0 ] && grep -q 'a file the user wrote' "$TMPROOT/f5-victim/notes.md"; then
  ok "F5 a symlinked SKILL.md destination did not send the install into the user's file"
else
  bad "F5 a symlinked SKILL.md destination did not send the install into the user's file" \
      "rc=$rc victim: $(cat "$TMPROOT/f5-victim/notes.md")"
fi

# F6: the skill directory is a symlink INTO the checkout - the payload-source cycle.
FL4="$TMPROOT/f6-repo"; FL4H="$TMPROOT/f6-home"; mkdir -p "$FL4H/.claude/skills"
stage_lotus "$FL4"; seed_lotus_artifacts "$FL4"
ln -s "$FL4/claude/skills/lotus" "$FL4H/.claude/skills/lotus"
out="$TMPROOT/f6.out"
HOME="$FL4H" PATH="$STUBPATH" bash "$FL4/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 3 ] && grep -q '__LOTUS_SRC__' "$FL4/claude/skills/lotus/SKILL.md"; then
  ok "F6 a skill dir symlinked into the checkout is refused (exit 3) and tracked source keeps its placeholder"
else
  bad "F6 a skill dir symlinked into the checkout is refused (exit 3) and tracked source keeps its placeholder" \
      "rc=$rc; $(tail -3 "$out")"
fi

# F7: a build STEP that fails is fatal, not a warning.
# The first repair here only checked that the artifacts exist, which independent review
# rejected: on a re-install yesterday's dist/ satisfies that check while today's build
# failed, and the same false success survives in a narrower window.
FJ4="$TMPROOT/f7-repo"; FJ4H="$TMPROOT/f7-home"; mkdir -p "$FJ4H"
stage_justify "$FJ4"
# stale artifacts from a previous good build, exactly the shape that used to slip through
mkdir -p "$FJ4H/.claude/justify/dist/server"
printf '// yesterday\n' > "$FJ4H/.claude/justify/dist/justify-core.js"
printf '// yesterday\n' > "$FJ4H/.claude/justify/dist/server/index.js"
FAILBIN="$TMPROOT/failbin"; mkdir -p "$FAILBIN"
printf '#!/bin/sh\nexit 0\n' > "$FAILBIN/node";  chmod +x "$FAILBIN/node"
printf '#!/bin/sh\nexit 0\n' > "$FAILBIN/npx";   chmod +x "$FAILBIN/npx"
printf '#!/bin/sh\ncase "$1" in install) exit 1 ;; esac\nexit 0\n' > "$FAILBIN/npm"; chmod +x "$FAILBIN/npm"
out="$TMPROOT/f7.out"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ4H" PATH="$FAILBIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$FJ4/justify/install.sh" > "$out" 2>&1
  rc=$?
fi
# The proxy for "nothing downstream ran" is the CLI install, the first stage after the
# build - NOT the absence of ~/.claude.json, which a sandboxed justify run never reaches
# anyway because the shim guard stops it first. An assertion that is satisfied for a
# reason other than the one it names is the failure mode this whole suite is about.
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F7 a failed build step is fatal (exit 4) even with stale artifacts sitting in dist/" "not run - see F0"
elif [ "$rc" = 4 ] && grep -q "npm install failed" "$out" \
     && [ ! -e "$FJ4H/.claude/justify/init.sh" ] && [ ! -e "$FJ4H/.claude.json" ]; then
  ok "F7 a failed build step is fatal (exit 4) even with stale artifacts sitting in dist/"
else
  bad "F7 a failed build step is fatal (exit 4) even with stale artifacts sitting in dist/" \
      "rc=$rc; $(tail -3 "$out")"
fi

# F8: a symlink at a BUILD OUTPUT path, one level below the install root.
# The root containment check says nothing about $JUSTIFY_DIR/dist, and npm and tsc write
# through a link there without noticing. Flagged by independent review.
FJ5="$TMPROOT/f8-repo"; FJ5H="$TMPROOT/f8-home"; mkdir -p "$FJ5H/.claude/justify" "$TMPROOT/f8-victim"
stage_justify "$FJ5"
printf 'the user own build output\n' > "$TMPROOT/f8-victim/keep.txt"
ln -s "$TMPROOT/f8-victim" "$FJ5H/.claude/justify/dist"
out="$TMPROOT/f8.out"; sentinel="$TMPROOT/f8.ran"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ5H" PATH="$STUBPATH" STUB_SENTINEL="$sentinel" bash "$FJ5/justify/install.sh" > "$out" 2>&1
  rc=$?
fi
victim_files=$(find "$TMPROOT/f8-victim" -type f | wc -l | tr -d ' ')
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F8 a symlinked dist/ is refused (exit 3) before any build writes through it" "not run - see F0"
elif [ "$rc" = 3 ] && grep -q "outside" "$out" && [ "$victim_files" = 1 ] && [ ! -e "$sentinel" ]; then
  ok "F8 a symlinked dist/ is refused (exit 3) with no build tool having been invoked at all"
else
  bad "F8 a symlinked dist/ is refused (exit 3) with no build tool having been invoked at all" \
      "rc=$rc victim_files=$victim_files build-ran=$([ -e "$sentinel" ] && echo yes || echo no); $(tail -3 "$out")"
fi

# F9: the shim verification, checked structurally.
#
# STATED PLAINLY BECAUSE IT MATTERS: this row does NOT drive the shim stage. That stage is
# unreachable from a sandbox - the temp-HOME guard (correctly) refuses to run it when
# BIN_DIR is a shared bin, and BIN_DIR is only ever /usr/local/bin, /opt/homebrew/bin or
# ~/.local/bin, never a path under the sandbox install root. Driving it for real would
# mean letting the suite write to the machine's PATH, which is exactly what F0 exists to
# prevent. So the three conditions independent review asked for are asserted as text.
shim_checks=0
grep -q 'if \[ ! -L "\$BIN_DIR/\$shim" \]' "$JUSTIFY_INSTALLER" && shim_checks=$((shim_checks + 1))
grep -q 'readlink "\$BIN_DIR/\$shim"' "$JUSTIFY_INSTALLER" && shim_checks=$((shim_checks + 1))
grep -q 'if \[ ! -e "\$BIN_DIR/\$shim" \]' "$JUSTIFY_INSTALLER" && shim_checks=$((shim_checks + 1))
grep -q 'is a directory - refusing to link inside it' "$JUSTIFY_INSTALLER" && shim_checks=$((shim_checks + 1))
grep -q 'existing file this installer did not create' "$JUSTIFY_INSTALLER" && shim_checks=$((shim_checks + 1))
if [ "$shim_checks" = 5 ]; then
  ok "F9 STRUCTURAL-ONLY: the shim stage's five checks are present in the source"
else
  bad "F9 STRUCTURAL-ONLY: the shim stage's five checks are present in the source" \
      "only $shim_checks of 5 found"
fi
# The row above counts strings, so it can be satisfied by text in a comment. This one
# proves it is at least watching the right text: remove one check from a staged copy and
# the count must drop. It does NOT prove the checks execute - nothing here can, for the
# reason stated above - and the row name says STRUCTURAL-ONLY so no reader has to infer it.
FJSHIM="$TMPROOT/f9-repo"; stage_justify "$FJSHIM"
mres=$(mutate "$FJSHIM/justify/install.sh" '  elif [ "$(readlink "$BIN_DIR/$shim")" != "$JUSTIFY_DIR/$target" ]; then' '  elif false; then' 1)
mutated_checks=1
grep -q 'readlink "\$BIN_DIR/\$shim")" != ' "$FJSHIM/justify/install.sh" || mutated_checks=0
if [ "$mres" = OK ] && [ "$mutated_checks" = 0 ]; then
  ok "F9b removing a check from a staged copy makes the structural row stop finding it"
elif [ "$mres" != OK ]; then
  bad "F9b removing a check from a staged copy makes the structural row stop finding it" "mutation did not apply: $mres"
else
  bad "F9b removing a check from a staged copy makes the structural row stop finding it" \
      "the grep still matched after the check was removed - it is matching something else"
fi

# F10: a symlink NESTED inside dist/, which the top-level guard does not see.
# tsc writes dist/server and esbuild writes the bundle; a link at either sends the build
# somewhere the installer does not own, and the `-f` artifact check then follows it and
# reports the build fine. Second review pass.
FJ8="$TMPROOT/f10-repo"; FJ8H="$TMPROOT/f10-home"
mkdir -p "$FJ8H/.claude/justify/dist" "$TMPROOT/f10-victim"
stage_justify "$FJ8"
printf 'the user own directory\n' > "$TMPROOT/f10-victim/keep.txt"
ln -s "$TMPROOT/f10-victim" "$FJ8H/.claude/justify/dist/server"
out="$TMPROOT/f10.out"; sentinel="$TMPROOT/f10.ran"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ8H" PATH="$STUBPATH" STUB_SENTINEL="$sentinel" bash "$FJ8/justify/install.sh" > "$out" 2>&1
  rc=$?
fi
victim_files=$(find "$TMPROOT/f10-victim" -type f | wc -l | tr -d ' ')
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F10 a symlink nested inside dist/ is refused before the build runs" "not run - see F0"
elif [ "$rc" = 3 ] && [ "$victim_files" = 1 ] && [ ! -e "$sentinel" ]; then
  ok "F10 a symlink nested inside dist/ is refused (exit 3) with no build tool having been invoked"
else
  bad "F10 a symlink nested inside dist/ is refused (exit 3) with no build tool having been invoked" \
      "rc=$rc victim_files=$victim_files build-ran=$([ -e "$sentinel" ] && echo yes || echo no); $(tail -3 "$out")"
fi

# F11: an ARTIFACT that is itself a link out of the install.
# `-f` follows it, so existence alone says nothing about where the build actually wrote.
FJ9="$TMPROOT/f11-repo"; FJ9H="$TMPROOT/f11-home"
mkdir -p "$FJ9H/.claude/justify/dist/server" "$TMPROOT/f11-victim"
stage_justify "$FJ9"
printf '// somebody elses bundle\n' > "$TMPROOT/f11-victim/core.js"
ln -s "$TMPROOT/f11-victim/core.js" "$FJ9H/.claude/justify/dist/justify-core.js"
printf '// server\n' > "$FJ9H/.claude/justify/dist/server/index.js"
out="$TMPROOT/f11.out"; sentinel="$TMPROOT/f11.ran"
rc=0
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ9H" PATH="$STUBPATH" STUB_SENTINEL="$sentinel" bash "$FJ9/justify/install.sh" > "$out" 2>&1
  rc=$?
fi
# `rc != 0` alone would be satisfied by the run sailing past both guards and stopping at
# the temp-HOME shim guard instead - a different refusal wearing this row's name. So the
# row demands a specific exit code, the guard's own message, and that no build tool ran.
#
# WHICH guard catches this fixture, measured rather than assumed: the recursive dist/ scan
# does, before the build, with exit 3 - not the artifact gate, which sits after the build
# as the second net. That ordering is the better one and this row pins it. The second net
# is proven separately by G12, which disables the scan so the gate is the only thing left.
if [ "$SHIM_STAGE_SAFE" != 1 ]; then
  bad "F11 an artifact that is a symlink out of the install is refused before the build" "not run - see F0"
elif [ "$rc" = 3 ] && grep -q "outside" "$out" && [ ! -e "$sentinel" ] \
     && [ ! -e "$FJ9H/.claude/justify/init.sh" ] && [ ! -e "$FJ9H/.claude.json" ]; then
  ok "F11 an artifact that is a symlink out of the install is refused (exit 3) before any build tool runs"
else
  bad "F11 an artifact that is a symlink out of the install is refused (exit 3) before any build tool runs" \
      "rc=$rc build-ran=$([ -e "$sentinel" ] && echo yes || echo no); $(tail -3 "$out")"
fi

# F12: lotus, a failed build step is fatal even with stale artifacts present.
# `(...) || { echo ...; }` returned the exit status of the ECHO, so the whole statement
# was 0 and `set -e` never saw the failure at all. Flagged by independent review.
FL6="$TMPROOT/f12-repo"; FL6H="$TMPROOT/f12-home"; mkdir -p "$FL6H"
stage_lotus "$FL6"; seed_lotus_artifacts "$FL6"
out="$TMPROOT/f12.out"
HOME="$FL6H" PATH="$FAILBIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$FL6/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 4 ] && grep -q "plugin build failed" "$out" && [ ! -e "$FL6H/.claude.json" ]; then
  ok "F12 lotus treats a failed build step as fatal (exit 4) even with stale artifacts present"
else
  bad "F12 lotus treats a failed build step as fatal (exit 4) even with stale artifacts present" \
      "rc=$rc; $(tail -3 "$out")"
fi

# F13: lotus, a symlinked build output inside the checkout's own lotus/ tree.
FL7="$TMPROOT/f13-repo"; FL7H="$TMPROOT/f13-home"; mkdir -p "$FL7H" "$TMPROOT/f13-victim"
stage_lotus "$FL7"; seed_lotus_artifacts "$FL7"
printf 'the user own output\n' > "$TMPROOT/f13-victim/keep.txt"
rm -rf "$FL7/lotus/mcp-server/dist"
ln -s "$TMPROOT/f13-victim" "$FL7/lotus/mcp-server/dist"
out="$TMPROOT/f13.out"; sentinel="$TMPROOT/f13.ran"
HOME="$FL7H" PATH="$STUBPATH" STUB_SENTINEL="$sentinel" bash "$FL7/lotus/install.sh" > "$out" 2>&1
rc=$?
victim_files=$(find "$TMPROOT/f13-victim" -type f | wc -l | tr -d ' ')
if [ "$rc" = 3 ] && [ "$victim_files" = 1 ] && [ ! -e "$FL7H/.claude.json" ] && [ ! -e "$sentinel" ]; then
  ok "F13 lotus refuses a symlinked build output (exit 3) with neither webpack nor tsc having been invoked"
else
  bad "F13 lotus refuses a symlinked build output (exit 3) with neither webpack nor tsc having been invoked" \
      "rc=$rc victim_files=$victim_files build-ran=$([ -e "$sentinel" ] && echo yes || echo no); $(tail -3 "$out")"
fi

# F14: the skill DIRECTORY is a symlink out of ~/.claude/skills.
# A symlink at SKILL.md is replaced rather than followed; a symlink at the containing
# directory is a different hole, and it takes the baked absolute path with it.
FL8="$TMPROOT/f14-repo"; FL8H="$TMPROOT/f14-home"
mkdir -p "$FL8H/.claude/skills" "$TMPROOT/f14-victim"
stage_lotus "$FL8"; seed_lotus_artifacts "$FL8"
printf 'the user own notes\n' > "$TMPROOT/f14-victim/SKILL.md"
ln -s "$TMPROOT/f14-victim" "$FL8H/.claude/skills/lotus"
out="$TMPROOT/f14.out"
HOME="$FL8H" PATH="$STUBPATH" bash "$FL8/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 3 ] && grep -q '^the user own notes$' "$TMPROOT/f14-victim/SKILL.md"; then
  ok "F14 a skill directory symlinked out of ~/.claude/skills is refused (exit 3) and the file behind it is untouched"
else
  bad "F14 a skill directory symlinked out of ~/.claude/skills is refused (exit 3) and the file behind it is untouched" \
      "rc=$rc victim: $(cat "$TMPROOT/f14-victim/SKILL.md")"
fi

# F15: a link NESTED in lotus's build output, at a path the artifact list never names.
# tsc emits bridge.js and tools.js beside server.js; naming only the advertised artifacts
# leaves those open. Third review pass.
FL11="$TMPROOT/f15-repo"; FL11H="$TMPROOT/f15-home"; mkdir -p "$FL11H" "$TMPROOT/f15-victim"
stage_lotus "$FL11"; seed_lotus_artifacts "$FL11"
printf 'the user own file\n' > "$TMPROOT/f15-victim/bridge.js"
ln -s "$TMPROOT/f15-victim/bridge.js" "$FL11/lotus/mcp-server/dist/bridge.js"
out="$TMPROOT/f15.out"; sentinel="$TMPROOT/f15.ran"
HOME="$FL11H" PATH="$STUBPATH" STUB_SENTINEL="$sentinel" bash "$FL11/lotus/install.sh" > "$out" 2>&1
rc=$?
if [ "$rc" = 3 ] && grep -q '^the user own file$' "$TMPROOT/f15-victim/bridge.js" \
   && [ ! -e "$FL11H/.claude.json" ] && [ ! -e "$sentinel" ]; then
  ok "F15 a link nested in lotus's build output is refused (exit 3) with no build tool having been invoked"
else
  bad "F15 a link nested in lotus's build output is refused (exit 3) with no build tool having been invoked" \
      "rc=$rc build-ran=$([ -e "$sentinel" ] && echo yes || echo no); $(tail -3 "$out")"
fi

# ============================================================
# G. Mutation control - every assertion above must be able to fail
# ============================================================
echo
echo "--- G. mutation control"

if [ "$LIB_OK" = 1 ]; then
  # ---- G1: register_mcp_server resolves the symlink. Break it and B3 must go RED.
  M="$TMPROOT/g1"; mkdir -p "$M/dotfiles"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" 'target = os.path.realpath(path)' 'target = path' 1)
  seed_config "$M/dotfiles/claude.json"
  ln -s "$M/dotfiles/claude.json" "$M/.claude.json"
  drive "$M/lib.sh" "$TMPROOT/norepo" register_mcp_server "$M/.claude.json" justify node /x.js >/dev/null 2>&1
  # B3 asserts the link survives. Violated when it no longer does.
  violated=0; [ -L "$M/.claude.json" ] || violated=1
  mutation_row "G1 mutating the realpath resolution turns B3 RED (the user's symlink is destroyed)" "$mres" "$violated"

  # ---- G2: the unparseable-config refusal. Break it and B4 must go RED.
  M="$TMPROOT/g2"; mkdir -p "$M"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" '            sys.exit(3)
    if not isinstance(data, dict):' '            data = {}
    if not isinstance(data, dict):' 1)
  printf '{ not json\n' > "$M/.claude.json"
  before_hash=$(hash_of "$M/.claude.json")
  drive "$M/lib.sh" "$TMPROOT/norepo" register_mcp_server "$M/.claude.json" justify node /x.js >/dev/null 2>&1
  after_hash=$(hash_of "$M/.claude.json")
  # B4 asserts the unparseable config is byte-identical afterwards. Violated when it is not.
  violated=0; [ "$before_hash" = "$after_hash" ] || violated=1
  mutation_row "G2 mutating the parse-failure refusal turns B4 RED (the config is rewritten from scratch)" "$mres" "$violated"

  # ---- G3: atomic_install_file's rename. Break it and C1 must go RED.
  M="$TMPROOT/g3"; mkdir -p "$M/skills" "$M/elsewhere"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" 'if ! mv -f "$tmp" "$dst"; then
    rm -f "$tmp"
    echo "ERROR: could not move the staged copy into place at $dst" >&2' 'if ! cp "$tmp" "$dst"; then
    rm -f "$tmp"
    echo "ERROR: could not move the staged copy into place at $dst" >&2' 1)
  printf 'the user precious file\n' > "$M/elsewhere/victim.md"
  printf 'installed\n' > "$M/source.md"
  ln -s "$M/elsewhere/victim.md" "$M/skills/SKILL.md"
  drive "$M/lib.sh" "$TMPROOT/norepo" atomic_install_file "$M/source.md" "$M/skills/SKILL.md" >/dev/null 2>&1
  # C1 asserts the victim outside the install dir is untouched. Violated when it is not.
  violated=0; grep -q 'the user precious file' "$M/elsewhere/victim.md" || violated=1
  mutation_row "G3 mutating the rename to a copy turns C1 RED (the write follows the symlink again)" "$mres" "$violated"

  # ---- G4: atomic_write_from_stdin's empty refusal. Break it and C3 must go RED.
  M="$TMPROOT/g4"; mkdir -p "$M"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" 'if [ ! -s "$tmp" ]; then' 'if false; then' 1)
  printf 'a good SKILL.md\n' > "$M/SKILL.md"
  before_hash=$(hash_of "$M/SKILL.md")
  drive "$M/lib.sh" "$TMPROOT/norepo" atomic_write_from_stdin "$M/SKILL.md" < /dev/null >/dev/null 2>&1
  after_hash=$(hash_of "$M/SKILL.md")
  # C3 asserts the destination survives an empty write. Violated when it does not.
  violated=0; [ "$before_hash" = "$after_hash" ] || violated=1
  mutation_row "G4 mutating the empty-write refusal turns C3 RED (a 0-byte SKILL.md is installed)" "$mres" "$violated"

  # ---- G5: atomic_install_tree's pre-swap removal. Break it and D2 must go RED.
  M="$TMPROOT/g5"; mkdir -p "$M/src" "$M/install/server"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" 'if [ -e "$dst" ] || [ -L "$dst" ]; then' 'if false; then' 1)
  printf 'current\n' > "$M/src/a.ts"
  printf 'stale\n' > "$M/install/server/stale.ts"
  drive "$M/lib.sh" "$TMPROOT/norepo" atomic_install_tree "$M/src" "$M/install/server" >/dev/null 2>&1
  # D2 asserts the stale file is gone. Violated when it is still there.
  violated=0; [ -e "$M/install/server/stale.ts" ] && violated=1
  mutation_row "G5 mutating the pre-swap removal turns D2 RED (the stale file survives the install)" "$mres" "$violated"

  # ---- G6: refuse_repo_write checks the RESOLVED path. Break it and E1(b) must go RED.
  M="$TMPROOT/g6"; mkdir -p "$M/repo/claude/skills/lotus" "$M/home/skills"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" 'case "$phys" in
    "$REPO_PHYS"/*)' 'case "$path" in
    "$REPO_PHYS"/*)' 1)
  ln -s "$M/repo/claude/skills/lotus" "$M/home/skills/lotus"
  drive "$M/lib.sh" "$M/repo" refuse_repo_write "$M/home/skills/lotus/SKILL.md" "test" >/dev/null 2>&1
  guard_rc=$?
  # E1 asserts the symlinked repo destination is REFUSED (non-zero). Violated when the
  # mutated guard lets it through.
  violated=0; [ "$guard_rc" = 0 ] && violated=1
  mutation_row "G6 mutating the containment check to the spelled path turns E1 RED (a symlinked repo dest slips through)" "$mres" "$violated"
else
  bad "G mutation control" "the helper block is absent, so no mutation can be applied"
fi

# ---- G7: the artifact gate in each installer, mutated in a staged copy.
FJ3="$TMPROOT/g7-repo"; FJ3H="$TMPROOT/g7-home"; mkdir -p "$FJ3H"
stage_justify "$FJ3"
mres=$(mutate "$FJ3/justify/install.sh" 'for artifact in "$JUSTIFY_DIR/dist/justify-core.js" "$JUSTIFY_DIR/dist/server/index.js"; do' 'for artifact in ; do' 1)
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ3H" PATH="$STUBPATH" bash "$FJ3/justify/install.sh" > "$TMPROOT/g7.out" 2>&1
  # F1b asserts the run stops at the gate, before the CLI install. Violated when the
  # mutated gate lets it march on into the stages that follow. This row deliberately
  # drives a run PAST the gate, which is why it needs the shim guard verified first.
  violated=0; [ -f "$FJ3H/.claude/justify/init.sh" ] && violated=1
  mutation_row "G7 emptying justify's artifact list turns F1b RED (the run continues past a build that produced nothing)" "$mres" "$violated"
else
  bad "G7 emptying justify's artifact list turns F1b RED (the run continues past a build that produced nothing)" "not run - see F0"
fi

FL5="$TMPROOT/g8-repo"; FL5H="$TMPROOT/g8-home"; mkdir -p "$FL5H"
stage_lotus "$FL5"
mres=$(mutate "$FL5/lotus/install.sh" 'for artifact in "$SCRIPT_DIR/dist/code.js" "$SCRIPT_DIR/dist/ui.html" "$SERVER_JS"; do' 'for artifact in ; do' 1)
HOME="$FL5H" PATH="$STUBPATH" bash "$FL5/lotus/install.sh" > "$TMPROOT/g8.out" 2>&1
# F3b asserts nothing downstream of a failed build is written. Violated when the mutated
# gate lets the registration through, pointing at an entrypoint that does not exist.
violated=0; [ -e "$FL5H/.claude.json" ] && violated=1
mutation_row "G8 emptying lotus's artifact list turns F3b RED (it registers a nonexistent entrypoint)" "$mres" "$violated"

# ---- G9: the fatal build step. Break it back to a warning and F7 must go RED.
FJ6="$TMPROOT/g9-repo"; FJ6H="$TMPROOT/g9-home"; mkdir -p "$FJ6H/.claude/justify/dist/server"
stage_justify "$FJ6"
printf '// yesterday\n' > "$FJ6H/.claude/justify/dist/justify-core.js"
printf '// yesterday\n' > "$FJ6H/.claude/justify/dist/server/index.js"
mres=$(mutate "$FJ6/justify/install.sh" '  echo "ERROR: npm install failed. Run manually: cd $JUSTIFY_DIR && npm install" >&2
  exit 4' '  echo "WARNING: npm install failed. Run manually: cd $JUSTIFY_DIR && npm install" >&2' 1)
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ6H" PATH="$FAILBIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$FJ6/justify/install.sh" > "$TMPROOT/g9.out" 2>&1
  # F7 asserts a failed build step stops the run before the stages after it. Violated
  # when the mutated installer walks past the failure into the CLI install.
  violated=0; [ -f "$FJ6H/.claude/justify/init.sh" ] && violated=1
  mutation_row "G9 turning the fatal build step back into a warning turns F7 RED (a failed build walks on into the install)" "$mres" "$violated"
else
  bad "G9 turning the fatal build step back into a warning turns F7 RED (a failed build walks on into the install)" "not run - see F0"
fi

# ---- G10: the build-output symlink guard. Remove it and F8 must go RED.
FJ7="$TMPROOT/g10-repo"; FJ7H="$TMPROOT/g10-home"; mkdir -p "$FJ7H/.claude/justify" "$TMPROOT/g10-victim"
stage_justify "$FJ7"
printf 'the user own build output\n' > "$TMPROOT/g10-victim/keep.txt"
ln -s "$TMPROOT/g10-victim" "$FJ7H/.claude/justify/dist"
mres=$(mutate "$FJ7/justify/install.sh" '  refuse_escaping_symlink "$JUSTIFY_DIR/$build_target" "$JUSTIFY_DIR" "justify build output" || exit 3' '  :' 1)
# BOTH guards have to come out for this row to isolate anything. `find dist -type l` does
# not follow a symlinked `dist` - it reports the link itself - so the nested scan catches
# F8's fixture too, and mutating only the top-level guard leaves the row green for the
# other guard's reason. A mutation that changes nothing observable is a row that proves
# nothing, which is why this is spelled out rather than left as a passing assertion.
mres2=$(mutate "$FJ7/justify/install.sh" '  if [ "$nested_escapes" -gt 0 ]; then' '  if false; then' 1)
if [ "$mres" = OK ] && [ "$mres2" != OK ]; then mres="$mres2"; fi
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ7H" PATH="$STUBPATH" bash "$FJ7/justify/install.sh" > "$TMPROOT/g10.out" 2>&1
  g10_rc=$?
  # F8 asserts the run is refused with exit 3 before a build writes through the link.
  violated=0; [ "$g10_rc" != 3 ] && violated=1
  mutation_row "G10 removing BOTH build-output symlink guards turns F8 RED (the run proceeds through the link)" "$mres" "$violated"
else
  bad "G10 removing BOTH build-output symlink guards turns F8 RED (the run proceeds through the link)" "not run - see F0"
fi

# ---- G11: the nested-dist scan. Remove it and F10 must go RED.
FJ10="$TMPROOT/g11-repo"; FJ10H="$TMPROOT/g11-home"
mkdir -p "$FJ10H/.claude/justify/dist" "$TMPROOT/g11-victim"
stage_justify "$FJ10"
ln -s "$TMPROOT/g11-victim" "$FJ10H/.claude/justify/dist/server"
mres=$(mutate "$FJ10/justify/install.sh" '  if [ "$nested_escapes" -gt 0 ]; then' '  if false; then' 1)
if [ "$SHIM_STAGE_SAFE" = 1 ]; then
  HOME="$FJ10H" PATH="$STUBPATH" bash "$FJ10/justify/install.sh" > "$TMPROOT/g11.out" 2>&1
  g11_rc=$?
  violated=0; [ "$g11_rc" != 3 ] && violated=1
  mutation_row "G11 disabling the nested-dist scan turns F10 RED (the build runs through a link inside dist/)" "$mres" "$violated"
else
  bad "G11 disabling the nested-dist scan turns F10 RED (the build runs through a link inside dist/)" "not run - see F0"
fi

# ---- G12: the artifact physical-location check. Remove it and F11 must go RED.
FJ11="$TMPROOT/g12-repo"; FJ11H="$TMPROOT/g12-home"
mkdir -p "$FJ11H/.claude/justify/dist/server" "$TMPROOT/g12-victim"
stage_justify "$FJ11"
printf '// somebody elses bundle\n' > "$TMPROOT/g12-victim/core.js"
ln -s "$TMPROOT/g12-victim/core.js" "$FJ11H/.claude/justify/dist/justify-core.js"
printf '// server\n' > "$FJ11H/.claude/justify/dist/server/index.js"
mres=$(mutate "$FJ11/justify/install.sh" '  elif ! refuse_escaping_symlink "$artifact" "$JUSTIFY_DIR" "justify build artifact"; then
    build_missing=$((build_missing + 1))' '  elif false; then
    build_missing=$((build_missing + 1))' 1)
# the nested scan would also catch this fixture, so it is disabled too - the row has to
# isolate the check it is actually about
mres2=$(mutate "$FJ11/justify/install.sh" '  if [ "$nested_escapes" -gt 0 ]; then' '  if false; then' 1)
if [ "$SHIM_STAGE_SAFE" = 1 ] && [ "$mres2" = OK ]; then
  HOME="$FJ11H" PATH="$STUBPATH" bash "$FJ11/justify/install.sh" > "$TMPROOT/g12.out" 2>&1
  # F11 asserts the run does not accept the linked artifact. Violated when it walks on
  # into the stages after the gate.
  violated=0; [ -f "$FJ11H/.claude/justify/init.sh" ] && violated=1
  mutation_row "G12 disabling the artifact physical-location check turns F11 RED (a linked artifact is accepted)" "$mres" "$violated"
else
  bad "G12 disabling the artifact physical-location check turns F11 RED (a linked artifact is accepted)" "not run - see F0 (or the second mutation failed: $mres2)"
fi


# ---- G13: lotus's fatal build step. Break it back to a warning and F12 must go RED.
FL9="$TMPROOT/g13-repo"; FL9H="$TMPROOT/g13-home"; mkdir -p "$FL9H"
stage_lotus "$FL9"; seed_lotus_artifacts "$FL9"
mres=$(mutate "$FL9/lotus/install.sh" '  echo "ERROR: the plugin build failed. Run manually: cd $SCRIPT_DIR && npm install && npm run build" >&2
  exit 4' '  echo "WARNING: the plugin build failed." >&2' 1)
# BOTH build steps go back to warnings, because the fixture fails both npm installs and
# the second `exit 4` would otherwise stop the run for the other step's reason. Isolating
# the mutation to one gate would leave this row green on evidence it did not produce.
mres2=$(mutate "$FL9/lotus/install.sh" '  echo "ERROR: the mcp-server build failed. Run manually: cd $SCRIPT_DIR/mcp-server && npm install && npm run build" >&2
  exit 4' '  echo "WARNING: the mcp-server build failed." >&2' 1)
if [ "$mres" = OK ] && [ "$mres2" != OK ]; then mres="$mres2"; fi
HOME="$FL9H" PATH="$FAILBIN:/usr/bin:/bin:/usr/sbin:/sbin" bash "$FL9/lotus/install.sh" > "$TMPROOT/g13.out" 2>&1
# F12 asserts a failed build writes no registration. Violated when the mutated installer
# walks past the failure and registers anyway.
violated=0; [ -e "$FL9H/.claude.json" ] && violated=1
mutation_row "G13 turning lotus's fatal build back into a warning turns F12 RED (a failed build reaches the registration)" "$mres" "$violated"

# ---- G14: the skill-directory guard. Remove it and F14 must go RED.
FL10="$TMPROOT/g14-repo"; FL10H="$TMPROOT/g14-home"
mkdir -p "$FL10H/.claude/skills" "$TMPROOT/g14-victim"
stage_lotus "$FL10"; seed_lotus_artifacts "$FL10"
printf 'the user own notes\n' > "$TMPROOT/g14-victim/SKILL.md"
ln -s "$TMPROOT/g14-victim" "$FL10H/.claude/skills/lotus"
mres=$(mutate "$FL10/lotus/install.sh" 'refuse_escaping_symlink "$SKILL_DIR" "${CLAUDE_DIR}/skills" "lotus skill dir" || exit 3' ':' 1)
HOME="$FL10H" PATH="$STUBPATH" bash "$FL10/lotus/install.sh" > "$TMPROOT/g14.out" 2>&1
# F14 asserts the file behind the link is untouched. Violated when the install writes over it.
violated=0; grep -q '^the user own notes$' "$TMPROOT/g14-victim/SKILL.md" || violated=1
mutation_row "G14 removing the skill-directory guard turns F14 RED (the install writes through the directory link)" "$mres" "$violated"


# ---- G15: lotus's nested build-output scan. Remove it and F15 must go RED.
FL12="$TMPROOT/g15-repo"; FL12H="$TMPROOT/g15-home"; mkdir -p "$FL12H" "$TMPROOT/g15-victim"
stage_lotus "$FL12"; seed_lotus_artifacts "$FL12"
printf 'the user own file\n' > "$TMPROOT/g15-victim/bridge.js"
ln -s "$TMPROOT/g15-victim/bridge.js" "$FL12/lotus/mcp-server/dist/bridge.js"
mres=$(mutate "$FL12/lotus/install.sh" 'if [ "$nested_escapes" -gt 0 ]; then' 'if false; then' 1)
HOME="$FL12H" PATH="$STUBPATH" bash "$FL12/lotus/install.sh" > "$TMPROOT/g15.out" 2>&1
g15_rc=$?
# F15 asserts the run is refused with exit 3. Violated when it proceeds.
violated=0; [ "$g15_rc" != 3 ] && violated=1
mutation_row "G15 disabling lotus's nested build-output scan turns F15 RED (the build runs through the link)" "$mres" "$violated"


# ---- G16: the interrupt handler's exit. Turn it back into a plain return and D6 must go
# RED - which is precisely the bug the third review pass found: the shell RESUMES, the
# staged tree is moved inside the restored one, and the helper reports success.
if [ "$LIB_OK" = 1 ]; then
  M="$TMPROOT/g16"; mkdir -p "$M/src" "$M/install/server"
  cp "$LIB_J" "$M/lib.sh"
  mres=$(mutate "$M/lib.sh" '  [ -n "$_ait_stash" ] && rm -rf "$_ait_stash"
  exit 130' '  [ -n "$_ait_stash" ] && rm -rf "$_ait_stash"
  return 0' 1)
  printf 'new\n' > "$M/src/a.ts"
  printf 'the working install\n' > "$M/install/server/a.ts"
  bash "$TMPROOT/drive-slow-swap.sh" "$M/lib.sh" "$TMPROOT/norepo" "$M/src" "$M/install/server" \
    > "$TMPROOT/g16.out" 2>&1 &
  g16_pid=$!
  g16_wait=0
  while [ -e "$M/install/server" ] && [ "$g16_wait" -lt 40 ]; do
    g16_wait=$((g16_wait + 1))
    sleep 0.1
  done
  g16_window=1; [ "$g16_wait" -lt 40 ] || g16_window=0
  kill -TERM "$g16_pid" 2>/dev/null || g16_window=0
  wait "$g16_pid" 2>/dev/null
  # D6 asserts the run does not resume past the interrupt. Violated when it does - but only
  # if the signal actually landed in the window, same honesty check as D6 itself.
  violated=0; grep -q 'RESUMED-AND-RETURNED' "$TMPROOT/g16.out" && violated=1
  if [ "$g16_window" = 1 ]; then
    mutation_row "G16 turning the interrupt handler's exit into a return turns D6 RED (the run resumes past the interrupt)" "$mres" "$violated"
  else
    bad "G16 turning the interrupt handler's exit into a return turns D6 RED (the run resumes past the interrupt)" \
        "the signal never landed in the swap window, so the row measured nothing"
  fi
else
  bad "G16 turning the interrupt handler's exit into a return turns D6 RED (the run resumes past the interrupt)" "the helper block is absent"
fi

# ============================================================
# H. Containment - the suite must not have written to the tree it reports on
# ============================================================
echo
echo "--- H. containment"

if [ "$(hash_of "$JUSTIFY_INSTALLER")" = "$JUSTIFY_HASH_AT_START" ] \
   && [ "$(hash_of "$LOTUS_INSTALLER")" = "$LOTUS_HASH_AT_START" ]; then
  ok "H1 the target checkout's two installers are byte-identical to what they were at start"
else
  bad "H1 the target checkout's two installers are byte-identical to what they were at start" \
      "this suite mutated the tree it reports on"
fi

# Scoped to the two directories this suite drives. A wider sweep would trip on whatever
# else is being edited in the checkout while the suite runs, which says nothing about
# whether the suite wrote anything.
if [ "$(shim_snapshot)" = "$SHIMS_AT_START" ]; then
  ok "H3 every justify shim in /usr/local/bin and /opt/homebrew/bin is exactly as the suite found it"
else
  bad "H3 every justify shim in /usr/local/bin and /opt/homebrew/bin is exactly as the suite found it" \
      "$(printf '%s\n' "$SHIMS_AT_START" | diff - <(shim_snapshot) | head -8)"
fi

live_writes=$(find "$TARGET_REPO/justify" "$TARGET_REPO/lotus" -newer "$MARKER" \
                -not -path '*/node_modules/*' -not -path '*/.git/*' -type f 2>/dev/null | head -5)
if [ -z "$live_writes" ]; then
  ok "H2 nothing under justify/ or lotus/ in the checkout was written while the suite ran"
else
  bad "H2 nothing under justify/ or lotus/ in the checkout was written while the suite ran" "$live_writes"
fi

echo
echo "================================"
echo "PASS $pass    FAIL $fail"
echo "================================"
[ "$fail" -eq 0 ] || exit 1
exit 0
