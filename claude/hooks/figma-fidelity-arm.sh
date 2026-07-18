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
#   2. NO OPT-OUT (hardened 2026-07-18, Jonah). Pulling a node's design context IS
#      a commitment to validate it: if you pulled it, you prove it. There is no
#      "delete the line to opt out" - the agent abused exactly that to skip fidelity
#      testing on a node it had built against. The ONLY way to clear an armed node
#      is a covering check in .figma-fidelity.json; the Stop gate then clears the
#      marker itself. The agent is ALSO blocked at the tool level (bash-guard +
#      content-guard) from rm-ing or editing .figma-fidelity.pending, so it cannot
#      remove an armed line. For a REFERENCE-only look that must not arm the gate,
#      use get_screenshot (which does not fire this hook), not get_design_context.
#      (Jonah retains a manual override via direct file edit - he is not gated.)
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
import hashlib
import hmac
import tempfile


def allow():
    # Arming is a side effect; the Figma tool is ALWAYS allowed. bash prints the
    # allow decision after this process exits, so even a crash here fails open.
    sys.exit(0)


# --- Level 2: tamper-evident signed arm ledger -----------------------------
# The .figma-fidelity.pending marker is mutable; a lazy opt-out deletes a line to
# skip a node's pixel validation. In ADDITION to the marker, arming appends a
# signed line to a per-repo hash-chained ledger. The Stop gate verifies the chain
# and requires coverage of every unresolved `arm` - so deleting the marker line
# changes nothing (the ledger still demands the check), editing/forging a ledger
# line breaks its HMAC, and only the gate (which holds the secret) can sign the
# `resolve` that clears a node. Genuine coverage is the only exit. Full rationale:
# decision_2026-07-17_fidelity-gate-level2-tamper-evident-ledger.md.
#
# Same FAIL-OPEN posture as the marker write: any ledger failure just skips the
# ledger step and still allows the Figma tool. The secret lives OUTSIDE any repo.
SECRET_PATH = os.path.expanduser(os.path.join("~", ".claude", ".fidelity-secret"))


def ledger_secret_read():
    """Return the raw secret bytes, or None if absent/empty/unreadable."""
    try:
        with open(SECRET_PATH, "rb") as fh:
            s = fh.read().strip()
        return s or None
    except OSError:
        return None


def ledger_secret_ensure():
    """Generate the secret once (0600, O_EXCL so concurrent arms cannot clobber
    or double-generate). Returns the secret, or None on failure (fail-open)."""
    existing = ledger_secret_read()
    if existing:
        return existing
    import secrets as _secrets

    try:
        os.makedirs(os.path.dirname(SECRET_PATH), exist_ok=True)
        fd = os.open(SECRET_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(fd, _secrets.token_hex(32).encode("ascii"))
        finally:
            os.close(fd)
    except FileExistsError:
        pass  # a concurrent arm created it between our read and our create
    except OSError:
        return None
    return ledger_secret_read()


def ledger_mac(secret, typ, node, ts, prev):
    msg = ("%s|%s|%s|%s" % (typ, node, ts, prev)).encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def head_mac(secret, count, tip):
    # Anchors the ledger's LENGTH and TIP so that truncating the end (deleting the
    # last line, which leaves a still-valid chain prefix) is detectable: the Stop
    # gate recomputes count+tip and compares to this signed anchor. Unforgeable
    # without the secret.
    return hmac.new(
        secret, ("%d|%s" % (count, tip)).encode("utf-8"), hashlib.sha256
    ).hexdigest()


def head_write(head, secret, count, tip):
    """Atomically (re)write the signed head anchor. Best effort."""
    tmp = head + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write("%d|%s|%s\n" % (count, tip, head_mac(secret, count, tip)))
        os.replace(tmp, head)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def head_read(head, secret):
    """Return (count, tip) from a VALID signed head anchor, else None (absent,
    malformed, or HMAC-forged). Verifying needs the secret, which the hook holds."""
    try:
        with open(head, "r", encoding="utf-8") as fh:
            raw = fh.read().strip()
    except OSError:
        return None
    parts = raw.split("|")
    if len(parts) != 3 or not parts[0].isdigit():
        return None
    count, tip, mac = int(parts[0]), parts[1], parts[2]
    if not hmac.compare_digest(head_mac(secret, count, tip), mac):
        return None
    return (count, tip)


def ledger_append(ledger, lock, head, secret, typ, node):
    """Append one signed, chain-linked event under an exclusive lock, then sign the
    head anchor to the NEW length+tip. Idempotent per node+type (a duplicate is a
    no-op). The tip is re-read under the lock so a concurrent append never forks the
    chain. Best effort - any OSError is swallowed, and the Figma tool is allowed
    regardless.

    CONSISTENCY GUARD (this is what makes truncation non-launderable): before doing
    anything, confirm the current ledger matches its signed head. A mismatch means
    the ledger was truncated or edited since the last signing - re-signing here would
    LAUNDER that tamper (an attacker could delete the last line, then trigger any arm
    to get this hook to re-anchor the head to the shortened ledger). So on a mismatch
    we touch NOTHING and leave the discrepancy for the fail-closed Stop gate to catch.
    The head is written ONLY on a genuine append, and only from a consistent base."""
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        lockf = open(lock, "a+", encoding="utf-8")
    except OSError:
        return
    try:
        fcntl.flock(lockf, fcntl.LOCK_EX)
        cur_count = 0
        cur_tip = "genesis"
        latest = None
        try:
            with open(ledger, "r", encoding="utf-8") as fh:
                for ln in fh:
                    ln = ln.strip()
                    if not ln:
                        continue
                    cur_count += 1
                    parts = ln.split("|")
                    cur_tip = parts[-1]
                    if len(parts) >= 2 and parts[1] == node:
                        latest = parts[0]
        except OSError:
            cur_count, cur_tip, latest = 0, "genesis", None

        hv = head_read(head, secret)
        if hv is not None:
            consistent = (hv[0] == cur_count and hv[1] == cur_tip)
        else:
            # No valid head is only legitimate for a brand-new (empty) ledger.
            consistent = (cur_count == 0)
        if not consistent:
            return  # tampered (or a rare mid-write crash) - do not launder it
        if latest == typ:
            return  # duplicate; the head already matches, nothing to do

        mac = ledger_mac(secret, typ, node, ts, cur_tip)
        try:
            with open(ledger, "a", encoding="utf-8") as fh:
                fh.write("%s|%s|%s|%s|%s\n" % (typ, node, ts, cur_tip, mac))
        except OSError:
            return
        head_write(head, secret, cur_count + 1, mac)
    finally:
        try:
            fcntl.flock(lockf, fcntl.LOCK_UN)
        except OSError:
            pass
        lockf.close()


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
LEDGER = os.path.join(ROOT, ".figma-fidelity.ledger")
LEDGER_LOCK = os.path.join(ROOT, ".figma-fidelity.ledger.lock")
LEDGER_HEAD = os.path.join(ROOT, ".figma-fidelity.ledger.head")

# Scope: only arm where the fidelity gate is already in use in this repo. Checked
# BEFORE the lock file is created, so an unrelated repo gets nothing at all.
if not (os.path.exists(MANIFEST) or os.path.exists(MARKER) or os.path.exists(MEASURING)):
    allow()

stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
line = ("%s  # armed by figma %s @ %s; cover this node in "
        ".figma-fidelity.json - a covering check is the ONLY way to clear this. "
        "Opting out (deleting this line) is NOT permitted and is blocked at the "
        "tool level. For a reference-only look, use get_screenshot instead.\n"
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

# Level 2: record the same arm in the tamper-evident signed ledger. Runs after the
# marker write (its own lock, released above) so the two never nest. Best effort:
# any failure here is swallowed and the Figma tool is still allowed. The marker
# already carries the arm; the ledger is the tamper-evident cross-check the Stop
# gate verifies.
try:
    _secret = ledger_secret_ensure()
    if _secret:
        ledger_append(LEDGER, LEDGER_LOCK, LEDGER_HEAD, _secret, "arm", token)
except Exception:
    pass

allow()
PYEOF

# Always allow the Figma tool. Arming ran (or was deliberately skipped) above as a
# best-effort side effect; a python non-zero exit must not reach this decision.
echo '{}'
exit 0
