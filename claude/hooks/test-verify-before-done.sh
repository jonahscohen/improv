#!/bin/bash
# Regression tests for verify-before-done.sh (T-0017).
# Run: bash ~/.claude/hooks/test-verify-before-done.sh
#
# Exercises the Bash-branch screenshot-mandate gate against verification-only
# commands (must NOT fire the mandate) and against real deploy/build commands
# (must STILL fire). Origin: 2026-05-28 roadmap session where the hook fired
# 4+ times on plain `npx ts-node ...test.ts` invocations and `npm run bench`
# runs - because `npx ` and `npm run build` were substrings in
# `write_indicators` with no offsetting test-command detector.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HOOK_DIR/verify-before-done.sh"

PASS=0
FAIL=0
FAIL_LABELS=()

# Run the hook with a Bash tool_input.command payload, return the JSON output.
run_hook() {
  local cmd="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$cmd")
  echo "$input" | bash "$HOOK" 2>/dev/null
}

# Assert the hook silently allows the command (no CODE DEPLOYED mandate text).
assert_skips() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(run_hook "$cmd")
  if echo "$out" | grep -q 'CODE DEPLOYED'; then
    echo "FAIL: $label  (expected SKIP, got mandate: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  else
    echo "PASS: $label"
    ((PASS++))
  fi
}

# Assert the hook fires the CODE DEPLOYED mandate for this command.
assert_fires() {
  local label="$1"
  local cmd="$2"
  local out
  # Once-per-episode arming (2026-07-18 reign-in): the nudge fires only when the flag STATE
  # changes, so each fire-case starts from a CLEARED flag to prove THIS command arms from cold.
  # The session-less payload makes the hook write the "global" bucket - clear that, never a
  # live session key, so running this suite cannot disturb a concurrent agent.
  rm -f "$HOME/.claude/.needs-verification.global"
  out=$(run_hook "$cmd")
  if echo "$out" | grep -q 'CODE DEPLOYED'; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label  (expected FIRE, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

echo "===== SKIP: test runners ====="
assert_skips "npm test"                   "npm test"
assert_skips "npm run test"               "npm run test"
assert_skips "npm run test:unit"          "npm run test:unit"
assert_skips "npm run test:e2e -- --watch" "npm run test:e2e -- --watch"
assert_skips "yarn test"                  "yarn test"
assert_skips "pnpm test"                  "pnpm test"
assert_skips "npx vitest"                 "npx vitest"
assert_skips "npx vitest run --reporter=verbose" "npx vitest run --reporter=verbose"
assert_skips "npx jest"                   "npx jest"
assert_skips "npx mocha"                  "npx mocha"
assert_skips "npx playwright test"        "npx playwright test"
assert_skips "npx ts-node test.ts"        "npx ts-node ./foo.test.ts"
assert_skips "npx ts-node test/helpers.ts" "npx ts-node test/helpers.ts"
assert_skips "npx ts-node spec/foo.ts"    "npx ts-node spec/foo.ts"
assert_skips "npx tsx test/spec.ts"       "npx tsx test/spec.ts"
assert_skips "node foo.test.ts"           "node foo.test.ts"
assert_skips "node bar.spec.js"           "node bar.spec.js"
assert_skips "bash test-foo.sh"           "bash test-foo.sh"
assert_skips "bash test-validation-guards.sh"  "bash test-validation-guards.sh"
assert_skips "bash claude/hooks/test-multiple-choice-enforce.sh" "bash claude/hooks/test-multiple-choice-enforce.sh"
assert_skips "cargo test"                 "cargo test"
assert_skips "cargo test --all"           "cargo test --all"
assert_skips "pytest"                     "pytest"
assert_skips "pytest tests/"              "pytest tests/"
assert_skips "python -m pytest"           "python -m pytest"
assert_skips "python3 -m pytest"          "python3 -m pytest tests/unit"
assert_skips "python -m unittest"         "python -m unittest"
assert_skips "go test ./..."              "go test ./..."
assert_skips "bun test"                   "bun test"
assert_skips "deno test"                  "deno test"
assert_skips "rspec spec/"                "rspec spec/"

echo ""
echo "===== SKIP: type checks ====="
assert_skips "npx tsc --noEmit"           "npx tsc --noEmit"
assert_skips "tsc --noEmit"               "tsc --noEmit"
assert_skips "npx tsc -p tsconfig.json"   "npx tsc -p tsconfig.json"
assert_skips "npm run typecheck"          "npm run typecheck"
assert_skips "npm run type-check"         "npm run type-check"
assert_skips "npm run check"              "npm run check"

echo ""
echo "===== SKIP: lint runs ====="
assert_skips "npm run lint"               "npm run lint"
assert_skips "npx eslint src/"            "npx eslint src/"
assert_skips "eslint ."                   "eslint ."
assert_skips "npx prettier --check ."     "npx prettier --check ."
assert_skips "prettier --check src"       "prettier --check src"
assert_skips "npx prettier --list-different src" "npx prettier --list-different src"
assert_skips "npx @google/design.md lint" "npx @google/design.md lint DESIGN.md"
assert_skips "npx stylelint"              "npx stylelint src/**/*.css"

echo ""
echo "===== SKIP: benchmark runs ====="
assert_skips "npm run bench"              "npm run bench"
assert_skips "npm run bench:compare"      "npm run bench:compare"
assert_skips "npm run bench:save-baseline" "npm run bench:save-baseline"
assert_skips "yarn bench"                 "yarn bench"
assert_skips "pnpm bench:compare"         "pnpm bench:compare"

echo ""
echo "===== SKIP: pure introspection ====="
# (Most go through is_read_only_command, but verify a chained git in middle.)
assert_skips "git status"                 "git status"
assert_skips "git log --oneline -10"      "git log --oneline -10"
assert_skips "git diff HEAD"              "git diff HEAD"
assert_skips "ls -la"                     "ls -la"
assert_skips "cat foo.txt"                "cat foo.txt"
assert_skips "grep -r foo src/"           "grep -r foo src/"
assert_skips "find . -name foo"           "find . -name foo"
assert_skips "head -20 file.log"          "head -20 file.log"
assert_skips "wc -l file"                 "wc -l file"
assert_skips "which node"                 "which node"

echo ""
echo "===== FIRE: actual deploy/build paths ====="
assert_fires "npm run build"              "npm run build"
assert_fires "npm run build --watch"      "npm run build --watch"

echo ""
echo "===== FIRE: write redirects + sed -i ====="
# These pre-existed in write_indicators - regression coverage.
assert_fires "cp src/foo.ts dest/"        "cp src/foo.ts dest/"
assert_fires "mv old.ts new.ts"           "mv old.ts new.ts"
assert_fires "sed -i 's/x/y/' src/foo.ts" "sed -i 's/x/y/' src/foo.ts"

echo ""
echo "===== EDGE CASES: chained commands ====="
# Verification-only command CHAINED with build - the build half must win
# (verified by `is_verification_only` returning False when ANY segment
# matches a deploy pattern, then falling through to write_indicators).
assert_fires "npx ts-node test.ts && npm run build"  "npx ts-node ./foo.test.ts && npm run build"
assert_fires "npx tsc --noEmit && npm run build"     "npx tsc --noEmit && npm run build"
assert_fires "npm run bench && npm run build"        "npm run bench && npm run build"
# Verification-only commands chained together - still skip.
assert_skips "npm test && npx tsc --noEmit"          "npm test && npx tsc --noEmit"
assert_skips "npx eslint . && npx prettier --check ." "npx eslint . && npx prettier --check ."
# Piped: lint output filtered through grep - still verification-only.
assert_skips "npx eslint . | grep error"             "npx eslint . | grep error"
# Semicolon-joined verification commands.
assert_skips "npm test; npx tsc --noEmit"            "npm test; npx tsc --noEmit"
# Known limitation (out of scope for T-0017): chains that START with a
# read-only command (git diff && X, ls && X) are intercepted by
# is_read_only_command's startswith() check before the deploy-pattern
# fallthrough can run. Fixing it requires chain-aware tokenization in
# is_read_only_command, separate task.

echo ""
echo "===== NEGATIVE: build look-alikes that should NOT skip ====="
# build:prod is a real build; write_indicators substring match on
# 'npm run build' still triggers, so this fires regardless of T-0017.
assert_fires "npm run build:prod"  "npm run build:prod"

echo ""
echo "===== ARM-SIDE FILE-TYPE FILTER (bug a): a .md-only Bash write must not re-arm ====="
# The flag-SET (arm) side of the Bash branch used to skip the file-type filter
# that the Write/Edit branch already applies via is_code_file. A .md-only write
# (cp/mv/sed/tee touching only markdown) therefore re-armed ~/.claude/.needs-verification
# right after a browser verification cleared it. These cases assert the arm flag
# directly (the stdout mandate is debounce-suppressible, so it is not a reliable
# signal for the arm side). Save + restore the real flag so a live session is safe.
VFLAG="$HOME/.claude/.needs-verification.global"
__VFLAG_EXISTED=no; __VFLAG_SAVED=""
if [ -f "$VFLAG" ]; then __VFLAG_EXISTED=yes; __VFLAG_SAVED="$(cat "$VFLAG" 2>/dev/null)"; fi
restore_vflag() { if [ "$__VFLAG_EXISTED" = yes ]; then printf '%s' "$__VFLAG_SAVED" > "$VFLAG"; else rm -f "$VFLAG"; fi; }

# Start from a CLEARED flag (a browser verification just cleared it), run the hook,
# report whether the arm flag is now present.
arm_state() { rm -f "$VFLAG"; run_hook "$1" >/dev/null 2>&1; [ -f "$VFLAG" ] && echo armed || echo clear; }
assert_no_rearm() {
  local got; got="$(arm_state "$2")"
  if [ "$got" = clear ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected clear, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}
assert_arms() {
  local got; got="$(arm_state "$2")"
  if [ "$got" = armed ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected armed, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}

assert_no_rearm "sed -i on a .md does not re-arm"   "sed -i 's/a/b/' README.md"
assert_no_rearm "cp .md to .md does not re-arm"     "cp draft.md final.md"
assert_no_rearm "tee into a .md does not re-arm"    "tee notes.md < input.txt"
assert_no_rearm "mv a .md does not re-arm"          "mv old.md new.md"
# Controls: a code-file write and a real build MUST still arm.
assert_arms     "cp a .ts (code) still arms"        "cp src/foo.ts dest/app.ts"
assert_arms     "sed -i a .ts (code) still arms"    "sed -i 's/a/b/' src/app.ts"
assert_arms     "npm run build still arms"          "npm run build"
# Intentional PREFERRED false-positive: a code file present only as a READ source
# still arms. We never risk UNDER-arming a real code write, even at the cost of a
# spurious prompt when the actual write target is markdown (feedback_hooks_prefer_false_positives).
assert_arms     "code file as a read source still arms (preferred FP)" "cp src/foo.ts README.md"

echo ""
echo "===== ARM-SIDE: the -> ARROW must not read as a redirect (2026-07-18) ====="
# The old "> " / ">> " substrings also matched the "-> " ARROW, so a for/while/printf compound
# (not in the read-only prefix list) that echoed an arrow falsely armed the gate (Jonah
# 2026-07-18). The redirect indicator now requires a "> "/">> " NOT preceded by a dash. Write
# VERBS stay substring matches, so recall on bash -c / \cp / gsed is untouched - a Codex review
# (2026-07-18) caught an over-engineered de-quote + command-position attempt that had broken
# exactly those, and the minimal dash-guarded redirect is the fold. Negative control: rows 1-3
# armed under the old "> " substring; dropping the (?<!-) guard would re-break them.
assert_no_rearm "for-loop echoing a -> arrow does not arm"           'for h in a.sh b.sh; do echo "$h -> x"; done'
assert_no_rearm "while-loop echoing a -> .css in prose does not arm" 'while read l; do echo "$l -> done.css"; done'
assert_no_rearm "printf of an arrow between .tsx names does not arm" 'printf "%s -> %s" a.tsx b.tsx'
assert_no_rearm "fd-dup 2>&1 (no space) is not a file redirect"      'node script.js 2>&1'
# Recall guards - write verbs stay SUBSTRING matches, so all of these must STILL arm. The
# de-quote attempt Codex rejected broke the bash -c / gsed rows; keep them red-on-regression.
assert_arms     "tee to a QUOTED visual filename still arms"         'tee "src/App.tsx" < input'
assert_arms     "cp of QUOTED css files still arms"                  "cp 'a.css' 'b.css'"
assert_arms     "cp wrapped in bash -lc still arms"                  'bash -lc "cp src/a.ts dst/App.tsx"'
assert_arms     "gsed -i on a css still arms"                        'gsed -i s/a/b/ src/app.css'
assert_arms     "a real > redirect to a code file still arms"        'node gen.js > src/out.css'

# Headline: browser verification clears the flag, a subsequent .md-only write
# must NOT re-arm it (the exact bug).
rm -f "$VFLAG"
run_hook "sed -i 's/a/b/' src/app.ts" >/dev/null 2>&1                                  # code change arms
run_hook "cmux browser --surface surface:01 screenshot --out /tmp/v.png" >/dev/null 2>&1 # verification clears
run_hook "sed -i 's/a/b/' CHANGELOG.md" >/dev/null 2>&1                                 # .md-only write
if [ ! -f "$VFLAG" ]; then echo "PASS: post-clear .md write leaves the flag CLEAR (headline)"; ((PASS++));
else echo "FAIL: post-clear .md write RE-ARMED the flag (headline)"; FAIL_LABELS+=("headline re-arm"); ((FAIL++)); fi

restore_vflag

echo ""
echo "===== REPO-SOURCE HOOK DIR EXEMPTION (U7b issue 3): editing claude/hooks/*.sh must NOT arm ====="
# EXEMPT_PATHS listed only the dot-prefixed deploy dir `.claude/hooks/`, so a Write/Edit
# to the repo SOURCE dir `claude/hooks/` - or a worktree path ending in claude/hooks/ -
# armed the visual-verify flag. Editing a shell hook is not a rendered-UI change; it has
# nothing to screenshot. Assert the arm flag directly through the Write-tool (file_path)
# branch AND the Bash (sed -i) branch. Own save/restore so a live session is safe.
VF2="$HOME/.claude/.needs-verification.global"
__VF2_EXISTED=no; __VF2_SAVED=""
if [ -f "$VF2" ]; then __VF2_EXISTED=yes; __VF2_SAVED="$(cat "$VF2" 2>/dev/null)"; fi
restore_vf2() { if [ "$__VF2_EXISTED" = yes ]; then printf '%s' "$__VF2_SAVED" > "$VF2"; else rm -f "$VF2"; fi; }

# Feed a Write tool_input.file_path, report whether the arm flag is now set.
arm_state_path() {
  rm -f "$VF2"
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1]}}))' "$1" \
    | bash "$HOOK" >/dev/null 2>&1
  [ -f "$VF2" ] && echo armed || echo clear
}
assert_path_no_arm() {
  local got; got="$(arm_state_path "$2")"
  if [ "$got" = clear ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected clear, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}
assert_path_arms() {
  local got; got="$(arm_state_path "$2")"
  if [ "$got" = armed ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected armed, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}

assert_path_no_arm "repo-source claude/hooks/*.sh does not arm"     "/Users/x/Documents/Github/improv/claude/hooks/memory-nudge.sh"
assert_path_no_arm "worktree .../claude/hooks/*.sh does not arm"    "/Users/x/Documents/Github/improv-wt/u7b/claude/hooks/verify-before-done.sh"
assert_path_no_arm "dotfiles .claude/hooks/*.sh still does not arm" "/Users/x/.claude/hooks/bash-guard.sh"
# Bash-branch path token: sed -i on a hook source must not arm either.
assert_no_rearm    "sed -i on a repo-source hook does not arm"      "sed -i 's/a/b/' claude/hooks/memory-nudge.sh"
# Controls: a real UI source edit MUST still arm.
assert_path_arms   "UI src/*.tsx still arms (control)"              "/Users/x/proj/src/App.tsx"
assert_path_arms   "styles/*.css still arms (control)"              "/Users/x/proj/src/styles/app.css"
# The exemption is a path SEGMENT, not a bare substring: a UI path that merely EMBEDS
# the letters (no `/` boundary before `claude`) must still arm (Codex U7b finding 3).
assert_path_arms   "src/myclaude/hooks/*.tsx still arms (embedded, not a segment)" "/Users/x/proj/src/myclaude/hooks/App.tsx"
assert_path_arms   "vendor/aclaude/hooks/*.css still arms (embedded)"              "/Users/x/proj/vendor/aclaude/hooks/theme.css"
# The exemption is scoped to NON-visual files: a real `claude/hooks/` path segment holding
# a VISUAL file is still renderable UI and must arm (Codex U7b finding 3), while a hook
# SCRIPT under any such segment stays exempt (it has no UI to screenshot).
assert_path_arms   "src/claude/hooks/App.tsx arms (real segment but VISUAL)"      "/Users/x/proj/src/claude/hooks/App.tsx"
assert_path_arms   "vendor/claude/hooks/theme.css arms (real segment but VISUAL)" "/Users/x/proj/vendor/claude/hooks/theme.css"
assert_path_no_arm ".sh under a nested claude/hooks/ stays exempt (a hook script)" "/Users/x/proj/tools/claude/hooks/helper.sh"

restore_vf2

echo ""
echo "===== VISUAL vs CODE: a visual REFERENCE must not arm visual (2026-07-23) ====="
# The Bash arm side used to upgrade to the "visual" flag whenever ANY token was a visual
# file - so a command that merely REFERENCED a .tsx/.css (a codemod arg, a cp/mv read
# source, a tee stdin source) falsely demanded a screenshot at the end of a research /
# refactor session even though no UI changed (Jonah 2026-07-23). Now a visual file arms
# "visual" ONLY when it is a genuine WRITE TARGET (redirect target / sed -i / tee /
# cp-mv destination). These rows assert the flag CONTENT (visual vs code), the dimension
# this fix narrows - the presence-only assert_arms rows above cannot see it. Negative
# controls: every genuine visual WRITE and every real UI build must STILL be visual, or
# we have lost recall (feedback_hooks_prefer_false_positives - never under-arm a real
# visual write). Own save/restore so a live session is safe.
VKIND="$HOME/.claude/.needs-verification.global"
__VK_EXISTED=no; __VK_SAVED=""
if [ -f "$VKIND" ]; then __VK_EXISTED=yes; __VK_SAVED="$(cat "$VKIND" 2>/dev/null)"; fi
restore_vkind() { if [ "$__VK_EXISTED" = yes ]; then printf '%s' "$__VK_SAVED" > "$VKIND"; else rm -f "$VKIND"; fi; }

# Feed a session-less Bash payload with an explicit cwd, so project_has_ui() is judged
# against a real package.json rather than the empty-cwd "assume UI" default.
run_hook_cwd() {
  local cmd="$1" cwd="$2" input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","cwd":sys.argv[2],"tool_input":{"command":sys.argv[1]}}))' "$cmd" "$cwd")
  echo "$input" | bash "$HOOK" 2>/dev/null
}
arm_kind()     { rm -f "$VKIND"; run_hook "$1"        >/dev/null 2>&1; [ -f "$VKIND" ] && cat "$VKIND" || echo absent; }
arm_kind_cwd() { rm -f "$VKIND"; run_hook_cwd "$1" "$2" >/dev/null 2>&1; [ -f "$VKIND" ] && cat "$VKIND" || echo absent; }
assert_kind() {
  local got; got="$(arm_kind "$3")"
  if [ "$got" = "$2" ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (want=$2 got=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}
assert_kind_cwd() {
  local got; got="$(arm_kind_cwd "$3" "$4")"
  if [ "$got" = "$2" ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (want=$2 got=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}

# A non-UI project (CLI library: no UI deps, no dev/start/serve script) and a UI project.
NONUI_DIR="$(mktemp -d)"; printf '{"name":"cli","dependencies":{"commander":"^12"},"scripts":{"build":"tsc","test":"vitest"}}' > "$NONUI_DIR/package.json"
UI_DIR="$(mktemp -d)";    printf '{"name":"web","dependencies":{"react":"^19"}}' > "$UI_DIR/package.json"

# --- The false positives this fix kills: a visual REFERENCE arms code, not visual ---
# WRITE branch: a .tsx/.css that is only a cp READ SOURCE (target is non-visual).
assert_kind     "cp .tsx to a .bak backup arms code (tsx is the read source)"  code   "cp src/App.tsx src/App.tsx.bak"
assert_kind     "cp .tsx to a .txt arms code (tsx is the read source)"         code   "cp src/App.tsx /tmp/x.txt"
# DEPLOY branch: a codemod that only NAMES a .tsx arg arms code in a non-UI project.
assert_kind_cwd "codemod naming a .tsx arms code in a non-UI project"          code   "npx jscodeshift -t codemod.js src/Button.tsx" "$NONUI_DIR"

# --- Negative controls: genuine visual WRITE TARGETS must STILL arm visual (recall) ---
assert_kind     "sed -i on a .css is a write target -> visual"                 visual "sed -i 's/a/b/' src/app.css"
assert_kind     "gsed -i on a .css (escaped verb) -> visual"                   visual "gsed -i s/a/b/ src/app.css"
assert_kind     "tee into a .tsx is a write target -> visual"                  visual "tee src/App.tsx"
assert_kind     "tee .tsx with a < stdin source -> visual (target is the .tsx)" visual "tee src/App.tsx < input.txt"
assert_kind     "cp DEST is a .css -> visual"                                  visual "cp 'a.css' 'b.css'"
assert_kind     "mv DEST is a .tsx (rename) -> visual"                         visual "mv src/Old.tsx src/New.tsx"
assert_kind     "redirect target is a .css -> visual"                          visual "node gen.js > src/out.css"
assert_kind     "cp wrapped in bash -lc, DEST .tsx -> visual (verb is substring)" visual 'bash -lc "cp src/a.ts dst/App.tsx"'
assert_kind     "escaped \\cp with a .tsx DEST -> visual"                       visual '\cp src/a.ts dst/App.tsx'

# --- Codex 2026-07-23 review: five RECALL REGRESSIONS the first cut introduced ---
# The first version scored only the TRAILING file operand of a write-verb segment and
# captured a redirect target with a bare \S+. Both silently downgraded REAL visual writes
# to the logic-only demand - false NEGATIVES, the direction feedback_hooks_prefer_false_positives
# forbids outright. The fold SIMPLIFIED the rule instead of patching each case: the only
# reference among write-verb operands is a cp READ SOURCE, because cp alone leaves an
# operand untouched. Each row below FAILED before the fold.
# 1. an in-place write FLAG rewrites the file it names, with no cp/mv/tee/sed verb present.
assert_kind_cwd "prettier --write on a .tsx -> visual (write flag, non-UI proj)" visual "npx prettier --write src/App.tsx" "$NONUI_DIR"
# 2. sed -i / tee edit EVERY operand, not just the last one.
assert_kind     "sed -i with a .css BEFORE a .ts operand -> visual"            visual "sed -i s/a/b/ src/app.css src/foo.ts"
assert_kind     "tee with a .tsx BEFORE a .txt operand -> visual"              visual "tee src/App.tsx notes.txt"
# 3. mv DESTROYS its source, so a visual SOURCE counts even when the dest is not visual.
assert_kind     "mv a .tsx to a non-visual name -> visual (source is destroyed)" visual "mv src/App.tsx src/App.ts"
assert_kind     "git mv a .tsx to a non-visual name -> visual"                 visual "git mv src/App.tsx src/App.ts"
# 4. a redirect target hugging a separator / subshell close, or quoted with a space.
assert_kind     "redirect .css followed by a ; separator -> visual"            visual "node gen.js > src/out.css; true"
assert_kind     "redirect .css inside a subshell -> visual"                    visual "(node gen.js > src/out.css)"
assert_kind     "QUOTED redirect target containing a space -> visual"          visual 'node gen.js > "src/out file.css"'
# 5. process substitution must not hide the real inner redirect.
assert_kind     "redirect .tsx inside a process substitution -> visual"        visual "tee /dev/null >(cat > src/App.tsx)"
# Arrow guard must survive the widened redirect regex: a -> or --> in prose is NOT a redirect
# (2026-07-18). The (?<![->]) lookbehind is what keeps these clear.
assert_kind     "a -> arrow between .tsx names is not a redirect"              absent 'printf "%s -> %s" a.tsx b.tsx'
assert_kind     "a --> arrow before a .css is not a redirect"                  absent 'while read l; do echo "$l --> done.css"; done'
assert_kind     "fd-dup 2>&1 is not a redirect target"                         absent "node script.js 2>&1"
# Chained visual write + build: the write target wins even in a NON-UI project (Codex
# 2026-07-17 finding 1 - a named visual write target must never be downgraded by the build).
assert_kind_cwd "sed -i .css && npm run build -> visual even in a non-UI project" visual "sed -i 's/a/b/' src/app.css && npm run build" "$NONUI_DIR"

# --- Negative controls: real UI build still visual; non-UI build/code writes stay code ---
assert_kind_cwd "npm run build in a UI project -> visual"                      visual "npm run build" "$UI_DIR"
assert_kind_cwd "npm run build in a non-UI project -> code"                    code   "npm run build" "$NONUI_DIR"
assert_kind     "sed -i on a .ts (code, not visual) -> code"                   code   "sed -i 's/x/y/' src/foo.ts"
assert_kind     "cp .ts read source into a .md target -> code (still arms, prefer-FP)" code "cp src/foo.ts README.md"
assert_kind     "tee .md target with a .tsx stdin source -> code (tsx is read source)" code "tee notes.md < src/App.tsx"

echo ""
echo "===== DEPLOY BRANCH: project_has_ui must not fail OPEN on a package.json-less dir ====="
# project_has_ui walked up 6 levels for a package.json and, finding none, fell out of the
# loop to a bare `return True`. Because the deploy branch ORs it with the write-target
# check, EVERY package.json-less directory armed visual on zero evidence and made the
# write-target check irrelevant there (lead review 2026-07-23). It now falls back to asking
# whether the tree actually renders anything: an .html/.htm within 2 levels.
# The .js rows are the DECISIVE controls - they name no visual file, carry no write verb and
# no redirect, so _visual_write_target is provably False and ONLY project_has_ui can arm them.
EMPTY_DIR="$(mktemp -d)"
STATIC_DIR="$(mktemp -d)"; printf '<html><body>hi</body></html>' > "$STATIC_DIR/index.html"; printf '.a{color:red}' > "$STATIC_DIR/style.css"
DEEP_DIR="$(mktemp -d)"; mkdir -p "$DEEP_DIR/src/pages"; printf '<html></html>' > "$DEEP_DIR/src/pages/index.html"
DEEP3_DIR="$(mktemp -d)"; mkdir -p "$DEEP3_DIR/site/src/pages"; printf '<html></html>' > "$DEEP3_DIR/site/src/pages/index.html"
LOOP_DIR="$(mktemp -d)"; mkdir -p "$LOOP_DIR/sub"; ln -s "$LOOP_DIR" "$LOOP_DIR/sub/back" 2>/dev/null

assert_kind_cwd "codemod naming only a .js in an EMPTY dir -> code (decisive)"  code   "npx jscodeshift -t codemod.js src/Button.js" "$EMPTY_DIR"
assert_kind_cwd "make in an EMPTY dir -> code (no evidence of UI)"              code   "make all" "$EMPTY_DIR"
assert_kind_cwd "npm run build in an EMPTY dir -> code (no evidence of UI)"     code   "npm run build" "$EMPTY_DIR"
assert_kind_cwd "codemod naming a .tsx in an EMPTY dir -> code (reference only)" code  "npx jscodeshift -t codemod.js src/Button.tsx" "$EMPTY_DIR"
# RECALL negative controls: a package.json-less STATIC SITE is real UI and must stay visual.
assert_kind_cwd "npm run build in a package.json-less STATIC SITE -> visual"    visual "npm run build" "$STATIC_DIR"
assert_kind_cwd "make in a package.json-less STATIC SITE -> visual"            visual "make all" "$STATIC_DIR"
assert_kind_cwd "codemod naming only a .js in a STATIC SITE -> visual"         visual "npx jscodeshift -t codemod.js src/Button.js" "$STATIC_DIR"
assert_kind_cwd "html nested 2 levels down still counts as a static site"      visual "npm run build" "$DEEP_DIR"
# Depth 2 was tighter than real static layouts and missed site/src/pages/index.html - a
# recall loss found by probing the scan directly. The bound is depth 3.
assert_kind_cwd "html nested 3 levels down still counts as a static site"      visual "npm run build" "$DEEP3_DIR"
# A symlink loop must TERMINATE (the entry cap bounds it) and must never raise - a
# traceback here would break the hook on every single tool call.
assert_kind_cwd "a symlink loop terminates without a traceback"                code   "npm run build" "$LOOP_DIR"
# A real visual WRITE TARGET must arm visual even where the project reads non-UI - the
# write-target check is no longer masked by the OR.
assert_kind_cwd "sed -i .css && build in an EMPTY dir -> visual (write target)" visual "sed -i 's/a/b/' src/app.css && npm run build" "$EMPTY_DIR"
assert_kind_cwd "prettier --write .tsx in an EMPTY dir -> visual (write flag)"  visual "npx prettier --write src/App.tsx" "$EMPTY_DIR"
# With NO cwd at all we still know nothing, so keep over-firing (prefer-FP, unchanged).
assert_kind     "npm run build with NO cwd -> visual (cannot tell, over-fire)"  visual "npm run build"

rm -rf "$EMPTY_DIR" "$STATIC_DIR" "$DEEP_DIR" "$DEEP3_DIR" "$LOOP_DIR"
rm -rf "$NONUI_DIR" "$UI_DIR"
restore_vkind

# Do not leave the global test bucket armed for the next suite / a stray reader.
rm -f "$HOME/.claude/.needs-verification.global"

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
