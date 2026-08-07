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
# generated image commonly lands there and the user still wants to see it. DOCUMENTS
# (.md .txt .csv .rtf .doc .docx) are harvested from the Write tool ONLY and keep the
# temp/scratch exclusion. The BASH section below proves both halves.
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
