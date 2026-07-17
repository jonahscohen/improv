#!/usr/bin/env bash
#
# figma-fidelity-arm.sh - PreToolUse hook.
#
# Arms the Figma-fidelity Stop gate (figma-fidelity-stop.sh) the MOMENT a build
# pulls from the Figma board, so a builder can no longer pull a node and then
# eyeball it past a gate that was asleep by design. Bound (in settings.json) to
# the two Figma MCP tools that PROVE a build is Figma-sourced:
#
#   mcp__plugin_figma_figma__get_design_context   (pull reference code + props)
#   mcp__plugin_figma_figma__download_assets       (export exact icon/arrow assets)
#
# Both carry tool_input.nodeId (shape \d+[:-]\d+) and tool_input.fileKey, verified
# against the plugin tool schemas 2026-07-17.
#
# On fire it records the pulled node id - normalised to COLON form, the manifest
# `node` convention - into <repo>/.figma-fidelity.pending, one token per line. The
# Stop gate then blocks "done" until .figma-fidelity.json carries a measured check
# whose element+node covers that node.
#
# Design decisions (full rationale in the ppai decision beat 2026-07-17):
#
#   1. Token = the exact pulled nodeId, colon-normalised (re.ASCII, so a Unicode
#      digit cannot masquerade as a Figma id). The gate's coverage check matches
#      the token, with word boundaries, against each check's element+node, so
#      recording `node: "858:11438"` for the node you pulled satisfies coverage.
#      Tying the proof to the node pulled is the whole point.
#
#   2. Over-arming opt-out. A reference-only pull also arms the gate. That is
#      intended (if you pulled it, prove it or deliberately clear it), so the
#      opt-out is VISIBLE and DELIBERATE: each armed line carries a
#      self-documenting comment, and the gate strips everything after '#'. To opt
#      a node OUT you delete (or '#'-comment) its line in .figma-fidelity.pending
#      - a per-node, on-the-record act, never a silent default.
#
#   3. Corruption-safe, and survives a concurrent Stop clear. The Stop gate reads
#      the marker WITHOUT a lock and `rm -f`s it on a pass. A plain O_APPEND would
#      race that remove: Stop could unlink between this hook's read and its write,
#      dropping the fresh arm onto an unlinked fd (arm silently lost). Instead this
#      hook writes the full new marker to a temp file and os.replace()s it into
#      place under an exclusive flock on a STABLE lock file
#      (.figma-fidelity.pending.lock). The rename is atomic, so:
#        - the lock-free Stop reader never sees a torn or empty marker;
#        - a fresh arm is never lost - if Stop unlinked the marker, the rename
#          recreates it carrying the new token.
#      macOS ships no flock(1), so the lock is taken in python (fcntl.flock); the
#      gate already hard-depends on python3. FULL arm-vs-Stop coordination would
#      have the Stop gate take the same lock before its read+rm; that is a Stop-gate
#      change left to the lead (see the beat). The residual without it is benign:
#      the rename may re-add a just-cleared token, which the manifest still covers.
#
#   4. Idempotence. Under the same exclusive lock the existing tokens are parsed
#      exactly as the gate parses them (strip '#', strip whitespace); the token is
#      written only if absent. The same node pulled twice, by either tool, is one
#      line.
#
#   5. Repo scoping. Arms ONLY in a repo that already participates in the gate
#      (a .figma-fidelity.json / .pending / .measuring exists at the root), so a
#      Figma pull in an unrelated project arms nothing.
#
#   Posture: FAIL-OPEN on the TOOL. Arming is a best-effort SIDE EFFECT. Any
#   failure (bad payload, no nodeId, non-gate repo, unwritable marker, python
#   missing) just skips arming and ALLOWS the Figma call - the hook always exits 0
#   with `{}`. Failing to arm is no worse than today's status quo; blocking a Figma
#   read would be user-hostile. The Stop gate remains the one hard gate. An in-hook
#   tool_name allowlist (exact base-name match, prefix-agnostic) backs up the
#   settings matcher so "ignores other tools" is a property of the hook itself.

INPUT=$(cat)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

HOOK_INPUT="$INPUT" python3 - "$ROOT" 2>/dev/null <<'PYEOF'
import json
import os
import re
import sys
import time
import fcntl
import tempfile


def allow():
    # Arming is a side effect; the Figma tool is ALWAYS allowed. bash prints the
    # allow decision after this process exits, so even a crash here fails open.
    sys.exit(0)


ROOT = sys.argv[1]
raw = os.environ.get("HOOK_INPUT", "")

try:
    data = json.loads(raw)
except Exception:
    allow()
if not isinstance(data, dict):
    allow()

# Defence in depth: arm ONLY on the two proof tools. Match on the EXACT base name
# (the segment after the last "__") so a prefix change - which has bitten sibling
# hooks - does not disarm this one, while an impostor like
# "..__not_get_design_context" is NOT accepted (endswith would wrongly accept it).
tool_name = data.get("tool_name")
if not isinstance(tool_name, str):
    allow()
base = tool_name.rsplit("__", 1)[-1]
if base not in ("get_design_context", "download_assets"):
    allow()

tool_input = data.get("tool_input")
if not isinstance(tool_input, dict):
    allow()

node = tool_input.get("nodeId")
if not isinstance(node, str):
    allow()
# re.ASCII: \d is [0-9] only, so "１２-３４" (fullwidth digits) does not parse as a
# Figma id and simply fails open, matching the gate's own ASCII discipline.
m = re.match(r"^\s*(\d+)[:-](\d+)\s*$", node, re.ASCII)
if not m:
    allow()
token = "%s:%s" % (m.group(1), m.group(2))  # colon form == manifest `node` convention

MARKER = os.path.join(ROOT, ".figma-fidelity.pending")
MANIFEST = os.path.join(ROOT, ".figma-fidelity.json")
MEASURING = os.path.join(ROOT, ".figma-fidelity.measuring")
LOCK = os.path.join(ROOT, ".figma-fidelity.pending.lock")

# Scope: only arm where the fidelity gate is already in use in this repo. Checked
# BEFORE the lock file is created, so an unrelated repo gets nothing at all.
if not (os.path.exists(MANIFEST) or os.path.exists(MARKER) or os.path.exists(MEASURING)):
    allow()

stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
line = ("%s  # armed by figma %s @ %s; cover this node in "
        ".figma-fidelity.json or delete this line to opt out\n"
        % (token, base, stamp))

try:
    lockf = open(LOCK, "a+", encoding="utf-8")  # stable inode; never renamed
except OSError:
    allow()

try:
    # Exclusive lock: serialise the read-check-write against a concurrent arm so
    # the same node is never duplicated and two nodes never interleave.
    fcntl.flock(lockf, fcntl.LOCK_EX)

    existing = ""
    try:
        with open(MARKER, "r", encoding="utf-8") as fh:
            existing = fh.read()
    except OSError:
        existing = ""

    # Idempotence: parse the tokens already present exactly as the gate does.
    present = set()
    for ln in existing.splitlines():
        t = ln.split("#", 1)[0].strip()
        if t:
            present.add(t)

    if token not in present:
        body = existing
        if body and not body.endswith("\n"):
            body += "\n"
        body += line
        # Atomic create-or-replace. Survives a concurrent Stop `rm -f` (the rename
        # recreates the marker with the new token) and is never seen torn/empty by
        # the lock-free Stop reader.
        fd, tmp = tempfile.mkstemp(dir=ROOT, prefix=".figma-fidelity.pending.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                tf.write(body)
            os.replace(tmp, MARKER)
        except OSError:
            try:
                os.unlink(tmp)
            except OSError:
                pass
finally:
    try:
        fcntl.flock(lockf, fcntl.LOCK_UN)
    except OSError:
        pass
    lockf.close()

allow()
PYEOF

# Always allow the Figma tool. Arming ran (or was deliberately skipped) above as a
# best-effort side effect; a python non-zero exit must not reach this decision.
echo '{}'
exit 0
