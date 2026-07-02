#!/usr/bin/env bash
# Regression coverage for `beats.py search` (stage 3) and the benchmark scorer
# (beats/bench/score.py). Exercises supersession resolution at query time, the
# cycle and dangling guards, derived-index exclusion, the unusable-query and
# staleness paths, the broken-db path, and a scorer smoke on a synthetic
# benchmark+corpus (bar pass and bar fail both exercised). Read-only against the
# real corpus. Prints PASS/FAIL per case; exits non-zero if any case fails.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEATS_PY="$HERE/../beats.py"
VALIDATE_PY="$HERE/../bench/validate.py"
SCORE_PY="$HERE/../bench/score.py"

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

# --- Case 6: zero hits is exit 0 with a "0 results" line ---------------------
out="$(python3 "$BEATS_PY" search "supercalifragilistic" --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q "0 results"; then
  pass "case6 zero-hit query exits 0 with '0 results'"
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
# "micro adjustment" -> bigram "microadjustment" matches; the single tokens do not.
out="$(python3 "$BEATS_PY" search "micro adjustment" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q '"bigram_compound.md"'; then
  pass "caseB1 compound bigram matches the one-word compound beat"
else
  failcase "caseB1 expected bigram_compound.md via bigram, rc=$rc :: $out"
fi
# Negative control: the single token "micro" alone must NOT match it (distinct stem).
out="$(python3 "$BEATS_PY" search "micro" --json --corpus "$sf_corpus" --build "$sf_build" 2>/dev/null)"
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
