#!/usr/bin/env python3
"""compact-memory.py - keep a beats MEMORY.md index under its load budget.

The harness loads MEMORY.md into context at session start, but it has a hard
size limit (~24.4KB); over it, the index silently truncates and the agent works
half-blind. This keeps it under budget MECHANICALLY, with zero data loss:

  1. Line-cap every index entry to MAX_LINE chars (the index is pointers + a
     short hook; the full detail lives in the beat file, so capping the line
     loses nothing real and just enforces the existing one-line rule).
  2. If still over BUDGET, ARCHIVE the oldest entries into MEMORY-archive.md
     until under budget. Order of sacrifice: oldest NON-STANDING dated entries
     first (feedback/decision/reference/user are "standing" and shed last); but
     if the standing entries ALONE still exceed budget, continue archiving
     oldest-across-ALL-types so the live index ALWAYS reaches budget. A small
     set of PINNED anchors (index title starts "** ACTIVE" / "** START HERE",
     or filename in PINNED_FILES) is NEVER archived, so the active-mission /
     active-plan / start-here pointers always stay live. Undated entries sort
     as newest (kept longest). Archived pointers are MOVED, not deleted; the
     beat files themselves are untouched and still grep-able.
  3. De-duplicate the archive: an identical pointer (same filename link) is
     never appended twice, and any pre-existing duplicates are collapsed to the
     first occurrence (section comments and blank lines preserved).

Why the all-types fallback (added 2026-06-25): a long-lived project's standing
entries can grow past BUDGET on their own. The old "never archive standing"
rule then let the loop run to exhaustion - it archived EVERY non-standing entry
(newest included) and STILL never reached budget, so freshly-added project
pointers were dumped to the archive on the very next write and the live index
stayed over budget anyway. Archiving oldest-across-all-types (minus pins) keeps
the index genuinely under budget while the pins guarantee the load-bearing
anchors survive. See reference_memory_index_over_budget.md.

Usage: compact-memory.py <path/to/MEMORY.md>
Idempotent: running it on an already-compact, de-duplicated file is a no-op.
"""
import os
import re
import sys
from datetime import datetime, timezone

BUDGET = 23000          # bytes; under the ~24.4KB harness limit, with headroom
MAX_LINE = 200          # chars per index entry (the documented one-line rule)
STANDING_PREFIXES = ("feedback_", "decision_", "reference")  # filename fallback
STANDING_TYPES = frozenset({"feedback", "decision", "reference", "user"})

# PINNED anchors are never archived, even under the all-types fallback, so the
# active-mission / active-plan / start-here pointers always survive in the live
# index. A beat is pinned if its index TITLE begins with one of these markers...
PIN_TITLE_MARKERS = ("** ACTIVE", "** START HERE")
# ...or its filename is listed here (explicit extension point; empty by default).
PINNED_FILES = frozenset()

ENTRY_RE = re.compile(r"^\s*- \[(?P<title>.*?)\]\((?P<file>[^)]+)\)(?P<rest>.*)$")
TYPE_RE = re.compile(r"^\s*type:\s*([A-Za-z]+)", re.MULTILINE)


def frontmatter_type(filepath: str):
    """Lowercased frontmatter `type:` of a beat file, or None if unreadable.

    Reads only the head of the file - the frontmatter block is at the very top,
    so a small slice is enough and keeps this cheap on every MEMORY.md write.
    """
    try:
        with open(filepath, encoding="utf-8") as fh:
            head = fh.read(1500)
    except OSError:
        return None
    m = TYPE_RE.search(head)
    return m.group(1).lower() if m else None


def is_standing(fn: str, memdir: str = "") -> bool:
    """True if a beat is standing (sheds LAST, after non-standing entries).

    AUTHORITATIVE signal is the referenced beat's frontmatter `type`: a
    long-lived decision/feedback/reference/user beat is shed only after every
    non-standing entry is gone. Many such beats are saved with a session_*
    FILENAME but a standing TYPE (e.g. session_2026-05-29_tilt-lab-design-
    direction.md is type: decision), so keying on the filename prefix alone -
    the old behavior - wrongly let them age out first. We read the frontmatter
    type and fall back to the filename prefix ONLY when the file or its type is
    unreadable, preserving the old behavior for that edge.
    """
    t = frontmatter_type(os.path.join(memdir, fn)) if memdir else None
    if t is not None:
        return t in STANDING_TYPES
    return fn.startswith(STANDING_PREFIXES)


def is_pinned(m: "re.Match") -> bool:
    """True if an index entry is a pinned anchor (NEVER archived, any type)."""
    if m.group("title").lstrip().startswith(PIN_TITLE_MARKERS):
        return True
    return m.group("file") in PINNED_FILES


def date_key(fn: str) -> str:
    m = re.search(r"(\d{4}-\d{2}-\d{2})", fn)
    return m.group(1) if m else "9999-99-99"  # undated -> treat as newest (keep)


def cap_line(line: str, m: "re.Match") -> str:
    if len(line) <= MAX_LINE:
        return line
    prefix = f"- [{m.group('title')}]({m.group('file')})"
    rest = m.group("rest")  # usually ": hook text"
    avail = MAX_LINE - len(prefix) - 1
    if avail < 0:
        return prefix  # pathologically long title/link: keep the pointer only
    rest = rest[:avail].rstrip() + "…"
    return prefix + rest


def byte_size(header, entries) -> int:
    """UTF-8 byte length of the rendered index (header + entry lines, each plus
    its newline). Byte-accurate because the harness budget is in BYTES, not
    characters - a capped "…" or any unicode in a title costs more than one byte
    apiece, and a char-count would let a unicode-heavy index slip over budget.
    """
    return (sum(len(h.encode("utf-8")) + 1 for h in header)
            + sum(len(l.encode("utf-8")) + 1 for l, _ in entries))


def dedup_archive(existing: str):
    """Collapse duplicate pointers in MEMORY-archive.md to their first
    occurrence. Non-entry lines (section comments, blanks) are preserved as-is
    and in order; only repeated entry pointers (same filename link) are dropped.

    Returns (lines, seen) where `lines` is the de-duplicated line list and
    `seen` is the set of filenames already present. Idempotent: already-unique
    input round-trips unchanged.
    """
    seen = set()
    out_lines = []
    for line in existing.splitlines():
        m = ENTRY_RE.match(line)
        if m:
            fn = m.group("file")
            if fn in seen:
                continue  # duplicate pointer - first occurrence already kept
            seen.add(fn)
        out_lines.append(line)
    return out_lines, seen


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: compact-memory.py <MEMORY.md>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    if not os.path.isfile(path):
        return 0
    memdir = os.path.dirname(path) or "."
    archive = os.path.join(memdir, "MEMORY-archive.md")

    lines = open(path, encoding="utf-8").read().splitlines()
    header, entries = [], []
    for l in lines:
        m = ENTRY_RE.match(l)
        if m:
            entries.append((cap_line(l, m), m))
        elif not entries:
            header.append(l)  # preserve a leading header block, if any
        # stray non-entry lines between entries are dropped (index = entries)

    # Archive oldest entries until under budget. Sort key is (is_standing,
    # date): non-standing (False) sheds before standing (True); within each
    # group oldest-first (undated -> "9999-99-99" sorts last = kept longest).
    # Pinned anchors are excluded entirely, so they never archive.
    keep = entries[:]
    archived = []
    if byte_size(header, keep) > BUDGET:
        candidates = sorted(
            (e for e in keep if not is_pinned(e[1])),
            key=lambda e: (is_standing(e[1].group("file"), memdir),
                           date_key(e[1].group("file"))),
        )
        for victim in candidates:
            if byte_size(header, keep) <= BUDGET:
                break
            keep.remove(victim)
            archived.append(victim)

    # Compose the new archive: de-dup what's already there, then append only the
    # victims whose pointer is not already present (no duplicate pointers ever).
    try:
        old_arch = open(archive, encoding="utf-8").read()
    except OSError:
        old_arch = ""
    archive_lines, seen = dedup_archive(old_arch)
    to_append = []
    for l, m2 in archived:
        fn = m2.group("file")
        if fn in seen:
            continue  # pointer already archived - move it out of live, don't re-add
        seen.add(fn)
        to_append.append(l)
    if to_append:
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        archive_lines.append("")
        archive_lines.append(
            f"<!-- archived {stamp} (moved from MEMORY.md to stay under load budget) -->")
        archive_lines.extend(to_append)
    new_arch = ("\n".join(archive_lines) + "\n") if archive_lines else ""

    out = header + [l for l, _ in keep]
    mem_text = "\n".join(out).rstrip("\n") + "\n"

    # Degenerate case: if the header plus the PINNED anchors alone exceed BUDGET,
    # the loop runs out of non-pinned candidates and the index stays over budget.
    # That is unavoidable without unpinning, but it must be reported honestly
    # rather than claimed "under budget" below.
    final_size = byte_size(header, keep)
    over_budget = final_size > BUDGET

    try:
        old_mem = open(path, encoding="utf-8").read()
    except OSError:
        old_mem = None

    # Idempotent: only rewrite a file when its content actually changed, so a
    # PostToolUse run never needlessly touches a file the agent is mid-edit on.
    mem_changed = mem_text != old_mem
    arch_changed = new_arch != old_arch
    if not mem_changed and not arch_changed:
        if over_budget:
            print(f"compact-memory: WARNING still over budget "
                  f"({final_size} > {BUDGET} bytes) - pinned anchors + header exceed "
                  f"budget, cannot shed further without unpinning", file=sys.stderr)
        else:
            print("compact-memory: already under budget, no change")
        return 0

    if arch_changed:
        open(archive, "w", encoding="utf-8").write(new_arch)
    if mem_changed:
        open(path, "w", encoding="utf-8").write(mem_text)
    print(f"compact-memory: {len(entries)} entries -> kept {len(keep)}, "
          f"archived {len(archived)} ({len(to_append)} new to archive), "
          f"~{final_size} bytes (budget {BUDGET})")
    if over_budget:
        print(f"compact-memory: WARNING still over budget ({final_size} > {BUDGET}) "
              f"after archiving every non-pinned entry; pinned anchors + header "
              f"exceed budget", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
