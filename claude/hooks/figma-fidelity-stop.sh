#!/usr/bin/env bash
#
# figma-fidelity-stop.sh - Stop hook.
#
# Blocks "done" on UI built from a Figma source until MEASURED property parity is
# proven: for every element, the Figma-measured value must equal the
# implementation value, that value must literally appear in the compiled
# code/markup, AND a verbatim browser reading must be recorded and must agree.
# Eyeballing a screenshot never clears this gate.
#
# Armed by ".figma-fidelity.pending" at the repo root, whose lines name the
# component token(s) the current build covers.
#
# Manifest: <repo>/.figma-fidelity.json
#   {
#     "checks": [
#       {
#         "element":  "site-header search input",
#         "node":     "858:11438",
#         "property": "border-radius",
#         "figma":    "10px",          // measured FROM Figma (the spec)
#         "measured": "10px",          // the value the implementation intends
#         "dom":      "10px",          // VERBATIM browser reading, no editing
#         "dom_status": "read",
#         "evidence": { "file": "...", "grep": "border-radius: 10px" }
#       }
#     ]
#   }
#
# dom_status enum:
#   read              - `dom` is a verbatim reading taken by the check's author
#   read_independent  - `dom` was read by someone other than the author
#   legacy_attested   - recorded before validation-guard.sh was fixed (2026-07-10
#                       03:23), when nothing in the harness could prevent a
#                       fabricated reading. Accepted, counted, and reported.
#                       Rejected under FIGMA_FIDELITY_STRICT=1.
#   not_a_dom_property- the property has no computed-style counterpart (e.g. SVG
#                       path data in a file). Exempt from the dom compare; still
#                       needs `note` and evidence.
#   not_read          - the author did not read it. Always blocks.
#
# figma-vs-dom ladder, in order. The first rule that matches decides:
#   1. exact string equality
#   2. colour equality  (#RRGGBB == rgb()/rgba())
#   3. numeric equality within Blink's 1/64px layout quantum, compared
#      element-wise across identical non-numeric skeletons ("a / b" vs "a / b")
#   4. a non-empty `dom_equivalence` string. This is an ESCAPE HATCH: it declares
#      that the two sides are not literally equal and says why. Every use is
#      listed on stderr. A row whose `dom` side is prose rather than a reading
#      must carry one.
#   5. otherwise: BLOCK.
#
# WHAT THIS GATE CANNOT DO: it cannot catch fabrication. Setting `dom` := `figma`
# on every row passes every rule (reproduced 2026-07-10). It catches DRIFT (a dom
# value that disagrees) and OMISSION (a dom value that is missing). Only an
# independent reader catches a lie - that is what `read_independent` is for.
# See decision_2026-07-10_dom-field-and-what-it-cannot-do.md.
#
# The manifest is read ONCE, as a single byte-slurp, and parsed in one process.
# A read or parse failure aborts as "manifest unreadable" and NEVER names a
# component: the previous version spawned ~1419 `jq` processes against a live
# path, and a `jq` that lost a race returned "" for a field, which the gate then
# reported as a missing value on whichever component the loop happened to be on.
# It accused a component nobody had touched. See
# reference_2026-07-10_gate-accused-an-innocent-component.md.
#
# Block convention: reason to stderr, exit 2. Allow: exit 0 and clear the marker.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER="$ROOT/.figma-fidelity.pending"
MANIFEST="$ROOT/.figma-fidelity.json"

# Not a Figma build in progress -> do nothing.
[ -f "$MARKER" ] || exit 0

command -v python3 >/dev/null 2>&1 || {
  printf 'BLOCKED (figma-fidelity-gate): python3 not found; cannot verify the fidelity manifest.\n' >&2
  exit 2
}

python3 - "$ROOT" "$MARKER" "$MANIFEST" <<'PYEOF'
import json
import os
import re
import sys

ROOT, MARKER, MANIFEST = sys.argv[1], sys.argv[2], sys.argv[3]
STRICT = os.environ.get("FIGMA_FIDELITY_STRICT", "") not in ("", "0")

# Blink quantises layout to 1/64px. The largest honest disagreement observed
# across 54 real readings was 0.0078 (half a quantum). The epsilon absorbs the
# 4-decimal rounding of the reported string.
TOL = 1.0 / 64.0 + 1e-4

# re.ASCII: \d must be [0-9]. Without it, Python matches every Unicode decimal,
# so "١px" (ARABIC-INDIC ONE) parses as 1.0 and compares equal to "1px".
NUMU = re.compile(r"([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)([a-zA-Z%]*)", re.ASCII)
HEX = re.compile(r"#([0-9a-fA-F]{6})\Z")
# Channels are \d+(\.\d+)? and not [\d.]+, so "rgb(1..2,2,3)" fails to MATCH
# rather than matching and then raising inside float().
_CH = r"\d+(?:\.\d+)?"
RGB = re.compile(
    r"rgba?\(\s*(%s)[,\s]+(%s)[,\s]+(%s)(?:[,/\s]+(%s))?\s*\)\Z" % (_CH, _CH, _CH, _CH),
    re.ASCII,
)

# Only these units get the layout tolerance. A degree, a percent, a second or an
# em is not a Blink px quantum: 45deg vs 45.0157deg is a real difference.
TOLERANT_UNITS = ("", "px")

VALID_STATUS = {
    "read",
    "read_independent",
    "legacy_attested",
    "not_a_dom_property",
    "not_read",
}


def block(msg):
    sys.stderr.write("BLOCKED (figma-fidelity-gate): %s\n" % msg)
    sys.exit(2)


def unreadable(why):
    """A manifest we cannot trust says NOTHING about any component.

    Never name one here. Naming a component on an infrastructure failure is how
    this gate once accused a component nobody had touched.
    """
    block(
        "manifest unreadable (%s). This is a gate failure, not a fidelity "
        "failure: it says nothing about any component. Retry. If it repeats, "
        "the manifest is being written non-atomically - write to a temp file "
        "and os.rename() it into place." % why
    )


def norm_color(s):
    if not isinstance(s, str):
        return None
    s = s.strip()
    m = HEX.match(s)
    if m:
        h = m.group(1)
        return (float(int(h[0:2], 16)), float(int(h[2:4], 16)), float(int(h[4:6], 16)), 1.0)
    m = RGB.match(s)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        # float, never int(). int(float("18.9")) truncates to 18, which would make
        # rgb(18.9, 99, 62) compare EQUAL to rgb(18, 99, 62): a silent over-match
        # in the direction of passing. Browsers serialise integer channels, so an
        # exact compare costs nothing and closes the hole.
        return (float(m.group(1)), float(m.group(2)), float(m.group(3)), a)
    return None


def numeric_match(a, b):
    """Same skeleton, same units, numbers within TOL element-wise.

    The skeleton keeps ORDER significant: "10px 20px" and "20px 10px" share a
    skeleton but their numbers are compared element-wise, so they do not match.

    `calc()` is refused outright. Element-wise slack ACCUMULATES through an
    expression: calc(10px + 2px) vs calc(10.0157px + 2.0157px) passes every
    per-number test while the resolved sum differs by 0.0314px, two quanta.
    Computed style resolves calc anyway, so a calc string must match exactly.
    """
    if "calc(" in a or "calc(" in b:
        return False

    ska, skb = NUMU.sub("\x00", a), NUMU.sub("\x00", b)
    if ska != skb:
        return False
    # Two numbers with nothing between them means we mis-tokenised something
    # malformed: "1.2.3" scans as [1.2, .3] and would compare equal to "1.2.300".
    if "\x00\x00" in ska:
        return False

    pa, pb = NUMU.findall(a), NUMU.findall(b)
    if not pa or len(pa) != len(pb):
        return False
    for (na, ua), (nb, ub) in zip(pa, pb):
        if ua != ub:
            return False
        try:
            x, y = float(na), float(nb)
        except ValueError:
            return False
        limit = TOL if ua in TOLERANT_UNITS else 0.0
        if abs(x - y) > limit:
            return False
    return True


def dom_matches(figma, dom):
    """The ladder. Returns 'exact' | 'colour' | 'numeric' | None."""
    if figma == dom:
        return "exact"
    cf, cd = norm_color(figma), norm_color(dom)
    if cf is not None and cd is not None and cf == cd:
        return "colour"
    if numeric_match(figma, dom):
        return "numeric"
    return None


# --- read the marker and the manifest exactly once -------------------------
try:
    with open(MARKER, "r", encoding="utf-8") as fh:
        marker_raw = fh.read()
except OSError as exc:
    unreadable("cannot read the pending marker: %s" % exc)

covers = []
for line in marker_raw.splitlines():
    line = line.split("#", 1)[0].strip()
    if line:
        covers.append(line)

if not covers:
    block(
        "the pending marker is empty. Write the component token(s) this build "
        "covers into .figma-fidelity.pending (one per line, e.g. site-footer) "
        "so the gate can confirm the manifest actually covers what changed."
    )

if not os.path.exists(MANIFEST):
    block(
        "a Figma build is armed (.figma-fidelity.pending) but no "
        ".figma-fidelity.json manifest exists.\nSelect each object in Figma, "
        "obtain its properties, and record per element: node id, property, the "
        "Figma value, the implementation value, a VERBATIM dom reading, and "
        "grep evidence in the real file. Then retry."
    )

try:
    with open(MANIFEST, "rb") as fh:
        raw = fh.read()
except OSError as exc:
    unreadable("read failed: %s" % exc)

if not raw.strip():
    unreadable("empty read; a writer was probably mid-flight")

try:
    data = json.loads(raw.decode("utf-8"))
except (UnicodeDecodeError, ValueError) as exc:
    unreadable("not valid JSON: %s" % exc)

if not isinstance(data, dict):
    unreadable("top level is %s, expected an object" % type(data).__name__)

prov = data.get("provenance", {})
if not isinstance(prov, dict):
    block(
        "provenance must be an object, got %s. Schema error; says nothing about "
        "any component." % type(prov).__name__
    )

checks = data.get("checks")
if not isinstance(checks, list) or not checks:
    block(
        ".figma-fidelity.json has no checks. Every measurable property of every "
        "element (radius, width/height, colour, font, icon path, spacing) needs "
        "a measured check."
    )

for idx, chk in enumerate(checks):
    if not isinstance(chk, dict):
        # The JSON parsed, so this is a SCHEMA defect, not a torn read. Saying
        # "unreadable, retry" here would tell the author to retry forever.
        block(
            "check #%d is a %s, expected an object. The manifest parsed cleanly, "
            "so this is a schema error, not a race." % (idx, type(chk).__name__)
        )

# --- coverage ---------------------------------------------------------------
# A bare substring test is vacuous: the token "card" matches the element
# "discarded component", "hero" matches "heroine bio", and node "858:1143"
# matches "858:11438". Require a boundary on both sides, where a boundary is
# anything outside [A-Za-z0-9_-]. Hyphen counts as a word character on purpose,
# so the token "text-image" does NOT claim coverage of "text-image-alt".
def covered(tok, checks):
    pat = re.compile(
        r"(?<![A-Za-z0-9_-])%s(?![A-Za-z0-9_-])" % re.escape(tok), re.ASCII
    )
    return any(
        pat.search("%s %s" % (c.get("element", ""), c.get("node", ""))) for c in checks
    )


uncovered = [tok for tok in covers if not covered(tok, checks)]
if uncovered:
    block(
        "the manifest does not cover this build.%s\nMeasure that component "
        "(Figma property + verbatim dom reading + evidence grep in real code) "
        "and add its checks before closing. A passing manifest for a different "
        "component is a vacuous pass."
        % "".join("\n  - no check covers component: %s" % t for t in uncovered)
    )

# --- evidence files, read once each ----------------------------------------
file_cache = {}


def evidence_text(rel):
    if rel in file_cache:
        return file_cache[rel]
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        file_cache[rel] = None
        return None
    try:
        with open(path, "rb") as fh:
            file_cache[rel] = fh.read().decode("utf-8", "replace")
    except OSError:
        file_cache[rel] = None
    return file_cache[rel]


fails = []
equivalences = []
legacy = []
independent = 0


def name(chk, idx):
    return "[%s] %s" % (
        chk.get("element", "check %d" % idx),
        chk.get("property", "?"),
    )


for idx, chk in enumerate(checks):
    # Type guards first. A JSON number in `figma`, or a list in `evidence`, used
    # to reach the comparison code and raise - which the bash net now converts to
    # a block, but "the gate crashed" is a worse message than "your schema is
    # wrong". Name the schema error.
    for key in ("figma", "measured"):
        if key in chk and not isinstance(chk[key], str):
            block(
                "check #%d field `%s` must be a string, got %r. Schema error."
                % (idx, key, chk[key])
            )
    if "evidence" in chk and not isinstance(chk["evidence"], (dict, type(None))):
        block(
            "check #%d field `evidence` must be an object, got %s. Schema error."
            % (idx, type(chk["evidence"]).__name__)
        )

    figma = chk.get("figma") or ""
    measured = chk.get("measured") or ""
    status = chk.get("dom_status")
    dom = chk.get("dom")

    # 1. the original invariant: the implementation value IS the Figma value.
    if not figma or not measured:
        fails.append("%s: missing figma or measured value (both required)" % name(chk, idx))
    elif figma != measured:
        fails.append(
            "%s: figma='%s' != measured='%s'" % (name(chk, idx), figma, measured)
        )

    # 2. the dom reading.
    if status is None:
        fails.append(
            "%s: no dom_status. This check has never been harness-enforced. "
            "Read the property in the browser and record `dom` + `dom_status`, "
            "or mark it not_a_dom_property / legacy_attested." % name(chk, idx)
        )
    elif status not in VALID_STATUS:
        fails.append(
            "%s: unknown dom_status '%s' (expected one of: %s)"
            % (name(chk, idx), status, ", ".join(sorted(VALID_STATUS)))
        )
    elif status == "not_read":
        fails.append(
            "%s: dom_status=not_read. Read it in the browser, or justify it as "
            "not_a_dom_property." % name(chk, idx)
        )
    elif status == "not_a_dom_property":
        if dom not in (None, ""):
            fails.append(
                "%s: dom_status=not_a_dom_property but a dom value is present "
                "('%s'). Pick one." % (name(chk, idx), str(dom)[:40])
            )
        if not chk.get("note"):
            fails.append(
                "%s: dom_status=not_a_dom_property requires a `note` saying why "
                "the property has no computed-style counterpart." % name(chk, idx)
            )
    else:
        # legacy_attested | read | read_independent.
        if status == "legacy_attested":
            legacy.append(name(chk, idx))
            if STRICT:
                fails.append(
                    "%s: dom_status=legacy_attested and FIGMA_FIDELITY_STRICT is set."
                    % name(chk, idx)
                )
        elif status == "read_independent":
            independent += 1

        if not isinstance(dom, str) or not dom.strip():
            # Only legacy rows may omit the reading. That is the whole debt.
            if status != "legacy_attested":
                fails.append(
                    "%s: dom_status=%s but no `dom` value. Record the verbatim "
                    "browser reading." % (name(chk, idx), status)
                )
        elif figma:
            # A `dom` value is compared WHATEVER the status. Otherwise
            # legacy_attested would be a hole to hide a failing reading in:
            # downgrade the status, keep the disagreeing dom, pass the gate.
            eq = chk.get("dom_equivalence")
            if dom_matches(figma, dom):
                pass
            elif isinstance(eq, str) and eq.strip():
                equivalences.append("%s: figma='%s' dom='%s'\n      because: %s"
                                    % (name(chk, idx), figma[:38], dom[:38], eq))
            else:
                fails.append(
                    "%s: figma='%s' does not match dom='%s'. If these are "
                    "equivalent in a way the gate cannot compute, say so in "
                    "`dom_equivalence`; do not edit the reading."
                    % (name(chk, idx), figma[:60], str(dom)[:60])
                )

    # 3. the value must exist in real compiled code.
    ev = chk.get("evidence") or {}
    efile, egrep = ev.get("file"), ev.get("grep")
    if not efile or not egrep:
        fails.append(
            "%s: missing evidence.file/evidence.grep (must prove the value in "
            "real code)" % name(chk, idx)
        )
    else:
        text = evidence_text(efile)
        if text is None:
            fails.append("%s: evidence file not found: %s" % (name(chk, idx), efile))
        elif egrep not in text:
            fails.append(
                "%s: evidence not found in %s: '%s'" % (name(chk, idx), efile, egrep)
            )

# The legacy debt is a RATCHET: it may shrink, never grow. Without this, any
# failing check could be downgraded to legacy_attested to walk past the gate, and
# any new check could be born already exempt. Raising the declared ceiling is
# still possible - but it is now a deliberate, visible edit to a field that says
# what it is, rather than a silent status change on one row.
def counter(key):
    """A declared non-negative count, or 0. `True` is not a count.

    isinstance(True, int) is True in Python, so a JSON `true` would otherwise be
    read as a ceiling of 1. A negative would make `len(x) > declared` fire on an
    empty list. Both are schema errors, not silent defaults.
    """
    v = prov.get(key)
    if v is None:
        return 0
    if isinstance(v, bool) or not isinstance(v, int) or v < 0:
        block(
            "provenance.%s must be a non-negative integer, got %r. This is a "
            "schema error and says nothing about any component." % (key, v)
        )
    return v


declared = counter("legacy_attested_count")
if len(legacy) > declared:
    fails.append(
        "legacy_attested debt GREW: %d rows carry it, but provenance."
        "legacy_attested_count declares %d. The debt may only shrink. Read the "
        "property in the browser instead of downgrading its status."
        % (len(legacy), declared)
    )

# A floor on the check count. Deleting the failing row is the cheapest way past
# any gate, and nothing else here would notice.
floor = counter("checks_count")
if len(checks) < floor:
    fails.append(
        "checks were REMOVED: %d present, provenance.checks_count declares %d. "
        "A check may not be deleted to pass the gate. If a check is genuinely "
        "obsolete, lower the declared count in the same commit that removes it."
        % (len(checks), floor)
    )

if fails:
    block(
        "measured Figma parity NOT proven (%d checks, %d failures):%s\n"
        "Build to spec: each implemented value must equal the Figma value, "
        "appear literally in the cited file, and agree with a verbatim browser "
        "reading. Screenshots are context, not proof."
        % (len(checks), len(fails), "".join("\n  - " + f for f in fails))
    )

# Passing. Report the debt rather than hiding it.
out = sys.stderr
out.write(
    "figma-fidelity-gate: %d checks pass (%d independently read).\n"
    % (len(checks), independent)
)
if legacy:
    out.write(
        "  %d checks are dom_status=legacy_attested: recorded before "
        "validation-guard.sh was fixed, when nothing could prevent a fabricated\n"
        "  reading. They are accepted, not verified. Re-read them in the browser "
        "to clear the debt; FIGMA_FIDELITY_STRICT=1 rejects them.\n" % len(legacy)
    )
    if len(legacy) < declared:
        out.write(
            "  the debt shrank (%d < %d). Lower provenance.legacy_attested_count "
            "to %d so the ratchet holds the new floor.\n"
            % (len(legacy), declared, len(legacy))
        )
if equivalences:
    out.write(
        "  %d checks pass via a declared dom_equivalence (the two sides are not "
        "literally equal):\n" % len(equivalences)
    )
    for e in equivalences:
        out.write("    - %s\n" % e)

sys.exit(0)
PYEOF

rc=$?

# Claude Code blocks a Stop ONLY on exit 2. Any other non-zero code is a
# NON-BLOCKING error: the turn ends anyway. So an unhandled Python exception -
# a malformed `provenance`, an unparseable colour channel, a killed process -
# would let a build declare itself done. The gate must FAIL CLOSED. Anything
# that is not a clean pass or a deliberate block is a crash, and a crash blocks.
if [ "$rc" -eq 2 ]; then
  exit 2
fi
if [ "$rc" -ne 0 ]; then
  printf 'BLOCKED (figma-fidelity-gate): the gate crashed (python exit %s; see the traceback above). This is a gate failure, not a fidelity failure - it says nothing about any component. Fix the gate or the manifest schema, then retry.\n' "$rc" >&2
  exit 2
fi

# All checks pass. Clear the marker so the gate disarms for this build.
rm -f "$MARKER"
exit 0
