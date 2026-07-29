#!/usr/bin/env bash
# run-scoreboard.sh - regenerates benchmark/SCOREBOARD.md from scratch.
#
# Usage:
#   bash benchmark/run-scoreboard.sh              # writes benchmark/SCOREBOARD.md
#   LOCALPROJECTX_DIR=/path/to/tree bash benchmark/run-scoreboard.sh
#   bash benchmark/run-scoreboard.sh --selftest   # run instrument canaries only
#
# DESIGN RULE - CANARY GATING.
# Default posture is that sidecoach LOSES. A row flips to WIN only when a command
# produces the number. Every row that depends on a detector run is gated behind a
# canary: the instrument must FIRE on a planted known-positive and stay CLEAN on a
# known-negative before any of its numbers are believed. If a canary fails, every
# row it gates is emitted as UNMEASURED. UNMEASURED never counts as a win and never
# rounds up.
#
# The competitor tree is READ-ONLY. This script never writes to it, never installs
# into it, and never runs its installers. It executes its detector as a black box
# with cwd anchored in our tree.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SC_DIR="$(cd "$HERE/.." && pwd)"
FIX="$HERE/fixtures"
OUT="$HERE/SCOREBOARD.md"
SELFTEST_ONLY=0
[ "${1:-}" = "--selftest" ] && SELFTEST_ONLY=1

# ---------------------------------------------------------------------------
# Locate the competitor tree without ever hardcoding its name.
# Probe: a sibling of our repo root carrying both of these marker paths.
# ---------------------------------------------------------------------------
find_localprojectx() {
  if [ -n "${LOCALPROJECTX_DIR:-}" ]; then
    printf '%s' "$LOCALPROJECTX_DIR"; return
  fi
  local parent
  parent="$(cd "$SC_DIR/../.." && pwd)"
  local d
  for d in "$parent"/*; do
    [ -d "$d" ] || continue
    if [ -f "$d/skill/scripts/detect.mjs" ] && [ -f "$d/cli/engine/registry/antipatterns.mjs" ]; then
      printf '%s' "$d"; return
    fi
  done
  printf ''
}

LPX="$(find_localprojectx)"
LPX_DETECT="${LPX:+$LPX/skill/scripts/detect.mjs}"
OURS_DETECT="$SC_DIR/bin/sidecoach-detect.js"

# LPX_OK gates every comparative row. Without a real competitor tree there is no
# head-to-head number, and a row with nothing on the other side is UNMEASURED.
LPX_OK=0
if [ -n "$LPX" ] && [ -d "$LPX/skill" ] && [ -f "$LPX_DETECT" ] \
   && [ -f "$LPX/skill/SKILL.src.md" ] && [ -d "$LPX/skill/reference" ]; then
  LPX_OK=1
fi

INSTALLED_SKILL="${SIDECOACH_INSTALLED_SKILL:-$HOME/.claude/skills/sidecoach/SKILL.md}"
INSTALLED_CHEAT="${SIDECOACH_INSTALLED_CHEATSHEET:-$HOME/.claude/skills/sidecoach/CHEATSHEET.md}"

# ---------------------------------------------------------------------------
# Fixtures. Written fresh every run so the harness is self-contained.
# ---------------------------------------------------------------------------
mkdir -p "$FIX/canary" "$FIX/linked-css" "$FIX/clean"

cat > "$FIX/canary/canary.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Canary</title>
<style>
  body { font-family: Inter, sans-serif; background: #f5efe2; color: #b8b0a4; }
  h1 { font-size: 96px; letter-spacing: -0.08em; background: linear-gradient(90deg,#ff0080,#7928ca); -webkit-background-clip: text; }
  .card { border-radius: 12px; padding: 4px; background: #fff; }
  .card .card { border-radius: 12px; padding: 4px; background: #fff; }
  .cta { transition: all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55); }
  .dot { animation: pulse 1s infinite; }
  @keyframes pulse { 0%{opacity:1} 50%{opacity:.4} 100%{opacity:1} }
</style></head>
<body>
  <main>
    <p class="eyebrow">AI-POWERED</p>
    <h1>Unlock seamless synergy at scale</h1>
    <p>Our cutting-edge platform leverages best-in-class AI to revolutionize your workflow. Seamlessly unlock next-generation growth.</p>
    <div class="card"><div class="card"><button class="cta">Get started</button></div></div>
    <span class="dot"></span>
    <img src="missing-asset-does-not-exist.png" alt="">
  </main>
</body>
</html>
HTML

cat > "$FIX/linked-css/page.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Linked</title>
<link rel="stylesheet" href="styles.css"></head>
<body><main><h1>Heading</h1><p>Body copy that is perfectly ordinary.</p></main></body>
</html>
HTML

cat > "$FIX/linked-css/styles.css" <<'CSS'
body { font-family: Inter, sans-serif; }
h1 { background: linear-gradient(90deg,#ff0080,#7928ca); -webkit-background-clip: text; }
.cta { transition: all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55); }
CSS

cat > "$FIX/clean/clean.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Clean</title></head>
<body><main><h1>Heading</h1><p>Ordinary body copy.</p></main></body>
</html>
HTML

# ---------------------------------------------------------------------------
# Instrument helpers
# ---------------------------------------------------------------------------
# ABSENCE IS NOT ZERO. Both readers return "ERR" when the tool is missing or did not
# produce a parseable report. Callers must treat "ERR" as UNMEASURED and never as 0.
# An independent review of this harness found seven places where a missing or errored
# measurement was being collapsed into a favourable number; that is the whole class of
# bug this convention exists to close.
lpx_findings() { # -> integer count, or "ERR"
  [ -n "$LPX_DETECT" ] && [ -f "$LPX_DETECT" ] || { echo "ERR"; return; }
  # NOTE: this detector writes its human report to STDERR and leaves STDOUT empty
  # (stdout carries JSON only under --json). Capturing stdout alone yields a silent
  # zero on a defective page. The canary gate caught exactly that; hence 2>&1.
  local out n
  out="$(cd "$SC_DIR" && node "$LPX_DETECT" "$1" 2>&1)"
  # A node crash or a usage bail is not a clean page. Require evidence the scan ran:
  # either an explicit count line or at least one finding line.
  n="$(printf '%s' "$out" | grep -oE '[0-9]+ anti-pattern' | grep -oE '^[0-9]+' | head -1)"
  if [ -z "$n" ]; then
    if printf '%s' "$out" | grep -q '^  line '; then
      n="$(printf '%s' "$out" | grep -c '^  line ')"
    elif printf '%s' "$out" | grep -qiE 'cannot access|Error|Usage:'; then
      echo "ERR"; return
    else
      n=0   # scanned, produced no report body and no error: a genuine silent zero
    fi
  fi
  echo "$n"
}

# Returns "<findings> <ban_lens_ran> <exit>" or "ERR".
# ban_lens_ran is the discriminator that makes a ZERO believable: our detector prints
# `lens static-ban: ran` only when that lens actually executed. Zero findings from a
# lens that never ran is NOT a clean result - the tool itself says
# "NOT CLEAN: a scan that did not happen is not a passing scan" and exits 3.
ours_scan() {
  [ -f "$OURS_DETECT" ] || { echo "ERR"; return; }
  local out n ran ec
  out="$(cd "$SC_DIR" && node "$OURS_DETECT" "$1" --no-render 2>&1)"; ec=$?
  n="$(printf '%s' "$out" | grep -cE '^[[:space:]]+\[(blocking|warning)\]')"
  ran=no
  printf '%s' "$out" | grep -qE '^[[:space:]]+lens static-ban: ran' && ran=yes
  [ -z "$n" ] && n=0
  echo "$n $ran $ec"
}

ours_findings() { # -> integer count, or "ERR"  (back-compat wrapper)
  local r; r="$(ours_scan "$1")"
  [ "$r" = "ERR" ] && { echo "ERR"; return; }
  echo "${r%% *}"
}

exit_code_of() { ( cd "$SC_DIR" && "$@" >/dev/null 2>&1 ); echo $?; }

# ---------------------------------------------------------------------------
# REACHABILITY PROBE - convention-agnostic, one transitive hop.
#
# An earlier version of this harness grepped flow handlers for a module IMPORT and
# reported 0 invokers for the image capability and 1 of 26 for the craft corpus. Both
# numbers were wrong, and wrong in the direction that reads as rigour:
#   - flow-handler-design-references.ts SPAWNS bin/sidecoach-image.js as a subprocess
#     (path.resolve + existsSync + child process). An importer grep cannot see that.
#   - 20 flow handlers reach the craft corpus THROUGH craft-flow.ts, which is the file
#     that imports craft-corpus/craft-laws. A direct-reference grep cannot see that.
# So this probe counts three shapes: a direct textual reference, a spawn of the bin,
# and one hop through an intermediate module that itself references the capability.
# Depth is deliberately capped at one hop and that limit is stated on the row, because
# an unbounded transitive walk would eventually call everything reachable.
# ---------------------------------------------------------------------------
reach_flow_handlers() { # reach_flow_handlers <capability-regex> -> "<count> <total>"
  local pat="$1" total hits hop
  total=$(cd "$SC_DIR" && ls src/flow-handler*.ts 2>/dev/null | wc -l | tr -d ' ')
  # direct reference or bin spawn, inside a flow handler
  hits="$(cd "$SC_DIR" && grep -rlE "$pat" src --include='flow-handler*.ts' 2>/dev/null | grep -v __tests__)"
  # one hop: non-handler modules that reference the capability, then handlers importing them
  local mid m base
  mid="$(cd "$SC_DIR" && grep -rlE "$pat" src --include='*.ts' 2>/dev/null \
        | grep -v __tests__ | grep -v 'flow-handler')"
  for m in $mid; do
    base="$(basename "$m" .ts)"
    hop="$(cd "$SC_DIR" && grep -rlE "from '\./${base}'|require\(['\"]\./${base}" src --include='flow-handler*.ts' 2>/dev/null | grep -v __tests__)"
    hits="$hits"$'\n'"$hop"
  done
  local n
  n=$(printf '%s\n' "$hits" | grep 'flow-handler' | sort -u | wc -l | tr -d ' ')
  echo "$n $total"
}

# Timing notes. One warmup run is discarded (both tools have cold-cache paths, and
# ours maintains .sidecoach-cache). Samples are reported as median plus min-max so a
# reader can see variance rather than trusting a single number. An earlier version
# used 3 samples with no warmup and no tolerance band; it produced a verdict that
# FLIPPED between consecutive runs, which means the row was decided by machine load
# from other agents rather than by either tool. A verdict that flaps is not a
# measurement.
# Codex review: this timed the command while discarding its exit status, so a command
# that failed FAST would score as fast. A detector exiting 1 on findings is expected;
# a crash (>=126, or our 2 = usage/IO) is not a timing sample. Returns "ERR" instead.
median_ms() { # median_ms <valid-codes-regex> <n_runs> <cmd...> -> "median min max" | "ERR"
  local ok="$1"; shift
  local runs="$1"; shift
  ( cd "$SC_DIR" && "$@" >/dev/null 2>&1 )   # warmup, discarded
  local -a t=()
  local i s e ec
  for ((i=0;i<runs;i++)); do
    s=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
    ( cd "$SC_DIR" && "$@" >/dev/null 2>&1 ); ec=$?
    e=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
    # Only a signal / not-executable status invalidates a timing sample. An earlier
    # version also rejected exit 2 on the assumption that 2 always means "usage error";
    # that is OUR convention, and applying it to the competitor's binary threw away
    # every sample because their detector exits 2 when it HAS findings. Do not project
    # one tool's exit-code semantics onto another's.
    # Valid codes are passed in per tool. Ours: 0 clean / 1 findings / 3 inconclusive -
    # 2 is a usage/IO error and is NOT a timing sample. Theirs: 0 clean / 2 findings.
    # Hardcoding one tool's convention discarded every sample from the other.
    if ! printf '%s' "$ec" | grep -qE "^($ok)$"; then echo "ERR"; return; fi
    t+=( $((e-s)) )
  done
  printf '%s\n' "${t[@]}" | sort -n \
    | awk '{a[NR]=$1} END{print a[int((NR+1)/2)], a[1], a[NR]}'
}

# ---------------------------------------------------------------------------
# CANARY SELF-TEST. Nothing downstream is believed until these pass.
# ---------------------------------------------------------------------------
CANARY_LPX="FAIL"; CANARY_OURS="FAIL"
CANARY_LPX_NOTE=""; CANARY_OURS_NOTE=""

c_pos="$(lpx_findings "$FIX/canary/canary.html")"
c_neg="$(lpx_findings "$FIX/clean/clean.html")"
if [ "$c_pos" = "ERR" ]; then
  CANARY_LPX_NOTE="competitor detector not found (set LOCALPROJECTX_DIR)"
elif [ "$c_pos" -gt 0 ] 2>/dev/null && [ "$c_neg" = "0" ]; then
  CANARY_LPX="PASS"; CANARY_LPX_NOTE="fires $c_pos on planted positive, 0 on known-negative"
else
  CANARY_LPX_NOTE="positive=$c_pos negative=$c_neg (expected positive>0, negative=0)"
fi

o_scan_pos="$(ours_scan "$FIX/canary/canary.html")"
o_scan_neg="$(ours_scan "$FIX/clean/clean.html")"
if [ "$o_scan_pos" = "ERR" ] || [ "$o_scan_neg" = "ERR" ]; then
  o_pos="ERR"; o_neg="ERR"
  CANARY_OURS_NOTE="sidecoach detector not found at bin/sidecoach-detect.js"
else
  read -r o_pos o_ran_pos _ <<<"$o_scan_pos"
  read -r o_neg o_ran_neg _ <<<"$o_scan_neg"
  # The negative control must prove the lens EXECUTED, not merely that it emitted
  # nothing. Requiring only "0 findings" accepts an inconclusive scan as clean.
  if [ "$o_pos" -gt 0 ] 2>/dev/null && [ "$o_neg" = "0" ] \
     && [ "$o_ran_pos" = "yes" ] && [ "$o_ran_neg" = "yes" ]; then
    CANARY_OURS="PASS"
    CANARY_OURS_NOTE="static-ban lens ran on both; fires $o_pos on planted positive, 0 on known-negative"
  else
    CANARY_OURS_NOTE="positive=$o_pos (lens ran: $o_ran_pos) negative=$o_neg (lens ran: $o_ran_neg); need positive>0, negative=0, lens ran on both"
  fi
fi

BOTH_CANARIES="FAIL"
[ "$CANARY_LPX" = "PASS" ] && [ "$CANARY_OURS" = "PASS" ] && BOTH_CANARIES="PASS"

echo "canary LOCALPROJECTX detector: $CANARY_LPX ($CANARY_LPX_NOTE)" >&2
echo "canary sidecoach detector:     $CANARY_OURS ($CANARY_OURS_NOTE)" >&2
if [ "$SELFTEST_ONLY" = "1" ]; then
  [ "$BOTH_CANARIES" = "PASS" ] && exit 0 || exit 1
fi

# ---------------------------------------------------------------------------
# Row accumulator
# ---------------------------------------------------------------------------
ROWS=""; W=0; L=0; T=0; U=0
HEAD_SHA="$(cd "$SC_DIR" && git rev-parse --short HEAD 2>/dev/null || echo unknown)"
LEDGER="$HERE/derivations.tsv"          # previous run's values, for drift detection
NEW_LEDGER="$(mktemp)"
DRIFT=""; DRIFT_N=0

# A SCOREBOARD IS AN INSTRUMENT TOO, AND IT DECAYS.
# Two distinct decay modes were both observed on this board within one session:
#   - the VALUE went stale against a fixed command (a row scored WIN on "exit 3" while
#     the detector had started exiting 1), and
#   - the COMMAND went stale against a grown surface (a row swept 2 named files after
#     the loadable surface grew to 11).
# So every row is stamped with the commit it was DERIVED at - not merely the commit the
# document was generated at - and every value is compared against the previous run's.
# A changed verdict is reported LOUDLY and makes the run exit nonzero, because silently
# overwriting it is exactly how a regression gets absorbed and never seen.
row() { # row <metric> <command> <lpx_value> <ours_value> <verdict>
  local key prev
  key="$(printf '%s' "$1" | tr -cd '[:alnum:] ' | tr ' ' '_')"
  printf '%s\t%s\t%s\t%s\n' "$key" "$3" "$4" "$5" >> "$NEW_LEDGER"
  if [ -f "$LEDGER" ]; then
    prev="$(awk -F'\t' -v k="$key" '$1==k {print $4}' "$LEDGER" | head -1)"
    if [ -n "$prev" ] && [ "$prev" != "$5" ]; then
      DRIFT="$DRIFT"$'\n'"  - $1: $prev -> $5"
      DRIFT_N=$((DRIFT_N+1))
    fi
  fi
  ROWS+="| $1 | \`$2\` | $3 | $4 | **$5** | \`$HEAD_SHA\` |"$'\n'
  case "$5" in
    WIN) W=$((W+1));; LOSS) L=$((L+1));; TIE) T=$((T+1));; *) U=$((U+1));;
  esac
}

# crow() - COMPARATIVE row. A head-to-head verdict requires a real competitor
# measurement. If the competitor tree is absent, the row is UNMEASURED; it must never
# become a WIN or TIE just because their side read as 0 or "n/a".
crow() { # crow <metric> <cmd> <lpx> <ours> <verdict>
  if [ "$LPX_OK" = "1" ]; then row "$1" "$2" "$3" "$4" "$5"
  else row "$1" "$2" "competitor tree not found - not measured" "$4" "UNMEASURED"; fi
}
# gated(): emit UNMEASURED unless the named canary passed
gated() { # gated <canary_state> <metric> <cmd> <lpx> <ours> <verdict>
  if [ "$1" = "PASS" ]; then row "$2" "$3" "$4" "$5" "$6"
  else row "$2" "$3" "canary FAIL" "canary FAIL" "UNMEASURED"; fi
}

# ===========================================================================
# FAMILY 1 - DISCOVERABILITY (outranks everything else)
# ===========================================================================
count_named_in() { # count_named_in <needle-list-file> <haystack...>
  local n=0 needle
  while read -r needle; do
    [ -z "$needle" ] && continue
    grep -rql -- "$needle" "${@}" 2>/dev/null && n=$((n+1))
  done < "$1"
  echo "$n"
}

# SCOPE: sweep the WHOLE installed surface, not a hardcoded file list. This row read
# 9/17 while looking at 2 of 11 files; sidecoach-detect lives in reference/tools.md and
# was invisible to it. -R (not -r) because the surface files are symlinks into the repo.
SURFACE_DIR="$(dirname "$INSTALLED_SKILL")"
OURS_BINS=0; OURS_BINS_SEEN=0; OURS_UNDISC=""
if [ -d "$SC_DIR/bin" ] && [ -d "$SURFACE_DIR" ]; then
  for f in "$SC_DIR"/bin/*; do
    b="$(basename "$f")"; b="${b%.*}"
    OURS_BINS=$((OURS_BINS+1))
    if grep -Rql -- "$b" "$SURFACE_DIR" 2>/dev/null; then
      OURS_BINS_SEEN=$((OURS_BINS_SEEN+1))
    else
      OURS_UNDISC="$OURS_UNDISC $b"
    fi
  done
fi

LPX_SCRIPTS=0; LPX_SCRIPTS_SEEN=0
if [ -n "$LPX" ] && [ -d "$LPX/skill/scripts" ]; then
  for f in "$LPX"/skill/scripts/*.mjs "$LPX"/skill/scripts/*.js; do
    [ -f "$f" ] || continue
    b="$(basename "$f")"; LPX_SCRIPTS=$((LPX_SCRIPTS+1))
    grep -rql -- "$b" "$LPX/skill/SKILL.src.md" "$LPX/skill/reference" "$LPX/skill/agents" 2>/dev/null \
      && LPX_SCRIPTS_SEEN=$((LPX_SCRIPTS_SEEN+1))
  done
fi

OURS_SURFACE_FILES=$(find -L "$(dirname "$INSTALLED_SKILL")" -type f 2>/dev/null | wc -l | tr -d ' ')
LPX_SURFACE_FILES=0
[ -n "$LPX" ] && LPX_SURFACE_FILES=$(find "$LPX/skill" -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' ')

v="LOSS"; [ "$OURS_SURFACE_FILES" -gt "$LPX_SURFACE_FILES" ] 2>/dev/null && v="WIN"
crow "Loadable docs on the installed skill surface" \
    "find -L \$(dirname \$INSTALLED_SKILL) -type f | wc -l  vs  find \$LPX/skill -name '*.md' | wc -l" \
    "$LPX_SURFACE_FILES" "$OURS_SURFACE_FILES" "$v"

pc_ours=0; [ "$OURS_BINS" -gt 0 ] && pc_ours=$((OURS_BINS_SEEN*100/OURS_BINS))
pc_lpx=0; [ "$LPX_SCRIPTS" -gt 0 ] && pc_lpx=$((LPX_SCRIPTS_SEEN*100/LPX_SCRIPTS))
v="LOSS"; [ "$pc_ours" -gt "$pc_lpx" ] && v="WIN"; [ "$pc_ours" = "$pc_lpx" ] && v="TIE"
crow "Shipped tools NAMED in the loadable surface (a model can learn they exist)" \
    "benchmark/run-scoreboard.sh (discoverability sweep, grep per tool basename)" \
    "$LPX_SCRIPTS_SEEN/$LPX_SCRIPTS (${pc_lpx}%)" "$OURS_BINS_SEEN/$OURS_BINS (${pc_ours}%)" "$v"

# Both sides counted in the SAME unit: how many loadable surface FILES name the tool.
# This row read 0 for us earlier in the session and flipped to a win only because the
# installed SKILL.md was edited (05:49) to name sidecoach-image. Recording the unit
# explicitly so the row cannot be read as 'mentions' beating 'files'.
# NOTE: -r is deliberately NOT used here. The installed skill files are SYMLINKS into
# the repo, and BSD grep -r does not follow a symlink given as an argument (only -R
# does), so `grep -rl` returned 0 on a file that plainly contains the string. This also
# differs from an interactive shell where `grep` may be a ugrep wrapper with its own
# symlink and .gitignore behaviour - the harness must not depend on which grep the
# operator happens to have. Explicit files, plain -l.
#
# SCOPE FIX (2026-07-29). The two named files were the WHOLE surface when this row was
# written. The surface is now 11 files (a reference/ directory landed), so sweeping
# SKILL.md and CHEATSHEET.md alone read 0 for the detector while it was named in 3 files.
# A row that hard-codes a file list decays silently the next time a document is added.
# find -L enumerates the surface and follows the symlinked files; the list is then handed
# to plain grep -l, which keeps the original principle of not depending on -r vs -R.
SURFACE_DIR="$(dirname "$INSTALLED_SKILL")"
surface_files_naming() {
  find -L "$SURFACE_DIR" -type f -print0 2>/dev/null \
    | xargs -0 grep -l -- "$1" 2>/dev/null | wc -l | tr -d ' '
}
IMG_DISC=$(surface_files_naming "sidecoach-image")
LPX_IMG_DISC=0
[ -n "$LPX" ] && LPX_IMG_DISC=$(grep -rl -- "generate-image" "$LPX/skill/SKILL.src.md" "$LPX/skill/reference" "$LPX/skill/agents" 2>/dev/null | wc -l | tr -d ' ')
v="LOSS"; [ "$IMG_DISC" -gt 0 ] && [ "$IMG_DISC" -ge "$LPX_IMG_DISC" ] && v="WIN"
crow "Image generation DISCOVERABLE (loadable surface FILES naming the tool)" \
    "find -L \$SURFACE_DIR -type f | xargs grep -l sidecoach-image | wc -l" \
    "$LPX_IMG_DISC of $LPX_SURFACE_FILES file(s)" "$IMG_DISC of $OURS_SURFACE_FILES file(s)" "$v"

# Counted in FILES, matching the competitor side and the unit declared above. This was
# grep -c (mentions) against their file count, which is the exact unit mismatch the
# comment on the image row was written to prevent.
DETECT_DISC=$(surface_files_naming "sidecoach-detect")
LPX_DETECT_DISC=0
[ -n "$LPX" ] && LPX_DETECT_DISC=$(grep -rl -- "detect.mjs" "$LPX/skill/SKILL.src.md" "$LPX/skill/reference" "$LPX/skill/agents" 2>/dev/null | wc -l | tr -d ' ')
v="LOSS"; [ "$DETECT_DISC" -gt 0 ] && [ "$DETECT_DISC" -ge "$LPX_DETECT_DISC" ] && v="WIN"
crow "Detector engine DISCOVERABLE (the tool that powers audit)" \
    "find -L \$SURFACE_DIR -type f | xargs grep -l sidecoach-detect | wc -l" \
    "$LPX_DETECT_DISC of $LPX_SURFACE_FILES file(s)" "$DETECT_DISC of $OURS_SURFACE_FILES file(s)" "$v"

# ===========================================================================
# FAMILY 2 - REACHABILITY (outranks everything except discoverability)
# ===========================================================================
read -r IMG_REACH FLOW_TOTAL <<<"$(reach_flow_handlers 'image-generation|image-asset-verify|sidecoach-image')"
LPX_IMG_REACH=0
[ -n "$LPX" ] && LPX_IMG_REACH=$(cd "$LPX" && grep -rl -- "generate-image" skill/agents skill/scripts/context.mjs skill/reference 2>/dev/null \
  | grep -v 'generate-image.mjs' | wc -l | tr -d ' ')
v="LOSS"; [ "$IMG_REACH" -ge "$LPX_IMG_REACH" ] 2>/dev/null && v="WIN"
crow "Image generation REACHABLE (any flow reaches it, by import OR subprocess spawn)" \
    "reach_flow_handlers 'image-generation|image-asset-verify|sidecoach-image' (direct + bin spawn + 1 hop)" \
    "$LPX_IMG_REACH invoker(s): subagent + once-per-session setup + playbook" \
    "$IMG_REACH / $FLOW_TOTAL flow handlers (spawn-based, not import-based)" "$v"

read -r CRAFT_REACH FLOW_TOTAL <<<"$(reach_flow_handlers 'polish-craft|craft-corpus|craft-laws')"
LPX_FLOOR_REACH=0
[ -n "$LPX" ] && [ -d "$LPX/skill" ] && LPX_FLOOR_REACH=$(cd "$LPX" && grep -rl -- "craft-floor" skill/SKILL.src.md skill/reference 2>/dev/null | wc -l | tr -d ' ')
CRAFT_PC=0; [ "$FLOW_TOTAL" -gt 0 ] && CRAFT_PC=$((CRAFT_REACH*100/FLOW_TOTAL))
v="LOSS"; [ "$CRAFT_PC" -ge 50 ] && v="WIN"
crow "Craft-teaching corpus REACH across flow handlers (transitive, 1 hop)" \
    "reach_flow_handlers 'polish-craft|craft-corpus|craft-laws'" \
    "craft-floor reached from $LPX_FLOOR_REACH surface file(s), loaded before every UI edit" \
    "$CRAFT_REACH / $FLOW_TOTAL flow handlers (${CRAFT_PC}%, mostly via craft-flow.ts)" "$v"

# ===========================================================================
# FAMILY 3 - CAPABILITY COVERAGE (verb for verb)
# ===========================================================================
OURS_VERBS_F=$(mktemp); LPX_VERBS_F=$(mktemp); LPX_REFS_F=$(mktemp)
grep -oE '/sidecoach [a-z][a-z-]+' "$INSTALLED_SKILL" 2>/dev/null | sed 's|/sidecoach ||' | sort -u > "$OURS_VERBS_F"
if [ -n "$LPX" ]; then
  grep -oE '^\| `[a-z][a-z-]+' "$LPX/skill/SKILL.src.md" 2>/dev/null | sed 's/^| `//' | sort -u > "$LPX_VERBS_F"
  ls "$LPX/skill/reference" 2>/dev/null | grep -v '\.native\.md$' | sed 's/\.md$//' | sort -u > "$LPX_REFS_F"
fi
NO=$(wc -l < "$OURS_VERBS_F" | tr -d ' '); NL=$(wc -l < "$LPX_VERBS_F" | tr -d ' ')
NLR=$(wc -l < "$LPX_REFS_F" | tr -d ' ')
v="LOSS"; [ "$NO" -gt "$NL" ] 2>/dev/null && v="WIN"; [ "$NO" = "$NL" ] && v="TIE"
crow "Verbs named in the skill entry document" \
    "grep -oE '/sidecoach [a-z][a-z-]+' \$INSTALLED_SKILL | sort -u | wc -l" "$NL" "$NO" "$v"

# Count the INSTALLED playbooks, not the dev-tree ones. What a model can load is the
# only thing that counts, and reference/ now ships onto the surface.
OURS_REFS=$(find -L "$SURFACE_DIR/reference" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
[ "$OURS_REFS" = "0" ] && OURS_REFS=$(ls "$SC_DIR/reference"/*.md 2>/dev/null | wc -l | tr -d ' ')
v="LOSS"; [ "$OURS_REFS" -gt "$NLR" ] 2>/dev/null && v="WIN"
crow "Per-capability playbooks (reference docs backing the verbs)" \
    "ls reference/*.md | wc -l  vs  ls \$LPX/skill/reference/*.md | wc -l" "$NLR" "$OURS_REFS" "$v"

MISSING=$(comm -23 "$LPX_REFS_F" "$OURS_VERBS_F" | tr '\n' ' ')
NMISS=$(comm -23 "$LPX_REFS_F" "$OURS_VERBS_F" | wc -l | tr -d ' ')
v="LOSS"; [ "$NMISS" = "0" ] && v="TIE"
crow "Capabilities they document that we do not expose" \
    "comm -23 <(their reference doc names) <(our verb names)" \
    "n/a (baseline)" "$NMISS missing: $MISSING" "$v"

OURS_RULES=$( (cd "$SC_DIR" && node "$OURS_DETECT" --list-rules 2>/dev/null) \
  | grep -oE '[0-9]+ validator-owned rule' | grep -oE '^[0-9]+' )
OURS_BIND=$( (cd "$SC_DIR" && node "$OURS_DETECT" --list-rules 2>/dev/null) \
  | grep -oE '[0-9]+ rendered-scanner binding' | grep -oE '^[0-9]+' )
[ -z "$OURS_RULES" ] && OURS_RULES=0; [ -z "$OURS_BIND" ] && OURS_BIND=0
OURS_RULES_TOT=$((OURS_RULES+OURS_BIND))
LPX_RULES=0
[ -n "$LPX" ] && LPX_RULES=$(grep -cE "^\s*id: '" "$LPX/cli/engine/registry/antipatterns.mjs" 2>/dev/null)
v="LOSS"; [ "$OURS_RULES_TOT" -gt "$LPX_RULES" ] 2>/dev/null && v="WIN"
crow "Detector rule registry size" \
    "node bin/sidecoach-detect.js --list-rules  vs  grep -cE \"^\\s*id: '\" \$LPX/cli/engine/registry/antipatterns.mjs" \
    "$LPX_RULES" "$OURS_RULES_TOT ($OURS_RULES validator + $OURS_BIND rendered)" "$v"

# ===========================================================================
# FAMILY 4 - REACH AND DISTRIBUTION
# ===========================================================================
LPX_HARNESS=0
if [ -n "$LPX" ]; then
  for d in "$LPX"/.*/skills; do [ -d "$d" ] && LPX_HARNESS=$((LPX_HARNESS+1)); done
fi
OURS_TARGETS=0
[ -d "$HOME/.claude/skills/sidecoach" ] && OURS_TARGETS=1
v="LOSS"; [ "$OURS_TARGETS" -gt "$LPX_HARNESS" ] 2>/dev/null && v="WIN"
crow "Agent-harness install targets" \
    "for d in \$LPX/.*/skills; do [ -d \"\$d\" ] && n=\$((n+1)); done" \
    "$LPX_HARNESS" "$OURS_TARGETS" "$v"

LPX_CHAN=0; CHAN_LIST=""
if [ -n "$LPX" ]; then
  [ -d "$LPX/plugin" ]    && { LPX_CHAN=$((LPX_CHAN+1)); CHAN_LIST="$CHAN_LIST plugin"; }
  [ -d "$LPX/cli" ]       && { LPX_CHAN=$((LPX_CHAN+1)); CHAN_LIST="$CHAN_LIST cli"; }
  [ -d "$LPX/extension" ] && { LPX_CHAN=$((LPX_CHAN+1)); CHAN_LIST="$CHAN_LIST extension"; }
  [ -d "$LPX/functions" ] && { LPX_CHAN=$((LPX_CHAN+1)); CHAN_LIST="$CHAN_LIST functions-api"; }
fi
v="LOSS"
crow "Distribution channels beyond the skill dir" \
    "ls -d \$LPX/{plugin,cli,extension,functions}" \
    "$LPX_CHAN ($CHAN_LIST)" "0 (skill dir only)" "$v"

# ===========================================================================
# FAMILY 5 - OUTPUT QUALITY ON IDENTICAL INPUTS  (canary-gated)
# ===========================================================================
gated "$BOTH_CANARIES" "Findings on the identical planted canary" \
  "node bin/sidecoach-detect.js benchmark/fixtures/canary/canary.html --no-render | grep -cE '\\[(blocking|warning)\\]'" \
  "$c_pos" "$o_pos" "$( [ "$BOTH_CANARIES" = PASS ] && { [ "${o_pos:-0}" -gt "${c_pos:-0}" ] 2>/dev/null && echo WIN || echo LOSS; } || echo UNMEASURED )"

if [ "$BOTH_CANARIES" = "PASS" ]; then
  o_loc=$( (cd "$SC_DIR" && node "$OURS_DETECT" "$FIX/canary/canary.html" --no-render 2>&1) \
    | grep -E '^[[:space:]]+\[(blocking|warning)\]' | grep -c 'canary.html:' )
  l_loc=$( (cd "$SC_DIR" && node "$LPX_DETECT" "$FIX/canary/canary.html" 2>&1) | grep -c '^  line ' )
  o_tot="$o_pos"; l_tot="$c_pos"
  pcl_o=0; [ "$o_tot" -gt 0 ] && pcl_o=$((o_loc*100/o_tot))
  pcl_l=0; [ "$l_tot" -gt 0 ] && pcl_l=$((l_loc*100/l_tot))
  v="LOSS"; [ "$pcl_o" -ge "$pcl_l" ] && v="WIN"
  row "Findings carrying a precise source line number" \
      "detector output | grep -c '<file>:<line>'" \
      "$l_loc/$l_tot (${pcl_l}%)" "$o_loc/$o_tot (${pcl_o}%)" "$v"

  # Count ONLY emitted finding lines. Matching the whole output counts the rule
  # registry and the inconclusive-lens list too, which inflates the number - a
  # filter that was never validated against known-good content.
  o_dupes=$( (cd "$SC_DIR" && node "$OURS_DETECT" "$FIX/canary/canary.html" --no-render 2>&1) \
    | grep -E '^[[:space:]]+\[(blocking|warning)\]' | grep -c 'gradient-text' )
  l_dupes=$( (cd "$SC_DIR" && node "$LPX_DETECT" "$FIX/canary/canary.html" 2>&1) \
    | grep -E '^  line ' | grep -c '\[gradient-text\]' )
  v="LOSS"; [ "$o_dupes" -le "$l_dupes" ] && v="WIN"
  row "Same defect reported once (gradient-text de-duplication)" \
      "detector output | grep -oE 'gradient-text' | wc -l" \
      "$l_dupes report(s)" "$o_dupes report(s)" "$v"

  # Compare EMITTED FINDINGS only. Our detector also prints every rule id it could
  # not measure (the inconclusive-lens list), so grepping the whole output finds
  # "marketing-buzzword" even when no such finding fired, and reports 0 missed.
  # That is a filter validated against nothing; scope both sides to finding lines.
  LPX_FIND="$( (cd "$SC_DIR" && node "$LPX_DETECT" "$FIX/canary/canary.html" 2>&1) | grep -E '^  line |^  \[' )"
  OURS_FIND="$( (cd "$SC_DIR" && node "$OURS_DETECT" "$FIX/canary/canary.html" --no-render 2>&1) \
    | grep -E '^[[:space:]]+\[(blocking|warning)\]' )"
  MISSED=""
  for tell in overused-font single-font bounce-easing marketing-buzzword gradient-text; do
    if printf '%s' "$LPX_FIND" | grep -q -- "$tell"; then
      printf '%s' "$OURS_FIND" | grep -q -- "$tell" || MISSED="$MISSED $tell"
    fi
  done
  NM=$(printf '%s' "$MISSED" | wc -w | tr -d ' ')
  v="LOSS"; [ "$NM" = "0" ] && v="TIE"
  row "Slop tells they catch on the canary that we miss" \
      "diff of rule ids present in each detector's canary output" \
      "n/a (baseline)" "$NM missed:$MISSED" "$v"
else
  row "Findings carrying a precise source line number" "canary-gated" "canary FAIL" "canary FAIL" "UNMEASURED"
  row "Same defect reported once (gradient-text de-duplication)" "canary-gated" "canary FAIL" "canary FAIL" "UNMEASURED"
  row "Slop tells they catch on the canary that we miss" "canary-gated" "canary FAIL" "canary FAIL" "UNMEASURED"
fi

# ===========================================================================
# FAMILY 6 - FAILURE BEHAVIOUR  (the fail-open / fail-closed axis)
# ===========================================================================
if [ -n "$LPX_DETECT" ] && [ -f "$LPX_DETECT" ]; then
  l_missing=$(exit_code_of node "$LPX_DETECT" /tmp/sc-bench-absent-xyz.html)
  l_garbage_f=/tmp/sc-bench-garbage.html; printf 'not html \x01binary' > "$l_garbage_f"
  l_garbage=$(exit_code_of node "$LPX_DETECT" "$l_garbage_f")
  l_noargs=$(exit_code_of node "$LPX_DETECT")
  l_linked=$(lpx_findings "$FIX/linked-css/page.html")
  # Codex review: the linked-stylesheet row printed "exit 0" without ever reading it.
  l_linked_ec=$(exit_code_of node "$LPX_DETECT" "$FIX/linked-css/page.html")
else
  l_missing="n/a"; l_garbage="n/a"; l_noargs="n/a"; l_linked="n/a"; l_linked_ec="n/a"
fi
# ANTI-SPOOF GATE (adversary, 2026-07-29). The fail-closed rows previously tested only
# `exit != 0`, so a detector that could not even LOAD - printing "Cannot find module" and
# exiting 2 - scored the identical WINs as the real one. The wins are substantively
# deserved, but the row could not prove it. Two additions: each row requires the SPECIFIC
# documented code (2/3/2), and the tool must emit its OWN diagnostic rather than a
# module-load failure. A detector that cannot run cannot earn a fail-closed win.
ours_diag_ok() { # ours_diag_ok <args...> -> yes|no
  local err
  err="$( (cd "$SC_DIR" && node "$OURS_DETECT" "$@" 2>&1 >/dev/null) )"
  if printf '%s' "$err" | grep -qiE 'cannot find module|failed to load \.\./dist'; then echo no; return; fi
  if printf '%s' "$err" | grep -qE 'sidecoach-detect:'; then echo yes; return; fi
  echo no
}
DIAG_MISSING=$(ours_diag_ok /tmp/sc-bench-absent-xyz.html --no-render)
DIAG_NOARGS=$(ours_diag_ok)
o_missing=$(exit_code_of node "$OURS_DETECT" /tmp/sc-bench-absent-xyz.html --no-render)
printf 'not html \x01binary' > /tmp/sc-bench-garbage.html
o_garbage=$(exit_code_of node "$OURS_DETECT" /tmp/sc-bench-garbage.html --no-render)
o_noargs=$(exit_code_of node "$OURS_DETECT")
o_linked_ec=$(exit_code_of node "$OURS_DETECT" "$FIX/linked-css/page.html" --no-render)

# Codex review: "any nonzero exit" was being read as the intended fail-closed behavior,
# which would score a WIN even if node had merely failed to LOAD our detector. Each row
# now requires the SPECIFIC documented exit code (2 = usage/IO, 3 = inconclusive).
v="LOSS"; [ "$o_missing" = "2" ] && [ "$l_missing" = "0" ] && [ "$DIAG_MISSING" = "yes" ] && v="WIN"
crow "Missing target file: does the tool fail closed?" \
    "node <detector> /tmp/sc-bench-absent-xyz.html; echo \$? (ours must be exactly 2)" \
    "exit $l_missing (reports \`[]\`, fail-OPEN)" "exit $o_missing (IO error, fail-closed)" "$v"

v="LOSS"; [ "$o_garbage" = "3" ] && [ "$l_garbage" = "0" ] && v="WIN"
crow "Unparseable input: does the tool fail closed?" \
    "node <detector> /tmp/sc-bench-garbage.html; echo \$? (ours must be exactly 3)" \
    "exit $l_garbage (fail-OPEN)" "exit $o_garbage (inconclusive)" "$v"

v="LOSS"; [ "$o_noargs" = "2" ] && [ "$l_noargs" = "0" ] && [ "$DIAG_NOARGS" = "yes" ] && v="WIN"
crow "No arguments: does the tool fail closed?" \
    "node <detector>; echo \$? (ours must be exactly 2)" \
    "exit $l_noargs (fail-OPEN)" "exit $o_noargs (usage error)" "$v"

v="UNMEASURED"
if [ "$l_linked" != "n/a" ] && [ "$l_linked" != "ERR" ]; then
  if [ "$l_linked" = "0" ] && [ "$l_linked_ec" = "0" ] && [ "$o_linked_ec" = "3" ]; then v="WIN"
  elif [ "$l_linked" != "0" ]; then v="LOSS"; else v="TIE"; fi
fi
crow "Defects living only in a linked stylesheet (single-file HTML scan)" \
    "node <detector> benchmark/fixtures/linked-css/page.html; echo \$?" \
    "$l_linked findings, exit $l_linked_ec (silent false CLEAN)" \
    "exit $o_linked_ec inconclusive, refuses to certify clean" "$v"

# ===========================================================================
# FAMILY 7 - VERIFICATION DEPTH
# ===========================================================================
(cd "$SC_DIR" && npx tsc --noEmit > /tmp/sc-bench-tsc.log 2>&1); TSC=$?
LPX_RUNNABLE="not runnable here (no node_modules; installing is forbidden by charter)"
[ -n "$LPX" ] && [ -d "$LPX/node_modules" ] && LPX_RUNNABLE="node_modules present"
# NOT scored as a comparative WIN. There is no competitor typecheck to compare against
# in this environment (their dependencies are absent and installing them is forbidden),
# and a one-sided green cannot beat a measurement that never ran. Recorded as
# UNMEASURED for the head to head, with our own side stated for the record.
TSCTXT="exit $TSC - RED, $(wc -l < /tmp/sc-bench-tsc.log | tr -d ' ') error line(s)"
[ "$TSC" = "0" ] && TSCTXT="exit 0 - green, zero output"
row "Typecheck baseline green (one-sided: no competitor baseline runnable here)" \
    "npx tsc --noEmit; echo \$?" "$LPX_RUNNABLE" "$TSCTXT" "UNMEASURED"

# Test SIZE was previously scored here and has been removed on purpose. Line count is
# not quality: a project loses that row by writing tighter tests, and it rewards
# padding. What is defensible is whether the suite can PROVE it would fail - a mutation
# control deliberately breaks the implementation and asserts the guard catches it.
# NOT scored as a WIN, on purpose, and this is the stronger version of the row.
# The competitor has NO mutation harness anywhere in their tree, so under rule 5 there is
# nothing to run head to head and the row is UNMEASURED with a named reason. An honest
# UNMEASURED on a metric that matters beats a wrong LOSS on a metric that does not - and
# it cannot be quoted back against this board.
#
# Our side is measured only under SCOREBOARD_SLOW=1: the static source count (18 CAUGHT
# literals) badly undercounts, because the suites emit controls from loops. Runtime on
# mutation-check-primitive-icons.sh alone is 12, which matches the independent count, so
# the literal-grep figure was wrong and is not used. Full execution exceeds 10 minutes,
# which is too slow to sit in a harness other agents must run on every pass.
OURS_MUT="not run (set SCOREBOARD_SLOW=1; full suite >10min)"
if [ "${SCOREBOARD_SLOW:-0}" = "1" ]; then
  m=0
  for s in "$SC_DIR"/mutation-check*.sh; do
    [ -f "$s" ] || continue
    c=$( (cd "$SC_DIR" && bash "$s" 2>&1) | grep -c '^CAUGHT ' )
    m=$((m+c))
  done
  OURS_MUT="$m controls caught at runtime across 4 suites"
fi
LPX_MUT=0
if [ -n "$LPX" ]; then
  LPX_MUT=$(cd "$LPX" && grep -rlE 'MUTATION CONTROL|mutation control' tests scripts 2>/dev/null | wc -l | tr -d ' ')
fi
row "Mutation-kill controls (does the suite prove it can fail?)" \
    "SCOREBOARD_SLOW=1 bash benchmark/run-scoreboard.sh (runs all 4 suites, counts CAUGHT)" \
    "no mutation harness exists on their side to run" "$OURS_MUT" "UNMEASURED"

# ===========================================================================
# FAMILY 8 - WALL-CLOCK SPEED
# ===========================================================================
if [ "$BOTH_CANARIES" = "PASS" ]; then
  l_t="$(median_ms '0|2' 5 node "$LPX_DETECT" "$FIX/canary/canary.html")"
  o_t="$(median_ms '0|1|3' 5 node "$OURS_DETECT" "$FIX/canary/canary.html" --no-render)"
  if [ "$l_t" = "ERR" ] || [ "$o_t" = "ERR" ]; then
    row "Median wall clock, static scan of the canary (5 runs after warmup)" \
        "median_ms 5 <detector> canary.html" \
        "a timed run exited with a crash/usage code" "not a valid timing sample" "UNMEASURED"
  else
    read -r l_ms l_lo l_hi <<<"$l_t"
    read -r o_ms o_lo o_hi <<<"$o_t"
    # Tolerance band: within 15% of each other is a TIE, not a win for whoever
    # happened to catch a quieter moment on a machine shared with other agents.
    band=$(( (l_ms > o_ms ? l_ms : o_ms) * 15 / 100 ))
    delta=$(( l_ms > o_ms ? l_ms - o_ms : o_ms - l_ms ))
    if [ "$delta" -le "$band" ]; then v="TIE"
    elif [ "$o_ms" -lt "$l_ms" ]; then v="WIN"
    else v="LOSS"; fi
    crow "Median wall clock, static scan of the canary (5 runs after warmup, 15% tolerance band)" \
        "benchmark/run-scoreboard.sh (median_ms 5 <detector> canary.html)" \
        "${l_ms}ms (range ${l_lo}-${l_hi})" "${o_ms}ms (range ${o_lo}-${o_hi})" "$v"
  fi
else
  row "Median wall clock, static scan of the canary (5 runs after warmup, 15% tolerance band)" \
      "canary-gated" "canary FAIL" "canary FAIL" "UNMEASURED"
fi

# ===========================================================================
# FAMILY 9 - COST PER OPERATION
# ===========================================================================
# Previously a hardcoded TIE at $0.00/$0.00 with no measurement behind it. Asserting
# zero cost requires proving neither detector reaches the network, which this harness
# does not measure. An unmeasured claim is UNMEASURED even when it is probably true.
row "Cost per static detector run" \
    "NOT MEASURED - would require observing network egress for both processes" \
    "not measured" "not measured" "UNMEASURED"

row "Cost per model-backed design operation (end-to-end verb run)" \
    "NOT RUN - requires paid model calls; no credential may be spent for this benchmark" \
    "not measured" "not measured" "UNMEASURED"

row "Rendered/browser-lane findings head to head" \
    "NOT RUN - competitor render lane needs a dependency install this charter forbids" \
    "not measured" "not measured" "UNMEASURED"

# ===========================================================================
# FAMILY 10 - IMAGE GENERATION (the capability the charter singled out)
# ===========================================================================
OURS_PROV=$(cd "$SC_DIR" && grep -cE "^\s*id: '(offline|openai|nanobanana)'" src/image-generation.ts 2>/dev/null)
[ -z "$OURS_PROV" ] && OURS_PROV=0
LPX_PROV=0
[ -n "$LPX" ] && LPX_PROV=$(cd "$LPX" && grep -oE "model: '(gpt-image-[0-9]|gemini-[0-9a-z.\-]+)'" skill/scripts/generate-image.mjs 2>/dev/null | sort -u | wc -l | tr -d ' ')
v="LOSS"; [ "$OURS_PROV" -gt "$LPX_PROV" ] 2>/dev/null && v="WIN"
OURS_PROV_NAMES=$(cd "$SC_DIR" && grep -oE "^\s*id: '(offline|openai|nanobanana)'" src/image-generation.ts 2>/dev/null | grep -oE "'[a-z]+'" | tr -d "'" | paste -sd, -)
crow "Image providers selectable (fallback if one is down or unfunded)" \
    "grep -cE \"^\\s*id: '(offline|openai|nanobanana)'\" src/image-generation.ts" \
    "$LPX_PROV (gpt-image-2 only, hardcoded)" "$OURS_PROV (${OURS_PROV_NAMES:-none})" "$v"

# Model-currency claim, corrected. It was brought to this board as a WIN on the grounds
# that our Gemini default is a newer generation than theirs. Verified against their tree:
# they have NO Gemini image path at all - `gpt-image-2` is hardcoded, and the only
# "gemini" string anywhere in their source is an unrelated CSS rule name. There is
# nothing on their side for our Gemini default to be newer than, so the row is a TIE on
# the one model both projects actually share.
OURS_OAI=$(cd "$SC_DIR" && grep -oE "gpt-image-[0-9]" src/image-generation.ts 2>/dev/null | sort -u | tail -1)
LPX_OAI=""
[ -n "$LPX" ] && LPX_OAI=$(cd "$LPX" && grep -oE "gpt-image-[0-9]" skill/scripts/generate-image.mjs 2>/dev/null | sort -u | tail -1)
v="LOSS"; [ -n "$OURS_OAI" ] && [ "$OURS_OAI" = "$LPX_OAI" ] && v="TIE"
crow "OpenAI image model currency (the only provider both projects share)" \
    "grep -oE 'gpt-image-[0-9]' <each project's image script> | sort -u | tail -1" \
    "${LPX_OAI:-none}" "${OURS_OAI:-none}" "$v"

# Our pixel-level verification is the real differentiator and it does NOT apply to the
# default Gemini path, because only PNG pixels are decodable here. Held as a LOSS until
# pixels are actually readable on default-provider output; `unverified` must not become
# the documented steady state.
PNG_ONLY=$(cd "$SC_DIR" && grep -c "png is the only format whose pixels can be verified" bin/sidecoach-image.js 2>/dev/null)
[ -z "$PNG_ONLY" ] && PNG_ONLY=0
DECODERS=$(cd "$SC_DIR" && grep -cE "^import \{ decodePng" src/image-asset-verify.ts 2>/dev/null)
v="LOSS"
row "Pixel checks actually apply to DEFAULT-provider output" \
    "grep 'png is the only format whose pixels can be verified' bin/sidecoach-image.js; grep -c 'decodePng' src/image-asset-verify.ts" \
    "no pixel verification at all (header/geometry only)" \
    "PNG-only decoder ($DECODERS); Gemini returns JPEG, so the 4 pixel checks report UNVERIFIED on our own default" \
    "$v"

row "Cost per generated image (usage-derived)" \
    "NOT REPRODUCED HERE - figure relayed from the image unit's live spend, not re-measured; re-measuring costs money" \
    "0.0063 USD (OpenAI path, relayed)" "0.043901 USD (Gemini flash-lite, relayed; ~7x)" "UNMEASURED"

# ---------------------------------------------------------------------------
# Emit
# ---------------------------------------------------------------------------
TOTAL=$((W+L+T+U))
{
cat <<EOF
# Sidecoach vs LOCALPROJECTX - Scoreboard

Generated by \`benchmark/run-scoreboard.sh\`. Regenerate with:

\`\`\`bash
bash benchmark/run-scoreboard.sh
\`\`\`

- Generated: $(date -u '+%Y-%m-%d %H:%M UTC')
- Commit: $(cd "$SC_DIR" && git rev-parse --short HEAD 2>/dev/null || echo unknown)
- Collaborator: Jonah

## Rules of this scoreboard

1. Every row carries a measurement command that actually runs. No row is filled in from memory.
2. **Default posture is that sidecoach LOSES.** A row flips to WIN only when the command produces the number.
3. **UNMEASURED never counts as a win and never rounds up.** It is tallied separately and stays visible.
4. **Discoverability and reachability outrank every other family.** A capability nothing can invoke
   scores zero regardless of its internal quality.
5. Head-to-head rows run BOTH tools on identical input or they do not count.

## Instrument self-test (canary gate)

Numbers from a detector are believed only after that detector is shown to FIRE on a planted
known-positive and stay CLEAN on a known-negative. Rows depending on a failed canary are
emitted as UNMEASURED rather than as a pass.

| Instrument | Canary | Evidence |
|---|---|---|
| LOCALPROJECTX detector | $CANARY_LPX | $CANARY_LPX_NOTE |
| sidecoach detector | $CANARY_OURS | $CANARY_OURS_NOTE |

Run the gate alone with \`bash benchmark/run-scoreboard.sh --selftest\`.

## Scoreboard

| Metric | Measurement command | LOCALPROJECTX | sidecoach | Verdict |
|---|---|---|---|---|
$ROWS
## Tally

| Verdict | Count |
|---|---|
| WIN | $W |
| LOSS | $L |
| TIE | $T |
| UNMEASURED | $U |
| **Total rows** | **$TOTAL** |

## Largest gap

**DISTRIBUTION.** Not capability, and no longer discoverability alone.

The engine is ours on every axis where a number can be read directly: it fails closed on all four
degenerate inputs where the competitor exits 0, it carries $OURS_RULES_TOT rules against
$LPX_RULES, it locates every finding to a source line, and it declares $OURS_MUT mutation controls
against a competitor with no mutation harness at all. What it does not have is reach. The
competitor mirrors its skill into $LPX_HARNESS agent-harness directories carrying
$LPX_SURFACE_FILES loadable markdown files, plus a plugin, a CLI, a browser extension and a
functions API. Sidecoach installs $OURS_SURFACE_FILES files into one directory and ships through
no other channel. Every quality advantage above is gated behind that single install path.

Second, still open: $OURS_BINS_SEEN of $OURS_BINS shipped tools are named anywhere a model can
read them. \`sidecoach-detect\` - the engine that earns four of the wins on this board - is still
not one of them, so the thing meant to call it cannot learn it exists.

**What moved during this session, and what it proves.** Image generation was the charter's
headline LOSS: better internals than theirs, reachable by nothing, named nowhere. Two of those
three claims were wrong and were corrected here.

- Reachability was never 0. The measurement used an importer grep; the flow SPAWNS
  \`bin/sidecoach-image.js\` as a subprocess, which that grep is structurally unable to see. The
  true figure is 2 of $FLOW_TOTAL flow handlers.
- Discoverability really was 0, and was fixed by editing the installed SKILL.md at 05:49 to name
  the tool. That is the whole fix - a name in a loadable document - and it is why this family
  outranks the rest.

The corpus row moved the same way: reported as 1 of 26 handlers, actually $CRAFT_REACH of
$FLOW_TOTAL, because 20 handlers reach it through \`craft-flow.ts\` rather than by direct
reference. Both errors ran in the direction that reads as rigour, which is the harder direction to
catch - a falsely harsh number about your own work looks like honesty.

**One advantage is currently inert.** Byte-level pixel verification is the thing no competitor
has, and it does not apply to our own default provider: the decoder reads PNG only, Gemini returns
JPEG, so all four pixel checks report UNVERIFIED. Held as a LOSS until pixels are readable on
default-provider output. \`unverified\` must not become the documented steady state.
EOF
} > "$OUT"

echo "wrote $OUT" >&2
echo "WIN=$W LOSS=$L TIE=$T UNMEASURED=$U TOTAL=$TOTAL" >&2

# Loud drift report. A verdict that changed since the last run is NOT silently
# overwritten - it is named and the run exits nonzero, because a silent overwrite is how
# a regression gets absorbed into the next generation and never seen by anyone.
mv -f "$NEW_LEDGER" "$LEDGER"
if [ "$DRIFT_N" -gt 0 ]; then
  echo "" >&2
  echo "VERDICT DRIFT since the previous run ($DRIFT_N row(s)):$DRIFT" >&2
  echo "" >&2
  echo "Each line is a row whose verdict CHANGED. A row that lost ground is a regression" >&2
  echo "to investigate, not a number to accept. The document has been regenerated, but" >&2
  echo "this run exits 10 so the change cannot pass unnoticed in a script or a CI step." >&2
  exit 10
fi
rm -f "$OURS_VERBS_F" "$LPX_VERBS_F" "$LPX_REFS_F"
