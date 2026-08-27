#!/bin/bash

# --- per-project sidecoach opt-out (Jonah 2026-08-27) -------------------------
# A repo carrying a `.sidecoach-off` file at its root disables sidecoach hooks for
# that project only. cwd is the project working dir when Claude runs a hook; fall
# back to $PWD outside a git tree. Other projects (no marker) are unaffected.
_sc_off_root="$(git rev-parse --show-toplevel 2>/dev/null || printf %s "$PWD")"
if [ -n "$_sc_off_root" ] && [ -f "$_sc_off_root/.sidecoach-off" ]; then exit 0; fi
# -----------------------------------------------------------------------------
# SessionStart + PostCompact hook: inject PRODUCT.md + DESIGN.md content
# as additionalContext so design constraints are enforced on every prompt,
# not just on prompts that explicitly invoke a sidecoach flow.
#
# Closes OMC research gap #1 (preamble injection).
#
# Behavior:
#   - Reads SESSION_CWD env var, falls back to `cwd` field on stdin, falls
#     back to $(pwd).
#   - Looks for <CWD>/PRODUCT.md and <CWD>/DESIGN.md at the project root.
#   - Each file must exist, be > 200 chars stripped, and NOT contain [TODO]
#     (the existing sidecoach project-setup-gate convention from CLAUDE.md).
#   - Caps each file at 4KB and the combined payload at 8KB, truncating
#     with "...[truncated]" to avoid context bloat.
#   - Defensive on binary files (rejects >1MB or null-byte-heavy content),
#     symlinks (followed via os.path.isfile, which resolves them), and
#     unreadable files (silent skip).
#   - Silent skip = emits {} (no additionalContext, no error).
#   - Idempotent: read-only, no flag files, no state changes.
#
# Wired in SessionStart AND PostCompact so context survives compactions.

# Read stdin (hook payload may include cwd field) without blocking. SessionStart
# hooks generally do supply stdin JSON; PostCompact may not. We tolerate either.
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null || true)
fi

HOOK_INPUT="$INPUT" python3 - <<'PY'
import json
import os
import sys

MAX_PER_FILE = 4 * 1024   # 4KB per file
MAX_TOTAL = 8 * 1024      # 8KB combined payload
MAX_FILE_BYTES_ON_DISK = 1024 * 1024  # reject anything bigger - probably binary

raw = os.environ.get("HOOK_INPUT", "")
cwd_from_stdin = ""
if raw:
    try:
        d = json.loads(raw)
        cwd_from_stdin = (d.get("cwd") or "").strip()
    except Exception:
        cwd_from_stdin = ""

cwd = os.environ.get("SESSION_CWD") or cwd_from_stdin or os.getcwd()
if not cwd or not os.path.isdir(cwd):
    print("{}")
    sys.exit(0)

product_path = os.path.join(cwd, "PRODUCT.md")
design_path = os.path.join(cwd, "DESIGN.md")


def load_valid(path, cap):
    """Return (content, was_truncated) if the file qualifies; else (None, False)."""
    try:
        if not os.path.isfile(path):
            return None, False
        size = os.path.getsize(path)
    except Exception:
        return None, False
    if size <= 0 or size > MAX_FILE_BYTES_ON_DISK:
        return None, False
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except Exception:
        return None, False
    # Defend against binary files masquerading as .md - reject if more than
    # 1% of the bytes are NUL or other low-control characters.
    null_count = content.count("\x00")
    if null_count and (null_count / max(len(content), 1)) > 0.01:
        return None, False
    content = content.replace("\x00", "")
    # Strip UTF-8 BOM if present.
    if content.startswith("﻿"):
        content = content[1:]
    stripped = content.strip()
    if len(stripped) < 200:
        return None, False
    # The sidecoach project-setup gate: a [TODO] marker means the file is
    # still a stub. Treat as missing.
    if "[TODO]" in content:
        return None, False
    truncated = False
    if len(content) > cap:
        content = content[:cap].rstrip() + "\n...[truncated]"
        truncated = True
    return content, truncated


product, _ = load_valid(product_path, MAX_PER_FILE)
design, _ = load_valid(design_path, MAX_PER_FILE)

# Per brief: only fires when SESSION_CWD has BOTH valid files.
if product is None or design is None:
    print("{}")
    sys.exit(0)

preamble = (
    "Project design context loaded from PRODUCT.md + DESIGN.md. Honor the "
    "register, brand personality, design tokens, and anti-references on every "
    "prompt, not just sidecoach flow invocations.\n\n"
    "=== PRODUCT.md ===\n" + product + "\n\n"
    "=== DESIGN.md ===\n" + design
)

# Final total-size cap (defense in depth - the per-file caps already bound
# the body, but the framing string adds ~250 bytes).
if len(preamble) > MAX_TOTAL + 512:
    preamble = preamble[: MAX_TOTAL + 512].rstrip() + "\n...[truncated]"

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": preamble,
    }
}))
PY
