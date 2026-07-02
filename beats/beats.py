#!/usr/bin/env python3
"""beats.py - compile the markdown beats corpus into derived build artifacts.

Stage 2 of the beats next-evolution plan. The markdown beats in
`.claude/memory/` are the source of truth; this tool turns them into
REGENERABLE, gitignored build artifacts (a JSONL index and a SQLite/FTS5
database) that a retrieval path can query. It never mutates the corpus.

Fail-loud contract (mirrors claude/hooks/codex-review.py and
beats/bench/validate.py): every failure class has a distinct exit code and
prints its class name on stderr. There is no silent success - the single
success summary line prints only when every check has passed.

USAGE
  beats.py compile [--corpus PATH] [--build PATH]
  beats.py verify  [--corpus PATH] [--build PATH]
  beats.py search  "natural language query" [--top N] [--json]
                   [--corpus PATH] [--build PATH]

  --corpus  override the corpus dir (default: <repo-root>/.claude/memory)
  --build   override the build dir  (default: <beats-dir>/.build)
  --top     search: max results after supersession resolution (default 5)
  --json    search: emit a JSON array for the benchmark scorer

EXIT CODES
  0  success (search: including zero hits)
  1  search-only: unusable query (nothing survived sanitization)
  2  corpus dir missing
  3  unreadable / non-strictly-decodable corpus file(s)
  4  artifact / db / FTS5 failure (broken, not stale)
  5  parity self-verification failure
  6  verify-only: artifacts stale vs the corpus
Argparse errors keep argparse's own default (exit 2).

Search never exits stale (6) and never exits 3: a stale (or even transiently
unreadable) corpus mid-session still beats retrieving nothing, so search reads
results from the compiled db, prints a one-line STALE warning to stderr, and
returns results anyway. Exit 3 (unreadable corpus) is a compile/verify-only
code. Search's only codes are 0, 1, 2, and 4.
"""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BEATS_DIR = SCRIPT.parent
REPO_ROOT = BEATS_DIR.parent
DEFAULT_CORPUS = REPO_ROOT / ".claude" / "memory"
DEFAULT_BUILD = BEATS_DIR / ".build"

TOOL_VERSION = 1

# Fields lifted into their own columns; everything else in frontmatter is
# preserved verbatim in `extra`.
KNOWN_KEYS = ("name", "description", "type", "relates_to", "supersedes", "superseded_by")
LIST_KEYS = ("relates_to",)

# Frontmatter is the leading `---\n ... \n---` block. Tolerant: a file without
# it is still indexed (all fields empty, body = whole file).
FM_RE = re.compile(r"\A---\n(.*?)\n---[ \t]*(?:\n|\Z)", re.DOTALL)
KEY_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):[ \t]?(.*)$")
ITEM_RE = re.compile(r"^[ \t]+-[ \t]*(.*)$")
WORD_RE = re.compile(r"[A-Za-z]{3,}")


def eprint(msg):
    print(msg, file=sys.stderr)


def strip_quotes(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def parse_frontmatter(fm_text):
    """Line-based, pyyaml-free parse of a frontmatter block.

    Returns (known, extra). `known` maps recognised keys to either a string
    (scalar) or a list (inline `[a, b]` or block `- a` forms); an empty value
    (`key:`, `key: []`, `key: ~`, `key: null`) yields "". `extra` maps every
    other key to its raw quote-stripped scalar (no list parsing, per spec).
    """
    lines = fm_text.split("\n")
    known = {}
    extra = {}
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        # Top-level keys start at column 0; indented / blank lines are handled
        # as block-list items during a key's lookahead, or skipped.
        if not line.strip() or line[0] in (" ", "\t"):
            i += 1
            continue
        m = KEY_RE.match(line)
        if not m:
            i += 1
            continue
        key = m.group(1)
        rest = m.group(2).strip()

        if key not in KNOWN_KEYS:
            extra[key] = strip_quotes(rest)
            i += 1
            continue

        if rest == "":
            # Possible YAML block list on the following indented lines.
            items = []
            j = i + 1
            while j < n:
                im = ITEM_RE.match(lines[j])
                if not im:
                    break
                item = strip_quotes(im.group(1))
                if item:
                    items.append(item)
                j += 1
            known[key] = items if items else ""
            i = j
            continue

        if rest in ("[]", "~", "null"):
            known[key] = ""
            i += 1
            continue

        if rest.startswith("[") and rest.endswith("]"):
            inner = rest[1:-1].strip()
            if not inner:
                known[key] = ""
            else:
                items = [strip_quotes(x) for x in inner.split(",")]
                known[key] = [x for x in items if x]
            i += 1
            continue

        known[key] = strip_quotes(rest)
        i += 1

    return known, extra


def as_str(value):
    if isinstance(value, list):
        return value[0] if value else ""
    return value or ""


def as_list(value):
    if isinstance(value, list):
        return value
    if not value:
        return []
    return [value]


def read_records(corpus, md_files):
    """Read every beat. Returns (records, bad). `bad` lists (name, reason) for
    files that cannot be read or strictly utf-8-decoded - a hard error."""
    records = []
    bad = []
    for path in md_files:
        try:
            raw = path.read_bytes()
        except OSError as exc:
            bad.append((path.name, f"read error: {exc}"))
            continue
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            bad.append((path.name, f"utf-8 decode error: {exc}"))
            continue
        text = text.replace("\r\n", "\n")
        try:
            stat = path.stat()
        except OSError as exc:
            bad.append((path.name, f"stat error: {exc}"))
            continue

        fm_match = FM_RE.match(text)
        if fm_match:
            known, extra = parse_frontmatter(fm_match.group(1))
            body = text[fm_match.end():]
            has_fm = True
        else:
            known, extra = {}, {}
            body = text
            has_fm = False

        superseded_by = as_str(known.get("superseded_by", ""))
        records.append({
            "filename": path.name,
            "name": as_str(known.get("name", "")),
            "description": as_str(known.get("description", "")),
            "type": as_str(known.get("type", "")),
            "relates_to": as_list(known.get("relates_to", [])),
            "supersedes": as_str(known.get("supersedes", "")),
            "superseded_by": superseded_by,
            "extra": extra,
            "body": body,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "mtime": int(stat.st_mtime),
            "size": len(raw),
            "is_stale": bool(superseded_by),
            "_has_fm": has_fm,
        })
    records.sort(key=lambda r: r["filename"])
    return records, bad


def corpus_hash(pairs):
    """sha256 over the newline-joined sorted 'filename:sha256' lines."""
    lines = sorted(f"{name}:{sha}" for name, sha in pairs)
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def probe_fts5():
    try:
        con = sqlite3.connect(":memory:")
        try:
            con.execute("CREATE VIRTUAL TABLE _probe USING fts5(x)")
        finally:
            con.close()
        return True
    except sqlite3.Error:
        return False


def spot_term(records):
    """First >=3-letter ascii word from any indexed body, for the FTS sanity
    probe. None if no body has one (nothing to probe)."""
    for rec in records:
        m = WORD_RE.search(rec["body"])
        if m:
            return m.group(0).lower()
    return None


def build_db(tmp_db, records, chash, compiled_at, inject_fault):
    """Create the SQLite artifact at tmp_db. Raises sqlite3.Error on failure."""
    if tmp_db.exists():
        tmp_db.unlink()
    con = sqlite3.connect(str(tmp_db))
    try:
        con.execute("""
            CREATE TABLE beats (
                filename TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                type TEXT,
                relates_to TEXT,
                supersedes TEXT,
                superseded_by TEXT,
                extra TEXT,
                body TEXT,
                sha256 TEXT,
                mtime INTEGER,
                size INTEGER,
                is_stale INTEGER
            )
        """)
        con.execute(
            "CREATE VIRTUAL TABLE beats_fts USING fts5("
            "filename UNINDEXED, name, description, body, "
            "tokenize='porter unicode61')"
        )
        con.execute("""
            CREATE TABLE meta (
                corpus_hash TEXT,
                compiled_at TEXT,
                file_count INTEGER,
                tool_version INTEGER
            )
        """)
        beat_rows = [(
            r["filename"], r["name"], r["description"], r["type"],
            json.dumps(r["relates_to"], ensure_ascii=False),
            r["supersedes"], r["superseded_by"],
            json.dumps(r["extra"], ensure_ascii=False),
            r["body"], r["sha256"], r["mtime"], r["size"],
            1 if r["is_stale"] else 0,
        ) for r in records]
        con.executemany(
            "INSERT INTO beats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", beat_rows
        )
        fts_rows = [(r["filename"], r["name"], r["description"], r["body"]) for r in records]
        con.executemany(
            "INSERT INTO beats_fts (filename, name, description, body) VALUES (?,?,?,?)",
            fts_rows,
        )
        con.execute(
            "INSERT INTO meta VALUES (?,?,?,?)",
            (chash, compiled_at, len(records), TOOL_VERSION),
        )
        con.commit()
        integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise sqlite3.DatabaseError(f"integrity_check returned {integrity!r}")
        if inject_fault and records:
            # Test-only: corrupt one stored sha256 so content-parity must catch it.
            con.execute(
                "UPDATE beats SET sha256 = 'INJECTEDPARITYFAULT' "
                "WHERE filename = (SELECT filename FROM beats ORDER BY filename LIMIT 1)"
            )
            con.commit()
    finally:
        con.close()


def self_verify(corpus, tmp_jsonl, tmp_db, records, chash):
    """Return a list of mismatch strings; empty means every check passed."""
    errors = []
    con = sqlite3.connect(str(tmp_db))
    try:
        db_beats = con.execute("SELECT COUNT(*) FROM beats").fetchone()[0]
        db_fts = con.execute("SELECT COUNT(*) FROM beats_fts").fetchone()[0]
        db_sha = dict(con.execute("SELECT filename, sha256 FROM beats").fetchall())

        # (d) meta integrity: verify keys off meta.corpus_hash, so a wrong meta
        # would make a just-compiled build report stale. Validate it here.
        meta = con.execute(
            "SELECT corpus_hash, file_count FROM meta"
        ).fetchone()
        if meta is None:
            errors.append("meta parity: meta row missing")
        else:
            meta_hash, meta_count = meta
            if meta_hash != chash:
                errors.append(
                    f"meta parity: stored corpus_hash {meta_hash!r} != recomputed {chash!r}"
                )
            if meta_count != len(records):
                errors.append(
                    f"meta parity: stored file_count {meta_count} != {len(records)}"
                )

        jsonl_sha = {}
        jsonl_lines = 0
        for line in tmp_jsonl.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            jsonl_lines += 1
            obj = json.loads(line)
            jsonl_sha[obj["filename"]] = obj["sha256"]

        disk_md = len(list(corpus.glob("*.md")))

        # (a) count parity
        if not (disk_md == jsonl_lines == db_beats == db_fts):
            errors.append(
                f"count parity: disk={disk_md} jsonl={jsonl_lines} "
                f"beats={db_beats} beats_fts={db_fts}"
            )

        # (b) content parity: recompute sha256 from disk for every file.
        for rec in records:
            name = rec["filename"]
            path = corpus / name
            try:
                disk_sha = hashlib.sha256(path.read_bytes()).hexdigest()
            except OSError as exc:
                errors.append(f"content parity: cannot re-read {name}: {exc}")
                continue
            if db_sha.get(name) != disk_sha:
                errors.append(
                    f"content parity: {name} db sha {db_sha.get(name)!r} != disk {disk_sha!r}"
                )
            if jsonl_sha.get(name) != disk_sha:
                errors.append(
                    f"content parity: {name} jsonl sha {jsonl_sha.get(name)!r} != disk {disk_sha!r}"
                )

        # (c) FTS spot sanity: a term known to exist must return >= 1 row.
        term = spot_term(records)
        if term is not None:
            hits = con.execute(
                "SELECT COUNT(*) FROM beats_fts WHERE beats_fts MATCH ?", (term,)
            ).fetchone()[0]
            if hits < 1:
                errors.append(f"fts sanity: term {term!r} matched 0 rows")
    finally:
        con.close()
    return errors


def cmd_compile(corpus, build, inject_fault):
    if not corpus.is_dir():
        eprint(f"CORPUS MISSING: corpus dir does not exist: {corpus}")
        return 2

    md_files = sorted(corpus.glob("*.md"), key=lambda p: p.name)
    records, bad = read_records(corpus, md_files)
    if bad:
        eprint("UNREADABLE CORPUS FILE(S): the following beats could not be read/decoded:")
        for name, reason in bad:
            eprint(f"  {name}: {reason}")
        return 3

    if not probe_fts5():
        eprint("ARTIFACT/DB FAILURE: this SQLite build lacks FTS5; cannot create beats_fts. "
               "Install a python3/sqlite3 with the FTS5 extension.")
        return 4

    no_frontmatter = sum(1 for r in records if not r["_has_fm"])
    stale_count = sum(1 for r in records if r["is_stale"])
    chash = corpus_hash((r["filename"], r["sha256"]) for r in records)
    compiled_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    build.mkdir(parents=True, exist_ok=True)
    final_jsonl = build / "beats.jsonl"
    final_db = build / "beats.db"
    tmp_jsonl = build / f".beats.jsonl.{os.getpid()}.tmp"
    tmp_db = build / f".beats.db.{os.getpid()}.tmp"

    def cleanup_temps():
        for tmp in (tmp_jsonl, tmp_db):
            try:
                if tmp.exists():
                    tmp.unlink()
            except OSError:
                pass

    # Write the JSONL artifact (temp).
    jsonl_lines = []
    for rec in records:
        obj = {k: rec[k] for k in (
            "filename", "name", "description", "type", "relates_to",
            "supersedes", "superseded_by", "extra", "body", "sha256",
            "mtime", "size", "is_stale",
        )}
        jsonl_lines.append(json.dumps(obj, ensure_ascii=False, sort_keys=True))
    try:
        tmp_jsonl.write_text(
            ("\n".join(jsonl_lines) + "\n") if jsonl_lines else "",
            encoding="utf-8",
        )
    except OSError as exc:
        cleanup_temps()
        eprint(f"ARTIFACT/DB FAILURE: cannot write jsonl artifact: {exc}")
        return 4

    # Write the SQLite artifact (temp, atomic-rename later).
    try:
        build_db(tmp_db, records, chash, compiled_at, inject_fault)
    except sqlite3.Error as exc:
        cleanup_temps()
        eprint(f"ARTIFACT/DB FAILURE: cannot build SQLite artifact: {exc}")
        return 4

    # Mandatory self-verification against the freshly written artifacts.
    errors = self_verify(corpus, tmp_jsonl, tmp_db, records, chash)
    if errors:
        cleanup_temps()
        eprint("PARITY SELF-VERIFICATION FAILED: artifacts invalidated. Mismatches:")
        for err in errors:
            eprint(f"  {err}")
        return 5

    # Install the verified artifacts. Each os.replace is atomic on its own; the
    # db is installed LAST because verify keys off the db, so the worst partial
    # outcome (new jsonl + old db, only on a rare second-replace failure) shows
    # up as STALE on the next verify rather than as a silent success. Any
    # failure here is reported loudly (exit 4), never swallowed. A previously
    # installed good db/jsonl is untouched until its atomic replace lands.
    try:
        os.replace(tmp_jsonl, final_jsonl)
        os.replace(tmp_db, final_db)
    except OSError as exc:
        cleanup_temps()
        eprint(f"ARTIFACT/DB FAILURE: cannot install artifacts: {exc}")
        return 4

    print(
        f"OK: compiled {len(records)} beats "
        f"({no_frontmatter} no-frontmatter, {stale_count} stale) "
        f"-> {final_jsonl}, {final_db} | corpus_hash {chash[:12]}"
    )
    return 0


def cmd_verify(corpus, build):
    if not corpus.is_dir():
        eprint(f"CORPUS MISSING: corpus dir does not exist: {corpus}")
        return 2

    db_path = build / "beats.db"
    if not db_path.exists():
        eprint(f"ARTIFACT/DB FAILURE: compiled db not found: {db_path} "
               "(run `beats.py compile` first)")
        return 4

    try:
        con = sqlite3.connect(str(db_path))
        try:
            # Malformed-vs-stale matters (this is the session-start guard's hook
            # point): a corrupt page or a dropped beats_fts table is exit 4, not
            # a stale 6. integrity_check catches corruption; the beats_fts probe
            # catches a missing/broken FTS table that the meta+beats reads miss.
            integrity = con.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise sqlite3.DatabaseError(
                    f"integrity_check returned {integrity[0] if integrity else 'no result'!r}"
                )
            meta = con.execute(
                "SELECT corpus_hash, file_count FROM meta"
            ).fetchone()
            db_rows = con.execute("SELECT filename, sha256 FROM beats").fetchall()
            # A present-but-emptied/desynced beats_fts is a broken artifact, not
            # a stale one: it would verify fresh yet return no FTS matches. Its
            # row count must equal the beats table's.
            fts_row = con.execute("SELECT COUNT(*) FROM beats_fts").fetchone()
            fts_count = fts_row[0] if fts_row else -1
            if fts_count != len(db_rows):
                raise sqlite3.DatabaseError(
                    f"beats_fts row count {fts_count} != beats row count {len(db_rows)}"
                )
            # db-internal consistency: the beats table must match the meta row's
            # own file_count. Otherwise an emptied beats+beats_fts (0/0) with an
            # intact meta would slip past the count check and, because the disk
            # hash still equals the stale meta.corpus_hash, verify fresh with
            # empty retrieval tables. That is a broken artifact (exit 4), not a
            # stale one. (Disk-vs-db file-count differences are staleness -> 6.)
            if meta is not None and len(db_rows) != meta[1]:
                raise sqlite3.DatabaseError(
                    f"beats row count {len(db_rows)} != meta.file_count {meta[1]}"
                )
        finally:
            con.close()
    except sqlite3.Error as exc:
        eprint(f"ARTIFACT/DB FAILURE: db unreadable or malformed: {exc}")
        return 4
    if meta is None:
        eprint("ARTIFACT/DB FAILURE: meta row missing from db")
        return 4

    stored_hash, stored_count = meta

    md_files = sorted(corpus.glob("*.md"), key=lambda p: p.name)
    disk = {}
    bad = []
    for path in md_files:
        try:
            disk[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError as exc:
            bad.append((path.name, f"read error: {exc}"))
    if bad:
        eprint("UNREADABLE CORPUS FILE(S): the following beats could not be read:")
        for name, reason in bad:
            eprint(f"  {name}: {reason}")
        return 3

    current_hash = corpus_hash(disk.items())
    if current_hash == stored_hash:
        # A matching corpus_hash is derived from exactly stored_count files, so
        # meta.file_count must equal the on-disk count. If it does not, the meta
        # row is inconsistent/tampered (e.g. file_count forced to 0 alongside
        # emptied tables) - a broken artifact (exit 4), not a stale one. This is
        # a cheap meta check, not per-file content re-parity (that is compile's
        # exit-5 job); a hash MISMATCH remains staleness (exit 6) below.
        if stored_count != len(disk):
            eprint(
                f"ARTIFACT/DB FAILURE: corpus hash matches but meta.file_count "
                f"{stored_count} != {len(disk)} files on disk; meta is inconsistent"
            )
            return 4
        print(
            f"OK: fresh - {len(disk)} beats match compiled state "
            f"(file_count {stored_count}) | corpus_hash {current_hash[:12]}"
        )
        return 0

    db_map = dict(db_rows)
    added = sorted(f for f in disk if f not in db_map)
    removed = sorted(f for f in db_map if f not in disk)
    changed = sorted(f for f in disk if f in db_map and disk[f] != db_map[f])
    eprint(
        f"STALE: {len(added)} added, {len(removed)} removed, {len(changed)} changed "
        f"vs compiled state | disk hash {current_hash[:12]} != stored {stored_hash[:12]}"
    )
    for label, names in (("added", added), ("removed", removed), ("changed", changed)):
        for name in names:
            eprint(f"  {label}: {name}")
    return 6


# ---------------------------------------------------------------------------
# search (stage 3): natural-language query -> ranked, supersession-resolved
# beats. All tuning knobs below are GLOBAL and principled - there is no
# benchmark-specific logic, no per-filename boosts, and the only filename
# special-casing permitted is the derived-index exclusion.
# ---------------------------------------------------------------------------

# Short global English stopword list. Dropped before building the FTS query so
# question scaffolding ("what", "how", "why", ...) does not dilute ranking.
STOPWORDS = frozenset({
    "what", "how", "why", "the", "a", "an", "is", "are", "do", "does", "did",
    "we", "i", "my", "our", "it", "its", "to", "of", "in", "on", "for", "and",
    "or", "not", "with", "vs", "versus",
})

# Alphanumeric token runs; a token is kept when it is at least 2 chars long.
QUERY_TOKEN_RE = re.compile(r"[a-z0-9]+")

# bm25 column weights, positional over the beats_fts columns in declaration
# order (filename UNINDEXED, name, description, body). The filename slot is
# never matched (UNINDEXED) so its weight is inert; name and description are
# weighted above body because a beat's title/summary is a stronger topic signal
# than an incidental body mention.
FTS_WEIGHTS = (1.0, 4.0, 3.0, 1.0)

# Derived indexes, never beats themselves: keyword-dense aggregations that would
# pollute every ranking. This is the ONLY filename-specific logic in the engine.
INDEX_FILES = ("MEMORY.md", "MEMORY-archive.md")

# Cap on how far a superseded_by chain is walked before giving up (defends
# against pathological or malformed chains).
RESOLVE_DEPTH_CAP = 10

# relates_to graph expansion (global, corpus-native). The beats link discipline
# binds complementary context (plan<->mandate, rule<->clarification), so
# retrieval that honors the graph honors the data model. After bm25 + supersession
# resolution, the top EXPAND_FROM direct hits pull in their neighbors - treated
# BIDIRECTIONALLY because relates_to is written asymmetrically (newer beats link
# back to older ones), so a forward-only walk would systematically miss the newer
# half of every pair. A neighbor inherits EXPAND_DAMPING of its citing hit's
# relevance (bm25 is negative; scaling toward 0 makes the neighbor rank below its
# citing hit). Edges span the hit's whole supersession chain and resolve through
# heads; index files are excluded. Both knobs are global - no per-case tuning.
EXPAND_FROM = 10
EXPAND_DAMPING = 0.5


def sanitize_query(raw):
    """Turn a natural-language question into an FTS5 OR-query.

    Extracts lowercased alphanumeric tokens (length >= 2), drops the global
    stopwords, dedupes preserving order, and double-quotes every remaining token
    so it is treated as a literal term - user text can never inject FTS5
    operators. Also adds a COMPOUND BIGRAM for each adjacent surviving-token pair
    (e.g. "micro adjustment" -> "microadjustment", "tilt lab" -> "tiltlab"): pure
    tokenization robustness for compound/hyphenated vocabulary the corpus may
    write as one word. Returns (match_expr, tokens); ("", []) when nothing
    survives. `tokens` is the single-token list (bigrams are query-only).
    """
    # Filtered but NOT yet deduped, so adjacency reflects the real query order
    # (bigrams must be built from this stream: "new york new jersey" must yield
    # "newyork" and "newjersey", not a bogus cross-pair from a deduped list).
    filtered = [
        tok for tok in QUERY_TOKEN_RE.findall((raw or "").lower())
        if len(tok) >= 2 and tok not in STOPWORDS
    ]
    if not filtered:
        return "", []
    # single-token terms: dedupe preserving order
    tokens = []
    seen = set()
    for tok in filtered:
        if tok not in seen:
            seen.add(tok)
            tokens.append(tok)
    # compound bigrams from adjacent surviving tokens (pre-dedupe adjacency)
    terms = list(tokens)
    for a, b in zip(filtered, filtered[1:]):
        terms.append(a + b)
    # dedupe the final term list preserving order (a bigram may collide with an
    # existing single token or with another bigram)
    term_seen = set()
    ordered = []
    for t in terms:
        if t not in term_seen:
            term_seen.add(t)
            ordered.append(t)
    return " OR ".join(f'"{t}"' for t in ordered), tokens


def resolve_head(start, sup_map, existing):
    """Walk the superseded_by chain from `start` to its current-truth head.

    Transitive, cycle-guarded, and depth capped. Terminates on:
      - a true head (no superseded_by) -> return it;
      - a dangling pointer (target not in `existing`) -> return the deepest
        existing beat reached so far;
      - a cycle (a pointer back to a beat already on the path) -> collapse the
        whole cycle to ONE canonical representative (its lexicographically
        smallest filename), so every member of a cycle resolves to the same
        beat and mutually-superseding beats never surface as separate results;
      - the depth cap -> return the deepest beat reached.
    `start` is always an existing beat (it came from a db row).
    """
    current = start
    path = [current]
    seen = {current}
    for _ in range(RESOLVE_DEPTH_CAP):
        nxt = sup_map.get(current, "")
        if not nxt:
            return current                     # true head: no superseded_by
        if nxt not in existing:
            return current                     # dangling: deepest existing beat
        if nxt in seen:
            return min(path[path.index(nxt):])  # cycle: one canonical member
        seen.add(nxt)
        path.append(nxt)
        current = nxt
    return current                             # depth cap: deepest reached


def compute_corpus_hash(corpus):
    """Recompute the corpus hash the way compile/verify do (all *.md files).

    Returns the hex digest, or None if any corpus file cannot be read - search
    treats an unreadable corpus as "cannot confirm fresh" and warns STALE."""
    pairs = []
    for path in sorted(corpus.glob("*.md"), key=lambda p: p.name):
        try:
            pairs.append((path.name, hashlib.sha256(path.read_bytes()).hexdigest()))
        except OSError:
            return None
    return corpus_hash(pairs)


def build_graph(rows_relates, sup_map, existing):
    """Precompute per-head BIDIRECTIONAL relates_to neighbor heads.

    `rows_relates` maps each raw filename to its list of raw relates_to targets.
    Returns (head_of, head_neighbors):
      head_of[raw]         = resolve_head(raw)
      head_neighbors[head] = the set of neighbor heads reachable from ANY raw
        beat in that head's supersession chain, via forward relates_to targets
        OR reverse citations (a beat that lists this one in its own relates_to).
    Edges are treated bidirectionally because relates_to is written
    asymmetrically by protocol; every endpoint is resolved through supersession
    to its current head; self-links and derived index files are excluded.
    """
    head_of = {raw: resolve_head(raw, sup_map, existing) for raw in existing}
    reverse = {}
    for raw, targets in rows_relates.items():
        for tgt in targets:
            if tgt in existing:
                reverse.setdefault(tgt, set()).add(raw)
    head_neighbors = {}
    for raw in existing:
        bucket = head_neighbors.setdefault(head_of[raw], set())
        for tgt in rows_relates.get(raw, ()):          # forward edge
            if tgt in existing:
                bucket.add(head_of[tgt])
        for citer in reverse.get(raw, ()):             # reverse edge (bidirectional)
            bucket.add(head_of[citer])
    for head, bucket in head_neighbors.items():
        bucket.discard(head)
        for idx in INDEX_FILES:
            bucket.discard(idx)
    return head_of, head_neighbors


def cmd_search(corpus, build, query, top, as_json):
    if not corpus.is_dir():
        eprint(f"CORPUS MISSING: corpus dir does not exist: {corpus}")
        return 2

    match, _tokens = sanitize_query(query)
    if not match:
        eprint("UNUSABLE QUERY: no searchable terms after sanitization "
               "(every token was too short or a stopword)")
        return 1

    db_path = build / "beats.db"
    if not db_path.exists():
        eprint(f"ARTIFACT/DB FAILURE: compiled db not found: {db_path} "
               "(run `beats.py compile` first)")
        return 4

    weights = ",".join(repr(w) for w in FTS_WEIGHTS)
    placeholders = ",".join("?" for _ in INDEX_FILES)
    try:
        con = sqlite3.connect(str(db_path))
    except sqlite3.Error as exc:
        eprint(f"ARTIFACT/DB FAILURE: cannot open db: {exc}")
        return 4
    try:
        # Same layered broken-vs-stale checks as verify: a corrupt page, a
        # missing meta row, or a desynced/emptied beats_fts is a broken artifact
        # (exit 4), never a silent empty result.
        try:
            integrity = con.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise sqlite3.DatabaseError(
                    f"integrity_check returned "
                    f"{integrity[0] if integrity else 'no result'!r}")
            meta = con.execute(
                "SELECT corpus_hash, file_count FROM meta"
            ).fetchone()
            rows = con.execute(
                "SELECT filename, name, description, superseded_by, relates_to FROM beats"
            ).fetchall()
            fts_row = con.execute("SELECT COUNT(*) FROM beats_fts").fetchone()
            fts_count = fts_row[0] if fts_row else -1
            if fts_count != len(rows):
                raise sqlite3.DatabaseError(
                    f"beats_fts row count {fts_count} != beats row count {len(rows)}")
            if meta is not None and len(rows) != meta[1]:
                raise sqlite3.DatabaseError(
                    f"beats row count {len(rows)} != meta.file_count {meta[1]}")
        except sqlite3.Error as exc:
            eprint(f"ARTIFACT/DB FAILURE: db unreadable or malformed: {exc}")
            return 4
        if meta is None:
            eprint("ARTIFACT/DB FAILURE: meta row missing from db")
            return 4

        existing = set()
        sup_map = {}
        info = {}
        rows_relates = {}
        for filename, name, description, superseded_by, relates_to in rows:
            existing.add(filename)
            sup_map[filename] = superseded_by or ""
            info[filename] = (name or "", description or "")
            try:
                targets = json.loads(relates_to) if relates_to else []
            except (json.JSONDecodeError, TypeError):
                targets = []
            rows_relates[filename] = targets if isinstance(targets, list) else []

        # Cheap staleness check (verify-equivalent hash). Search reads results
        # from the db, not the corpus, so a stale-or-unreadable corpus never
        # blocks retrieval - it beats returning nothing. Warn loudly on stderr
        # (never silently) and keep going. Unlike compile/verify, search does
        # NOT exit 3 on an unreadable corpus file: it cannot confirm freshness,
        # says so, and still serves the compiled index.
        current_hash = compute_corpus_hash(corpus)
        if current_hash is None:
            eprint("STALE: could not read one or more corpus files to confirm "
                   "freshness; returning results from the compiled index anyway.")
        elif current_hash != meta[0]:
            eprint("STALE: compiled index does not match the corpus on disk; "
                   "run `beats.py compile`. Returning results from the stale index.")

        try:
            hits = con.execute(
                f"SELECT filename, bm25(beats_fts,{weights}) AS score "
                f"FROM beats_fts WHERE beats_fts MATCH ? "
                f"AND filename NOT IN ({placeholders}) "
                f"ORDER BY score ASC, filename ASC",
                (match, *INDEX_FILES),
            ).fetchall()
        except sqlite3.Error as exc:
            eprint(f"ARTIFACT/DB FAILURE: FTS query failed: {exc}")
            return 4
    finally:
        con.close()

    head_of, head_neighbors = build_graph(rows_relates, sup_map, existing)

    # Phase 1 - direct hits: resolve every FTS hit to its chain head, keeping the
    # best (most negative) bm25 score per head. Hits arrive best-first, so the
    # first sighting of a head is its best rank. Never surface a derived index.
    direct = {}
    order = []
    for filename, score in hits:
        head = head_of.get(filename, filename)
        if head in INDEX_FILES:
            continue
        if head not in direct:
            direct[head] = score
            order.append(head)
        elif score < direct[head]:
            direct[head] = score

    # Phase 2 - bidirectional relates_to graph expansion: the top EXPAND_FROM
    # direct hits pull in their neighbor heads at EXPAND_DAMPING of their own
    # relevance (bm25 is negative, so the neighbor ranks below its citing hit).
    # A neighbor keeps its best contribution across all citing hits; a beat that
    # is both a direct hit and a neighbor keeps whichever score is better.
    combined = dict(direct)
    for head in order[:EXPAND_FROM]:
        blended = direct[head] * EXPAND_DAMPING
        for neighbor in head_neighbors.get(head, ()):
            if neighbor in INDEX_FILES:
                continue
            if neighbor not in combined or blended < combined[neighbor]:
                combined[neighbor] = blended

    # Strict ranking: (score asc, filename asc), truncated to `top`.
    ranked = sorted(combined.items(), key=lambda kv: (kv[1], kv[0]))[:top]
    results = []
    for rank, (head, score) in enumerate(ranked, start=1):
        name, description = info.get(head, ("", ""))
        results.append({
            "rank": rank,
            "filename": head,
            "score": score,
            "name": name,
            "description": description,
        })

    if as_json:
        print(json.dumps(results, ensure_ascii=False))
        return 0

    if not results:
        print("0 results")
        return 0
    for r in results:
        label = r["name"] or r["description"] or "(no name/description)"
        print(f"{r['rank']:>2}  {r['filename']}  {r['score']:.6f}  {label}")
    return 0


def main():
    ap = argparse.ArgumentParser(
        description="Compile / verify / search the markdown beats corpus."
    )
    ap.add_argument("command", choices=["compile", "verify", "search"])
    ap.add_argument("query", nargs="?", default=None,
                    help="search: natural-language query text")
    ap.add_argument("--corpus", default=None,
                    help="corpus dir (default: <repo-root>/.claude/memory)")
    ap.add_argument("--build", default=None,
                    help="build dir (default: <beats-dir>/.build)")
    ap.add_argument("--top", type=int, default=5,
                    help="search: max results after resolution (default 5)")
    ap.add_argument("--json", action="store_true",
                    help="search: emit a JSON array")
    ap.add_argument("--inject-parity-fault", action="store_true",
                    help=argparse.SUPPRESS)
    args = ap.parse_args()

    corpus = Path(args.corpus).resolve() if args.corpus else DEFAULT_CORPUS
    build = Path(args.build).resolve() if args.build else DEFAULT_BUILD

    if args.command == "compile":
        return cmd_compile(corpus, build, args.inject_parity_fault)
    if args.command == "verify":
        return cmd_verify(corpus, build)
    # search
    if args.top < 1:
        eprint("UNUSABLE QUERY: --top must be a positive integer")
        return 1
    if args.query is None:
        eprint("UNUSABLE QUERY: no query text provided")
        return 1
    return cmd_search(corpus, build, args.query, args.top, args.json)


if __name__ == "__main__":
    sys.exit(main())
