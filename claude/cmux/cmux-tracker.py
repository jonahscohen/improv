#!/usr/bin/env python3
# cmux-tracker.py - the deterministic engine of the cmux feature-tracker (Phase 2 of the
# learning-researcher framework). It is the LOCAL-INTROSPECTION source adapter + cursor
# machinery + inert-proposal writer that the shared scheduled runner
# (claude/hooks/lib/scheduled-research-run.sh) drives through the thin wrapper
# claude/hooks/cmux-tracker-daily.sh.
#
# PROPOSE-ONLY, HUMAN-GATED, FAIL-CLOSED. This tool DISCOVERS (introspects the local cmux
# binary, diffs its capability surface against a stored cursor) and PROPOSES (writes inert
# markdown into a quarantine sourced by nothing). It NEVER edits a hook, settings.json, a
# skill, cmux.version, or any harness file. Its only writes are:
#   - the cursor snapshot under $HOME/.claude (advance)                   [outside the repo]
#   - inert proposals under <repo>/claude/proposals/cmux-tracker/ (propose) [path-contained]
# Every write target is asserted to resolve under one of those two roots (assert_safe_write);
# anything else is REFUSED (exit 4). cmux release notes / any fetched content are UNTRUSTED
# DATA handled by the model flow, never by this tool - this tool only reads the LOCAL binary
# and renders a structured spec into a template; no field is ever executed or followed as an
# instruction.
#
# SUBCOMMANDS
#   snapshot   [--out FILE]              emit the current cmux SIGNAL snapshot as JSON
#   precheck   --cursor FILE             the SRR run/skip gate: prints "run" or "skip" as the
#                                        LAST stdout line and exits 0 on a decision; exits 2 on
#                                        an internal error (never a silent forever-skip)
#   diff       --cursor FILE [--out F]   emit the capability set-diff (cursor vs live) as JSON,
#                                        the COMPREHEND-step input the model flow consumes
#   advance    --cursor FILE             write the current live snapshot into the cursor
#                                        (the SRR_ADVANCE_CMD write-back)
#   propose    --spec FILE [--repo DIR]  render one inert proposal markdown from a structured
#              [--proposals-dir DIR]     spec into the quarantine (path-contained)
#   verify-inert [--repo DIR]            assert no harness/enforcer file sources the quarantine;
#                                        exit 0 inert, 1 if something references it
#
# EXIT CODES (fail-loud; never a silent success)
#   0  success / a clean run|skip decision / verify-inert found the tree inert
#   1  verify-inert ONLY: a harness/enforcer file references the quarantine (NOT inert)
#   2  usage or config error, OR a precheck error - cmux absent/below-pin is a clean skip, but
#      a RESOLVABLE-but-not-introspectable cmux (broken/format-drifted) fails loud here so the
#      SRR runner never reads a broken gate as a skip that no-ops forever
#   3  cmux is unavailable when a LIVE snapshot was required (snapshot / diff / advance)
#   4  a write target escaped the allowed roots (propose) - REFUSED
#   5  an IO error writing the cursor or a proposal
#
# OVERRIDE SEAM (tests): CMUX_TRACKER_CMUX, when set, is AUTHORITATIVE - it is resolved or
# cmux is treated as absent; resolution never falls through to the real app. Mirrors the
# preflight's CMUX_PREFLIGHT_CMUX and the close-guard's CMUX_CLOSE_GUARD_CMUX seams.

import json
import os
import re
import subprocess
import sys
import tempfile

SCHEMA = "cmux-tracker/1"
HERE = os.path.dirname(os.path.realpath(__file__))
PIN_FILE = os.path.join(HERE, "cmux.version")

# The single relative root every in-repo proposal must land under. Kept as a constant so the
# writer, the containment check, and verify-inert all agree on ONE path.
PROPOSALS_REL = os.path.join("claude", "proposals", "cmux-tracker")

# Harness/enforcer surfaces that must NEVER read the quarantine (the structural-inertness
# guarantee). verify-inert greps these for a reference to the proposals dir; the WRITERS
# (this tool, the flow doc, the dir's own README) are legitimately allowed to name it and are
# not in this set. Mirrors the taste miner's "grep -rn proposed-rules sidecoach/src" proof.
HARNESS_SCAN_DIRS = [
    os.path.join("claude", "hooks"),
    os.path.join("sidecoach", "src"),
    os.path.join("sidecoach", "scripts"),
    os.path.join("sidecoach", "bin"),
]
HARNESS_SCAN_FILES = [
    os.path.join("claude", "settings.json"),
    "install.sh",
]


class CmuxUnavailable(Exception):
    """Raised when the local cmux binary cannot be resolved or introspected."""


class WriteRefused(Exception):
    """Raised when a write target escapes the allowed roots."""


# --------------------------------------------------------------------------- cmux resolution
def resolve_cmux():
    """Resolve the cmux binary the SAME way cmux-preflight.sh does. Returns an absolute path
    or None. CMUX_TRACKER_CMUX is authoritative (resolved or absent; no fall-through)."""
    override = os.environ.get("CMUX_TRACKER_CMUX")
    if override is not None:
        return override if (os.path.isfile(override) and os.access(override, os.X_OK)) else None

    candidates = [
        os.environ.get("CMUX_CLAUDE_HOOK_CMUX_BIN"),
        os.environ.get("CMUX_BUNDLED_CLI_PATH"),
        os.environ.get("CMUX_CLAUDE_TEAMS_CMUX_BIN"),
        _which("cmux"),
        os.path.expanduser("~/.claude/cmux/cmux"),
        "/Applications/cmux.app/Contents/Resources/bin/cmux",
    ]
    for cand in candidates:
        if cand and os.path.isfile(cand) and os.access(cand, os.X_OK):
            return cand
    return None


def _which(name):
    for d in (os.environ.get("PATH") or "").split(os.pathsep):
        if not d:
            continue
        p = os.path.join(d, name)
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def _cmux_run(cmux_bin, args, timeout=15):
    """Run `cmux <args>` read-only, returning stdout. Raises CmuxUnavailable on any failure
    (missing binary, non-zero exit, timeout) so no broken introspection is read as data."""
    try:
        proc = subprocess.run(
            [cmux_bin] + list(args),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CmuxUnavailable("cmux %s failed to run: %s" % (" ".join(args), exc))
    if proc.returncode != 0:
        raise CmuxUnavailable(
            "cmux %s exited %d: %s"
            % (" ".join(args), proc.returncode, proc.stderr.decode("utf-8", "replace").strip())
        )
    return proc.stdout.decode("utf-8", "replace")


# --------------------------------------------------------------------------- signal snapshot
def cmux_version_parts(cmux_bin=None):
    """Just the (cli_version, build, hash) from `cmux version` - the CHEAP part, no capabilities
    call. Lets the pre-check gate on the pin using only the version, so a below-pin cmux is a
    clean skip WITHOUT needing `capabilities` to succeed (Codex review 2026-08-23). Raises
    CmuxUnavailable if the binary is absent or the version is unfetchable/unparseable."""
    cmux_bin = cmux_bin or resolve_cmux()
    if not cmux_bin:
        raise CmuxUnavailable("cmux binary not resolvable")
    ver_raw = _cmux_run(cmux_bin, ["version"]).strip()
    m = re.search(r"(\d+\.\d+\.\d+)(?:\s*\((\d+)\))?(?:\s*\[([0-9a-fA-F]+)\])?", ver_raw)
    if not m:
        raise CmuxUnavailable("could not parse a version from `cmux version`: %r" % ver_raw)
    return m.group(1), m.group(2), m.group(3)


def cmux_signal(cmux_bin=None):
    """Build the STABLE cmux capability SIGNAL from the local binary. The signal is exactly
    the fields whose change means 'this install can now do something different' - version +
    build + hash + sorted capabilities + sorted methods + access_mode + protocol. Volatile
    fields (socket_path, and anything per-launch) are deliberately EXCLUDED so an unchanged
    cmux compares equal across runs. Raises CmuxUnavailable if the binary is absent/broken."""
    cmux_bin = cmux_bin or resolve_cmux()
    if not cmux_bin:
        raise CmuxUnavailable("cmux binary not resolvable")

    cli_version, build, hsh = cmux_version_parts(cmux_bin)
    caps_raw = _cmux_run(cmux_bin, ["capabilities"])
    try:
        caps = json.loads(caps_raw)
    except (ValueError, TypeError) as exc:
        raise CmuxUnavailable("cmux capabilities did not return JSON: %s" % exc)
    if not isinstance(caps, dict):
        raise CmuxUnavailable("cmux capabilities JSON was not an object")

    return {
        "cli_version": cli_version,
        "build": build,
        "hash": hsh,
        "access_mode": caps.get("access_mode"),
        "protocol": caps.get("protocol"),
        "protocol_version": caps.get("version"),
        "capabilities": sorted(str(c) for c in (caps.get("capabilities") or [])),
        "methods": sorted(str(x) for x in (caps.get("methods") or [])),
    }


def current_snapshot():
    """A full snapshot = the compared signal + human metadata. Only `signal` is ever diffed;
    `meta` is informational and never enters an equality test."""
    import datetime

    sig = cmux_signal()
    return {
        "schema": SCHEMA,
        "signal": sig,
        "meta": {
            "captured_utc": datetime.datetime.now(datetime.timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            "capability_count": len(sig["capabilities"]),
            "method_count": len(sig["methods"]),
        },
    }


def _normalize_signal(sig):
    """Canonical form used for equality: sorted arrays + a stable JSON string. Total over a
    malformed cursor (a dict lacking keys still compares, a non-dict becomes '')."""
    if not isinstance(sig, dict):
        return ""
    norm = {
        "cli_version": sig.get("cli_version"),
        "build": sig.get("build"),
        "hash": sig.get("hash"),
        "access_mode": sig.get("access_mode"),
        "protocol": sig.get("protocol"),
        "protocol_version": sig.get("protocol_version"),
        "capabilities": sorted(str(c) for c in (sig.get("capabilities") or [])),
        "methods": sorted(str(x) for x in (sig.get("methods") or [])),
    }
    return json.dumps(norm, sort_keys=True)


def _read_cursor_signal(cursor_path):
    """Return the stored signal dict, or None if the cursor is absent/empty/unparseable
    (all of which the pre-check treats as a first-run 'run')."""
    try:
        with open(cursor_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    if isinstance(data, dict) and isinstance(data.get("signal"), dict):
        return data["signal"]
    return None


def _read_pin():
    """First non-comment MAJOR.MINOR.PATCH from cmux.version, or None if unreadable."""
    try:
        with open(PIN_FILE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.split("#", 1)[0].strip()
                m = re.search(r"\d+\.\d+\.\d+", line)
                if m:
                    return m.group(0)
    except OSError:
        return None
    return None


def _ver_tuple(v):
    parts = (v or "0").split(".")
    out = []
    for i in range(3):
        try:
            out.append(int(parts[i]))
        except (IndexError, ValueError):
            out.append(0)
    return tuple(out)


# --------------------------------------------------------------------------- write guards
def assert_safe_write(target, repo_root, allow_in_repo_rel=None):
    """Containment (the taste-miner assert_safe_write model): a target OUTSIDE the repo is
    allowed (scratch: /tmp, and the ~/.claude cursor - the runner mandates the cursor live
    outside the repo tree). A target INSIDE the repo MUST land under one of allow_in_repo_rel
    (repo-relative dir prefixes, e.g. 'claude/proposals/cmux-tracker') - anything else (src/,
    scripts/, claude/hooks/, config) is REFUSED.

    The check is against the REALPATH'd target's path RELATIVE TO THE REPO, compared to the
    LITERAL allowed prefix - NOT against a realpath'd allowed root. That distinction closes a
    symlink redirect (Codex review): if the quarantine dir were itself a symlink to
    claude/hooks, realpath'ing the allowed root would redefine 'allowed' as claude/hooks and
    let a proposal land there. Resolving the TARGET through symlinks but comparing its real
    in-repo location to the fixed literal prefix means a redirected quarantine fails the check.
    Raises WriteRefused."""
    allow_in_repo_rel = allow_in_repo_rel or []
    real_target = _real_resolve(target)
    real_repo = _real_resolve(repo_root)
    inside_repo = real_target == real_repo or real_target.startswith(real_repo + os.sep)
    if not inside_repo:
        return  # outside the repo (scratch / ~/.claude cursor) - allowed
    rel = os.path.relpath(real_target, real_repo)  # real in-repo location, no '..' (inside)
    for prefix in allow_in_repo_rel:
        prefix = prefix.replace("/", os.sep).rstrip(os.sep)
        if rel == prefix or rel.startswith(prefix + os.sep):
            return
    raise WriteRefused(
        "refusing to write inside the repo outside the allowed prefix(es) (%s): %s resolves to %s"
        % (", ".join(allow_in_repo_rel) or "none", target, rel)
    )


def _real_resolve(path):
    """realpath of the nearest existing ancestor joined with the remaining tail, so a target
    that does not yet exist is still resolved through any symlinked ancestor."""
    path = os.path.abspath(path)
    tail = []
    cur = path
    while not os.path.exists(cur):
        cur, part = os.path.split(cur)
        if not part:
            break
        tail.append(part)
    base = os.path.realpath(cur)
    for part in reversed(tail):
        base = os.path.join(base, part)
    return base


def _atomic_write(target, text, repo_root, allow_in_repo_rel=None):
    """Write text to target atomically (temp in the same dir + rename), after containment."""
    assert_safe_write(target, repo_root, allow_in_repo_rel)
    parent = os.path.dirname(target) or "."
    try:
        os.makedirs(parent, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".cmux-tracker.", dir=parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(text)
            os.replace(tmp, target)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
    except OSError as exc:
        raise IOError("could not write %s: %s" % (target, exc))


def _sanitize_slug(raw):
    """A proposal slug reduced to a safe filename fragment: lowercase [a-z0-9-] only, no
    path separators, no leading/trailing dashes. Prevents any '../' escape via the filename."""
    s = re.sub(r"[^a-z0-9]+", "-", str(raw or "").lower()).strip("-")
    return s or "proposal"


def _sanitize_version(raw):
    """A version fragment for the filename: digits and dots only (strips any path chars)."""
    s = re.sub(r"[^0-9.]+", "", str(raw or ""))
    s = s.strip(".")
    return s or "unversioned"


def _fence_for(text):
    """A code-fence of backticks guaranteed to be longer than any backtick run in text, so an
    embedded ``` in an untrusted excerpt cannot close the fence early (CommonMark closing rule)."""
    longest = 0
    cur = 0
    for ch in str(text):
        if ch == "`":
            cur += 1
            longest = max(longest, cur)
        else:
            cur = 0
    return "`" * max(3, longest + 1)


# --------------------------------------------------------------------------- subcommands
def cmd_snapshot(args):
    out = _arg(args, "--out")
    try:
        snap = current_snapshot()
    except CmuxUnavailable as exc:
        _err("cmux unavailable: %s" % exc)
        return 3
    text = json.dumps(snap, indent=2, sort_keys=True) + "\n"
    if out:
        try:
            _atomic_write(out, text, _repo_root(args))
        except WriteRefused as exc:
            _err(str(exc))
            return 4
        except IOError as exc:
            _err(str(exc))
            return 5
    else:
        sys.stdout.write(text)
    return 0


def cmd_precheck(args):
    """The SRR gate. Prints diagnostics then a final 'run'/'skip' line and exits 0 on a
    decision. cmux absent/old -> skip (clean). Cursor absent or signal changed -> run.
    Any UNEXPECTED failure -> exit 2 (a broken gate must fail loud, never skip forever)."""
    cursor = _arg(args, "--cursor") or os.environ.get("SRR_CURSOR_FILE")
    if not cursor:
        _err("precheck requires --cursor FILE (or SRR_CURSOR_FILE)")
        return 2
    try:
        # cmux absent -> clean skip (nothing to track).
        cmux_bin = resolve_cmux()
        if not cmux_bin:
            print("cmux not resolvable on this machine - clean skip")
            print("skip")
            return 0
        # VERSION FIRST (cheap): a below-pin cmux is a clean skip decided on the VERSION alone,
        # so the pin gate must not depend on `capabilities` succeeding (Codex review
        # 2026-08-23). A version that will not fetch/parse is a broken/drifted gate -> fail loud.
        try:
            cli_version, _b, _h = cmux_version_parts(cmux_bin)
        except CmuxUnavailable as exc:
            _err("cmux `version` is unfetchable/unparseable (%s) - a broken/drifted gate, NOT a "
                 "skip; failing loud so a real cmux format drift is surfaced" % exc)
            return 2
        # cmux present but below the pin -> clean skip (the tracker only tracks a supported
        # cmux; the pin re-verify is a separate manual step). Decided WITHOUT a capabilities call.
        pin = _read_pin()
        if pin and _ver_tuple(cli_version) < _ver_tuple(pin):
            print("cmux %s is below the pin %s - clean skip" % (cli_version, pin))
            print("skip")
            return 0
        # Above pin: now build the FULL signal (incl. capabilities). A `capabilities` failure
        # here is NOT a clean skip - it is a broken or DRIFTED gate, and a cmux output-format
        # drift is exactly the signal this tracker exists to surface, so swallowing it as "skip"
        # would let the job no-op forever on the very change it should catch. FAIL LOUD (exit 2);
        # the runner logs it, leaves the cursor untouched, and retries next pass.
        try:
            sig = cmux_signal(cmux_bin)
        except CmuxUnavailable as exc:
            _err("cmux is resolvable and >= pin but `capabilities` is not introspectable (%s) - "
                 "a broken/drifted gate, NOT a skip; failing loud so a real drift is surfaced" % exc)
            return 2

        stored = _read_cursor_signal(cursor)
        if stored is None:
            print("no cursor at %s (first run) - run" % cursor)
            print("run")
            return 0
        if _normalize_signal(stored) == _normalize_signal(sig):
            print("cmux %s unchanged since last-seen (version+capabilities identical) - skip"
                  % sig["cli_version"])
            print("skip")
            return 0
        print("cmux signal changed since last-seen - run")
        print("run")
        return 0
    except Exception as exc:  # noqa: BLE001 - a broken gate must fail loud (exit 2), not skip
        _err("precheck internal error (treated as a broken gate, NOT a skip): %s" % exc)
        return 2


def cmd_diff(args):
    cursor = _arg(args, "--cursor") or os.environ.get("SRR_CURSOR_FILE")
    out = _arg(args, "--out")
    if not cursor:
        _err("diff requires --cursor FILE (or SRR_CURSOR_FILE)")
        return 2
    try:
        new = cmux_signal()
    except CmuxUnavailable as exc:
        _err("cmux unavailable: %s" % exc)
        return 3
    old = _read_cursor_signal(cursor)
    first_run = old is None
    old = old or {}

    new_caps, old_caps = set(new["capabilities"]), set(old.get("capabilities") or [])
    new_meth, old_meth = set(new["methods"]), set(old.get("methods") or [])
    diff = {
        "schema": "cmux-tracker-diff/1",
        "first_run": first_run,
        "version_from": old.get("cli_version"),
        "version_to": new["cli_version"],
        "build_from": old.get("build"),
        "build_to": new["build"],
        "hash_from": old.get("hash"),
        "hash_to": new["hash"],
        "protocol_version_from": old.get("protocol_version"),
        "protocol_version_to": new["protocol_version"],
        "capabilities": {
            "added": sorted(new_caps - old_caps),
            "removed": sorted(old_caps - new_caps),
        },
        "methods": {
            "added": sorted(new_meth - old_meth),
            "removed": sorted(old_meth - new_meth),
        },
    }
    text = json.dumps(diff, indent=2, sort_keys=True) + "\n"
    if out:
        try:
            _atomic_write(out, text, _repo_root(args))
        except WriteRefused as exc:
            _err(str(exc))
            return 4
        except IOError as exc:
            _err(str(exc))
            return 5
    else:
        sys.stdout.write(text)
    return 0


def cmd_advance(args):
    cursor = _arg(args, "--cursor") or os.environ.get("SRR_CURSOR_FILE")
    if not cursor:
        _err("advance requires --cursor FILE (or SRR_CURSOR_FILE)")
        return 2
    try:
        snap = current_snapshot()
    except CmuxUnavailable as exc:
        _err("cmux unavailable - cannot advance the cursor: %s" % exc)
        return 3
    text = json.dumps(snap, indent=2, sort_keys=True) + "\n"
    # The cursor lives under ~/.claude; advance writes there. Containment allows ~/.claude.
    try:
        _atomic_write(cursor, text, _repo_root(args))
    except WriteRefused as exc:
        _err(str(exc))
        return 4
    except IOError as exc:
        _err(str(exc))
        return 5
    _err("advanced cursor %s to cmux %s (%d caps, %d methods)"
         % (cursor, snap["signal"]["cli_version"], snap["meta"]["capability_count"],
            snap["meta"]["method_count"]))
    return 0


def cmd_propose(args):
    """Render ONE inert proposal markdown from a structured spec into the quarantine. Every
    string field is treated as DATA (rendered into a template, never executed). The target
    filename is sanitized and containment-checked, so a hostile slug/version cannot escape."""
    spec_path = _arg(args, "--spec")
    repo_root = _repo_root(args)
    proposals_dir = _arg(args, "--proposals-dir") or os.path.join(repo_root, PROPOSALS_REL)
    try:
        if spec_path:
            with open(spec_path, "r", encoding="utf-8") as fh:
                spec = json.load(fh)
        else:
            spec = json.load(sys.stdin)
    except (OSError, ValueError) as exc:
        _err("could not read a JSON spec (--spec FILE or stdin): %s" % exc)
        return 2
    if not isinstance(spec, dict):
        _err("proposal spec must be a JSON object")
        return 2

    version = _sanitize_version(spec.get("version"))
    slug = _sanitize_slug(spec.get("slug"))
    filename = "%s-%s.md" % (version, slug)
    target = os.path.join(proposals_dir, filename)

    try:
        text = _render_proposal(spec)
        # A proposal is model-derived (semi-untrusted): if it lands inside the repo it MUST
        # be under the canonical quarantine (the LITERAL repo-relative path, so a symlinked
        # quarantine cannot redirect it), never src/ or a hook dir. Out-of-repo (a /tmp test
        # dir) is allowed as scratch.
        _atomic_write(target, text, repo_root, allow_in_repo_rel=[PROPOSALS_REL])
    except WriteRefused as exc:
        _err(str(exc))
        return 4
    except IOError as exc:
        _err(str(exc))
        return 5
    _err("wrote inert proposal %s" % target)
    print(target)
    return 0


def _render_proposal(spec):
    """Render the proposal template. All values are DATA. Untrusted excerpts (changelog text)
    are placed ONLY inside a fenced UNTRUSTED block for the human - never concatenated into a
    directive an agent acts on."""
    def s(key, default=""):
        v = spec.get(key, default)
        return "" if v is None else str(v)

    def lst(key):
        v = spec.get(key)
        return v if isinstance(v, list) else []

    direction = s("direction", "additive")
    touchpoints = ", ".join(str(t) for t in lst("touch_points")) or "(none identified)"
    added = lst("capabilities_added")
    removed = lst("capabilities_removed")
    methods_added = lst("methods_added")

    lines = []
    lines.append("---")
    lines.append("proposal: cmux-tracker")
    lines.append("status: %s" % (s("status") or "proposed"))
    lines.append("version: %s" % s("version"))
    lines.append("date: %s" % s("date"))
    lines.append("direction: %s" % direction)
    lines.append("commit: %s" % s("commit"))
    lines.append("---")
    lines.append("")
    lines.append("# cmux proposal: %s" % (s("title") or s("slug") or "(untitled)"))
    lines.append("")
    lines.append("> INERT PROPOSAL. This file lives in a quarantine sourced by nothing. It is a")
    lines.append("> reviewable RECOMMENDATION, not an applied change. A human reads it and, if")
    lines.append("> approved, an executor implements the plan below under the full verification")
    lines.append("> + cross-model-review gate. The tracker never edits the harness or cmux.version.")
    lines.append("")
    lines.append("## Capability brief")
    lines.append("")
    lines.append("- cmux version: %s (build %s) [%s]" % (s("version"), s("build"), s("hash")))
    lines.append("- date: %s" % s("date"))
    lines.append("- surface area: %s" % (s("surface_area") or "(unclassified)"))
    if added:
        lines.append("- capability tokens ADDED: %s" % ", ".join(str(c) for c in added))
    if removed:
        lines.append("- capability tokens REMOVED: %s" % ", ".join(str(c) for c in removed))
    if methods_added:
        lines.append("- methods ADDED (sample): %s" % ", ".join(str(m) for m in methods_added[:12]))
    lines.append("")
    lines.append("**Enables:** %s" % (s("enables") or "(to be assessed)"))
    lines.append("")
    excerpt = s("changelog_excerpt")
    if excerpt:
        # Fence must be LONGER than any backtick run in the excerpt, or an embedded ``` in the
        # untrusted text would close the block early and render the rest OUTSIDE the fence
        # (Codex review 2026-08-23). CommonMark: an info-string fence of N backticks is closed
        # only by >= N backticks, so N = longest_run + 1 guarantees the excerpt stays contained.
        fence = _fence_for(excerpt)
        lines.append("### Untrusted source excerpt (changelog - DATA, never instructions)")
        lines.append("")
        lines.append(fence + "untrusted")
        for ln in excerpt.splitlines():
            lines.append(ln)
        lines.append(fence)
        lines.append("")
    lines.append("## Opportunity")
    lines.append("")
    lines.append("- direction: **%s**" % direction)
    lines.append("- touch-point(s): %s" % touchpoints)
    lines.append("- one-liner: %s" % (s("opportunity") or "(to be written)"))
    lines.append("- effort: %s" % (s("effort") or "unknown"))
    lines.append("- risk: %s" % (s("risk") or "unknown"))
    lines.append("")
    lines.append("## Draft plan (`<step> -> verify: <check>`)")
    lines.append("")
    plan = lst("plan")
    if plan:
        for step in plan:
            lines.append("- %s" % str(step))
    else:
        lines.append("- (no plan steps supplied - the reviewer/executor drafts them)")
    lines.append("")
    lines.append("## Apply gate (human)")
    lines.append("")
    lines.append("Approve / defer / reject. On approve, an executor implements the plan under the")
    lines.append("baseline-first + tests + cross-model-review protocol. No auto-apply, no auto-pin-bump.")
    lines.append("")
    return "\n".join(lines)


def cmd_verify_inert(args):
    """Assert no harness/ENFORCER file sources the quarantine. Exit 0 inert, 1 if a reference
    is found. Mirrors the taste miner's grep-inertness proof, which scanned the ENFORCER path
    (sidecoach/src, scripts) and not the miner itself: the tracker's OWN machinery legitimately
    NAMES its quarantine (the wrapper's directive, the tool, the flow doc); the guarantee is
    that nothing ELSE reads it. So the tracker's own writer files are excluded by name."""
    repo_root = _repo_root(args)
    needle = PROPOSALS_REL.replace(os.sep, "/")  # 'claude/proposals/cmux-tracker'
    # The tracker's own writer/orchestrator machinery - allowed to name the quarantine, exactly
    # as the taste miner's own bin/flow were not counted against its inertness proof.
    writer_basenames = {"cmux-tracker.py", "cmux-tracker-daily.sh", "cmux-track-flow.md"}
    hits = []

    def scan_file(path):
        if os.path.basename(path) in writer_basenames:
            return
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh, 1):
                    if needle in line:
                        hits.append("%s:%d: %s" % (os.path.relpath(path, repo_root), i, line.strip()))
        except OSError:
            pass

    for d in HARNESS_SCAN_DIRS:
        base = os.path.join(repo_root, d)
        for root, _dirs, files in os.walk(base):
            if "node_modules" in root or "/.git" in root:
                continue
            for f in files:
                if f.endswith((".sh", ".py", ".js", ".ts", ".json", ".cjs", ".mjs")):
                    scan_file(os.path.join(root, f))
    for f in HARNESS_SCAN_FILES:
        p = os.path.join(repo_root, f)
        if os.path.isfile(p):
            scan_file(p)

    if hits:
        _err("NOT INERT: a harness/enforcer file references the quarantine %s:" % needle)
        for h in hits:
            _err("  " + h)
        return 1
    print("INERT: no harness/enforcer file under %s sources the quarantine %s"
          % (", ".join(HARNESS_SCAN_DIRS + HARNESS_SCAN_FILES), needle))
    return 0


# --------------------------------------------------------------------------- helpers / main
def _arg(args, flag):
    if flag in args:
        i = args.index(flag)
        if i + 1 < len(args):
            return args[i + 1]
    return None


def _repo_root(args):
    """Resolve the repo root: --repo, then SRR_REPO_ROOT, then two levels up from this file
    (claude/cmux/cmux-tracker.py -> repo)."""
    r = _arg(args, "--repo") or os.environ.get("SRR_REPO_ROOT")
    if r:
        return os.path.abspath(r)
    return os.path.realpath(os.path.join(HERE, "..", ".."))


def _err(msg):
    sys.stderr.write("cmux-tracker: %s\n" % msg)


USAGE = """usage: cmux-tracker.py <subcommand> [options]

  snapshot   [--out FILE]              emit the current cmux SIGNAL snapshot JSON
  precheck   --cursor FILE             SRR run/skip gate (prints run|skip, exit 0/2)
  diff       --cursor FILE [--out F]   capability set-diff (cursor vs live) JSON
  advance    --cursor FILE             write the current snapshot into the cursor
  propose    --spec FILE [--repo DIR] [--proposals-dir DIR]   render one inert proposal
  verify-inert [--repo DIR]            assert nothing sources the quarantine (exit 0 inert / 1 not)

exit codes: 0 ok/decision/inert | 1 verify-inert NOT inert | 2 usage or precheck-broke |
            3 cmux unavailable | 4 write refused (containment) | 5 IO error
"""


def main(argv):
    if not argv or argv[0] in ("-h", "--help", "help"):
        sys.stdout.write(USAGE)
        return 0 if (argv and argv[0] in ("-h", "--help", "help")) else 2
    sub, rest = argv[0], argv[1:]
    table = {
        "snapshot": cmd_snapshot,
        "precheck": cmd_precheck,
        "diff": cmd_diff,
        "advance": cmd_advance,
        "propose": cmd_propose,
        "verify-inert": cmd_verify_inert,
    }
    fn = table.get(sub)
    if not fn:
        _err("unknown subcommand: %s" % sub)
        sys.stdout.write(USAGE)
        return 2
    return fn(rest)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
