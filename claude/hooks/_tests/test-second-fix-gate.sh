#!/bin/bash
# Smoke test for second-fix-gate.sh v2.
# Spins up a temp HOME so tests don't touch the real ~/.claude state.

set -e
HOOK=/Users/spare3/Documents/Github/improv/claude/hooks/second-fix-gate.sh
TMP=$(mktemp -d)
mkdir -p "$TMP/.claude"
export HOME="$TMP"

pass=0
fail=0
trial() {
  local name="$1" expect="$2" output="$3"
  if echo "$output" | grep -q "SECOND FIX DETECTED"; then got=warn; else got=silent; fi
  if [ "$got" = "$expect" ]; then
    echo "OK     $name (expect=$expect)"
    pass=$((pass+1))
  else
    echo "FAIL   $name (expect=$expect got=$got)"
    echo "       output: $output"
    fail=$((fail+1))
  fi
}

reset_state() {
  rm -f "$HOME/.claude/.last-fix-file" "$HOME/.claude/.needs-verification" \
        "$HOME/.claude/.suppress-fix-gate" "$HOME/.claude/.fix-gate-warned-"*
}

# A modify edit (old NOT in new). Two edits to same file, verify still set.
modify_payload() {
  printf '%s' "$1" | jq -Rs '{
    tool_name: "Edit",
    tool_input: {
      file_path: .,
      old_string: "function foo() { return 1; }",
      new_string: "function foo() { return 2; }"
    }
  }'
}
# An additive edit (old IS in new - the old code is preserved in new).
additive_payload() {
  printf '%s' "$1" | jq -Rs '{
    tool_name: "Edit",
    tool_input: {
      file_path: .,
      old_string: "function foo() { return 1; }",
      new_string: "function foo() { return 1; }\n\nfunction bar() { return 2; }"
    }
  }'
}

FILE="$TMP/src/app.ts"

# --- Scenario 1: First edit, no prior state, no verify pending ---
reset_state
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "1.first-edit-no-prior-state" silent "$out"

# --- Scenario 2: Two edits same file, NO .needs-verification ---
reset_state
modify_payload "$FILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "2.two-edits-no-verify-flag" silent "$out"

# --- Scenario 3: Two MODIFY edits same file, verify pending - SHOULD WARN ---
reset_state
touch "$HOME/.claude/.needs-verification"
modify_payload "$FILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "3.two-modify-with-verify-warns" warn "$out"

# --- Scenario 4: Three edits in same window - third should NOT warn again ---
reset_state
touch "$HOME/.claude/.needs-verification"
modify_payload "$FILE" | bash "$HOOK" > /dev/null
modify_payload "$FILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "4.third-edit-silent-already-warned" silent "$out"

# --- Scenario 5: Five additive edits, verify pending - SHOULD ALL BE SILENT ---
reset_state
touch "$HOME/.claude/.needs-verification"
additive_payload "$FILE" | bash "$HOOK" > /dev/null
out_a=$(additive_payload "$FILE" | bash "$HOOK")
out_b=$(additive_payload "$FILE" | bash "$HOOK")
out_c=$(additive_payload "$FILE" | bash "$HOOK")
trial "5a.additive-second-edit-silent" silent "$out_a"
trial "5b.additive-third-edit-silent" silent "$out_b"
trial "5c.additive-fourth-edit-silent" silent "$out_c"

# --- Scenario 6: Override flag - all warnings suppressed ---
reset_state
touch "$HOME/.claude/.needs-verification"
touch "$HOME/.claude/.suppress-fix-gate"
modify_payload "$FILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "6.override-flag-suppresses-warn" silent "$out"

# --- Scenario 7: Expired override (mtime > 30 min ago) - should warn again ---
reset_state
touch "$HOME/.claude/.needs-verification"
touch "$HOME/.claude/.suppress-fix-gate"
# backdate the override flag by 31 minutes
touch -t "$(date -j -v-31M +%Y%m%d%H%M.%S 2>/dev/null || date --date='31 minutes ago' +%Y%m%d%H%M.%S)" \
  "$HOME/.claude/.suppress-fix-gate"
modify_payload "$FILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$FILE" | bash "$HOOK")
trial "7.expired-override-warns-again" warn "$out"

# --- Scenario 8: Exempt path (.claude/memory/) - silent always ---
reset_state
touch "$HOME/.claude/.needs-verification"
MEMFILE="$TMP/.claude/memory/session.md"
modify_payload "$MEMFILE" | bash "$HOOK" > /dev/null
out=$(modify_payload "$MEMFILE" | bash "$HOOK")
trial "8.exempt-memory-path-silent" silent "$out"

# --- Scenario 9: Same-directory (different file) MODIFY - SHOULD WARN ---
reset_state
touch "$HOME/.claude/.needs-verification"
modify_payload "$TMP/src/a.ts" | bash "$HOOK" > /dev/null
out=$(modify_payload "$TMP/src/b.ts" | bash "$HOOK")
trial "9.same-dir-different-file-warns" warn "$out"

echo
echo "=== Results: $pass passed, $fail failed ==="
rm -rf "$TMP"
exit $fail
