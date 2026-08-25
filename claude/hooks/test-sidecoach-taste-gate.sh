#!/bin/bash
# Regression harness for sidecoach-taste-gate.sh.
#
# Drives the gate through its REAL PostToolUse entry point (JSON on stdin -> hook), never a
# hand-called function, so it proves the wiring the developer actually hits. It creates a throwaway
# design project (a dir with a DESIGN.md) in the system temp dir - OUTSIDE any .claude/ or
# sidecoach/ path so the gate's own scope guards do not exclude it - drops fixtures with known
# defects, and asserts the injected findings.
#
# The rendered detectors (marketing-buzzword / tiny-text / low-contrast) need the matching
# Playwright browser. The harness PROBES whether the rendered lane is up and gates those
# assertions on it: with a browser it asserts the findings; without one it asserts the gate's
# fail-closed "NOT CHECKED" coverage note instead, and SKIPS (never fails) the finding checks.
# The static assertions (gradient-text ban, silence outside a project, override) run either way.
#
# Exit 0 = all assertions passed (skips allowed); 1 = an assertion failed; 2 = cannot run.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$ROOT/claude/hooks/sidecoach-taste-gate.sh"
SC="${SIDECOACH_DIR:-$ROOT/sidecoach}"
DETECT="$SC/bin/sidecoach-detect.js"

PASS=0; FAIL=0; SKIP=0
ok()   { echo "  ok   - $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL - $1"; FAIL=$((FAIL+1)); }
skip() { echo "  skip - $1"; SKIP=$((SKIP+1)); }

[ -x "$HOOK" ]   || { echo "PRECONDITION: hook not executable: $HOOK"; exit 2; }
[ -f "$DETECT" ] || { echo "PRECONDITION: detect CLI missing: $DETECT"; exit 2; }
if [ ! -e "$SC/node_modules" ]; then
  echo "CANNOT RUN: $SC/node_modules absent - run 'npm ci' (or 'npm install') in $SC first."
  exit 2
fi

PROJ="$(mktemp -d)"        # a design project (has DESIGN.md)
NOPROJ="$(mktemp -d)"      # a plain dir (no DESIGN.md)
TMPHOME="$(mktemp -d)"     # isolate ~/.claude/.suppress-taste-gate from the real dotfile
mkdir -p "$TMPHOME/.claude"
cleanup() { rm -rf "$PROJ" "$NOPROJ" "$TMPHOME"; }
trap cleanup EXIT

printf '# Design\n\nMinimal DESIGN.md so this dir reads as a sidecoach project.\n' > "$PROJ/DESIGN.md"

# --- buzzword-heavy page (>=2 distinct PEAK terms so the v4 gate qualifies it) ---
cat > "$PROJ/buzz.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Platform</title></head>
<body style="font-family:system-ui;max-width:720px;margin:2rem auto;color:#111">
<h1>Revolutionary, world-class platform</h1>
<p>Our seamless, game-changing, best-in-class solution supercharges your workflow with
cutting-edge, next-generation synergy. Unlock revolutionary, world-class outcomes with our
seamless platform. Supercharge productivity with game-changing, best-in-class technology.</p>
<p>Experience frictionless, turnkey, revolutionary performance. Our supercharged, best-in-class
engine delivers seamless, world-class results at scale.</p>
</body></html>
HTML

# --- clean, concrete technical prose (must not trip any taste detector) ---
cat > "$PROJ/clean.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Latency notes</title></head>
<body style="font-family:system-ui;max-width:720px;margin:2rem auto;color:#111;line-height:1.6">
<h1>Request latency in the ingestion pipeline</h1>
<p>The ingestion service batches writes every 200ms and flushes to the write-ahead log before
acknowledging the client. Under load the p99 latency is dominated by fsync on the log segment.</p>
<h2>Tuning the batch window</h2>
<p>Widening the batch window to 500ms cut fsync calls by 60% and reduced p99 from 34ms to 12ms.</p>
</body></html>
HTML

# --- tiny type across the bulk of the content ---
cat > "$PROJ/tiny.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tiny</title></head>
<body style="font-family:system-ui;color:#111">
<main style="font-size:11px;line-height:1.4;max-width:600px;margin:2rem auto">
<h1 style="font-size:13px">Release notes</h1>
<p>The scheduler now coalesces adjacent wake-ups within a 5ms window to reduce timer churn. This
paragraph is deliberately long so the char-weighted proportion of content text at or below
thirteen pixels comfortably clears the fifteen percent floor the tiny-text detector uses.</p>
<p>More undersized body copy so the page reads as genuinely tiny across the bulk of its content
rather than one stray label that would not qualify as a page-level defect.</p>
</main></body></html>
HTML

# --- light gray body text on white (fails contrast) ---
cat > "$PROJ/lowcontrast.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Low contrast</title></head>
<body style="font-family:system-ui;background:#ffffff">
<main style="max-width:600px;margin:2rem auto;font-size:16px;line-height:1.6">
<h1 style="color:#cfcfcf">Quiet heading</h1>
<p style="color:#cccccc">This paragraph is a very light gray on white, well under the 4.5:1 body
contrast minimum, so it should register as a low-contrast objective defect when rendered.</p>
</main></body></html>
HTML

# --- CSS with two absolute bans (browser-independent: static lenses catch these) ---
cat > "$PROJ/styles.css" <<'CSS'
.hero-title {
  background: linear-gradient(90deg, #7c3aed, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.card { border-left: 4px solid #7c3aed; padding-left: 1rem; }
CSS

printf 'const x = 1;\n' > "$PROJ/notes.js"   # a non-UI file the gate must ignore

# Drive the hook exactly as the harness does: PostToolUse JSON on stdin.
#
# IMPORTANT: keep the REAL $HOME here. Playwright resolves its browser cache from
# $HOME/Library/Caches/ms-playwright, so overriding HOME would hide the installed browser and
# push every .html run onto the fail-closed gap path - which is exactly the bug an earlier draft
# of this harness hit. Only the override test (below) sets a temp HOME, and it runs on a .css file
# that never renders, so it is unaffected.
run() {
  printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$1" \
    | SIDECOACH_DIR="$SC" bash "$HOOK" 2>/dev/null
}

# Probe: is the rendered subjective lane available in this environment?
RENDER_OK=0
if node "$DETECT" "$PROJ/clean.html" --quiet 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.exit(j.lenses&&j.lenses.subjective&&j.lenses.subjective.available?0:1)}catch(e){process.exit(1)}})'; then
  RENDER_OK=1
fi
echo "rendered taste lane available: $([ $RENDER_OK = 1 ] && echo yes || echo 'no (finding assertions will be skipped, gap-note asserted instead)')"
echo

# Assertions match on CONCRETE rendered details ("buzzword density", "content text", "need 4.5:1")
# that appear ONLY in a real finding line - never in the gap note, which merely lists the rule
# names. Matching a bare rule name would false-pass off the gap note's own wording.
echo "[1] buzzword page"
OUT="$(run "$PROJ/buzz.html")"
if [ "$RENDER_OK" = 1 ]; then
  echo "$OUT" | grep -q "buzzword density" && ok "marketing-buzzword flagged (density measured)" || bad "expected 'buzzword density' finding; got: $OUT"
  echo "$OUT" | grep -q "SHOULD FIX" && ok "grouped under SHOULD FIX (warning)" || bad "expected SHOULD FIX section"
else
  echo "$OUT" | grep -q "NOT CHECKED" && ok "fail-closed gap note fired (no browser)" || bad "expected NOT CHECKED gap note; got: $OUT"
  skip "marketing-buzzword finding (rendered lane down)"
fi

echo "[2] clean page -> no false alarm"
OUT="$(run "$PROJ/clean.html")"
if [ "$RENDER_OK" = 1 ]; then
  [ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok "clean page produced no findings ({})" || bad "clean page should be silent; got: $OUT"
else
  skip "clean-page silence (rendered lane down would emit gap note, not a finding)"
fi

echo "[3] tiny-text page"
OUT="$(run "$PROJ/tiny.html")"
if [ "$RENDER_OK" = 1 ]; then
  echo "$OUT" | grep -q "content text" && ok "tiny-text flagged (content-text proportion measured)" || bad "expected tiny-text 'content text' finding; got: $OUT"
else
  skip "tiny-text finding (rendered lane down)"
fi

echo "[4] low-contrast page"
OUT="$(run "$PROJ/lowcontrast.html")"
if [ "$RENDER_OK" = 1 ]; then
  echo "$OUT" | grep -Eq "need (4\.5|3):1" && ok "low-contrast flagged (ratio measured)" || bad "expected a measured contrast ratio; got: $OUT"
  echo "$OUT" | grep -q "MUST FIX" && ok "grouped under MUST FIX (blocking)" || bad "expected MUST FIX section"
  # The rendered `low-contrast` and the registry `a11y.color-contrast` are ONE defect - the alias
  # must fold them into a single group, so no separate `color-contrast` line survives.
  echo "$OUT" | grep -q "color-contrast" && bad "contrast should collapse to one group; saw a separate color-contrast line: $OUT" || ok "contrast deduped to one group (no split color-contrast line)"
else
  skip "low-contrast finding (rendered lane down)"
fi

echo "[5] CSS with absolute bans (browser-independent)"
OUT="$(run "$PROJ/styles.css")"
echo "$OUT" | grep -q "gradient-text" && ok "gradient-text ban flagged" || bad "expected gradient-text; got: $OUT"
echo "$OUT" | grep -q "MUST FIX" && ok "ban grouped under MUST FIX (blocking)" || bad "expected MUST FIX section"

echo "[6] accepted-exception filter"
printf '{"accept":[{"ban":"gradient-text","file":"styles.css"}]}' > "$PROJ/.sidecoach-accept.json"
OUT="$(run "$PROJ/styles.css")"
echo "$OUT" | grep -q "gradient-text" && bad "gradient-text should be suppressed by accept list; got: $OUT" || ok "accepted gradient-text suppressed"
echo "$OUT" | grep -q "side-stripe-borders" && ok "un-accepted side-stripe-borders still flagged" || bad "side-stripe-borders should remain; got: $OUT"
rm -f "$PROJ/.sidecoach-accept.json"

echo "[7] file NOT under a DESIGN.md project -> silent"
cp "$PROJ/buzz.html" "$NOPROJ/buzz.html"
OUT="$(run "$NOPROJ/buzz.html")"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok "no DESIGN.md ancestor -> silent" || bad "expected silence outside a project; got: $OUT"

echo "[8] non-UI file -> silent"
OUT="$(run "$PROJ/notes.js")"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok "non-.html/.css ignored" || bad "expected silence on .js; got: $OUT"

echo "[9] 30-minute override -> silent"
# Isolate the override with a temp HOME so it cannot touch the real ~/.claude/.suppress-taste-gate.
# The override short-circuits before any render, and this runs on a .css anyway, so the temp HOME
# (with no Playwright browser under it) is harmless here.
touch "$TMPHOME/.claude/.suppress-taste-gate"
OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$PROJ/styles.css" \
        | HOME="$TMPHOME" SIDECOACH_DIR="$SC" bash "$HOOK" 2>/dev/null)"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok "suppress flag silences the gate" || bad "override should silence; got: $OUT"
rm -f "$TMPHOME/.claude/.suppress-taste-gate"

echo "[10] engine missing -> fail-closed 'could NOT run' (NOT silent)"
# Point at a nonexistent engine AND a temp HOME so the built-in default paths cannot resolve. An
# in-scope UI write whose engine cannot run must announce the page is unverified, never go silent.
OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$PROJ/styles.css" \
        | HOME="$TMPHOME" SIDECOACH_DIR="/nonexistent/sidecoach" bash "$HOOK" 2>/dev/null)"
echo "$OUT" | grep -q "could NOT run" && ok "engine-missing surfaces a fail-closed notice" || bad "expected 'could NOT run'; got: $OUT"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && bad "engine-missing must NOT be silent" || ok "engine-missing is not silent"

echo "[11] detector aborts mid-scan (no lenses in JSON) -> fail-closed, NOT silent"
# Stub engine: passes the sc discovery check (bin + dist present) but emits detect's top-level
# CRASH JSON, which omits `lenses`. The hook must treat an empty lens map as a mid-scan abort and
# fail closed rather than parse it as a clean page and go silent.
STUB="$(mktemp -d)"
mkdir -p "$STUB/bin" "$STUB/dist"
: > "$STUB/dist/absolute-ban-detector.js"
cat > "$STUB/bin/sidecoach-detect.js" <<'JS'
process.stdout.write(JSON.stringify({ verdict: "inconclusive", scanned: false, findings: [],
  unavailableReasons: ["scan aborted: boom-in-scanner"] }) + "\n");
JS
OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$PROJ/styles.css" \
        | SIDECOACH_DIR="$STUB" bash "$HOOK" 2>/dev/null)"
echo "$OUT" | grep -q "could NOT run" && ok "mid-scan abort surfaces a fail-closed notice" || bad "expected 'could NOT run'; got: $OUT"
echo "$OUT" | grep -q "boom-in-scanner" && ok "carries the detector's abort reason" || bad "expected the abort reason; got: $OUT"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && bad "mid-scan abort must NOT be silent" || ok "mid-scan abort is not silent"
rm -rf "$STUB"

# ---------------------------------------------------------------------------
# STATIC-FAMILY BROADENING (ITEM 11). The gate now runs detect's static lenses on the
# whole set of sources detect can statically scan (scanned=true): the CSS family
# (.scss/.sass/.less) and component templates (.vue/.svelte/.jsx/.tsx), not only
# .html/.css. These are browser-independent (they run without the rendered lane), so
# they assert unconditionally. .astro/.styl (scanned=false in detect) stay OUT of scope.
# ---------------------------------------------------------------------------
echo "[12] broadening: .scss with an absolute ban (browser-independent)"
cat > "$PROJ/main.scss" <<'SCSS'
.hero-title {
  background: linear-gradient(90deg, #7c3aed, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
SCSS
OUT="$(run "$PROJ/main.scss")"
echo "$OUT" | grep -q "gradient-text" && ok ".scss gradient-text ban flagged (detect ran on a non-.css stylesheet)" || bad "expected gradient-text on .scss; got: $OUT"
echo "$OUT" | grep -q "MUST FIX" && ok ".scss ban grouped under MUST FIX (blocking)" || bad "expected MUST FIX on .scss; got: $OUT"
echo "$OUT" | grep -q "NOT CHECKED" && bad ".scss must NOT emit a rendered coverage-gap note (static-only source)" || ok ".scss emits no rendered gap note (correct: no renderable target)"

echo "[13] broadening: .vue with a ban inside its <style> block"
cat > "$PROJ/App.vue" <<'VUE'
<template><h1 class="hero-title">Hi</h1></template>
<style>
.hero-title { background: linear-gradient(90deg,#7c3aed,#ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style>
VUE
OUT="$(run "$PROJ/App.vue")"
echo "$OUT" | grep -q "gradient-text" && ok ".vue gradient-text ban flagged (detect scanned the <style> block)" || bad "expected gradient-text on .vue; got: $OUT"

echo "[14] broadening: .svelte with a ban inside its <style> block"
cat > "$PROJ/Card.svelte" <<'SVELTE'
<h1 class="hero-title">Hi</h1>
<style>
.hero-title { background: linear-gradient(90deg,#7c3aed,#ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style>
SVELTE
OUT="$(run "$PROJ/Card.svelte")"
echo "$OUT" | grep -q "gradient-text" && ok ".svelte gradient-text ban flagged" || bad "expected gradient-text on .svelte; got: $OUT"

echo "[15] exclusion boundary: extensions detect cannot statically scan stay silent"
# .astro / .styl report scanned=false in detect - broadening onto them would fire a
# fail-closed 'unverified' note on every edit with no finding behind it, so the gate
# leaves them OUT of scope entirely (silent), exactly like a non-design file.
cp "$PROJ/main.scss" "$PROJ/page.astro"
OUT="$(run "$PROJ/page.astro")"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok ".astro is out of scope -> silent (not fail-closed)" || bad "expected .astro silent; got: $OUT"
printf 'export const x = 1;\n' > "$PROJ/util.ts"
OUT="$(run "$PROJ/util.ts")"
[ "$(printf '%s' "$OUT" | tr -d '[:space:]')" = "{}" ] && ok ".ts non-design source -> silent" || bad "expected .ts silent; got: $OUT"

echo
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" = 0 ] || exit 1
exit 0
