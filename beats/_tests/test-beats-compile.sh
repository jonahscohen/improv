#!/usr/bin/env bash
# Regression coverage for beats/beats.py - exercises every exit-code path
# against synthetic fixture corpora built in temp dirs. The real corpus is
# only ever read (never written to). Prints PASS/FAIL per case; exits non-zero
# if any case fails.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BEATS_PY="$HERE/../beats.py"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
REAL_CORPUS="$REPO_ROOT/.claude/memory"
SQLITE="$(command -v sqlite3 || true)"

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

# Build the standard fixture corpus (6 files) into $1. Covers scalar / inline-list
# / block-list / empty superseded_by-and-list forms, a no-frontmatter file, and
# unicode content. Exactly one file (file01) is stale. Only file03 contains the
# word "term" (for the FTS smoke).
make_fixture() {
  local corpus="$1"
  mkdir -p "$corpus"

  cat > "$corpus/file01_scalar.md" <<'EOF'
---
name: Scalar stale beat
description: uses a scalar superseded_by value
type: decision
supersedes: ~
superseded_by: file02_inline.md
---
This beat is stale. It discusses quantum flux capacitors at length.
EOF

  cat > "$corpus/file02_inline.md" <<'EOF'
---
name: Inline list beat
description: inline-list relates_to plus empty inline-list superseded_by
type: reference
relates_to: [file01_scalar.md, file03_block.md]
superseded_by: []
---
Inline content about widgets and gadgets.
EOF

  cat > "$corpus/file03_block.md" <<'EOF'
---
name: Block list beat
description: block-list relates_to plus empty block superseded_by
type: project
relates_to:
  - file01_scalar.md
  - file02_inline.md
superseded_by:
---
Block content mentioning the term marker exactly once.
EOF

  cat > "$corpus/file04_empty.md" <<'EOF'
---
name: Empty fields beat
description: empty list and null scalar forms
type: user
relates_to: []
supersedes: null
superseded_by:
---
Plain body about coffee and mornings.
EOF

  cat > "$corpus/file05_unicode.md" <<'EOF'
---
name: Unicode beat café
description: unicode content ünïcödé 日本語
type: feedback
custom_field: some custom value
another_extra: 42
---
Unicode body café naïve 日本語 résumé jalapeño.
EOF

  cat > "$corpus/file06_nofrontmatter.md" <<'EOF'
# Just a heading

No frontmatter block here at all, only markdown body prose.
EOF
}

# --- Case 1: happy path ------------------------------------------------------
c1="$(newtmp)"; c1_corpus="$c1/corpus"; c1_build="$c1/build"
make_fixture "$c1_corpus"
out="$(python3 "$BEATS_PY" compile --corpus "$c1_corpus" --build "$c1_build" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case1 compile exits 0"
else
  failcase "case1 compile expected 0 got $rc :: $out"
fi

jsonl_lines="$(wc -l < "$c1_build/beats.jsonl" | tr -d ' ')"
if [ "$jsonl_lines" = "6" ]; then
  pass "case1 jsonl line count is 6"
else
  failcase "case1 jsonl line count expected 6 got $jsonl_lines"
fi

if [ -n "$SQLITE" ]; then
  rows="$("$SQLITE" "$c1_build/beats.db" "SELECT COUNT(*) FROM beats;")"
  if [ "$rows" = "6" ]; then
    pass "case1 beats row count is 6"
  else
    failcase "case1 beats row count expected 6 got $rows"
  fi
  stale="$("$SQLITE" "$c1_build/beats.db" "SELECT COUNT(*) FROM beats WHERE is_stale=1;")"
  if [ "$stale" = "1" ]; then
    pass "case1 exactly one is_stale row"
  else
    failcase "case1 is_stale count expected 1 got $stale"
  fi
else
  failcase "case1 sqlite3 not on PATH - cannot verify db"
fi

out="$(python3 "$BEATS_PY" verify --corpus "$c1_corpus" --build "$c1_build" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case1 verify exits 0 (fresh)"
else
  failcase "case1 verify expected 0 got $rc :: $out"
fi

# --- Case 2: corpus missing --------------------------------------------------
c2="$(newtmp)"
out="$(python3 "$BEATS_PY" compile --corpus "$c2/does-not-exist" --build "$c2/build" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then
  pass "case2 missing corpus exits 2"
else
  failcase "case2 expected 2 got $rc :: $out"
fi

# --- Case 3: undecodable file ------------------------------------------------
c3="$(newtmp)"; c3_corpus="$c3/corpus"; mkdir -p "$c3_corpus"
cat > "$c3_corpus/good.md" <<'EOF'
---
name: good
type: project
---
fine body
EOF
printf '\xff\xfe\x00\x80bad bytes' > "$c3_corpus/bad_bytes.md"
out="$(python3 "$BEATS_PY" compile --corpus "$c3_corpus" --build "$c3/build" 2>&1)"; rc=$?
if [ "$rc" -eq 3 ]; then
  pass "case3 undecodable file exits 3"
else
  failcase "case3 expected 3 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q "bad_bytes.md"; then
  pass "case3 names the offending file on stderr"
else
  failcase "case3 offending filename not reported :: $out"
fi

# --- Case 4: stale detection -------------------------------------------------
c4="$(newtmp)"; c4_corpus="$c4/corpus"; c4_build="$c4/build"
make_fixture "$c4_corpus"
python3 "$BEATS_PY" compile --corpus "$c4_corpus" --build "$c4_build" >/dev/null 2>&1
# add one new file and modify one existing file
cat > "$c4_corpus/file07_new.md" <<'EOF'
---
name: newly added beat
type: project
---
brand new body
EOF
printf '\nappended line to change the sha\n' >> "$c4_corpus/file04_empty.md"
out="$(python3 "$BEATS_PY" verify --corpus "$c4_corpus" --build "$c4_build" 2>&1)"; rc=$?
if [ "$rc" -eq 6 ]; then
  pass "case4 stale corpus verify exits 6"
else
  failcase "case4 expected 6 got $rc :: $out"
fi
if printf '%s' "$out" | grep -q "1 added" && printf '%s' "$out" | grep -q "1 changed"; then
  pass "case4 reports 1 added and 1 changed"
else
  failcase "case4 added/changed counts wrong :: $out"
fi

# --- Case 5: parity self-verification failure --------------------------------
c5="$(newtmp)"; c5_corpus="$c5/corpus"; c5_build="$c5/build"
make_fixture "$c5_corpus"
out="$(python3 "$BEATS_PY" compile --corpus "$c5_corpus" --build "$c5_build" --inject-parity-fault 2>&1)"; rc=$?
if [ "$rc" -eq 5 ]; then
  pass "case5 injected parity fault exits 5"
else
  failcase "case5 expected 5 got $rc :: $out"
fi
if [ ! -e "$c5_build/beats.db" ] && [ ! -e "$c5_build/beats.jsonl" ]; then
  pass "case5 artifacts invalidated (not installed on parity failure)"
else
  failcase "case5 artifacts should not have been installed"
fi

# --- Case 6: real corpus smoke (read-only) -----------------------------------
c6="$(newtmp)"; c6_build="$c6/build"
if [ -d "$REAL_CORPUS" ]; then
  out="$(python3 "$BEATS_PY" compile --corpus "$REAL_CORPUS" --build "$c6_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 0 ]; then
    pass "case6 real-corpus compile exits 0"
  else
    failcase "case6 expected 0 got $rc :: $out"
  fi
  if [ -n "$SQLITE" ]; then
    fc="$("$SQLITE" "$c6_build/beats.db" "SELECT file_count FROM meta;")"
    if [ -n "$fc" ] && [ "$fc" -ge 800 ]; then
      pass "case6 real-corpus file_count >= 800 (got $fc)"
    else
      failcase "case6 real-corpus file_count expected >= 800 got ${fc:-none}"
    fi
    printf 'SMOKE: real-corpus file_count=%s\n' "$fc"
  else
    failcase "case6 sqlite3 not on PATH - cannot read file_count"
  fi
else
  failcase "case6 real corpus not found at $REAL_CORPUS"
fi

# --- Case 7: FTS smoke -------------------------------------------------------
if [ -n "$SQLITE" ]; then
  match="$("$SQLITE" "$c1_build/beats.db" "SELECT filename FROM beats_fts WHERE beats_fts MATCH 'term';")"
  if [ "$match" = "file03_block.md" ]; then
    pass "case7 FTS MATCH 'term' returns file03_block.md"
  else
    failcase "case7 FTS match expected file03_block.md got '$match'"
  fi
else
  failcase "case7 sqlite3 not on PATH - cannot run FTS query"
fi

# --- Case 8: verify exit 4 when db is missing --------------------------------
c8="$(newtmp)"; c8_corpus="$c8/corpus"; c8_build="$c8/build"
make_fixture "$c8_corpus"
python3 "$BEATS_PY" compile --corpus "$c8_corpus" --build "$c8_build" >/dev/null 2>&1
rm -f "$c8_build/beats.db"
out="$(python3 "$BEATS_PY" verify --corpus "$c8_corpus" --build "$c8_build" 2>&1)"; rc=$?
if [ "$rc" -eq 4 ]; then
  pass "case8 verify with missing db exits 4"
else
  failcase "case8 expected 4 got $rc :: $out"
fi

# --- Case 9: verify exit 4 when db is malformed ------------------------------
c9="$(newtmp)"; c9_corpus="$c9/corpus"; c9_build="$c9/build"
make_fixture "$c9_corpus"
python3 "$BEATS_PY" compile --corpus "$c9_corpus" --build "$c9_build" >/dev/null 2>&1
printf 'this is not a sqlite database' > "$c9_build/beats.db"
out="$(python3 "$BEATS_PY" verify --corpus "$c9_corpus" --build "$c9_build" 2>&1)"; rc=$?
if [ "$rc" -eq 4 ]; then
  pass "case9 verify with malformed db exits 4"
else
  failcase "case9 expected 4 got $rc :: $out"
fi

# --- Case 10: verify exit 4 when beats_fts table is dropped ------------------
c10="$(newtmp)"; c10_corpus="$c10/corpus"; c10_build="$c10/build"
make_fixture "$c10_corpus"
python3 "$BEATS_PY" compile --corpus "$c10_corpus" --build "$c10_build" >/dev/null 2>&1
if [ -n "$SQLITE" ]; then
  "$SQLITE" "$c10_build/beats.db" "DROP TABLE beats_fts;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$c10_corpus" --build "$c10_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "case10 verify with dropped beats_fts exits 4"
  else
    failcase "case10 expected 4 got $rc :: $out"
  fi
else
  failcase "case10 sqlite3 not on PATH - cannot drop table"
fi

# --- Case 11: a failed (parity-fault) compile leaves prior good artifacts ----
c11="$(newtmp)"; c11_corpus="$c11/corpus"; c11_build="$c11/build"
make_fixture "$c11_corpus"
python3 "$BEATS_PY" compile --corpus "$c11_corpus" --build "$c11_build" >/dev/null 2>&1
if [ -n "$SQLITE" ]; then
  good_hash="$("$SQLITE" "$c11_build/beats.db" "SELECT corpus_hash FROM meta;")"
else
  good_hash="$(shasum "$c11_build/beats.db" | awk '{print $1}')"
fi
out="$(python3 "$BEATS_PY" compile --corpus "$c11_corpus" --build "$c11_build" --inject-parity-fault 2>&1)"; rc=$?
if [ "$rc" -eq 5 ]; then
  pass "case11 re-compile with parity fault exits 5"
else
  failcase "case11 expected 5 got $rc :: $out"
fi
if [ -e "$c11_build/beats.db" ] && [ -e "$c11_build/beats.jsonl" ]; then
  pass "case11 prior good artifacts still present after failed compile"
else
  failcase "case11 prior artifacts destroyed by failed compile"
fi
if [ -n "$SQLITE" ]; then
  now_hash="$("$SQLITE" "$c11_build/beats.db" "SELECT corpus_hash FROM meta;")"
else
  now_hash="$(shasum "$c11_build/beats.db" | awk '{print $1}')"
fi
if [ "$good_hash" = "$now_hash" ]; then
  pass "case11 prior good db unchanged (not clobbered by fault)"
else
  failcase "case11 db changed after failed compile ($good_hash -> $now_hash)"
fi
out="$(python3 "$BEATS_PY" verify --corpus "$c11_corpus" --build "$c11_build" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then
  pass "case11 prior good artifacts still verify fresh (exit 0)"
else
  failcase "case11 expected verify 0 after failed compile got $rc :: $out"
fi

# --- Case 12: verify exit 4 when beats_fts is emptied (desynced) -------------
c12="$(newtmp)"; c12_corpus="$c12/corpus"; c12_build="$c12/build"
make_fixture "$c12_corpus"
python3 "$BEATS_PY" compile --corpus "$c12_corpus" --build "$c12_build" >/dev/null 2>&1
if [ -n "$SQLITE" ]; then
  "$SQLITE" "$c12_build/beats.db" "DELETE FROM beats_fts;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$c12_corpus" --build "$c12_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "case12 verify with emptied beats_fts exits 4"
  else
    failcase "case12 expected 4 got $rc :: $out"
  fi
else
  failcase "case12 sqlite3 not on PATH - cannot empty beats_fts"
fi

# --- Case 13: verify exit 4 when beats+beats_fts emptied but meta intact -----
c13="$(newtmp)"; c13_corpus="$c13/corpus"; c13_build="$c13/build"
make_fixture "$c13_corpus"
python3 "$BEATS_PY" compile --corpus "$c13_corpus" --build "$c13_build" >/dev/null 2>&1
if [ -n "$SQLITE" ]; then
  "$SQLITE" "$c13_build/beats.db" "DELETE FROM beats; DELETE FROM beats_fts;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$c13_corpus" --build "$c13_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "case13 verify with emptied beats+beats_fts (meta intact) exits 4"
  else
    failcase "case13 expected 4 got $rc :: $out"
  fi
else
  failcase "case13 sqlite3 not on PATH - cannot empty tables"
fi

# --- Case 14: verify exit 4 when meta.file_count forged to match empty tables -
c14="$(newtmp)"; c14_corpus="$c14/corpus"; c14_build="$c14/build"
make_fixture "$c14_corpus"
python3 "$BEATS_PY" compile --corpus "$c14_corpus" --build "$c14_build" >/dev/null 2>&1
if [ -n "$SQLITE" ]; then
  "$SQLITE" "$c14_build/beats.db" "DELETE FROM beats; DELETE FROM beats_fts; UPDATE meta SET file_count=0;" >/dev/null 2>&1
  out="$(python3 "$BEATS_PY" verify --corpus "$c14_corpus" --build "$c14_build" 2>&1)"; rc=$?
  if [ "$rc" -eq 4 ]; then
    pass "case14 verify with forged meta.file_count exits 4"
  else
    failcase "case14 expected 4 got $rc :: $out"
  fi
else
  failcase "case14 sqlite3 not on PATH - cannot forge meta"
fi

# --- Summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$passes" "$fails"
[ "$fails" -eq 0 ] || exit 1
