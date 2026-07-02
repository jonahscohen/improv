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

  --corpus  override the corpus dir (default: <repo-root>/.claude/memory)
  --build   override the build dir  (default: <beats-dir>/.build)

EXIT CODES
  0  success
  2  corpus dir missing
  3  unreadable / non-strictly-decodable corpus file(s)
  4  artifact / db / FTS5 failure (broken, not stale)
  5  parity self-verification failure
  6  verify-only: artifacts stale vs the corpus
Argparse errors keep argparse's own default (exit 2).
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


def main():
    ap = argparse.ArgumentParser(
        description="Compile / verify the markdown beats corpus into build artifacts."
    )
    ap.add_argument("command", choices=["compile", "verify"])
    ap.add_argument("--corpus", default=None,
                    help="corpus dir (default: <repo-root>/.claude/memory)")
    ap.add_argument("--build", default=None,
                    help="build dir (default: <beats-dir>/.build)")
    ap.add_argument("--inject-parity-fault", action="store_true",
                    help=argparse.SUPPRESS)
    args = ap.parse_args()

    corpus = Path(args.corpus).resolve() if args.corpus else DEFAULT_CORPUS
    build = Path(args.build).resolve() if args.build else DEFAULT_BUILD

    if args.command == "compile":
        return cmd_compile(corpus, build, args.inject_parity_fault)
    return cmd_verify(corpus, build)


if __name__ == "__main__":
    sys.exit(main())
