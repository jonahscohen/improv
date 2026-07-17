#!/bin/bash
# Test script for memory-nudge.sh and verify-before-done.sh debouncing.
# Verifies:
#   - Nudge text appears when no recent satisfying action
#   - Nudge text is suppressed when satisfying action happened within DEBOUNCE_SECONDS
#   - Flag-setting/clearing still works regardless of debounce
#   - Memory file edits clear dirty flag (no nudge)
#   - Screenshot Reads clear verify flag (no nudge)
#
# Exits 0 on all-pass, non-zero on any failure.
# Restores flag/timestamp files to pre-test state.

set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEMORY_NUDGE="$HOOK_DIR/memory-nudge.sh"
VERIFY_HOOK="$HOOK_DIR/verify-before-done.sh"

# The beats-dirty flag is PER-SESSION (.memory-dirty.<session>) as of 2026-07-17.
# The payloads below carry no session_id, so the hook derives the "global" fallback
# key. This suite runs against the REAL $HOME (it backs up and restores), and the
# keying is what now makes that safe: `.memory-dirty.global` is a bucket no real
# session reads, since live sessions key on their UUID. Before the fix this suite
# armed and cleared the one flag EVERY concurrent session shared, so running it
# could block or silently absolve a live agent mid-commit.
DIRTY_FLAG="$HOME/.claude/.memory-dirty.global"
VERIFY_FLAG="$HOME/.claude/.needs-verification"
LAST_MEM="$HOME/.claude/.last-memory-write"
LAST_SCR="$HOME/.claude/.last-screenshot-read"

# --- Backup current state -----------------------------------------------------
BACKUP_DIR="$(mktemp -d)"
for f in "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"; do
    if [ -e "$f" ]; then
        cp -p "$f" "$BACKUP_DIR/$(basename "$f")"
    fi
done

restore_state() {
    rm -f "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"
    for f in "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"; do
        base="$BACKUP_DIR/$(basename "$f")"
        if [ -e "$base" ]; then
            cp -p "$base" "$f"
        fi
    done
    rm -rf "$BACKUP_DIR"
}

trap restore_state EXIT

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "PASS  %s\n" "$1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "FAIL  %s\n" "$1"
}

# Reset all state before each case
reset_all() {
    rm -f "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"
}

# Run a hook with a JSON payload and capture stdout
run_hook() {
    local hook="$1"
    local payload="$2"
    printf '%s' "$payload" | bash "$hook"
}

# Check whether a JSON output contains the nudge text
has_nudge() {
    local out="$1"
    local needle="$2"
    case "$out" in
        *"$needle"*) return 0 ;;
        *) return 1 ;;
    esac
}

# =============================================================================
# memory-nudge.sh tests
# =============================================================================

PROJECT_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/src/file.ts"}}'
MEMORY_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/.claude/memory/session_test.md"}}'

# --- Case A: project edit, no recent memory write -> nudge present ----------
reset_all
OUT="$(run_hook "$MEMORY_NUDGE" "$PROJECT_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    pass "memory-nudge Case A: cold project edit emits nudge"
else
    fail "memory-nudge Case A: expected nudge, got: $OUT"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Case A: dirty flag set"
else
    fail "memory-nudge Case A: dirty flag missing"
fi

# --- Case B: recent memory write -> nudge SUPPRESSED, flag still set --------
reset_all
touch "$LAST_MEM"
OUT="$(run_hook "$MEMORY_NUDGE" "$PROJECT_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    fail "memory-nudge Case B: nudge should be suppressed, got: $OUT"
else
    pass "memory-nudge Case B: nudge suppressed within debounce window"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Case B: dirty flag still set despite debounce"
else
    fail "memory-nudge Case B: dirty flag should still be set"
fi

# --- Case C: memory edit -> flag cleared, no nudge --------------------------
reset_all
touch "$DIRTY_FLAG"   # pretend project was dirty
OUT="$(run_hook "$MEMORY_NUDGE" "$MEMORY_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    fail "memory-nudge Case C: memory edit should not nudge, got: $OUT"
else
    pass "memory-nudge Case C: memory edit emits no nudge"
fi
if [ -e "$DIRTY_FLAG" ]; then
    fail "memory-nudge Case C: dirty flag should have been cleared"
else
    pass "memory-nudge Case C: dirty flag cleared by memory edit"
fi
if [ -e "$LAST_MEM" ]; then
    pass "memory-nudge Case C: last-memory-write timestamp recorded"
else
    fail "memory-nudge Case C: last-memory-write timestamp missing"
fi

# --- Case A2 (Bash variant): bash write, no recent memory -> nudge present ---
reset_all
BASH_WRITE_PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"cp foo.txt bar.txt"}}'
OUT="$(run_hook "$MEMORY_NUDGE" "$BASH_WRITE_PAYLOAD")"
if has_nudge "$OUT" "BASH WROTE FILES"; then
    pass "memory-nudge Bash Case A: cold bash write emits nudge"
else
    fail "memory-nudge Bash Case A: expected nudge, got: $OUT"
fi

# --- Case B2 (Bash variant): recent memory -> nudge suppressed --------------
reset_all
touch "$LAST_MEM"
OUT="$(run_hook "$MEMORY_NUDGE" "$BASH_WRITE_PAYLOAD")"
if has_nudge "$OUT" "BASH WROTE FILES"; then
    fail "memory-nudge Bash Case B: nudge should be suppressed, got: $OUT"
else
    pass "memory-nudge Bash Case B: nudge suppressed within debounce window"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Bash Case B: dirty flag still set"
else
    fail "memory-nudge Bash Case B: dirty flag should still be set"
fi

# =============================================================================
# verify-before-done.sh tests
# =============================================================================

CODE_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/src/file.ts"}}'
SCREENSHOT_READ_PAYLOAD='{"tool_name":"Read","tool_input":{"file_path":"/tmp/screenshot.png"}}'

# --- Case D-A: code edit, no recent screenshot -> verify nudge present ------
reset_all
OUT="$(run_hook "$VERIFY_HOOK" "$CODE_EDIT_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    pass "verify-hook Case A: cold code edit emits verify nudge"
else
    fail "verify-hook Case A: expected verify nudge, got: $OUT"
fi
if [ -e "$VERIFY_FLAG" ]; then
    pass "verify-hook Case A: verify flag set"
else
    fail "verify-hook Case A: verify flag missing"
fi

# --- Case D-B: recent screenshot read -> nudge suppressed, flag still set ---
reset_all
touch "$LAST_SCR"
OUT="$(run_hook "$VERIFY_HOOK" "$CODE_EDIT_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    fail "verify-hook Case B: nudge should be suppressed, got: $OUT"
else
    pass "verify-hook Case B: nudge suppressed within debounce window"
fi
if [ -e "$VERIFY_FLAG" ]; then
    pass "verify-hook Case B: verify flag still set despite debounce"
else
    fail "verify-hook Case B: verify flag should still be set"
fi

# --- Case D-C: screenshot Read -> verify flag cleared, no nudge -------------
reset_all
touch "$VERIFY_FLAG"   # pretend something needed verification
OUT="$(run_hook "$VERIFY_HOOK" "$SCREENSHOT_READ_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    fail "verify-hook Case C: screenshot read should not nudge, got: $OUT"
else
    pass "verify-hook Case C: screenshot read emits no nudge"
fi
if [ -e "$VERIFY_FLAG" ]; then
    fail "verify-hook Case C: verify flag should have been cleared"
else
    pass "verify-hook Case C: verify flag cleared by screenshot read"
fi
if [ -e "$LAST_SCR" ]; then
    pass "verify-hook Case C: last-screenshot-read timestamp recorded"
else
    fail "verify-hook Case C: last-screenshot-read timestamp missing"
fi

# =============================================================================
# verify-before-done.sh Case D: the message must MATCH the flag (2026-07-17)
#
# The hook always knew visual vs non-visual but ordered a screenshot either way, so
# editing a test runner or building a CLI demanded a screenshot of a thing with no UI.
# Non-visual changes now get a logic demand; VISUAL changes must still demand a real
# screenshot. Arming is unchanged - only the wording moves - so recall is preserved
# (feedback_hooks_prefer_false_positives: never loosen a gate to silence an over-fire).
#
# The Bash-write rows are the regression Codex caught: arm_and_report() hardcoded
# set_flag("code"), so `sed -i src/app.css` armed code and would have been let off with a
# logic-only demand. A visual operand must arm visual no matter which tool touched it.
#
# The "build cwd unknown" row carries no cwd, so the hook cannot identify the project and
# deliberately over-fires to visual (feedback_hooks_prefer_false_positives: when we cannot
# tell, demand the stronger proof). Builds WITH a known cwd are covered in Case E.
# =============================================================================
SCR_NEEDLE="Take a screenshot"
LOGIC_NEEDLE="NON-VISUAL"

# rows: label | payload | expected(screenshot|logic|silent) | expected flag
while IFS='|' read -r label payload want want_flag; do
    [ -z "$label" ] && continue
    reset_all
    OUT=$(run_hook "$VERIFY_HOOK" "$payload")
    GOT_FLAG=$(cat "$VERIFY_FLAG" 2>/dev/null || echo "NONE")
    if has_nudge "$OUT" "$SCR_NEEDLE"; then GOT="screenshot"
    elif has_nudge "$OUT" "$LOGIC_NEEDLE"; then GOT="logic"
    else GOT="silent"; fi
    if [ "$GOT" = "$want" ]; then
        pass "verify-hook Case D: $label -> $want demand"
    else
        fail "verify-hook Case D: $label expected $want, got $GOT"
    fi
    if [ "$GOT_FLAG" = "$want_flag" ]; then
        pass "verify-hook Case D: $label -> flag=$want_flag"
    else
        fail "verify-hook Case D: $label expected flag=$want_flag, got $GOT_FLAG"
    fi
done <<'ROWS'
edit .css|{"tool_name":"Edit","tool_input":{"file_path":"/x/a.css"}}|screenshot|visual
edit .tsx|{"tool_name":"Edit","tool_input":{"file_path":"/x/a.tsx"}}|screenshot|visual
edit .ts runner|{"tool_name":"Edit","tool_input":{"file_path":"/x/run-tests.ts"}}|logic|code
edit .py|{"tool_name":"Edit","tool_input":{"file_path":"/x/loader.py"}}|logic|code
edit .go|{"tool_name":"Edit","tool_input":{"file_path":"/x/main.go"}}|logic|code
build cwd unknown|{"tool_name":"Bash","tool_input":{"command":"make all"}}|screenshot|visual
bash write css|{"tool_name":"Bash","tool_input":{"command":"sed -i s/a/b/ src/app.css"}}|screenshot|visual
bash cp tsx|{"tool_name":"Bash","tool_input":{"command":"cp x.tsx src/App.tsx"}}|screenshot|visual
bash write ts|{"tool_name":"Bash","tool_input":{"command":"cp a.ts b.ts"}}|logic|code
edit .md beat|{"tool_name":"Edit","tool_input":{"file_path":"/x/notes.md"}}|silent|NONE
ROWS

# Sticky-visual: a visual debt must survive a later non-visual build. This is the
# 2026-06-22 hole (a CSS change reported done off a curl) and must never regress.
reset_all
run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/a.css"}}' > /dev/null
OUT=$(run_hook "$VERIFY_HOOK" '{"tool_name":"Bash","tool_input":{"command":"make all"}}')
if has_nudge "$OUT" "$SCR_NEEDLE"; then
    pass "verify-hook Case D: visual debt survives a later build (still screenshot)"
else
    fail "verify-hook Case D: visual debt LOST - build downgraded it to logic"
fi

# =============================================================================
# verify-before-done.sh Case E: builds are judged by the PROJECT (Jonah 2026-07-17)
#
# `npm run build` is identical in a Next.js app and a CLI library, so the command cannot
# say whether it emits UI. The hook asks the nearest package.json: UI deps or a
# dev/start/serve script -> visual (screenshot); otherwise -> code (logic). No package.json
# -> visual, the deliberate over-fire per feedback_hooks_prefer_false_positives.
# Deliberately NOT a filesystem scan: sidecoach has pages/ + eval .html fixtures it never
# renders, so a scan would call a CLI library "UI" and restore the screenshot noise.
# =============================================================================
UI_FIX="$(mktemp -d)/uiproj"
CLI_FIX="$(mktemp -d)/cliproj"
mkdir -p "$UI_FIX" "$CLI_FIX"
cat > "$UI_FIX/package.json" <<'PKG'
{"name":"web","scripts":{"build":"next build","dev":"next dev"},"dependencies":{"next":"14","react":"18"}}
PKG
cat > "$CLI_FIX/package.json" <<'PKG'
{"name":"cli","scripts":{"build":"tsc","test":"node t.js"},"dependencies":{"js-yaml":"4"},"devDependencies":{"typescript":"5"}}
PKG

check_build() {
    local label="$1" dir="$2" cmd="$3" want="$4"
    reset_all
    OUT=$(run_hook "$VERIFY_HOOK" "$(printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"%s"}}' "$dir" "$cmd")")
    if has_nudge "$OUT" "$SCR_NEEDLE"; then GOT="screenshot"
    elif has_nudge "$OUT" "$LOGIC_NEEDLE"; then GOT="logic"
    else GOT="silent"; fi
    if [ "$GOT" = "$want" ]; then
        pass "verify-hook Case E: $label -> $want"
    else
        fail "verify-hook Case E: $label expected $want, got $GOT"
    fi
}

check_build "UI project build (next/react)"   "$UI_FIX"  "npm run build" screenshot
check_build "CLI library build (no UI deps)"  "$CLI_FIX" "npm run build" logic
check_build "cd into CLI subdir then build"   "$(dirname "$CLI_FIX")" "cd cliproj && npm run build" logic
check_build "cd into UI subdir then build"    "$(dirname "$UI_FIX")"  "cd uiproj && npm run build" screenshot
check_build "unknown project (no package.json)" "/tmp" "make all" screenshot
check_build "CLI build that NAMES a css file" "$CLI_FIX" "sed -i s/a/b/ src/app.css && npm run build" screenshot

# Codex finding: only a LEADING cd describes where the build ran. A TRAILING cd into a CLI
# dir must not downgrade a real UI build (false negative = the dangerous direction).
check_build "UI build then trailing cd to cli" "$UI_FIX" "npm run build && cd ../cliproj" screenshot

# Codex finding: a component library declares react in peerDependencies and ships no
# dev/start script. It still renders UI.
PEER_FIX="$(mktemp -d)/peerproj"
mkdir -p "$PEER_FIX"
cat > "$PEER_FIX/package.json" <<'PKG'
{"name":"ui-kit","scripts":{"build":"tsc"},"peerDependencies":{"react":"18"}}
PKG
check_build "component lib (react as peerDep)" "$PEER_FIX" "npm run build" screenshot
rm -rf "$(dirname "$PEER_FIX")"

rm -rf "$(dirname "$UI_FIX")" "$(dirname "$CLI_FIX")"

# =============================================================================
# Summary
# =============================================================================
printf "\n----- Summary -----\n"
printf "Passed: %d\n" "$PASS_COUNT"
printf "Failed: %d\n" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
