#!/bin/bash
# test-compact-memory.sh
#
# Regression coverage for compact-memory.py.
#
# Scenario A (standing detection, caught 2026-06-06): standing beats are
# identified by frontmatter `type`, NOT by filename prefix. A long-lived
# decision/feedback beat is often saved with a session_* FILENAME but a standing
# TYPE - the old prefix-only is_standing() let those age out first. With the
# budget set so archiving the non-standing entries is ENOUGH, the standing
# entries (incl. a session_-named type:decision) must be RETAINED.
#
# Scenario B (over-budget-standing fallback, added 2026-06-25): when the
# standing entries ALONE exceed budget, the compactor continues archiving
# oldest-across-ALL-types so the live index still reaches budget - EXCEPT pinned
# anchors (title "** ACTIVE" / "** START HERE"), which never archive. Also
# proves archive de-duplication (collapse pre-existing dupes + never re-append a
# pointer already in the archive) and full idempotency across both files.
#
# Scenario D (title-heavy cap regression, added 2026-07-26): the live index
# drifted to a one-liner style where the whole hook sits INSIDE the [title]
# brackets and `rest` is empty. The old cap_line only trimmed `rest`, so those
# entries returned UNCAPPED and a 96-entry index sat at ~108KB, 4.4x over budget,
# with the compactor a silent no-op. cap_line must now cap the title too (keeping
# the ](file) pointer + leading pin marker intact) so an all-title-heavy pinned
# index lands under budget by CAPPING ALONE, every pointer retained, no archival.
#
# It loads the real module via importlib and shrinks BUDGET to force archival,
# so the actual is_standing()/is_pinned()/cap_line()/main() logic is exercised.
# Exits non-zero on any failure.

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 - "$HOOK_DIR/compact-memory.py" <<'PYEOF'
import importlib.util, os, sys, tempfile

mod_path = sys.argv[1]
spec = importlib.util.spec_from_file_location("compact_memory", mod_path)
cm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cm)

fails = []


def check(cond, msg):
    print(("PASS" if cond else "FAIL") + ": " + msg)
    if not cond:
        fails.append(msg)


def parse(line):
    m = cm.ENTRY_RE.match(line)
    assert m, f"unparseable test line: {line!r}"
    return (line, m)


def run(mem):
    argv = sys.argv
    sys.argv = ["compact-memory.py", mem]
    try:
        return cm.main()
    finally:
        sys.argv = argv


# ---------------------------------------------------------------------------
# Scenario A: non-standing exhaustion is ENOUGH -> standing beats retained.
# ---------------------------------------------------------------------------
print("=== Scenario A: standing-type detection (non-standing sheds first) ===")
tmpA = tempfile.mkdtemp(prefix="compact-test-A-")


def beatA(name, btype):
    with open(os.path.join(tmpA, name), "w", encoding="utf-8") as fh:
        fh.write(f"---\nname: {name}\ntype: {btype}\n---\nbody\n")


beatA("session_2020-01-01_old-decision.md", "decision")   # oldest; MUST survive
beatA("session_2021-01-01_old-project.md", "project")     # archivable by date
beatA("session_2026-06-05_new-project.md", "project")     # archivable by date
beatA("feedback_2020_rule.md", "feedback")                # standing (type+prefix)

# Index pointers, including two with NO file on disk to exercise the fallback:
#   decision_ghost.md     -> no file, no type -> filename prefix -> standing
#   session_2019_ghost.md -> no file, no type, no standing prefix -> archivable
standing_lines = [
    "- [Old decision](session_2020-01-01_old-decision.md): a long-lived decision saved with a session filename",
    "- [Standing rule](feedback_2020_rule.md): a standing feedback rule",
    "- [Ghost decision](decision_ghost.md): pointer whose file is missing - fallback to prefix",
]
nonstanding_lines = [
    "- [Old project](session_2021-01-01_old-project.md): a dated project beat that should archive by age",
    "- [New project](session_2026-06-05_new-project.md): a newer project beat",
    "- [Ghost session](session_2019_ghost.md): missing file, no standing prefix - archivable",
]
memA = os.path.join(tmpA, "MEMORY.md")
with open(memA, "w", encoding="utf-8") as fh:
    fh.write("\n".join(standing_lines + nonstanding_lines) + "\n")

# Budget = exactly the standing trio's size: the 3 non-standing entries must be
# shed, the 3 standing entries fit and are retained.
cm.BUDGET = cm.byte_size([], [parse(l) for l in standing_lines])
check(run(memA) == 0, "compactor returns 0")

liveA = open(memA, encoding="utf-8").read()
archA_path = os.path.join(tmpA, "MEMORY-archive.md")
archA = open(archA_path, encoding="utf-8").read() if os.path.isfile(archA_path) else ""

check("session_2020-01-01_old-decision.md" in liveA,
      "session_-named type:decision beat RETAINED in live index (the fix)")
check("session_2020-01-01_old-decision.md" not in archA,
      "session_-named type:decision beat NOT archived")
check("session_2021-01-01_old-project.md" in archA,
      "type:project beat archived (behavior preserved)")
check("session_2021-01-01_old-project.md" not in liveA,
      "archived type:project beat removed from live index")
check("session_2026-06-05_new-project.md" in archA, "second type:project beat archived")
check("feedback_2020_rule.md" in liveA, "type:feedback standing beat retained")
check("decision_ghost.md" in liveA,
      "missing-file decision_ pointer retained via filename fallback")
check("session_2019_ghost.md" in archA,
      "missing-file non-standing session_ pointer archived via fallback")

beforeA = open(memA, encoding="utf-8").read()
beforeArchA = archA
run(memA)
check(open(memA, encoding="utf-8").read() == beforeA, "scenario A: live index idempotent")
check((open(archA_path, encoding="utf-8").read() if os.path.isfile(archA_path) else "")
      == beforeArchA, "scenario A: archive idempotent")

# ---------------------------------------------------------------------------
# Scenario B: standing entries alone exceed budget -> all-types fallback + pins.
# ---------------------------------------------------------------------------
print("\n=== Scenario B: over-budget-standing fallback, pins, de-dup ===")
tmpB = tempfile.mkdtemp(prefix="compact-test-B-")


def beatB(name, btype):
    with open(os.path.join(tmpB, name), "w", encoding="utf-8") as fh:
        fh.write(f"---\nname: {name}\ntype: {btype}\n---\nbody\n")


beatB("session_2020-01-01_old-standing.md", "decision")   # oldest standing -> archive
beatB("session_2026-01-01_new-standing.md", "decision")   # newest standing -> retained
beatB("session_2023-01-01_proj.md", "project")            # non-standing -> archive first

pin1 = "- [** ACTIVE MISSION ** the load-bearing anchor](session_2026-06-24_active-mission.md): never archive"
pin2 = "- [** START HERE context ** orientation](session_2026-06-24_start-here.md): never archive"
new_standing = "- [New standing](session_2026-01-01_new-standing.md): newest standing, fits in budget"
old_standing = "- [Old standing](session_2020-01-01_old-standing.md): oldest standing, must shed"
proj = "- [Project](session_2023-01-01_proj.md): non-standing, sheds first"

memB = os.path.join(tmpB, "MEMORY.md")
with open(memB, "w", encoding="utf-8") as fh:
    fh.write("\n".join([pin1, pin2, old_standing, new_standing, proj]) + "\n")

# Pre-seed the archive with a duplicate pair (must collapse to one) AND a
# pointer to the soon-to-be-archived old_standing (must NOT be re-appended).
archB_path = os.path.join(tmpB, "MEMORY-archive.md")
with open(archB_path, "w", encoding="utf-8") as fh:
    fh.write("\n".join([
        "",
        "<!-- archived 2025-01-01 (seed) -->",
        "- [Dup one](session_2019_dup.md): first copy",
        "- [Dup two](session_2019_dup.md): duplicate copy that must collapse",
        "- [Pre-existing](session_2020-01-01_old-standing.md): already in the archive",
    ]) + "\n")

# Budget = pins + newest standing: pins + newest standing survive; the older
# standing and the non-standing project must shed (oldest-across-all-types).
cm.BUDGET = cm.byte_size([], [parse(l) for l in (pin1, pin2, new_standing)])
check(run(memB) == 0, "compactor returns 0")

liveB = open(memB, encoding="utf-8").read()
archB = open(archB_path, encoding="utf-8").read()

# Pins never archive.
check("session_2026-06-24_active-mission.md" in liveB, "** ACTIVE pin retained in live index")
check("session_2026-06-24_start-here.md" in liveB, "** START HERE pin retained in live index")
check("session_2026-06-24_active-mission.md" not in archB, "** ACTIVE pin NOT archived")
check("session_2026-06-24_start-here.md" not in archB, "** START HERE pin NOT archived")
# Oldest-first sacrifice across all types: newest standing kept, older shed.
check("session_2026-01-01_new-standing.md" in liveB, "newest standing retained (fits budget)")
check("session_2020-01-01_old-standing.md" not in liveB, "oldest standing shed from live index")
check("session_2023-01-01_proj.md" not in liveB, "non-standing project shed from live index")
check("session_2023-01-01_proj.md" in archB, "non-standing project moved to archive")
# Under budget (real bytes).
size_b = len(liveB.encode("utf-8"))
check(size_b <= cm.BUDGET, f"live index under budget ({size_b} <= {cm.BUDGET} bytes)")

# De-dup: the seeded duplicate collapses to ONE; old_standing already present is
# NOT appended again (still exactly one pointer to it).
check(archB.count("(session_2019_dup.md)") == 1, "pre-existing duplicate collapsed to one")
check(archB.count("(session_2020-01-01_old-standing.md)") == 1,
      "victim already in archive not re-appended (exactly one pointer)")
check("<!-- archived 2025-01-01 (seed) -->" in archB, "seed section comment preserved")

# Idempotency across BOTH files.
beforeB = open(memB, encoding="utf-8").read()
beforeArchB = open(archB_path, encoding="utf-8").read()
run(memB)
check(open(memB, encoding="utf-8").read() == beforeB, "scenario B: live index idempotent")
check(open(archB_path, encoding="utf-8").read() == beforeArchB, "scenario B: archive idempotent")

# ---------------------------------------------------------------------------
# Scenario C: pins ALONE exceed budget -> can't reach budget, but pins survive
# and the compactor still returns cleanly (no crash, no pin dropped, no loop).
# ---------------------------------------------------------------------------
print("\n=== Scenario C: pins alone exceed budget (degenerate, honest) ===")
tmpC = tempfile.mkdtemp(prefix="compact-test-C-")
memC = os.path.join(tmpC, "MEMORY.md")
with open(memC, "w", encoding="utf-8") as fh:
    fh.write("\n".join([pin1, pin2, old_standing, proj]) + "\n")
cm.BUDGET = 1  # below even a single pin -> all non-pinned shed, pins remain
check(run(memC) == 0, "scenario C: compactor returns 0 even when pins exceed budget")
liveC = open(memC, encoding="utf-8").read()
check("session_2026-06-24_active-mission.md" in liveC, "scenario C: ** ACTIVE pin survives")
check("session_2026-06-24_start-here.md" in liveC, "scenario C: ** START HERE pin survives")
check("session_2020-01-01_old-standing.md" not in liveC, "scenario C: non-pinned standing shed")
check("session_2023-01-01_proj.md" not in liveC, "scenario C: non-pinned project shed")
beforeC = open(memC, encoding="utf-8").read()
run(memC)
check(open(memC, encoding="utf-8").read() == beforeC,
      "scenario C: idempotent even while still over budget")

# ---------------------------------------------------------------------------
# Scenario D: TITLE-heavy one-liners must line-cap (2026-07-26 regression).
# The whole hook sits inside the [title] brackets, `rest` is empty. The old
# cap_line only trimmed `rest`, so these returned uncapped -> a 96-entry index
# at ~108KB, 4.4x over budget, compactor a silent no-op. cap_line must now cap
# the title too, keeping the ](file) pointer + pin marker, so an all-pinned
# title-heavy index reaches budget by CAPPING ALONE.
# ---------------------------------------------------------------------------
print("\n=== Scenario D: title-heavy one-liners line-cap to budget (regression) ===")

# A single ~1550-char title-heavy entry with an empty rest (the live-corpus shape).
long_title = "** ACTIVE ** " + "detail " * 220
heavy = "- [" + long_title.rstrip() + "](session_2026-07-26_heavy-one.md)"
mh = cm.ENTRY_RE.match(heavy)
assert mh, "regression fixture must parse"
capped = cm.cap_line(heavy, mh)
check(len(heavy) > cm.MAX_LINE, "regression fixture is over-long before capping")
check(len(capped) <= cm.MAX_LINE,
      f"title-heavy entry capped to <= MAX_LINE ({len(capped)} <= {cm.MAX_LINE})")
mc = cm.ENTRY_RE.match(capped)
check(mc is not None, "capped title-heavy line still parses as an index entry")
check(bool(mc) and mc.group("file") == "session_2026-07-26_heavy-one.md",
      "capped entry keeps its ](file) pointer intact (still grep-able)")
check(bool(mc) and cm.is_pinned(mc), "capped entry keeps its ** ACTIVE pin marker")

# A whole index of 40 title-heavy PINNED one-liners at the real 23KB budget: the
# fix must land it under budget by capping alone, every pointer retained, nothing
# archived (the old code left this shape 4x+ over budget as a no-op).
tmpD = tempfile.mkdtemp(prefix="compact-test-D-")
memD = os.path.join(tmpD, "MEMORY.md")


def heavy_name(i):
    return f"session_2026-07-{i % 28 + 1:02d}_heavy-{i:02d}.md"


heavy_lines = []
for i in range(40):
    t = f"** ACTIVE ** entry {i:02d} " + "verbose hook text over the one-line rule " * 30
    heavy_lines.append("- [" + t.rstrip() + "](" + heavy_name(i) + ")")
with open(memD, "w", encoding="utf-8") as fh:
    fh.write("\n".join(heavy_lines) + "\n")

raw_bytes = os.path.getsize(memD)
cm.BUDGET = 23000  # reset from scenario C's BUDGET=1 back to the real budget
check(raw_bytes > cm.BUDGET,
      f"raw title-heavy index over budget before compaction ({raw_bytes} > {cm.BUDGET})")
check(run(memD) == 0, "scenario D: compactor returns 0")

liveD = open(memD, encoding="utf-8").read()
sizeD = len(liveD.encode("utf-8"))
check(sizeD <= cm.BUDGET,
      f"scenario D: title-heavy index UNDER budget after capping ({sizeD} <= {cm.BUDGET})")
archD_path = os.path.join(tmpD, "MEMORY-archive.md")
archD = open(archD_path, encoding="utf-8").read() if os.path.isfile(archD_path) else ""
missing = [heavy_name(i) for i in range(40) if heavy_name(i) not in liveD]
check(not missing, f"scenario D: all 40 pointers retained in live index (missing: {missing})")
check(archD == "", "scenario D: nothing archived - capping alone reached budget")
longest = max(len(l) for l in liveD.splitlines())
check(longest <= cm.MAX_LINE, f"scenario D: longest line <= MAX_LINE ({longest} <= {cm.MAX_LINE})")

# Idempotent second pass.
beforeD = open(memD, encoding="utf-8").read()
run(memD)
check(open(memD, encoding="utf-8").read() == beforeD, "scenario D: idempotent")

print()
if fails:
    print(f"{len(fails)} FAILURE(S)")
    sys.exit(1)
print("ALL PASS")
PYEOF
rc=$?
exit $rc
