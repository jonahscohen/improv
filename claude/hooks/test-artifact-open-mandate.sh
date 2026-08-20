#!/usr/bin/env bash
# Falsification suite for artifact-open-mandate.sh (PostToolUse Write|Artifact|Bash).
#
# The single most important assertion is the false-positive guard: a beat, a scratch
# file, a source/config file, or an internal repo doc must NEVER be recorded. Case 6
# (a .claude/memory beat records nothing) and MUTANT case 20 (the SAME basename in a
# normal dir DOES record) together prove the exclusion is load-bearing and the gate can
# go both ways.
#
# SCOPE (Jonah 2026-08-07 "balanced"): VISUALS (images/pdf/pages) are harvested from
# Write AND Bash and are caught even in /tmp, /var/folders, or a scratchpad, because a
# generated image commonly lands there and the user still wants to see it. TEXT
# documents (.md .txt .csv .rtf) are harvested from the Write tool ONLY. BINARY office
# documents (.doc .docx .xls .xlsx .ppt .pptx .od[tsp]) are ALSO harvested from Bash -
# a script is the only way to create them - but ONLY from an explicit output position
# (a -o/--output flag, a redirect, or a save()-call), never a bare positional/mention
# (2026-08-13). All documents keep the temp/scratch exclusion. The BASH + R7 sections
# below prove each half.
#
# Every case runs under a FAKE $HOME so no test reads or mutates real session state.
# Sample DOCUMENTS live under a repo-local WORK dir (temp is excluded for docs);
# sample VISUALS in temp are used deliberately to prove the balanced temp carve-out.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HERE/artifact-open-mandate.sh"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$REPO/.artifact-test-mandate.$$"
TMPIMG="/tmp/artifact-test-mandate-$$.png"
TMPDOC="/tmp/artifact-test-mandate-$$.md"
trap 'rm -rf "$WORK" "$TMPIMG" "$TMPDOC"' EXIT
mkdir -p "$WORK"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }
disable() { : > "$1/.claude/.artifact-surface-disabled"; }

# mkfile <relpath> -> creates a real file under WORK/proj, prints its absolute path
mkfile() { local p="$WORK/proj/$1"; mkdir -p "$(dirname "$p")"; printf 'x' > "$p"; printf '%s' "$p"; }

# run_tool <home> <tool_name> <file_path> -> hook stdout (Write/Artifact/future-tool)
run_tool() {
  printf '{"session_id":"S","tool_name":"%s","tool_input":{"file_path":"%s"}}' "$2" "$3" \
    | HOME="$1" bash "$HOOK"
}
# run_bash <home> <command> -> hook stdout (Bash PostToolUse)
run_bash() {
  python3 -c 'import json,sys; print(json.dumps({"session_id":"S","tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$2" \
    | HOME="$1" bash "$HOOK"
}
pend()     { echo "$1/.claude/.artifact-pending.S"; }
recorded() { [ -s "$(pend "$1")" ]; }
count()    { wc -l < "$(pend "$1")" 2>/dev/null | tr -d ' '; }
is_json()  { python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1; }
ctx()      { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])' 2>/dev/null; }
mtns()     { python3 -c 'import os,sys; print(os.stat(sys.argv[1]).st_mtime_ns)' "$1"; }
# seed_shown <home> <abs_path> [mtime_ns] : write a one-line shown ledger (path<TAB>mtime)
# for session S; mtime defaults to the file's current mtime (i.e. "shown, unchanged since").
seed_shown() { printf '%s\t%s\n' "$2" "${3:-$(mtns "$2")}" > "$1/.claude/.artifact-shown.S"; }

echo "=== R1: in-scope artifacts ARE recorded ==="

FH=$(newhome); F=$(mkfile assets/hero.png); OUT=$(run_tool "$FH" Write "$F")
{ recorded "$FH" && printf '%s' "$OUT" | is_json; } \
  && ok "1. .png in a normal dir -> recorded, reminder is valid JSON" \
  || bad "1. .png in a normal dir -> recorded, reminder is valid JSON"

FH=$(newhome); F=$(mkfile page.html); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && ok "2. .html -> recorded" || bad "2. .html -> recorded"

FH=$(newhome); F=$(mkfile reports/summary.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && ok "3. deliverable .md in a normal dir -> recorded" \
               || bad "3. deliverable .md in a normal dir -> recorded"

FH=$(newhome); F=$(mkfile out/render.png); CTX=$(run_tool "$FH" Write "$F" | ctx)
{ [[ "$CTX" == *"MANDATORY"* ]] && [[ "$CTX" == *"$F"* ]]; } \
  && ok "4. reminder says MANDATORY and names the exact path" \
  || bad "4. reminder says MANDATORY and names the exact path"

FH=$(newhome); F=$(mkfile gen/asset.webp); run_tool "$FH" ImageGen "$F" >/dev/null
recorded "$FH" && ok "5. non-Write tool with an in-scope file_path -> recorded (image-tool extension point)" \
               || bad "5. non-Write tool with an in-scope file_path -> recorded (image-tool extension point)"

echo
echo "=== R2: hard exclusions are NEVER recorded ==="

FH=$(newhome); F=$(mkfile .claude/memory/session_x.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "6. .claude/memory beat -> recorded (MUST NOT)" \
               || ok "6. .claude/memory beat -> not recorded"

FH=$(newhome); F=$(mkfile scratchpad/note.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "7. scratchpad DOC -> recorded (MUST NOT)" \
               || ok "7. scratchpad doc -> not recorded"

FH=$(newhome); printf 'x' > "$TMPDOC"; run_tool "$FH" Write "$TMPDOC" >/dev/null
recorded "$FH" && bad "8. /tmp .md DOCUMENT -> recorded (MUST NOT: docs keep temp exclusion)" \
               || ok "8. /tmp .md document -> not recorded (docs keep temp exclusion)"

FH=$(newhome); F=$(mkfile app.js);   run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "9. .js source -> recorded (MUST NOT)"  || ok "9. .js source -> not recorded"

FH=$(newhome); F=$(mkfile data.json); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "10. .json config -> recorded (MUST NOT)" || ok "10. .json config -> not recorded"

FH=$(newhome); F=$(mkfile style.css); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "11. .css -> recorded (MUST NOT)" || ok "11. .css -> not recorded"

FH=$(newhome); F=$(mkfile README.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "12. README.md basename -> recorded (MUST NOT)" \
               || ok "12. README.md basename -> not recorded"

FH=$(newhome); F=$(mkfile TASKS.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "13. TASKS.md basename -> recorded (MUST NOT)" \
               || ok "13. TASKS.md basename -> not recorded"

FH=$(newhome); F=$(mkfile docs/superpowers/plans/2026-08-06-x.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "14. docs/superpowers/plans doc -> recorded (MUST NOT)" \
               || ok "14. docs/superpowers/plans doc -> not recorded"

FH=$(newhome); F=$(mkfile out/dist/bundle.png); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && bad "15. file under a dist/ segment -> recorded (MUST NOT)" \
               || ok "15. file under a dist/ segment -> not recorded"

FH=$(newhome); F=$(mkfile shown.html); run_tool "$FH" Artifact "$F" >/dev/null
recorded "$FH" && bad "16. Artifact tool create -> recorded (publishing already shows it)" \
               || ok "16. Artifact tool create -> not recorded"

echo
echo "=== R3: require-exists (no unsatisfiable mandate) ==="

FH=$(newhome); run_tool "$FH" Write "$WORK/proj/assets/ghost.png" >/dev/null
recorded "$FH" && bad "17. Write of a path not on disk -> recorded (MUST NOT)" \
               || ok "17. Write of a path not on disk -> not recorded"

echo
echo "=== R4: append, dedup, multi ==="

FH=$(newhome); F=$(mkfile a.png); run_tool "$FH" Write "$F" >/dev/null; run_tool "$FH" Write "$F" >/dev/null
[ "$(count "$FH")" = "1" ] && ok "18. same file written twice -> exactly one pending entry (dedup)" \
                           || bad "18. same file written twice -> exactly one pending entry (got $(count "$FH"))"

FH=$(newhome); F1=$(mkfile b.png); F2=$(mkfile c.pdf)
run_tool "$FH" Write "$F1" >/dev/null; CTX=$(run_tool "$FH" Write "$F2" | ctx)
{ [ "$(count "$FH")" = "2" ] && [[ "$CTX" == *"outstanding"* ]]; } \
  && ok "19. two distinct files -> two entries and reminder notes outstanding count" \
  || bad "19. two distinct files -> two entries and reminder notes outstanding count"

echo
echo "=== MUTANT (a gate that cannot go red is not a gate) ==="

# The SAME basename that was excluded under .claude/memory (case 6) is recorded in a
# normal dir - proving location, not name, is what suppressed it.
FH=$(newhome); F=$(mkfile notes/session_x.md); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && ok "20. same basename in a normal dir -> recorded (exclusion is load-bearing)" \
               || bad "20. same basename in a normal dir -> recorded (exclusion is load-bearing)"

echo
echo "=== R6: BASH harvest + balanced temp carve-out (Jonah 2026-08-07) ==="

# A generated image reached via a Bash CLI, in a NORMAL dir -> recorded.
FH=$(newhome); F=$(mkfile out/chart.png); run_bash "$FH" "python plot.py --out $F" >/dev/null
recorded "$FH" && ok "21. Bash-created png (normal dir) -> recorded" \
               || bad "21. Bash-created png (normal dir) -> recorded"

# THE HEADLINE: a generated image in /tmp -> recorded (visuals are caught in temp).
FH=$(newhome); printf 'x' > "$TMPIMG"; run_bash "$FH" "convert in.svg $TMPIMG" >/dev/null
recorded "$FH" && ok "22. Bash-created png in /tmp -> recorded (balanced: visuals caught in temp)" \
               || bad "22. Bash-created png in /tmp -> recorded (balanced: visuals caught in temp)"

# A Write of a VISUAL in /tmp is also caught (visual temp carve-out is source-agnostic).
FH=$(newhome); printf 'x' > "$TMPIMG"; run_tool "$FH" Write "$TMPIMG" >/dev/null
recorded "$FH" && ok "23. Write of a png in /tmp -> recorded (visual temp carve-out)" \
               || bad "23. Write of a png in /tmp -> recorded (visual temp carve-out)"

# A pure CONSUMER Bash command that only reads an image did not create it -> not recorded.
FH=$(newhome); F=$(mkfile out/existing.png); run_bash "$FH" "cat $F" >/dev/null
recorded "$FH" && bad "24. Bash 'cat <png>' -> recorded (MUST NOT: consumer, not creator)" \
               || ok "24. Bash consumer 'cat <png>' -> not recorded"

# Documents are NOT harvested from Bash (docs are Write-tool-only).
FH=$(newhome); F=$(mkfile out/report.md); run_bash "$FH" "pandoc in.rst -o $F" >/dev/null
recorded "$FH" && bad "25. Bash-created .md -> recorded (MUST NOT: docs are Write-only)" \
               || ok "25. Bash-created .md doc -> not recorded (docs are Write-only)"

# A Bash-created image UNDER .claude is still never recorded (EXCLUDE_ALWAYS wins).
FH=$(newhome); F=$(mkfile .claude/tmp/x.png); run_bash "$FH" "gen --out $F" >/dev/null
recorded "$FH" && bad "26. Bash png under .claude -> recorded (MUST NOT)" \
               || ok "26. Bash png under .claude -> not recorded"

# OUTPUT-first: an input/source visual must not steal the obligation from the generated
# output. `svgo <src> -o <out>` must record OUT, not SRC (Codex v2 Medium).
FH=$(newhome); SRC=$(mkfile src/logo.svg); OUT=$(mkfile out/logo-min.svg)
run_bash "$FH" "svgo $SRC -o $OUT" >/dev/null
{ recorded "$FH" && grep -qxF -- "$OUT" "$(pend "$FH")" && ! grep -qxF -- "$SRC" "$(pend "$FH")"; } \
  && ok "27. 'svgo src -o out' -> records the OUTPUT, not the source" \
  || bad "27. 'svgo src -o out' -> records the OUTPUT, not the source"

# Positional output (no flag): a CLI whose output is the last arg records the last path.
FH=$(newhome); TPL=$(mkfile src/t.html); PDF=$(mkfile out/final.pdf)
run_bash "$FH" "wkhtmltopdf $TPL $PDF" >/dev/null
grep -qxF -- "$PDF" "$(pend "$FH")" 2>/dev/null \
  && ok "28. 'wkhtmltopdf src out' -> records the last positional (output)" \
  || bad "28. 'wkhtmltopdf src out' -> records the last positional (output)"

# A DOCUMENT named by -o from Bash must NOT be recorded (docs are Write-only).
FH=$(newhome); DOUT=$(mkfile out/report.txt); run_bash "$FH" "pandoc in.rst -o $DOUT" >/dev/null
recorded "$FH" && bad "29. Bash '-o <doc>' -> recorded (MUST NOT: docs are Write-only)" \
               || ok "29. Bash '-o <doc>' -> not recorded (docs are Write-only)"

echo
echo "=== R7: Word documents (.doc / .docx) ==="

FH=$(newhome); F=$(mkfile deliverables/proposal.docx); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && ok "27. .docx from Write (normal dir) -> recorded" \
               || bad "27. .docx from Write (normal dir) -> recorded"

FH=$(newhome); F=$(mkfile deliverables/legacy.doc); run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" && ok "28. .doc from Write (normal dir) -> recorded" \
               || bad "28. .doc from Write (normal dir) -> recorded"

# .docx is a document, so it keeps the temp exclusion.
FH=$(newhome); D="/tmp/artifact-test-mandate-$$.docx"; printf 'x' > "$D"
run_tool "$FH" Write "$D" >/dev/null; rm -f "$D"
recorded "$FH" && bad "29. .docx in /tmp -> recorded (MUST NOT: docs keep temp exclusion)" \
               || ok "29. .docx in /tmp -> not recorded (docs keep temp exclusion)"

# THE 2026-08-13 FIX (ppai-pm incident): a BINARY office document can only be
# produced by a script (Bash) - the Write tool cannot author binary - so unlike a
# TEXT doc (.md/.txt, still Write-only above) it IS harvested from Bash. This is the
# exact hole a Word doc a script saved to the Desktop fell through, unenforced.
FH=$(newhome); F=$(mkfile deliverables/review.docx); run_bash "$FH" "pandoc notes.md -o $F" >/dev/null
recorded "$FH" && ok "R7a. Bash-created .docx (pandoc -o) -> recorded (the incident fix)" \
               || bad "R7a. Bash-created .docx (pandoc -o) -> recorded (the incident fix)"

# The realistic incident shape: a python-docx script whose .save() names the path.
FH=$(newhome); F=$(mkfile deliverables/checklist.docx)
run_bash "$FH" "python3 -c \"from docx import Document; d=Document(); d.save('$F')\"" >/dev/null
recorded "$FH" && ok "R7b. Bash python-docx .save('<path>.docx') -> recorded" \
               || bad "R7b. Bash python-docx .save('<path>.docx') -> recorded"

FH=$(newhome); F=$(mkfile out/data.xlsx); run_bash "$FH" "python3 make_sheet.py -o $F" >/dev/null
recorded "$FH" && ok "R7c. Bash-created .xlsx -> recorded" || bad "R7c. Bash-created .xlsx -> recorded"

FH=$(newhome); F=$(mkfile out/deck.pptx); run_bash "$FH" "python3 slides.py --output $F" >/dev/null
recorded "$FH" && ok "R7d. Bash-created .pptx -> recorded" || bad "R7d. Bash-created .pptx -> recorded"

# A binary office doc in /tmp is still a document -> temp exclusion still applies.
FH=$(newhome); D="/tmp/artifact-test-mandate-$$-bash.docx"; printf 'x' > "$D"
run_bash "$FH" "pandoc notes.md -o $D" >/dev/null; rm -f "$D"
recorded "$FH" && bad "R7e. Bash .docx in /tmp -> recorded (MUST NOT: office docs keep temp exclusion)" \
               || ok "R7e. Bash .docx in /tmp -> not recorded (office docs keep temp exclusion)"

# A CONSUMER command that only reads a .docx did not create it -> not recorded.
FH=$(newhome); F=$(mkfile deliverables/existing.docx); run_bash "$FH" "cat $F" >/dev/null
recorded "$FH" && bad "R7f. 'cat <doc>.docx' -> recorded (MUST NOT: consumer command)" \
               || ok "R7f. consumer 'cat .docx' -> not recorded"

# Codex 2026-08-13 false-positive guards: office docs are harvested ONLY from an
# explicit OUTPUT position (flag / redirect / save-call), never a bare positional
# INPUT or a stdout mention.
# g) `soffice --convert-to` names an INPUT positional + an --outdir (a dir, not a
#    file): the input must NOT be recorded (and the derived output is simply missed).
FH=$(newhome); SRC=$(mkfile work/source.odt)
run_bash "$FH" "soffice --headless --convert-to docx --outdir $WORK/proj/out $SRC" >/dev/null
recorded "$FH" && bad "R7g. soffice input .odt -> recorded (MUST NOT: bare input positional)" \
               || ok "R7g. soffice input .odt -> not recorded (output-position-only)"

# h) converting FROM an office doc TO a visual: record the OUTPUT (pdf), not the input docx.
FH=$(newhome); IN=$(mkfile src/report.docx); OUT=$(mkfile out/report.pdf)
run_bash "$FH" "libreoffice --convert-to pdf $IN -o $OUT" >/dev/null
{ grep -qxF -- "$OUT" "$(pend "$FH")" && ! grep -qxF -- "$IN" "$(pend "$FH")"; } \
  && ok "R7h. 'convert report.docx -o out.pdf' -> records the PDF, not the input docx" \
  || bad "R7h. 'convert report.docx -o out.pdf' -> records the PDF, not the input docx"

# i) an office doc merely MENTIONED in stdout (a template/log reference) -> not recorded.
FH=$(newhome); TPL=$(mkfile templates/contract.docx)
python3 -c 'import json,sys; print(json.dumps({"session_id":"S","tool_name":"Bash","tool_input":{"command":"python3 validate.py"},"tool_response":"Using template "+sys.argv[1]}))' "$TPL" \
  | HOME="$FH" bash "$HOOK" >/dev/null
recorded "$FH" && bad "R7i. office doc mentioned in stdout -> recorded (MUST NOT)" \
               || ok "R7i. office doc mentioned in stdout -> not recorded"

# j) a save-call output PATH WITH SPACES is caught (BASH_PATH_RE would have missed it).
FH=$(newhome); F=$(mkfile "deliverables/Project Plan.docx")
run_bash "$FH" "python3 -c \"d.save('$F')\"" >/dev/null
recorded "$FH" && ok "R7j. .save('<path with spaces>.docx') -> recorded" \
               || bad "R7j. .save('<path with spaces>.docx') -> recorded"

# k) an archive tool's -o is OVERWRITE, not an output file; its named archive is an
#    INPUT (Codex LOW). `unzip -o x.docx` must NOT record the input .docx.
FH=$(newhome); F=$(mkfile archives/bundle.docx); run_bash "$FH" "unzip -o $F -d /tmp/x" >/dev/null
recorded "$FH" && bad "R7k. 'unzip -o <docx>' -> recorded (MUST NOT: archive input)" \
               || ok "R7k. 'unzip -o <docx>' -> not recorded (archive extractor)"

echo
echo "=== R8: GAP A - inline-returned image auto-satisfies (Jonah 2026-08-07) ==="

is_block() { python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("decision")=="block" else 1)' 2>/dev/null; }
STOP_HOOK="$HERE/artifact-open-stop.sh"
run_stop() { printf '{"session_id":"S","tool_name":"Stop","stop_hook_active":false}' | HOME="$1" bash "$STOP_HOOK"; }
# run_imgtool <home> <file_path> <inline true|false> -> mandate hook stdout. Simulates an
# MCP screenshot tool: tool_input carries the saved path; tool_response carries an inline
# image content block ONLY when <inline> is true (otherwise a plain status string).
run_imgtool() {
  python3 -c '
import json, sys
inline = sys.argv[2] == "true"
if inline:
    resp = {"content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "x"}},
        {"type": "text", "text": "Saved screenshot to " + sys.argv[1]},
    ]}
else:
    resp = "Saved screenshot to " + sys.argv[1]
print(json.dumps({"session_id": "S", "tool_name": "mcp__claude-in-chrome__computer",
                  "tool_input": {"file_path": sys.argv[1]}, "tool_response": resp}))
' "$2" "$3" | HOME="$1" bash "$HOOK"
}

# An inline-rendered screenshot the user already saw -> NOT recorded, reminder is {}.
FH=$(newhome); F=$(mkfile shots/home.png); OUT=$(run_imgtool "$FH" "$F" true)
{ ! recorded "$FH" && [ "$OUT" = "{}" ]; } \
  && ok "A1. MCP screenshot rendered inline -> not recorded, no nag" \
  || bad "A1. MCP screenshot rendered inline -> not recorded, no nag (out=$OUT)"

# ...and it does NOT trip the Stop gate (nothing pending -> silent).
FH=$(newhome); F=$(mkfile shots/lib.png); run_imgtool "$FH" "$F" true >/dev/null
OUT=$(run_stop "$FH")
[ "$OUT" = "{}" ] && ok "A2. inline-shown screenshot does not trip the Stop gate" \
                  || bad "A2. inline-shown screenshot wrongly tripped the Stop gate (out=$OUT)"

# A saved image with NO inline render (hypothetical save-only tool) is STILL tracked.
FH=$(newhome); F=$(mkfile shots/saveonly.png); run_imgtool "$FH" "$F" false >/dev/null
recorded "$FH" && ok "A3. MCP image saved WITHOUT inline render -> still recorded (no over-suppression)" \
               || bad "A3. MCP image saved WITHOUT inline render -> still recorded"

# An image-LABELLED result that carries only metadata (type:image but NO payload) is NOT
# inline - it must still be recorded (Codex v6: a payload is required, not just a label).
FH=$(newhome); F=$(mkfile shots/meta.png)
python3 -c 'import json,sys; print(json.dumps({"session_id":"S","tool_name":"mcp__x__save","tool_input":{"file_path":sys.argv[1]},"tool_response":{"type":"image","path":sys.argv[1],"status":"saved"}}))' "$F" \
  | HOME="$FH" bash "$HOOK" >/dev/null
recorded "$FH" && ok "A5. image-typed result with metadata only (no payload) -> still recorded" \
               || bad "A5. image-typed metadata-only result wrongly suppressed (payload must be required)"

# NO REGRESSION: a genuinely-unshown Write artifact (no inline image) STILL trips the gate.
FH=$(newhome); F=$(mkfile out/report.png); run_tool "$FH" Write "$F" >/dev/null
OUT=$(run_stop "$FH")
printf '%s' "$OUT" | is_block \
  && ok "A4. an unshown non-inline file STILL trips the Stop gate (backstop intact)" \
  || bad "A4. an unshown non-inline file STILL trips the Stop gate (out=$OUT)"

echo
echo "=== R9: GAP B - superseded-intermediate nudge (Jonah 2026-08-07) ==="

# preview_full.html recorded, then a lighter preview_light.html: the second reminder
# recognizes the sibling and names the orphaned original.
FH=$(newhome); F1=$(mkfile reports/preview_full.html); F2=$(mkfile reports/preview_light.html)
run_tool "$FH" Write "$F1" >/dev/null; CTX=$(run_tool "$FH" Write "$F2" | ctx)
{ [[ "$CTX" == *"SUPERSEDE CHECK"* ]] && [[ "$CTX" == *"$F1"* ]]; } \
  && ok "B1. sibling variant (preview_full -> preview_light) -> supersede nudge names the original" \
  || bad "B1. sibling variant -> supersede nudge names the original (ctx=$CTX)"

# Two genuinely-distinct artifacts in the same dir must NOT trip the nudge.
FH=$(newhome); F1=$(mkfile assets/hero.png); F2=$(mkfile assets/footer.png)
run_tool "$FH" Write "$F1" >/dev/null; CTX=$(run_tool "$FH" Write "$F2" | ctx)
[[ "$CTX" != *"SUPERSEDE"* ]] \
  && ok "B2. distinct artifacts (hero / footer) -> no supersede nudge (no over-fire)" \
  || bad "B2. distinct artifacts wrongly triggered a supersede nudge (ctx=$CTX)"

# A numbered SEQUENCE (slide_1 / slide_2) is not a supersede - both are wanted.
FH=$(newhome); F1=$(mkfile deck/slide_1.png); F2=$(mkfile deck/slide_2.png)
run_tool "$FH" Write "$F1" >/dev/null; CTX=$(run_tool "$FH" Write "$F2" | ctx)
[[ "$CTX" != *"SUPERSEDE"* ]] \
  && ok "B3. numbered sequence (slide_1 / slide_2) -> no supersede nudge" \
  || bad "B3. numbered sequence wrongly triggered a supersede nudge (ctx=$CTX)"

# Normal single-artifact flow is unchanged: the reminder is the plain MANDATORY, no note.
FH=$(newhome); F=$(mkfile solo/only.png); CTX=$(run_tool "$FH" Write "$F" | ctx)
{ [[ "$CTX" == *"MANDATORY"* ]] && [[ "$CTX" != *"SUPERSEDE"* ]] && [[ "$CTX" != *"outstanding"* ]]; } \
  && ok "B4. normal single-artifact flow unchanged (plain MANDATORY, no supersede note)" \
  || bad "B4. normal single-artifact flow altered (ctx=$CTX)"

# A sibling in a DIFFERENT directory is not flagged (same-dir requirement).
FH=$(newhome); F1=$(mkfile a/preview_full.html); F2=$(mkfile b/preview_light.html)
run_tool "$FH" Write "$F1" >/dev/null; CTX=$(run_tool "$FH" Write "$F2" | ctx)
[[ "$CTX" != *"SUPERSEDE"* ]] \
  && ok "B5. sibling names in different dirs -> no supersede nudge (same-dir required)" \
  || bad "B5. cross-dir sibling wrongly triggered a supersede nudge (ctx=$CTX)"

# A sibling that was already DELETED is not named (Codex v6: mirror the Stop self-heal).
FH=$(newhome); F1=$(mkfile reports/preview_full.html); F2=$(mkfile reports/preview_light.html)
run_tool "$FH" Write "$F1" >/dev/null; rm -f "$F1"
CTX=$(run_tool "$FH" Write "$F2" | ctx)
[[ "$CTX" != *"SUPERSEDE"* ]] \
  && ok "B6. a deleted sibling is not named in the nudge (aligns with Stop self-heal)" \
  || bad "B6. deleted sibling wrongly named in the supersede nudge (ctx=$CTX)"

echo
echo "=== R6: re-flag-loop guard (shown ledger) + scaffold exclusions ==="

# A path already surfaced this session and UNCHANGED since must NOT be re-recorded when a
# later Bash command merely mentions it - that re-harvest was the re-flag loop.
FH=$(newhome); F=$(mkfile assets/hero.png)
seed_shown "$FH" "$F"
run_bash "$FH" "compare base.png $F" >/dev/null
! recorded "$FH" \
  && ok "32. an unchanged shown path is NOT re-recorded on a later mention (re-flag loop fixed)" \
  || bad "32. an unchanged shown path is NOT re-recorded on a later mention (re-flag loop fixed)"

# MUTANT for 32: the SAME mention DOES record when the path is not in the shown ledger,
# proving the shown ledger is what suppressed it (not something incidental).
FH=$(newhome); F=$(mkfile assets/hero.png); run_bash "$FH" "compare base.png $F" >/dev/null
recorded "$FH" \
  && ok "33. control: same mention records when NOT in the shown ledger" \
  || bad "33. control: same mention records when NOT in the shown ledger"

# .design/ captures (internal Figma reference pulls) are never recorded.
FH=$(newhome); F=$(mkfile .design/figma/header.png); run_bash "$FH" "figma-export --out $F" >/dev/null
! recorded "$FH" \
  && ok "34. a .design/ reference capture is never recorded" \
  || bad "34. a .design/ reference capture is never recorded"

# ARTIFACT_SURFACE_IGNORE excludes a project's own scaffold dir by /-bounded segment.
FH=$(newhome); F=$(mkfile refs/tile.png)
printf '{"session_id":"S","tool_name":"Bash","tool_input":{"command":"gen --out %s"}}' "$F" \
  | ARTIFACT_SURFACE_IGNORE="refs,.snapshots" HOME="$FH" bash "$HOOK" >/dev/null
! recorded "$FH" \
  && ok "35. ARTIFACT_SURFACE_IGNORE excludes a listed scaffold dir" \
  || bad "35. ARTIFACT_SURFACE_IGNORE excludes a listed scaffold dir"

# MUTANT for 35: the SAME path WITHOUT the env IS recorded, so the env is the cause.
FH=$(newhome); F=$(mkfile refs/tile.png); run_bash "$FH" "gen --out $F" >/dev/null
recorded "$FH" \
  && ok "36. control: the same path records when the ignore env is unset" \
  || bad "36. control: the same path records when the ignore env is unset"

# A partial-name match must NOT be excluded (segment-bounded, not substring): 'refs' in
# the ignore list must not silence a sibling dir 'myrefs'.
FH=$(newhome); F=$(mkfile myrefs/tile.png)
printf '{"session_id":"S","tool_name":"Bash","tool_input":{"command":"gen --out %s"}}' "$F" \
  | ARTIFACT_SURFACE_IGNORE="refs" HOME="$FH" bash "$HOOK" >/dev/null
recorded "$FH" \
  && ok "37. ignore token 'refs' does NOT match sibling dir 'myrefs' (segment-bounded)" \
  || bad "37. ignore token 'refs' does NOT match sibling dir 'myrefs' (segment-bounded)"

# Codex P1 guard: the shown-ledger skip must apply to MENTIONS only, never to a genuine
# re-CREATION of a shown path (that new artifact is unshown and must still be flagged).
# 38/39 use CREATION positions (Write, --out); 40 proves the mtime discrimination catches a
# re-creation whose output is only a bare positional (indistinguishable from a mention by text).
FH=$(newhome); F=$(mkfile assets/hero.png); seed_shown "$FH" "$F"
run_tool "$FH" Write "$F" >/dev/null
recorded "$FH" \
  && ok "38. a shown path RE-CREATED by Write is still recorded (no false-clean)" \
  || bad "38. a shown path RE-CREATED by Write is still recorded (no false-clean)"

FH=$(newhome); F=$(mkfile assets/hero.png); seed_shown "$FH" "$F"
run_bash "$FH" "gen --out $F" >/dev/null
recorded "$FH" \
  && ok "39. a shown path RE-CREATED by a Bash --out is still recorded (creation != mention)" \
  || bad "39. a shown path RE-CREATED by a Bash --out is still recorded (creation != mention)"

# 40: shown EARLIER (older mtime), then re-created via a BARE positional (a mention by text).
# The file's current mtime is newer than the recorded show-time, so it re-flags anyway.
FH=$(newhome); F=$(mkfile assets/hero.png)
seed_shown "$FH" "$F" "$(( $(mtns "$F") - 5000000000 ))"
run_bash "$FH" "magick in.jpg $F" >/dev/null
recorded "$FH" \
  && ok "40. a shown path re-created (newer mtime) re-flags even via a bare-positional mention" \
  || bad "40. a shown path re-created (newer mtime) re-flags even via a bare-positional mention"

echo
echo "=== R5: disable marker + fail-open ==="

FH=$(newhome); disable "$FH"; F=$(mkfile d.png); OUT=$(run_tool "$FH" Write "$F")
{ [ "$OUT" = "{}" ] && ! recorded "$FH"; } \
  && ok "30. disable marker present -> silent, nothing recorded" \
  || bad "30. disable marker present -> silent, nothing recorded"

FH=$(newhome); OUT=$(printf 'not json' | HOME="$FH" bash "$HOOK"); RC=$?
{ [ "$OUT" = "{}" ] && [ "$RC" = 0 ]; } \
  && ok "31. malformed stdin -> {} and exit 0 (fail-open)" \
  || bad "31. malformed stdin -> {} and exit 0 (rc=$RC out=$OUT)"

echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
