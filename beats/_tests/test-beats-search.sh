#!/usr/bin/env bash
# Regression coverage for `beats.py search` (stage 3) and the benchmark scorer
# (beats/bench/score.py). Exercises supersession resolution at query time, the
# cycle and dangling guards, derived-index exclusion, the unusable-query and
# staleness paths, the broken-db path, and a scorer smoke on a synthetic
# benchmark+corpus (bar pass and bar fail both exercised), plus the stage-3b
# hybrid path (RRF over the deterministic stub embedder) and its fail-soft.
# Read-only against the real corpus. Prints PASS/FAIL per case; exits non-zero
# if any case fails.
set -u

# Stage 3b: the deterministic stub embedder (documented, test-only, like
# --inject-parity-fault) makes every compile/search here exercise the hybrid
# vector+RRF path WITHOUT a running ollama - suites stay hermetic and fast. A
# real-model smoke gated on ollama availability runs at the end.
export BEATS_EMBED_STUB=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEATS_PY="$HERE/../beats.py"
VALIDATE_PY="$HERE/../bench/validate.py"
SCORE_PY="$HERE/../bench/score.py"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
SQLITE="$(command -v sqlite3 || true)"
BEATS_3A_REF="4b804747"  # committed stage-3a beats.py, for degraded-mode parity

# Force lexical-only for the cases that assert lexical-layer contracts (a truly
# empty result, and single-token tokenization): drop the stub AND point at a
# dead ollama so the query cannot embed. A dense retriever always returns
# nearest neighbors, so those contracts only hold with vectors off.
LEXONLY=(env -u BEATS_EMBED_STUB BEATS_OLLAMA_URL=http://127.0.0.1:1)

fails=0
passes=0
pass() { printf 'PASS: %s\n' "$1"; passes=$((passes + 1)); }
failcase() { printf 'FAIL: %s\n' "$1"; fails=$((fails + 1)); }

TMPDIRS=()
cleanup() {
  for d in "${TMPDIRS[@]:-}"; do
    [ -n "$d" ] && rm -rf "$d"
  done
}
trap cleanup EXIT

newtmp() {
  local d
  d="$(mktemp -d)"
  TMPDIRS+=("$d")
  printf '%s\n' "$d"
}

# Run "$@" with a wall-clock cap ($1 seconds), writing stdout/stderr to the
# files named in $2/$3. Returns 124 if the cap is hit (proves no hang). Portable
# - does not rely on coreutils `timeout` being installed.
run_capped() {
  local secs="$1" outf="$2" errf="$3"; shift 3
  "$@" >"$outf" 2>"$errf" &
  local pid=$! waited=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge "$secs" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 124
    fi
  done
  wait "$pid"
}

# Build a small search fixture corpus into $1. Distinctive body tokens:
#   zeppelin  -> alpha_head (HEAD) + alpha_stale (superseded_by alpha_head)
#                + both index files (must be excluded from results)
#   meteor    -> dangling.md (superseded_by a nonexistent target)
#   orbital   -> cyc_a <-> cyc_b (2-cycle in superseded_by)
make_search_fixture() {
  local corpus="$1"
  mkdir -p "$corpus"

  cat > "$corpus/alpha_head.md" <<'EOF'
---
name: Alpha head beat
description: current truth about zeppelin
type: reference
---
This is the current-truth beat about zeppelin navigation.
EOF

  cat > "$corpus/alpha_stale.md" <<'EOF'
---
name: Alpha stale beat
description: superseded zeppelin note
type: reference
superseded_by: alpha_head.md
---
An older superseded beat about zeppelin navigation, replaced by the head.
EOF

  cat > "$corpus/MEMORY.md" <<'EOF'
---
name: Memory index
description: derived index mentioning zeppelin and many other tokens
type: reference
---
Index pointers referencing zeppelin and everything else in the corpus.
EOF

  cat > "$corpus/MEMORY-archive.md" <<'EOF'
---
name: Memory archive index
description: archived derived index mentioning zeppelin
type: reference
---
Archived index pointers referencing zeppelin and other tokens.
EOF

  cat > "$corpus/dangling.md" <<'EOF'
---
name: Dangling beat
description: points at a missing superseder about meteor
type: reference
superseded_by: ghost_missing_target.md
---
A beat about meteor showers whose superseder does not exist on disk.
EOF

  cat > "$corpus/cyc_a.md" <<'EOF'
---
name: Cycle A beat
description: orbital note A
type: reference
superseded_by: cyc_b.md
---
Orbital mechanics discussion, side A of a supersession cycle.
EOF

  cat > "$corpus/cyc_b.md" <<'EOF'
---
name: Cycle B beat
description: orbital note B
type: reference
superseded_by: cyc_a.md
---
Orbital mechanics discussion, side B of a supersession cycle.
EOF

  cat > "$corpus/filler.md" <<'EOF'
---
name: Filler beat
description: unrelated content
type: project
---
Completely unrelated prose about gardening and weather.
EOF

  # Bigram fixture: the compound token appears ONLY as one word, so it is
  # reachable only via the compound-bigram query term, never the single tokens.
  cat > "$corpus/bigram_compound.md" <<'EOF'
---
name: Compound token beat
description: documents one compound workflow
type: reference
---
This beat documents the microadjustment workflow end to end.
EOF

  # Graph-expansion fixture. graph_hit is the only beat containing "kryptonite".
  # graph_fwd is a forward relates_to target of graph_hit; graph_rev cites
  # graph_hit in its own relates_to (reverse edge). Neither contains the query
  # token, so surfacing them proves BIDIRECTIONAL expansion.
  cat > "$corpus/graph_hit.md" <<'EOF'
---
name: Graph hit beat
description: the only beat about kryptonite
type: reference
relates_to: [graph_fwd.md]
---
A beat all about kryptonite and its many documented effects.
EOF

  cat > "$corpus/graph_fwd.md" <<'EOF'
---
name: Graph forward neighbor
description: forward relates_to target, no query token
type: reference
---
Prose about lead shielding and containment procedures.
EOF

  cat > "$corpus/graph_rev.md" <<'EOF'
---
name: Graph reverse neighbor
description: cites the hit in its own relates_to, no query token
type: reference
relates_to: [graph_hit.md]
---
Prose about ancient green rock lore and folklore.
EOF
}

# === Search fixture: compile once, reuse across cases ========================
sf="$(newtmp)"; sf_corpus="$sf/corpus"; sf_build="$sf/build"
make_search_fixture "$sf_corpus"
out="$(python3 "$BEATS_PY" compile --corpus "$sf_corpus" --build "$sf_build" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "search-fixture compile exits 0"
else
  failcase "search-fixture compile expected 0 got $rc :: $out"
fi

# --- Case 1: supersession resolution (stale -> head, never the stale file) ---
out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case1 search exits 0"
else
  failcase "case1 search expected 0 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q '"alpha_head.md"'; then
  pass "case1 chain head alpha_head.md present"
else
  failcase "case1 head missing from results :: $out"
fi
if printf '%s' "$out" | grep -q '"alpha_stale.md"'; then
  failcase "case1 stale beat alpha_stale.md leaked into results :: $out"
else
  pass "case1 stale beat alpha_stale.md correctly resolved away"
fi

# --- Case 2: derived-index exclusion (MEMORY.md / MEMORY-archive.md) ---------
if printf '%s' "$out" | grep -q '"MEMORY.md"' || printf '%s' "$out" | grep -q '"MEMORY-archive.md"'; then
  failcase "case2 an index file appeared in results :: $out"
else
  pass "case2 MEMORY.md and MEMORY-archive.md excluded from results"
fi

# --- Case 3: dangling superseded_by resolves to the deepest existing beat ----
out="$(python3 "$BEATS_PY" search "meteor" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"dangling.md"'; then
  pass "case3 dangling superseded_by resolves to itself (deepest existing)"
else
  failcase "case3 expected dangling.md in results, rc=$rc :: $out"
fi

# --- Case 4: cycle guard must not hang, must be deterministic ----------------
cyc_out="$sf/cyc.out"; cyc_err="$sf/cyc.err"
run_capped 20 "$cyc_out" "$cyc_err" python3 "$BEATS_PY" search "orbital" --json --corpus "$sf_corpus" --build "$sf_build"; rc=$?
if [ "$rc" -eq 124 ]; then
  failcase "case4 cycle query HUNG (killed after cap)"
elif [ "$rc" -eq 0 ]; then
  pass "case4 cycle query terminates (no hang), exits 0"
else
  failcase "case4 cycle query expected 0 got $rc :: $(cat "$cyc_err")"
fi
# Determinism: two runs produce identical output.
run2="$(python3 "$BEATS_PY" search "orbital" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"
if [ "$(cat "$cyc_out")" = "$run2" ] && printf '%s' "$run2" | grep -q '"cyc_'; then
  pass "case4 cycle query result is deterministic and non-empty"
else
  failcase "case4 cycle result non-deterministic or empty :: '$(cat "$cyc_out")' vs '$run2'"
fi
# Canonical collapse: both cycle members resolve to one deterministic
# representative (the min filename cyc_a.md); cyc_b.md must not surface too.
if printf '%s' "$run2" | grep -q '"cyc_a.md"' && ! printf '%s' "$run2" | grep -q '"cyc_b.md"'; then
  pass "case4 cycle collapses to canonical cyc_a.md (cyc_b.md not surfaced)"
else
  failcase "case4 cycle not collapsed to a single canonical member :: $run2"
fi

# --- Case 5: unusable query (all stopwords / too short) exits 1 --------------
out="$(python3 "$BEATS_PY" search "what is the a of do we" --corpus "$sf_corpus" --build "$sf_build" 2>&1)"; rc=$?
if [ "$rc" -eq 1 ]; then
  pass "case5 all-stopword query exits 1"
else
  failcase "case5 expected 1 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q "UNUSABLE QUERY"; then
  pass "case5 names the UNUSABLE QUERY class on stderr"
else
  failcase "case5 missing UNUSABLE QUERY class :: $out"
fi

# --- Case 6: zero hits is exit 0 with a "0 results" line (lexical-only) -------
# A dense retriever always returns nearest neighbors, so a truly empty page only
# happens in lexical-only mode when nothing matches the FTS query.
out="$("${LEXONLY[@]}" python3 "$BEATS_PY" search "supercalifragilistic" --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "0 results"; then
  pass "case6 zero-hit query exits 0 with '0 results' (lexical-only)"
else
  failcase "case6 expected 0 + '0 results' got rc=$rc :: $out"
fi

# --- Case 7: staleness warning path (still returns results, exit 0) ----------
st="$(newtmp)"; st_corpus="$st/corpus"; st_build="$st/build"
make_search_fixture "$st_corpus"
python3 "$BEATS_PY" compile --corpus "$st_corpus" --build "$st_build" >/dev/null 2>&1
printf '\nappended to change the corpus hash\n' >> "$st_corpus/filler.md"
out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$st_corpus" --build "$st_build" 2>"$st/err")"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"'; then
  pass "case7 stale-index search still returns results, exit 0"
else
  failcase "case7 expected 0 + results got rc=$rc :: $out"
fi
if grep -q "^STALE:" "$st/err"; then
  pass "case7 STALE warning printed to stderr"
else
  failcase "case7 no STALE warning on stderr :: $(cat "$st/err")"
fi

# --- Case 8: broken db exits 4 ----------------------------------------------
bd="$(newtmp)"; bd_corpus="$bd/corpus"; bd_build="$bd/build"
make_search_fixture "$bd_corpus"
python3 "$BEATS_PY" compile --corpus "$bd_corpus" --build "$bd_build" >/dev/null 2>&1
printf 'not a sqlite database' > "$bd_build/beats.db"
out="$(python3 "$BEATS_PY" search "zeppelin" --corpus "$bd_corpus" --build "$bd_build" 2>&1)"; rc=$?
if [ "$rc" -eq 4 ]; then
  pass "case8 broken db exits 4"
else
  failcase "case8 expected 4 got $rc :: $out"
fi

# --- Case 9: missing db exits 4 ---------------------------------------------
md="$(newtmp)"
out="$(python3 "$BEATS_PY" search "zeppelin" --corpus "$sf_corpus" --build "$md/nobuild" 2>&1)"; rc=$?
if [ "$rc" -eq 4 ]; then
  pass "case9 missing db exits 4"
else
  failcase "case9 expected 4 got $rc :: $out"
fi

# --- Case B1: compound-bigram query term reaches a one-word compound ---------
# Bigram tokenization is a lexical-layer mechanism; run lexical-only so a dense
# retriever's nearest-neighbor noise cannot mask it either way.
# "micro adjustment" -> bigram "microadjustment" matches; the single tokens do not.
out="$("${LEXONLY[@]}" python3 "$BEATS_PY" search "micro adjustment" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"bigram_compound.md"'; then
  pass "caseB1 compound bigram matches the one-word compound beat"
else
  failcase "caseB1 expected bigram_compound.md via bigram, rc=$rc :: $out"
fi
# Negative control: the single token "micro" alone must NOT match it (distinct stem).
out="$("${LEXONLY[@]}" python3 "$BEATS_PY" search "micro" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"
if printf '%s' "$out" | grep -q '"bigram_compound.md"'; then
  failcase "caseB1 single token 'micro' wrongly matched the compound :: $out"
else
  pass "caseB1 single token 'micro' does not match the compound (bigram is what did)"
fi

# --- Case B2: bidirectional relates_to graph expansion -----------------------
# "kryptonite" only matches graph_hit; expansion must surface BOTH its forward
# relates_to target (graph_fwd) and the beat that cites it (graph_rev).
out="$(python3 "$BEATS_PY" search "kryptonite" --json --top 5 --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"graph_hit.md"'; then
  pass "caseB2 direct hit graph_hit.md present"
else
  failcase "caseB2 direct hit missing, rc=$rc :: $out"
fi
if printf '%s' "$out" | grep -q '"graph_fwd.md"'; then
  pass "caseB2 forward relates_to neighbor graph_fwd.md surfaced by expansion"
else
  failcase "caseB2 forward neighbor not expanded :: $out"
fi
if printf '%s' "$out" | grep -q '"graph_rev.md"'; then
  pass "caseB2 reverse (bidirectional) citer graph_rev.md surfaced by expansion"
else
  failcase "caseB2 reverse neighbor not expanded (bidirectional broken) :: $out"
fi

# --- Case H1: hybrid mode is active under the stub embedder ------------------
# With vectors present AND an embedder (the stub) available, search must NOT warn
# VECTORS ABSENT - it is running the fused hybrid path.
python3 "$BEATS_PY" search "zeppelin" --json --corpus "$sf_corpus" --build "$sf_build" >/dev/null 2>"$sf/h1.err"
if grep -q "VECTORS ABSENT" "$sf/h1.err"; then
  failcase "caseH1 expected hybrid (no VECTORS ABSENT) but got :: $(cat "$sf/h1.err")"
else
  pass "caseH1 hybrid path active under the stub (no VECTORS ABSENT warning)"
fi

# --- Case H2: fail-soft when the embedder is unreachable at query time -------
# The db has vectors but the query cannot embed -> loud VECTORS ABSENT warning,
# lexical-only results still returned, exit 0 (distinct from broken-db exit 4).
out="$("${LEXONLY[@]}" python3 "$BEATS_PY" search "zeppelin" --json --corpus "$sf_corpus" --build "$sf_build" 2>"$sf/h2.err")"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"'; then
  pass "caseH2 unreachable embedder -> lexical-only results, exit 0"
else
  failcase "caseH2 expected 0 + results got rc=$rc :: $out"
fi
if grep -q "VECTORS ABSENT: embedder unreachable" "$sf/h2.err"; then
  pass "caseH2 loud VECTORS ABSENT (embedder unreachable) warning on stderr"
else
  failcase "caseH2 missing embedder-unreachable warning :: $(cat "$sf/h2.err")"
fi

# --- Case H3: fail-soft when the compiled index carries no vectors -----------
va="$(newtmp)"; va_corpus="$va/corpus"; va_build="$va/build"
make_search_fixture "$va_corpus"
# Compile with the embedder unavailable -> vectors_present=0, still exit 0 + loud line.
cout="$(env -u BEATS_EMBED_STUB BEATS_OLLAMA_URL=http://127.0.0.1:1 \
  python3 "$BEATS_PY" compile --corpus "$va_corpus" --build "$va_build" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$cout" | grep -q "VECTORS ABSENT"; then
  pass "caseH3 compile with no embedder succeeds lexical-only + loud VECTORS ABSENT"
else
  failcase "caseH3 expected 0 + VECTORS ABSENT got rc=$rc :: $cout"
fi
if [ -n "$SQLITE" ]; then
  vp="$("$SQLITE" "$va_build/beats.db" "SELECT vectors_present FROM meta;")"
  if [ "$vp" = "0" ]; then
    pass "caseH3 meta.vectors_present=0 after lexical-only compile"
  else
    failcase "caseH3 expected vectors_present=0 got '$vp'"
  fi
fi
out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$va_corpus" --build "$va_build" 2>"$va/err")"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"' \
   && grep -q "VECTORS ABSENT: compiled index has no vectors" "$va/err"; then
  pass "caseH3 search on a vectorless db is lexical-only + loud warning, exit 0"
else
  failcase "caseH3 expected lexical-only warning + results, rc=$rc :: $out :: $(cat "$va/err")"
fi

# --- Case H4: vector-parity is a broken artifact (desynced beats_vec) --------
if [ -n "$SQLITE" ]; then
  vd="$(newtmp)"; vd_corpus="$vd/corpus"; vd_build="$vd/build"
  make_search_fixture "$vd_corpus"
  python3 "$BEATS_PY" compile --corpus "$vd_corpus" --build "$vd_build" >/dev/null 2>&1
  "$SQLITE" "$vd_build/beats.db" "DELETE FROM beats_vec WHERE rowid=1;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$vd_corpus" --build "$vd_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "caseH4 verify with desynced beats_vec exits 4"
  else
    failcase "caseH4 expected 4 got $rc :: $out"
  fi
  # Filename-set (not just count) parity: a wrong-filename beats_vec row must be
  # caught even though the row count still matches beats.
  vf="$(newtmp)"; vf_corpus="$vf/corpus"; vf_build="$vf/build"
  make_search_fixture "$vf_corpus"
  python3 "$BEATS_PY" compile --corpus "$vf_corpus" --build "$vf_build" >/dev/null 2>&1
  "$SQLITE" "$vf_build/beats.db" \
    "UPDATE beats_vec SET filename='ghost_phantom.md' WHERE filename='filler.md';" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$vf_corpus" --build "$vf_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "caseH4 verify with wrong-filename beats_vec (count matches) exits 4"
  else
    failcase "caseH4 expected 4 for filename desync got $rc :: $out"
  fi
fi

# --- Case H6: corrupt stored vector -> loud lexical-only fallback ------------
if [ -n "$SQLITE" ]; then
  cv="$(newtmp)"; cv_corpus="$cv/corpus"; cv_build="$cv/build"
  make_search_fixture "$cv_corpus"
  python3 "$BEATS_PY" compile --corpus "$cv_corpus" --build "$cv_build" >/dev/null 2>&1
  # Truncate one vector blob so struct.unpack fails at search time (verify's
  # filename-set parity still passes, so this is the search-side guard).
  "$SQLITE" "$cv_build/beats.db" \
    "UPDATE beats_vec SET vec=X'0000' WHERE filename='alpha_head.md';" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$cv_corpus" --build "$cv_build" 2>"$cv/err")"; rc=$?
  if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"' \
     && grep -q "VECTORS ABSENT: corrupt stored vector" "$cv/err"; then
    pass "caseH6 corrupt vector blob -> loud lexical-only fallback, exit 0"
  else
    failcase "caseH6 expected corrupt-vector lexical fallback, rc=$rc :: $out :: $(cat "$cv/err")"
  fi
fi

# --- Case H7: query/index embedding dim mismatch -> lexical-only (gated) ------
# A stub-compiled index (dim 64) queried with the real model (dim 1024) must
# detect the mismatch and fall back loudly, not fuse garbage cosine.
real_probe7="$(curl -s --max-time 40 http://localhost:11434/api/embeddings \
  -d '{"model":"qwen3-embedding:0.6b","prompt":"probe"}' 2>/dev/null || true)"
if printf '%s' "$real_probe7" | grep -q '"embedding"'; then
  dm="$(newtmp)"; dm_corpus="$dm/corpus"; dm_build="$dm/build"
  make_search_fixture "$dm_corpus"
  python3 "$BEATS_PY" compile --corpus "$dm_corpus" --build "$dm_build" >/dev/null 2>&1  # stub dim 64
  out="$(env -u BEATS_EMBED_STUB python3 "$BEATS_PY" search "zeppelin" --json \
    --corpus "$dm_corpus" --build "$dm_build" 2>"$dm/err")"; rc=$?
  if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"' \
     && grep -q "query embedding dim 1024 != index dim 64" "$dm/err"; then
    pass "caseH7 dim mismatch -> loud lexical-only fallback, exit 0"
  else
    failcase "caseH7 expected dim-mismatch fallback, rc=$rc :: $out :: $(cat "$dm/err")"
  fi
else
  pass "caseH7 dim-mismatch smoke SKIPPED (no live ollama embedding endpoint)"
fi

# --- Case H8: malformed meta.embed_dim -> lexical-only, no crash --------------
if [ -n "$SQLITE" ]; then
  md8="$(newtmp)"; md8_corpus="$md8/corpus"; md8_build="$md8/build"
  make_search_fixture "$md8_corpus"
  python3 "$BEATS_PY" compile --corpus "$md8_corpus" --build "$md8_build" >/dev/null 2>&1
  # vectors_present stays 1 but embed_dim is NULL (malformed) -> unusable vectors.
  "$SQLITE" "$md8_build/beats.db" "UPDATE meta SET embed_dim=NULL;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$md8_corpus" --build "$md8_build" 2>/dev/null)"; rc=$?
  if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"'; then
    pass "caseH8 malformed embed_dim -> lexical-only results, exit 0 (no crash)"
  else
    failcase "caseH8 expected lexical-only exit 0, got rc=$rc :: $out"
  fi
fi

# --- Case H9: NULL vector blob (TypeError path) -> corrupt lexical fallback ---
if [ -n "$SQLITE" ]; then
  n9="$(newtmp)"; n9_corpus="$n9/corpus"; n9_build="$n9/build"
  make_search_fixture "$n9_corpus"
  python3 "$BEATS_PY" compile --corpus "$n9_corpus" --build "$n9_build" >/dev/null 2>&1
  "$SQLITE" "$n9_build/beats.db" "UPDATE beats_vec SET vec=NULL WHERE filename='alpha_head.md';" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$n9_corpus" --build "$n9_build" 2>"$n9/err")"; rc=$?
  if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"' \
     && grep -q "VECTORS ABSENT: corrupt stored vector" "$n9/err"; then
    pass "caseH9 NULL vector blob -> loud corrupt lexical fallback, exit 0"
  else
    failcase "caseH9 expected corrupt-vector fallback, rc=$rc :: $out :: $(cat "$n9/err")"
  fi
  # A per-row dim that disagrees with meta.embed_dim must be caught (a dim=1 row
  # would otherwise unpack "fine" and pollute the ranking silently).
  n9b="$(newtmp)"; n9b_corpus="$n9b/corpus"; n9b_build="$n9b/build"
  make_search_fixture "$n9b_corpus"
  python3 "$BEATS_PY" compile --corpus "$n9b_corpus" --build "$n9b_build" >/dev/null 2>&1
  "$SQLITE" "$n9b_build/beats.db" "UPDATE beats_vec SET dim=1 WHERE filename='alpha_head.md';" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" search "zeppelin" --json --corpus "$n9b_corpus" --build "$n9b_build" 2>"$n9b/err")"; rc=$?
  if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"alpha_head.md"' \
     && grep -q "VECTORS ABSENT: corrupt stored vector" "$n9b/err"; then
    pass "caseH9 per-row dim != meta.embed_dim -> loud corrupt lexical fallback"
  else
    failcase "caseH9 expected row-dim-mismatch fallback, rc=$rc :: $out :: $(cat "$n9b/err")"
  fi
fi

# --- Case H5: real-model smoke (gated on a live ollama embedding endpoint) ----
real_probe="$(curl -s --max-time 40 http://localhost:11434/api/embeddings \
  -d '{"model":"qwen3-embedding:0.6b","prompt":"probe"}' 2>/dev/null || true)"
if printf '%s' "$real_probe" | grep -q '"embedding"'; then
  rm_tmp="$(newtmp)"; rm_corpus="$rm_tmp/corpus"; rm_build="$rm_tmp/build"
  make_search_fixture "$rm_corpus"
  env -u BEATS_EMBED_STUB python3 "$BEATS_PY" compile --corpus "$rm_corpus" --build "$rm_build" >/dev/null 2>&1
  if [ -n "$SQLITE" ]; then
    rvp="$("$SQLITE" "$rm_build/beats.db" "SELECT vectors_present FROM meta;")"
    rdim="$("$SQLITE" "$rm_build/beats.db" "SELECT embed_dim FROM meta;")"
  else
    rvp=1; rdim=1
  fi
  rout="$(env -u BEATS_EMBED_STUB python3 "$BEATS_PY" search "zeppelin navigation" --json --corpus "$rm_corpus" --build "$rm_build" 2>/dev/null)"
  if [ "$rvp" = "1" ] && [ "${rdim:-0}" -gt 0 ] && printf '%s' "$rout" | grep -q '"alpha_head.md"'; then
    pass "caseH5 real-model smoke: vectors_present=1 dim=$rdim, hybrid search returns"
  else
    failcase "caseH5 real-model smoke failed: vp=$rvp dim=$rdim :: $rout"
  fi
else
  pass "caseH5 real-model smoke SKIPPED (no live ollama embedding endpoint)"
fi

# --- Case P1: degraded-mode parity with the pre-3b (stage-3a) lexical path ---
# The mandatory cert fold: in lexical-only mode the FULL hits stream (not
# hits[:CAND_K]) must feed supersession + expansion + top-N, exactly like 3a.
# Fixture: >CAND_K stale beats that all collapse to one head occupy the top of
# the bm25 ranking; distinct filler heads sit BEYOND CAND_K. With the old cap the
# page starved to a single result; the full stream fills it - and must match the
# actual committed 3a engine byte-for-byte (filenames+order).
p1_ref="$(git -C "$REPO_ROOT" rev-parse --verify -q "$BEATS_3A_REF^{commit}" 2>/dev/null || true)"
if [ -n "$p1_ref" ] && [ -n "$SQLITE" ]; then
  P1="$(newtmp)"; p1_corpus="$P1/corpus"; p1_build="$P1/build"; beats3a="$P1/beats3a.py"
  git -C "$REPO_ROOT" show "$BEATS_3A_REF:beats/beats.py" > "$beats3a" 2>/dev/null
  mkdir -p "$p1_corpus"
  python3 - "$p1_corpus" <<'PY'
import sys, pathlib
c = pathlib.Path(sys.argv[1])
# A head that only appears via resolution (no query token of its own).
(c / "target.md").write_text(
    "---\nname: target head\ndescription: the resolution head\ntype: reference\n---\n"
    "Head content on a distinct topic.\n", encoding="utf-8")
# 120 stale beats, all superseded_by target, "widget" in name+desc+body -> strong
# bm25, so they occupy the top ~120 ranks (well past CAND_K=100).
for i in range(120):
    (c / f"stale_{i:03d}.md").write_text(
        f"---\nname: widget stale {i:03d}\ndescription: widget widget widget\n"
        f"type: reference\nsuperseded_by: target.md\n---\nwidget widget widget body {i}\n",
        encoding="utf-8")
# 30 distinct filler heads, "widget" only once in body -> weaker bm25, ranked
# AFTER the stale block (beyond CAND_K). These only reach the page via the full
# stream. A relates_to chain among them makes bidirectional graph EXPANSION
# participate, so caseP1 also proves expansion parity (the -bm25 lexical-only
# scoring must match 3a's bm25 blend, not just direct-hit order).
for i in range(30):
    nb = (i + 1) % 30
    (c / f"filler_{i:02d}.md").write_text(
        f"---\nname: filler {i:02d}\ndescription: distinct head {i}\ntype: reference\n"
        f"relates_to: [filler_{nb:02d}.md]\n---\n"
        f"content mentioning widget once, filler {i}\n", encoding="utf-8")
PY
  # Compile with the 3a engine (produces a stage-3a v1 db, no vectors); both
  # engines read it, and the 3b engine goes lexical-only on a vectorless db.
  python3 "$beats3a" compile --corpus "$p1_corpus" --build "$p1_build" >/dev/null 2>&1
  fnseq() { python3 -c 'import sys,json; print("|".join(x["filename"] for x in json.load(sys.stdin)))'; }
  seq3a="$(python3 "$beats3a" search "widget" --json --top 5 --corpus "$p1_corpus" --build "$p1_build" 2>/dev/null | fnseq)"
  seqnew="$(python3 "$BEATS_PY" search "widget" --json --top 5 --corpus "$p1_corpus" --build "$p1_build" 2>/dev/null | fnseq)"
  n3a="$(printf '%s' "$seq3a" | awk -F'|' '{print (length($0)? NF : 0)}')"
  # Compare the filename ORDER (the plain `score` field is legitimately
  # sign-flipped: 3a prints bm25, degraded prints -bm25; ordering is what must match).
  if [ "$seqnew" = "$seq3a" ] && [ "${n3a:-0}" -ge 2 ]; then
    pass "caseP1 degraded-mode filename order matches committed stage-3a ($n3a results, full stream)"
  else
    failcase "caseP1 parity mismatch (3a='$seq3a' vs degraded='$seqnew')"
  fi
  # Guard: prove the OLD cap would have starved this page (top CAND_K all collapse
  # to one head), so the parity above is meaningful, not vacuous.
  capseq="$(python3 - "$p1_build" "$SQLITE" <<'PY'
import sys, sqlite3
con = sqlite3.connect(sys.argv[1] + "/beats.db")
rows = con.execute(
    "SELECT filename FROM beats_fts WHERE beats_fts MATCH 'widget' "
    "ORDER BY bm25(beats_fts,1.0,4.0,3.0,1.0) ASC, filename ASC LIMIT 100").fetchall()
# how many distinct supersession heads among the top-100 lexical hits?
sup = dict(con.execute("SELECT filename, superseded_by FROM beats").fetchall())
heads = set()
for (fn,) in rows:
    h = fn
    for _ in range(10):
        nxt = sup.get(h) or ""
        if not nxt: break
        h = nxt
    heads.add(h)
print(len(heads))
PY
)"
  if [ "${capseq:-0}" -le 1 ]; then
    pass "caseP1 top-CAND_K collapse to <=1 head confirmed (old cap would starve the page)"
  else
    failcase "caseP1 fixture not exercising collapse: $capseq heads in top-100"
  fi
fi

# --- Case P2: degraded-mode EXPANSION parity with stage-3a -------------------
# The -bm25 fold's real purpose: expansion neighbors must be blended off bm25
# (like 3a), not off rank. This fixture has a neighbor that is NOT a direct hit,
# so it reaches the page ONLY through graph expansion; its position must match
# the committed 3a engine exactly.
if [ -n "$p1_ref" ] && [ -n "$SQLITE" ]; then
  P2="$(newtmp)"; p2_corpus="$P2/corpus"; p2_build="$P2/build"; beats3a2="$P2/beats3a.py"
  git -C "$REPO_ROOT" show "$BEATS_3A_REF:beats/beats.py" > "$beats3a2" 2>/dev/null
  mkdir -p "$p2_corpus"
  # head_a and head_b both match "sprocket"; head_a cites neighbor_x, which does
  # NOT contain the token, so neighbor_x can only appear via expansion.
  cat > "$p2_corpus/head_a.md" <<'EOF'
---
name: head a
description: sprocket topic
type: reference
relates_to: [neighbor_x.md]
---
sprocket assembly notes
EOF
  cat > "$p2_corpus/head_b.md" <<'EOF'
---
name: head b
description: sprocket topic
type: reference
---
sprocket maintenance notes
EOF
  cat > "$p2_corpus/neighbor_x.md" <<'EOF'
---
name: neighbor x
description: bound context, no query token
type: reference
---
Gearbox lubrication schedule and torque values.
EOF
  python3 "$beats3a2" compile --corpus "$p2_corpus" --build "$p2_build" >/dev/null 2>&1
  fnseq2() { python3 -c 'import sys,json; print("|".join(x["filename"] for x in json.load(sys.stdin)))'; }
  s3a="$(python3 "$beats3a2" search "sprocket" --json --top 5 --corpus "$p2_corpus" --build "$p2_build" 2>/dev/null | fnseq2)"
  snew="$(python3 "$BEATS_PY" search "sprocket" --json --top 5 --corpus "$p2_corpus" --build "$p2_build" 2>/dev/null | fnseq2)"
  if [ "$snew" = "$s3a" ] && printf '%s' "$snew" | grep -q "neighbor_x.md"; then
    pass "caseP2 degraded expansion (bm25-blended neighbor) matches 3a; neighbor surfaced via expansion"
  else
    failcase "caseP2 expansion parity mismatch (3a='$s3a' vs degraded='$snew')"
  fi
fi

# === Scorer smoke: synthetic benchmark + corpus ==============================
# Build a self-contained fixture repo tree so validate.py (which reads its own
# sibling benchmark.json and a repo-relative corpus) and beats.py both resolve
# inside the fixture. Copies (never symlinks) so __file__.resolve() stays inside
# the tree.
sc="$(newtmp)"
sc_beats="$sc/beats"; sc_bench="$sc_beats/bench"; sc_corpus="$sc/.claude/memory"; sc_build="$sc_beats/.build"
mkdir -p "$sc_bench" "$sc_corpus" "$sc_build"
cp "$BEATS_PY" "$sc_beats/beats.py"
cp "$VALIDATE_PY" "$sc_bench/validate.py"

python3 - "$sc_corpus" "$sc_bench" <<'PY'
import json, sys
from pathlib import Path
corpus = Path(sys.argv[1]); bench_dir = Path(sys.argv[2])

# 33 distinct pure-alpha tokens (no stemmer collisions).
words = []
for a in "bcdfg":
    for b in "aeiou":
        for c in "kt":
            words.append(a + b + c + "wex")
words = words[:33]

# 32 answerable beats, each carrying its unique token exactly once.
for i in range(32):
    w = words[i]
    (corpus / f"beat{i:02d}.md").write_text(
        f"---\nname: Beat {i:02d} about {w}\n"
        f"description: the {w} subject\ntype: reference\n---\n"
        f"This beat covers the {w} subject in detail.\n",
        encoding="utf-8",
    )
# A marked-stale beat sharing beat00's token; must never leak into results.
(corpus / "beat_stale.md").write_text(
    "---\nname: Stale beat about " + words[0] + "\n"
    f"description: superseded {words[0]} note\ntype: reference\n"
    "superseded_by: beat00.md\n---\n"
    f"Old superseded beat about the {words[0]} subject.\n",
    encoding="utf-8",
)

def case(i, question):
    return {
        "id": f"c{i:02d}", "topic": f"t{i % 5}", "question": question,
        "answers": [f"beat{i:02d}.md"], "stale": [], "notes": "synthetic",
    }

base = {
    "version": 1, "created": "2026-07-02", "corpus": ".claude/memory",
    "scoring": {
        "unit": "query", "top_n": 5,
        "hit_rule": "synthetic", "global_stale_rule": "synthetic",
        "tie_rule": "synthetic", "cutover_rule": "synthetic",
    },
}

# Pass variant: every question names its own beat's token; bar 0.5.
passing = dict(base)
passing["scoring"] = dict(base["scoring"], pass_rate=0.5)
passing["cases"] = [case(i, f"Tell me about the {words[i]} subject") for i in range(32)]

# Fail variant: one question names a token in no beat -> that query misses;
# bar 0.99 so a single miss (31/32 = 0.969) falls under the bar.
failing = dict(base)
failing["scoring"] = dict(base["scoring"], pass_rate=0.99)
fcases = [case(i, f"Tell me about the {words[i]} subject") for i in range(32)]
fcases[31] = case(31, "Tell me about the zzznotokenhere subject")
failing["cases"] = fcases

# Invalid variant: too few cases -> validate.py fails -> scorer exits 2.
invalid = dict(base)
invalid["scoring"] = dict(base["scoring"], pass_rate=0.5)
invalid["cases"] = [case(0, f"Tell me about the {words[0]} subject")]

(bench_dir / "benchmark_pass.json").write_text(json.dumps(passing, indent=2), encoding="utf-8")
(bench_dir / "benchmark_fail.json").write_text(json.dumps(failing, indent=2), encoding="utf-8")
(bench_dir / "benchmark_invalid.json").write_text(json.dumps(invalid, indent=2), encoding="utf-8")
print("fixture written")
PY

# Compile the fixture corpus so the scorer's verify sees an existing db.
python3 "$sc_beats/beats.py" compile --corpus "$sc_corpus" --build "$sc_build" >/dev/null 2>&1

# --- Case 10: scorer bar PASS -> exit 0 --------------------------------------
cp "$sc_bench/benchmark_pass.json" "$sc_bench/benchmark.json"
out="$(python3 "$SCORE_PY" --benchmark "$sc_bench/benchmark.json" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case10 scorer bar-pass exits 0"
else
  failcase "case10 expected 0 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q "^OK: hit rate"; then
  pass "case10 scorer prints the OK success line"
else
  failcase "case10 missing OK success line :: $out"
fi

# --- Case 11: stale corpus -> scorer recompiles and still passes -------------
printf '\nwhitespace change to force a stale index\n' >> "$sc_corpus/beat05.md"
out="$(python3 "$SCORE_PY" --benchmark "$sc_bench/benchmark.json" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case11 scorer recompiles a stale index and still passes (exit 0)"
else
  failcase "case11 expected 0 (recompile path) got $rc :: $out"
fi

# --- Case 12: scorer bar FAIL -> exit 1 --------------------------------------
cp "$sc_bench/benchmark_fail.json" "$sc_bench/benchmark.json"
out="$(python3 "$SCORE_PY" --benchmark "$sc_bench/benchmark.json" 2>&1)"; rc=$?
if [ "$rc" -eq 1 ]; then
  pass "case12 scorer bar-fail exits 1"
else
  failcase "case12 expected 1 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q "UNDER BAR"; then
  pass "case12 scorer prints UNDER BAR on stderr"
else
  failcase "case12 missing UNDER BAR :: $out"
fi

# --- Case 13: invalid benchmark (< min cases) -> scorer exits 2 --------------
cp "$sc_bench/benchmark_invalid.json" "$sc_bench/benchmark.json"
out="$(python3 "$SCORE_PY" --benchmark "$sc_bench/benchmark.json" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then
  pass "case13 scorer with invalid benchmark exits 2"
else
  failcase "case13 expected 2 got $rc :: $out"
fi

# --- Summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$passes" "$fails"
[ "$fails" -eq 0 ] || exit 1
