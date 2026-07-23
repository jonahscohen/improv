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
# The verify flag is now PER-SESSION too (.needs-verification.<session>) as of 2026-07-18,
# for the same cross-session/cross-project leak that keyed .memory-dirty on 2026-07-17.
# These payloads carry no session_id, so the hook derives the "global" fallback bucket -
# a bucket no live session reads, which is what makes running this suite against the real
# $HOME safe (a live agent keys on its UUID and is untouched).
VERIFY_FLAG="$HOME/.claude/.needs-verification.global"
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

# --- Arrow FP (2026-07-23): an UNQUOTED -> arrow must NOT set dirty -----------
# The old "> " write token also matched "-> "; de-quoting (cmd_bare) protected QUOTED arrows
# but an UNQUOTED arrow in a for/while compound (not in the read_only prefix list) still
# false-set .memory-dirty. Fixed with a dash-guarded redirect (mirrors verify-before-done).
# Negative control: rows 1-2 set dirty under the old bare "> " token.
reset_all
OUT="$(run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"for h in a.sh b.sh; do echo $h -> x; done"}}')"
if [ -e "$DIRTY_FLAG" ]; then
    fail "memory-nudge arrow: unquoted -> in a for-loop must NOT dirty"
else
    pass "memory-nudge arrow: unquoted -> in a for-loop does not dirty"
fi
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"while read l; do echo $l -> done; done"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    fail "memory-nudge arrow: unquoted -> in a while-loop must NOT dirty"
else
    pass "memory-nudge arrow: unquoted -> in a while-loop does not dirty"
fi
# Recall guards - a real redirect / write must STILL dirty:
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"node gen.js >> build.log"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge arrow: a real >> redirect still dirties (recall)"
else
    fail "memory-nudge arrow: real >> redirect should dirty"
fi
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"sed -i s/a/b/ src/app.css"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge arrow: sed -i still dirties (recall)"
else
    fail "memory-nudge arrow: sed -i should dirty"
fi
# NO-SPACE append recall (Codex 2026-07-23 High): the old bare ">>" token caught these; the
# dash-guard must keep them, so ">>" matches with space OPTIONAL (unlike the space-required "> ").
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"printf x >>src/generated.ts"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge arrow: no-space >>append still dirties (recall)"
else
    fail "memory-nudge arrow: no-space >>append should dirty"
fi
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"node gen.js 2>>build.log"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge arrow: no-space 2>>append still dirties (recall)"
else
    fail "memory-nudge arrow: no-space 2>>append should dirty"
fi
# fd-dup 2>&1 must STILL NOT dirty (no new FP from the >> branch).
reset_all
run_hook "$MEMORY_NUDGE" '{"tool_name":"Bash","tool_input":{"command":"node script.js 2>&1"}}' >/dev/null
if [ -e "$DIRTY_FLAG" ]; then
    fail "memory-nudge arrow: fd-dup 2>&1 must NOT dirty"
else
    pass "memory-nudge arrow: fd-dup 2>&1 does not dirty"
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
# 2026-06-22 hole (a CSS change reported done off a curl) and must never regress. The
# INVARIANT is the FLAG staying "visual" - that is what keeps the Stop hook + commit gate
# armed. The per-edit nudge is deliberately once-per-episode (2026-07-18 reign-in) and does
# NOT re-fire on the second edit, so assert the flag, not the repeated nag.
reset_all
run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/a.css"}}' > /dev/null
run_hook "$VERIFY_HOOK" '{"tool_name":"Bash","tool_input":{"command":"make all"}}' > /dev/null
if [ "$(cat "$VERIFY_FLAG" 2>/dev/null)" = "visual" ]; then
    pass "verify-hook Case D: visual debt survives a later build (flag stays visual)"
else
    fail "verify-hook Case D: visual debt LOST - flag no longer visual after build"
fi

# =============================================================================
# Reign-in (Jonah 2026-07-18): the per-edit nudge is ONCE-PER-EPISODE. The edit that
# ARMS the flag nudges; a later edit while already armed is SILENT (only the nag stops -
# the flag still arms, so the Stop hook + commit gate are untouched). A code->visual
# UPGRADE re-nudges because the demand genuinely changed (logic -> screenshot).
# =============================================================================
reset_all
OUT1=$(run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/first.css"}}')
OUT2=$(run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/second.css"}}')
if has_nudge "$OUT1" "$SCR_NEEDLE"; then
    pass "reign-in: first arming edit emits the nudge"
else
    fail "reign-in: first arming edit should nudge, got: $OUT1"
fi
if has_nudge "$OUT2" "$SCR_NEEDLE"; then
    fail "reign-in: second edit re-nagged (should be SILENT), got: $OUT2"
else
    pass "reign-in: second edit while already armed is SILENT"
fi
if [ "$(cat "$VERIFY_FLAG" 2>/dev/null)" = "visual" ]; then
    pass "reign-in: flag STILL armed after the silent second edit (teeth intact)"
else
    fail "reign-in: flag lost after second edit"
fi

reset_all
OUT1=$(run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/logic.ts"}}')
OUT2=$(run_hook "$VERIFY_HOOK" '{"tool_name":"Edit","tool_input":{"file_path":"/x/view.css"}}')
if has_nudge "$OUT1" "$LOGIC_NEEDLE"; then
    pass "reign-in: first code edit emits the logic demand"
else
    fail "reign-in: first code edit should emit logic demand, got: $OUT1"
fi
if has_nudge "$OUT2" "$SCR_NEEDLE"; then
    pass "reign-in: code->visual upgrade RE-nudges with the screenshot demand"
else
    fail "reign-in: code->visual upgrade should nudge, got: $OUT2"
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
