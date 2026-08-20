#!/usr/bin/env bash
# Falsification suite for artifact-announce-stop.sh.
#
# It must BLOCK only when the assistant's final message announces a deliverable LOCATION,
# the named file EXISTS on disk, and it was NEVER opened/surfaced this session. Every other
# shape (opened already, no real file, no delivery framing, internal file, loop-guard,
# disabled, no transcript) must pass silently. The false-positive controls are the point:
# a hook that blocks on any path-shaped prose would be worse than the gap it closes.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/artifact-announce-stop.sh"
pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude" "$FH/Desktop" "$FH/Downloads"; echo "$FH"; }
# emit one assistant TEXT message line
msg()  { python3 -c 'import json,sys;print(json.dumps({"type":"assistant","message":{"content":[{"type":"text","text":sys.argv[1]}]}}))' "$1"; }
# emit one assistant Read tool_use line (real tool_use blocks always carry an id)
rd()   { python3 -c 'import json,sys;print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_rd","name":"Read","input":{"file_path":sys.argv[1]}}]}}))' "$1"; }
# emit an assistant Bash-open tool_use line PLUS its successful tool_result (as a real turn has)
opn()  { python3 -c 'import json,sys;p=sys.argv[1]
print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_op","name":"Bash","input":{"command":"open "+p}}]}}))
print(json.dumps({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_op","is_error":False,"content":"ok"}]}}))' "$1"; }
# run_hook <home> <transcript_path> [stop_active] -> stdout
run_hook() { printf '{"transcript_path":"%s","stop_hook_active":%s,"session_id":"S"}' "$2" "${3:-false}" | HOME="$1" bash "$HOOK"; }
blocked()  { printf '%s' "$1" | grep -q '"decision": "block"'; }

echo "=== POSITIVE: announced + exists + not opened -> BLOCK ==="

# 1. "on your desktop" + bare filename resolved to ~/Desktop
FH=$(newhome); printf x > "$FH/Desktop/MerchGuide.docx"; T="$FH/t1.jsonl"
msg "All done. The guide is on your desktop: MerchGuide.docx - 26 pages." > "$T"
OUT=$(run_hook "$FH" "$T"); { blocked "$OUT" && printf '%s' "$OUT" | grep -qF "Desktop/MerchGuide.docx"; } \
  && ok "1. 'on your desktop: NAME.docx' with the file present -> blocks, names it" \
  || bad "1. 'on your desktop: NAME.docx' with the file present -> blocks, names it"

# 2. explicit ~ path with delivery framing
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t2.jsonl"
msg "I saved it to ~/Desktop/report.pdf for you." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && ok "2. 'saved it to ~/Desktop/report.pdf' present -> blocks" \
  || bad "2. 'saved it to ~/Desktop/report.pdf' present -> blocks"

# 3. explicit absolute path
FH=$(newhome); D="$FH/out"; mkdir -p "$D"; printf x > "$D/book.xlsx"; T="$FH/t3.jsonl"
msg "The workbook is ready at $D/book.xlsx." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && ok "3. 'ready at /abs/book.xlsx' present -> blocks" \
  || bad "3. 'ready at /abs/book.xlsx' present -> blocks"

echo
echo "=== NEGATIVE: must NOT block ==="

# 4. same announcement but the file WAS opened this session
FH=$(newhome); printf x > "$FH/Desktop/MerchGuide.docx"; T="$FH/t4.jsonl"
opn "$FH/Desktop/MerchGuide.docx" > "$T"
msg "The guide is on your desktop: MerchGuide.docx." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "4. announced-but-OPENED still blocked (should not)" \
  || ok "4. announced file that was opened this session -> no block"

# 5. a Read is VERIFICATION, not presentation (Rule 11): announced-but-only-READ still blocks.
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t5.jsonl"
rd "$FH/Desktop/report.pdf" > "$T"
msg "Saved it to ~/Desktop/report.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && ok "5. announced file only Read (not opened) -> still blocks (Read is not presentation)" \
  || bad "5. announced file only Read (not opened) -> still blocks (Read is not presentation)"

# 5b. an Artifact publish of the announced file DOES present it -> no block.
FH=$(newhome); printf x > "$FH/Desktop/deck.pdf"; T="$FH/t5b.jsonl"
python3 -c 'import json,sys;p=sys.argv[1]
print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_art","name":"Artifact","input":{"file_path":p}}]}}))
print(json.dumps({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_art","is_error":False,"content":"published"}]}}))' "$FH/Desktop/deck.pdf" > "$T"
msg "Saved it to ~/Desktop/deck.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "5b. Artifact-published file still blocked (should not)" \
  || ok "5b. announced file published via Artifact -> no block"

# 6. delivery framing but the file does NOT exist (phantom)
FH=$(newhome); T="$FH/t6.jsonl"
msg "I saved it to ~/Desktop/ghost.docx." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "6. phantom file (not on disk) blocked (should not)" \
  || ok "6. announced file that does not exist -> no block"

# 7. a path mentioned with NO delivery framing (just discussing a file)
FH=$(newhome); printf x > "$FH/Desktop/notes.docx"; T="$FH/t7.jsonl"
msg "You could edit ~/Desktop/notes.docx however you like." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "7. path with no delivery framing blocked (should not)" \
  || ok "7. path mentioned without delivery framing -> no block"

# 8. announcing an INTERNAL file (excluded basename)
FH=$(newhome); printf x > "$FH/Desktop/README.md"; T="$FH/t8.jsonl"
msg "I saved it to ~/Desktop/README.md." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "8. internal excluded basename blocked (should not)" \
  || ok "8. announced internal file (README.md) -> no block"

# 8b. announcing a file under an internal dir (.design)
FH=$(newhome); mkdir -p "$FH/.design"; printf x > "$FH/.design/ref.png"; T="$FH/t8b.jsonl"
msg "The capture is saved at $FH/.design/ref.png." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "8b. file under .design blocked (should not)" \
  || ok "8b. announced file under an internal dir -> no block"

# 9. loop guard: stop_hook_active=true
FH=$(newhome); printf x > "$FH/Desktop/MerchGuide.docx"; T="$FH/t9.jsonl"
msg "The guide is on your desktop: MerchGuide.docx." > "$T"
OUT=$(run_hook "$FH" "$T" true); blocked "$OUT" \
  && bad "9. blocked despite stop_hook_active (would wedge)" \
  || ok "9. stop_hook_active=true -> no block (fire once)"

# 10. disable marker
FH=$(newhome); printf x > "$FH/Desktop/MerchGuide.docx"; : > "$FH/.claude/.artifact-surface-disabled"; T="$FH/t10.jsonl"
msg "The guide is on your desktop: MerchGuide.docx." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "10. blocked while family disabled (should not)" \
  || ok "10. disable marker present -> no block"

# 11. fail-open: missing transcript + malformed stdin
FH=$(newhome)
OUT=$(printf '{"transcript_path":"/no/such/file","stop_hook_active":false}' | HOME="$FH" bash "$HOOK"); RC=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ]; } && ok "11a. missing transcript -> silent exit 0" || bad "11a. missing transcript -> silent exit 0 (rc=$RC out=$OUT)"
OUT=$(printf 'not json' | HOME="$FH" bash "$HOOK"); RC=$?
{ [ -z "$OUT" ] && [ "$RC" = 0 ]; } && ok "11b. malformed stdin -> silent exit 0" || bad "11b. malformed stdin -> silent exit 0 (rc=$RC out=$OUT)"

# 12. proximity: a real delivery cue is present, but the only existing deliverable path sits
#     FAR (>90 chars) from it - an input mentioned elsewhere, not the announced file -> no block.
FH=$(newhome); printf x > "$FH/Desktop/reference.pdf"; T="$FH/t12.jsonl"
GAP=$(python3 -c 'print("x"*120)')
msg "The summary is on your desktop now. $GAP Separately, the template lives at ~/Desktop/reference.pdf." > "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "12. an existing path far from the cue blocked (proximity binding failed)" \
  || ok "12. existing path >90 chars from any delivery cue -> no block (proximity-bound)"

# 13. hardened open parser: a chained/metachar 'open' does NOT count as opening -> still blocks.
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t13.jsonl"
python3 -c 'import json,sys;print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"open --bad;true "+sys.argv[1]}}]}}))' "$FH/Desktop/report.pdf" > "$T"
msg "Saved it to ~/Desktop/report.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && ok "13. chained 'open --bad;true X' not credited as an open -> still blocks" \
  || bad "13. chained 'open --bad;true X' wrongly credited as an open (should still block)"

# 13b. control for 13: a clean 'open X' DOES clear.
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t13b.jsonl"
opn "$FH/Desktop/report.pdf" > "$T"
msg "Saved it to ~/Desktop/report.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "13b. clean 'open X' still blocked (should clear)" \
  || ok "13b. control: clean 'open X' clears -> no block"

# 14. success correlation: a FAILED open (matching tool_result is_error) does NOT clear -> blocks.
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t14.jsonl"
python3 -c 'import json,sys;p=sys.argv[1]
print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"open "+p}}]}}))
print(json.dumps({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_1","is_error":True,"content":"failed"}]}}))' "$FH/Desktop/report.pdf" > "$T"
msg "Saved it to ~/Desktop/report.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && ok "14. a FAILED open (tool_result is_error) does not clear -> still blocks" \
  || bad "14. a FAILED open (tool_result is_error) wrongly cleared the block"

# 14b. control: the same open with a NON-error result clears -> no block.
FH=$(newhome); printf x > "$FH/Desktop/report.pdf"; T="$FH/t14b.jsonl"
python3 -c 'import json,sys;p=sys.argv[1]
print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"open "+p}}]}}))
print(json.dumps({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tu_1","is_error":False,"content":"ok"}]}}))' "$FH/Desktop/report.pdf" > "$T"
msg "Saved it to ~/Desktop/report.pdf." >> "$T"
OUT=$(run_hook "$FH" "$T"); blocked "$OUT" \
  && bad "14b. open with a success result still blocked (should clear)" \
  || ok "14b. control: open with a non-error result clears -> no block"

# 15. ReDoS guard: a very long message (40k+ chars) with a cue and many word-starts must be
#     scanned fast, not stall the Stop hook (the bare-filename regex was quadratic before).
FH=$(newhome); T="$FH/t15.jsonl"
# slash-heavy AND word-heavy body: stresses BOTH the path regex and the bare-filename regex.
python3 -c 'import json;print(json.dumps({"type":"assistant","message":{"content":[{"type":"text","text":"The report is on your desktop now. "+(("alpha /a/b/c/d/e/f/g beta gamma "*1400))}]}}))' > "$T"
S=$(python3 -c 'import time;print(time.time())')
run_hook "$FH" "$T" >/dev/null
E=$(python3 -c 'import time;print(time.time())')
python3 -c "import sys;sys.exit(0 if ($E-$S)<2.0 else 1)" \
  && ok "15. a 40k-char message is scanned in under 2s (no ReDoS stall)" \
  || bad "15. a 40k-char message took too long (possible ReDoS)"

# 16. a QUOTED path with spaces is unambiguous and IS caught -> blocks.
FH=$(newhome); printf x > "$FH/Desktop/PPAI PM Report.docx"; T="$FH/t16.jsonl"
msg 'Saved it to "~/Desktop/PPAI PM Report.docx" for you.' > "$T"
OUT=$(run_hook "$FH" "$T"); { blocked "$OUT" && printf '%s' "$OUT" | grep -qF "PPAI PM Report.docx"; } \
  && ok "16. a quoted path with spaces is caught -> blocks, names the full file" \
  || bad "16. a quoted path with spaces is caught -> blocks, names the full file"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
