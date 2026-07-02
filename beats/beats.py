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
import math
import os
import re
import sqlite3
import struct
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BEATS_DIR = SCRIPT.parent
REPO_ROOT = BEATS_DIR.parent
DEFAULT_CORPUS = REPO_ROOT / ".claude" / "memory"
DEFAULT_BUILD = BEATS_DIR / ".build"

TOOL_VERSION = 2

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


def build_db(tmp_db, records, chash, compiled_at, inject_fault,
             vectors=None, embed_model="", embed_dim=0):
    """Create the SQLite artifact at tmp_db. Raises sqlite3.Error on failure.

    `vectors` (filename -> unit list[float]) is optional: when present every
    record must have an entry (compile guarantees this before calling), and the
    rows land in beats_vec as float32 BLOBs. meta records embed_model/embed_dim
    and vectors_present so search and verify know whether the hybrid path is
    available."""
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
            CREATE TABLE beats_vec (
                filename TEXT PRIMARY KEY,
                dim INTEGER,
                vec BLOB
            )
        """)
        con.execute("""
            CREATE TABLE meta (
                corpus_hash TEXT,
                compiled_at TEXT,
                file_count INTEGER,
                tool_version INTEGER,
                embed_model TEXT,
                embed_dim INTEGER,
                vectors_present INTEGER
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
        vectors_present = 1 if vectors else 0
        if vectors:
            vec_rows = [
                (r["filename"], embed_dim,
                 struct.pack(f"<{embed_dim}f", *vectors[r["filename"]]))
                for r in records
            ]
            con.executemany(
                "INSERT INTO beats_vec (filename, dim, vec) VALUES (?,?,?)", vec_rows
            )
        con.execute(
            "INSERT INTO meta VALUES (?,?,?,?,?,?,?)",
            (chash, compiled_at, len(records), TOOL_VERSION,
             embed_model if vectors_present else "",
             embed_dim if vectors_present else 0,
             vectors_present),
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

        # (e) vector parity: when vectors are enabled, EVERY beat must have EXACTLY
        # one vector of the declared dimension. Checks filenames (not just count),
        # dim == meta.embed_dim, and blob byte-length == dim*4 (float32). Any
        # mismatch is a parity failure (exit 5), never a silently-degraded index.
        meta_vec = con.execute(
            "SELECT vectors_present, embed_dim FROM meta"
        ).fetchone()
        if meta_vec and meta_vec[0]:
            embed_dim = meta_vec[1]
            beat_names = {r["filename"] for r in records}
            vec_names = set()
            for filename, dim, blob in con.execute(
                "SELECT filename, dim, vec FROM beats_vec"
            ).fetchall():
                vec_names.add(filename)
                if dim != embed_dim:
                    errors.append(
                        f"vector parity: {filename} dim {dim} != meta.embed_dim {embed_dim}")
                elif len(blob) != embed_dim * 4:
                    errors.append(
                        f"vector parity: {filename} blob {len(blob)} bytes != {embed_dim * 4} "
                        f"(dim {embed_dim} float32)")
            if vec_names != beat_names:
                missing = sorted(beat_names - vec_names)[:5]
                extra = sorted(vec_names - beat_names)[:5]
                errors.append(
                    f"vector parity: beats_vec filenames != beats "
                    f"(missing {missing}, extra {extra})")
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

    # Embed the corpus (stage 3b). FAIL-SOFT: if the embedder is unreachable the
    # compile still succeeds lexical-only, emitting a single loud VECTORS ABSENT
    # line and vectors_present=0 - never a silent degradation. Vectors are
    # all-or-nothing: self_verify enforces "vectors present => every beat has
    # one", so a single failed embed drops the whole vector set (still exit 0).
    vectors = None
    embed_dim = 0
    if records:
        probe = embed_text("beats embedder availability probe")
        if probe is None:
            eprint(f"VECTORS ABSENT: embedder unreachable "
                   f"({embed_text.last_error or 'no response'}); compiling lexical-only "
                   f"(model {EMBED_MODEL} at {OLLAMA_URL})")
        else:
            embed_dim = len(probe)
            vecs = {}
            failed = None
            for rec in records:
                v = embed_text(build_embed_text(rec["name"], rec["description"], rec["body"]))
                if v is None or len(v) != embed_dim:
                    failed = rec["filename"]
                    break
                vecs[rec["filename"]] = v
            if failed is not None:
                eprint(f"VECTORS ABSENT: embedding failed at {failed} "
                       f"({embed_text.last_error or 'dimension mismatch'}); "
                       "compiling lexical-only")
                embed_dim = 0
            else:
                vectors = vecs

    # Write the SQLite artifact (temp, atomic-rename later).
    try:
        build_db(tmp_db, records, chash, compiled_at, inject_fault,
                 vectors=vectors, embed_model=EMBED_MODEL, embed_dim=embed_dim)
    except (sqlite3.Error, struct.error) as exc:
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

    vec_note = (f"{len(records)} vectors ({EMBED_MODEL} dim {embed_dim})"
                if vectors else "no vectors (lexical-only)")
    print(
        f"OK: compiled {len(records)} beats "
        f"({no_frontmatter} no-frontmatter, {stale_count} stale) "
        f"-> {final_jsonl}, {final_db} | {vec_note} | corpus_hash {chash[:12]}"
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
            # Base meta read works on any schema (stage 3a or 3b).
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
            # Same logic for the vector table, read DEFENSIVELY (an old stage-3a
            # db has no vectors_present column -> treated as no-vectors, verifies
            # normally). When vectors are present, beats_vec must match beats
            # exactly by FILENAME (not just count); a desync silently disables
            # hybrid search, so it is a broken artifact (exit 4).
            try:
                vp_row = con.execute("SELECT vectors_present FROM meta").fetchone()
                vectors_present = bool(vp_row and vp_row[0])
            except sqlite3.OperationalError:
                vectors_present = False
            if vectors_present:
                vec_names = {
                    r[0] for r in con.execute("SELECT filename FROM beats_vec").fetchall()
                }
                beat_names = {r[0] for r in db_rows}
                if vec_names != beat_names:
                    raise sqlite3.DatabaseError(
                        f"beats_vec desynced with beats by filename "
                        f"(vec {len(vec_names)} rows, beats {len(beat_names)} rows) "
                        "(vectors_present=1)"
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

    stored_hash, stored_count = meta[0], meta[1]

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

# --- embeddings (stage 3b): local ollama-served model, stdlib urllib only -----
# The embedder is a LOCAL ollama HTTP endpoint - one-time model download, offline
# thereafter, zero per-query cost, and beats.py stays pip-free (no torch/numpy).
# Everything below is a GLOBAL knob; the embedded-text construction is uniform
# across every beat. qwen3-embedding:0.6b is the pick (newest strong small
# embedding model ollama serves, 1024-dim, clean semantic separation on a probe).
OLLAMA_URL = os.environ.get("BEATS_OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("BEATS_EMBED_MODEL", "qwen3-embedding:0.6b")
EMBED_TIMEOUT = 60          # seconds per embedding HTTP call
EMBED_TEXT_CHARS = 4000     # uniform truncation of name+description+body (~1k tokens)
STUB_EMBED_DIM = 64         # deterministic test-only stub dimensionality

# Hybrid retrieval knobs (global). Reciprocal Rank Fusion with the standard
# k=60 over the lexical and vector candidate lists, each capped at CAND_K. A
# candidate depth of 100 (out of ~860 beats) is the honest operating point: it
# is deep enough to admit a complementary beat that only one modality ranks
# highly, without diluting RRF's rank signal (swept globally; 100 was the best
# principled depth, deeper plateaus).
RRF_K = 60
CAND_K = 100

# Test-only deterministic embedder, gated by BEATS_EMBED_STUB (documented, like
# --inject-parity-fault). Lets the suites run without ollama. A hashed
# bag-of-tokens unit vector: same text -> same vector, token overlap -> higher
# cosine, so fixtures can exercise the vector/RRF path deterministically.
def _stub_embed(text):
    vec = [0.0] * STUB_EMBED_DIM
    for tok in QUERY_TOKEN_RE.findall((text or "").lower()):
        vec[int(hashlib.sha1(tok.encode("utf-8")).hexdigest(), 16) % STUB_EMBED_DIM] += 1.0
    return _l2_normalize(vec)


def _l2_normalize(vec):
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0.0:
        return vec
    return [x / norm for x in vec]


def embed_text(text):
    """Return a unit-normalized embedding (list[float]) for `text`, or None.

    FAIL-SOFT: any transport/HTTP/parse problem returns None so callers degrade
    to lexical-only with a loud warning - an embedder outage never crashes a
    compile or a search. BEATS_EMBED_STUB swaps in the deterministic test stub.
    """
    if os.environ.get("BEATS_EMBED_STUB"):
        return _stub_embed(text)
    try:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/embeddings",
            data=json.dumps({"model": EMBED_MODEL, "prompt": text}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=EMBED_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        embed_text.last_error = str(exc)
        return None
    if not isinstance(payload, dict):
        embed_text.last_error = "embedder returned non-object JSON"
        return None
    vec = payload.get("embedding")
    if not isinstance(vec, list) or not vec:
        embed_text.last_error = "embedder returned no embedding field"
        return None
    try:
        return _l2_normalize([float(x) for x in vec])
    except (TypeError, ValueError):
        embed_text.last_error = "embedding contained non-numeric values"
        return None


embed_text.last_error = ""


def build_embed_text(name, description, body):
    """Uniform embedded-text construction for every beat: name + description +
    body, truncated to a global character cap. Identical for corpus beats (at
    compile) and would be identical for any future re-embed - never per-beat."""
    return f"{name}\n{description}\n{body}"[:EMBED_TEXT_CHARS]


def cosine_unit(query_vec, other_vec):
    """Dot product of two vectors. Inputs are L2-normalized unit vectors (stored
    and query embeddings are normalized on creation), so the dot product IS the
    cosine similarity. Length mismatch (e.g. a model change) yields 0.0."""
    if len(query_vec) != len(other_vec):
        return 0.0
    return sum(a * b for a, b in zip(query_vec, other_vec))


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
            # Base meta read works on any schema (stage 3a or 3b).
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
            # Vector availability is read DEFENSIVELY so an old stage-3a db (no
            # vectors_present/embed_dim columns) degrades to lexical-only rather
            # than exiting 4 - matches the "missing-vectors db -> lexical-only"
            # contract. When vectors are present the set must be complete AND
            # its filenames must match beats exactly (a wrong-filename or short
            # beats_vec is a broken artifact, exit 4).
            vec_rows = []
            vectors_present = False
            index_dim = 0
            try:
                vp_row = con.execute(
                    "SELECT vectors_present, embed_dim FROM meta"
                ).fetchone()
                if vp_row and vp_row[0]:
                    dim_val = vp_row[1]
                    # A usable hybrid index needs a STRICT positive integer
                    # dimension. No int() coercion: a REAL/TEXT/None/0/negative
                    # embed_dim means unusable vectors, so degrade to lexical-only
                    # rather than fuse meaningless rows (and never risk an
                    # OverflowError from int(inf)).
                    if isinstance(dim_val, int) and not isinstance(dim_val, bool) and dim_val > 0:
                        index_dim = dim_val
                        vectors_present = True
            except sqlite3.OperationalError:
                # stage-3a schema: no vectors_present/embed_dim columns.
                vectors_present = False
                index_dim = 0
            if vectors_present:
                vec_rows = con.execute(
                    "SELECT filename, dim, vec FROM beats_vec"
                ).fetchall()
                vec_names = {vr[0] for vr in vec_rows}
                beat_names = {r[0] for r in rows}
                if len(vec_rows) != len(rows) or vec_names != beat_names:
                    raise sqlite3.DatabaseError(
                        f"beats_vec desynced with beats (vec {len(vec_rows)} rows, "
                        f"beats {len(rows)} rows; filenames match={vec_names == beat_names})")
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

    # --- Reciprocal Rank Fusion (stage 3b) -----------------------------------
    # Vector candidates FIRST (FAIL-SOFT), because whether the vector side is
    # active decides the lexical candidate DEPTH below. If the db carries vectors
    # AND the query embeds, cosine over the stored unit vectors gives a second
    # ranked list; otherwise a loud one-line warning and lexical-only (still exit
    # 0, distinct from a broken db which already returned 4 above).
    vector_rank = {}
    mode = "lexical"
    if vectors_present:
        qvec = embed_text(query)
        if qvec is None:
            eprint("VECTORS ABSENT: embedder unreachable "
                   f"({embed_text.last_error or 'no response'}); this query is lexical-only.")
        elif index_dim and len(qvec) != index_dim:
            # A query embedding of a different width than the stored vectors means
            # the query model does not match the compile model. Cosine would be
            # meaningless (0.0 for every row); fall back loudly rather than fusing
            # arbitrary vector candidates.
            eprint(f"VECTORS ABSENT: query embedding dim {len(qvec)} != index dim "
                   f"{index_dim} (embedder model mismatch); this query is lexical-only.")
        else:
            sims = []
            corrupt = False
            for filename, dim, blob in vec_rows:
                # Skip phantom rows (a vector whose filename is not a real beat)
                # and derived indexes; a real beat's vector only.
                if filename in INDEX_FILES or filename not in existing:
                    continue
                # Every stored row must match the index dimension exactly: a row
                # with a wrong dim or a short/NULL/TEXT blob is corrupt. Trusting
                # the per-row dim would let a dim=1/4-byte row unpack "fine" and
                # silently pollute the ranking with a length-mismatched cosine.
                if (dim != index_dim
                        or not isinstance(blob, (bytes, bytearray))
                        or len(blob) != index_dim * 4):
                    corrupt = True
                    break
                try:
                    bvec = struct.unpack(f"<{index_dim}f", blob)
                except (struct.error, TypeError):
                    corrupt = True
                    break
                sims.append((filename, cosine_unit(qvec, bvec)))
            if corrupt:
                # A malformed stored vector is a corrupt artifact; abandon the
                # whole vector side loudly rather than silently ranking a partial
                # set as "hybrid" (vector_rank stays empty, mode stays lexical).
                eprint("VECTORS ABSENT: corrupt stored vector (blob unpack failed); "
                       "this query is lexical-only.")
            else:
                sims.sort(key=lambda t: (-t[1], t[0]))
                for i, (filename, _sim) in enumerate(sims[:CAND_K], start=1):
                    vector_rank[filename] = i
                mode = "hybrid"
    else:
        eprint("VECTORS ABSENT: compiled index has no vectors "
               "(compile with the embedder available); this search is lexical-only.")

    # Build the candidate score map (higher = better for the pipeline below).
    if mode == "hybrid":
        # Reciprocal Rank Fusion of the CAND_K-capped lexical and vector lists:
        # RRF score 1/(RRF_K + rank), summed across the two lists. Index files are
        # already excluded by the FTS query.
        lexical_rank = {}
        for i, (filename, _score) in enumerate(hits[:CAND_K], start=1):
            lexical_rank[filename] = i
        fused = {}
        for filename, r in lexical_rank.items():
            fused[filename] = fused.get(filename, 0.0) + 1.0 / (RRF_K + r)
        for filename, r in vector_rank.items():
            fused[filename] = fused.get(filename, 0.0) + 1.0 / (RRF_K + r)
    else:
        # Lexical-only / degraded: score = -bm25 over the FULL hits stream. This
        # is EXACTLY the stage-3a pipeline: the pipeline below (max-per-head,
        # blended = score*EXPAND_DAMPING, descending sort) over -bm25 reproduces
        # 3a's bm25-ascending ordering for BOTH direct hits AND damped expansion
        # neighbors, because it is a consistent negation of 3a's whole bm25 path.
        # (Single-list RRF would preserve direct-hit order but NOT the direct-vs-
        # neighbor gap.) No CAND_K cap, so broad queries, --top > CAND_K, and heavy
        # supersession collapse all match pre-3b.
        fused = {filename: -score for filename, score in hits}

    head_of, head_neighbors = build_graph(rows_relates, sup_map, existing)

    # Phase 1 - direct hits: resolve every fused candidate to its chain head,
    # keeping the best (highest) fused score per head. Iterate best-first so the
    # first sighting of a head is its best position. Never surface a derived index.
    fused_sorted = sorted(fused.items(), key=lambda kv: (-kv[1], kv[0]))
    direct = {}
    order = []
    for filename, score in fused_sorted:
        head = head_of.get(filename, filename)
        if head in INDEX_FILES:
            continue
        if head not in direct:
            direct[head] = score
            order.append(head)
        elif score > direct[head]:
            direct[head] = score

    # Phase 2 - bidirectional relates_to graph expansion: the top EXPAND_FROM
    # direct hits pull in their neighbor heads at EXPAND_DAMPING of their own
    # relevance (fused scores are positive, so a damped neighbor ranks below its
    # citing hit). A neighbor keeps its best contribution across citing hits; a
    # beat that is both a direct hit and a neighbor keeps whichever is better.
    combined = dict(direct)
    for head in order[:EXPAND_FROM]:
        blended = direct[head] * EXPAND_DAMPING
        for neighbor in head_neighbors.get(head, ()):
            if neighbor in INDEX_FILES:
                continue
            if neighbor not in combined or blended > combined[neighbor]:
                combined[neighbor] = blended

    # Strict ranking: (score desc, filename asc), truncated to `top`.
    ranked = sorted(combined.items(), key=lambda kv: (-kv[1], kv[0]))[:top]
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
