#!/usr/bin/env python3
"""Re-apply the child_process exec narrowing to the security-guidance plugin hook.

WHY THIS EXISTS
The security-guidance plugin's PreToolUse hook lives in the plugin CACHE
(~/.claude/plugins/cache/...), which is managed by the plugin system and can be
overwritten by a plugin refresh. The fix applied on 2026-07-24 narrows a rule
that otherwise BLOCKS every RegExp string-match call as a shell
command-injection risk. A plugin refresh would silently restore that behavior,
so this script makes the fix reproducible instead of a one-off hand edit.

WHAT IT DOES
Idempotent, and refuses to clobber anything it does not recognize:

  already patched  -> report and exit 0
  known vulnerable -> back up, install the vendored patched copy, exit 0
  unrecognized     -> report and change NOTHING, exit 0

The last case matters: upstream 2.0.6 already fixed this bug on its own, so if
the plugin ever resolves to a newer version this script must stay out of the
way rather than downgrade it.

Run:     python3 claude/hooks/patch-security-guidance-exec.py
Check:   python3 claude/hooks/patch-security-guidance-exec.py --check
Verify:  python3 claude/hooks/test-security-guidance-exec.py
         python3 claude/hooks/test-security-guidance-rules.py
"""

import glob
import os
import py_compile
import re
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
VENDORED = os.path.join(HERE, "vendored", "security_reminder_hook.patched.py")

# Every installed copy of the hook, whichever version the plugin resolved to.
# Overridable so the round-trip can be tested against a throwaway tree.
TARGET_GLOB = os.environ.get("SG_TARGET_GLOB") or os.path.expanduser(
    "~/.claude/plugins/cache/claude-plugins-official/"
    "security-guidance/*/hooks/security_reminder_hook.py"
)

# Markers proving BOTH narrowings are present. A copy counts as patched only
# when it has both, because the two landed as separate passes:
#   1. the child_process exec matcher
#   2. the sibling-rule path gates, of which _DOC_EXTS is the load-bearing one
# Checking only the first would misclassify an exec-only copy as done and skip
# it, leaving the seven substring rules still blocking markdown and prose.
PATCHED_MARKERS = ("_child_process_exec_match", "_DOC_EXTS")

# Signatures of the vulnerable rules, each a bare token sitting in a plain
# substring list. Assembled rather than written literally so this file does
# not trip a substring-matching guard itself. The second catches an exec-only
# copy, whose exec marker is already present but whose siblings are not.
VULNERABLE_MARKER = '"' + "exec" + '(", "' + "execSync" + '("'
VULNERABLE_MARKERS = (
    VULNERABLE_MARKER,
    '"substrings": ["' + "pick" + 'le"]',
)

# The COMPLETE rule set of the known-vulnerable variant.
#
# Why a whole rule set and not just the marker above: this script replaces the
# entire file, so it is only safe when the target is EXACTLY the variant the
# vendored copy descends from. An upstream that still carried the vulnerable
# rule but had ADDED rules would match a marker-only check and be overwritten,
# silently deleting those new rules. That was demonstrated in review against a
# synthetic upstream carrying two extra rules - both were destroyed. Requiring
# an exact rule-set match makes any added, removed, or renamed rule
# disqualifying, which fails safe toward doing nothing.
KNOWN_RULES = frozenset([
    "github_actions_workflow",
    "child_process_exec",
    "new_function_injection",
    "eval_injection",
    "react_dangerously_set_html",
    "document_write_xss",
    "innerHTML_xss",
    "pickle_deserialization",
    "os_system_injection",
])

_RULE_NAME_RE = re.compile(r'"ruleName"\s*:\s*"([A-Za-z0-9_]+)"')

# The revision the hook embeds, so an older patched build is upgradeable.
_PATCH_REV_RE = re.compile(r"^_SG_PATCH_REV\s*=\s*(\d+)", re.M)


def _marker_in_code(text, marker):
    """True when `marker` appears on a line that is not a comment.

    A marker-presence check over the whole file also matched a file that only
    MENTIONS these names in prose - a docstring describing the patch set was
    enough to classify an unpatched copy as patched.
    """
    for line in text.splitlines():
        if marker in line and not line.lstrip().startswith("#"):
            return True
    return False


def _patch_rev(text):
    """The patch-set revision embedded in a copy, or 0 if it predates them."""
    m = _PATCH_REV_RE.search(text)
    return int(m.group(1)) if m else 0


def classify(path, vendored_rev=None):
    """Return one of:

        patched      - carries this patch set at the current revision
        stale        - carries an OLDER revision of it, and can be upgraded
        vulnerable   - a known-vulnerable variant, safe to replace wholesale
        unrecognized - anything else; left strictly alone
        unreadable

    `stale` exists because a marker-presence check could never upgrade this
    script's own earlier output: once a copy contained the markers it was
    reported "already narrowed" forever, so a plugin refresh that restored an
    older patched build would be permanently mistaken for a current one.
    """
    try:
        with open(path, "r", errors="replace") as f:
            text = f.read()
    except (OSError, IOError):
        return "unreadable"
    # Markers must be REAL code, not a mention in a comment or a docstring -
    # otherwise a file that merely discusses this patch set classifies as
    # carrying it.
    if all(_marker_in_code(text, m) for m in PATCHED_MARKERS):
        if vendored_rev is None:
            return "patched"
        return "patched" if _patch_rev(text) >= vendored_rev else "stale"
    if not any(m in text for m in VULNERABLE_MARKERS):
        # Includes upstream 2.0.6, which carries _DOC_EXTS but fixed exec its
        # own way, so it must never be downgraded to the vendored copy.
        return "unrecognized"
    if frozenset(_RULE_NAME_RE.findall(text)) != KNOWN_RULES:
        # Vulnerable, but NOT the variant we can safely replace wholesale.
        return "unrecognized"
    return "vulnerable"


def install(src, dst):
    """Compile-check, then replace atomically.

    py_compile first: installing a syntactically broken hook would break
    editing for every session on this machine. os.replace last: a torn write
    from an interrupted copy would do the same.
    """
    # cfile to a throwaway path: the default writes a __pycache__ next to the
    # vendored source, littering the repo with a build artifact on every run.
    check = "%s.compilecheck.%d" % (dst, os.getpid())
    try:
        py_compile.compile(src, cfile=check, doraise=True)
    finally:
        try:
            os.remove(check)
        except OSError:
            pass

    tmp = "%s.tmp.%d" % (dst, os.getpid())
    try:
        shutil.copy2(src, tmp)
        os.replace(tmp, dst)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def main():
    check_only = "--check" in sys.argv

    if not os.path.exists(VENDORED):
        print("ERROR: vendored patched hook missing at %s" % VENDORED)
        return 1

    targets = sorted(glob.glob(TARGET_GLOB))
    if not targets:
        print("security-guidance plugin hook not installed; nothing to do.")
        return 0

    try:
        with open(VENDORED, "r", errors="replace") as f:
            vendored_rev = _patch_rev(f.read())
    except (OSError, IOError):
        vendored_rev = 0

    changed = vulnerable = 0
    for path in targets:
        version = os.path.basename(os.path.dirname(os.path.dirname(path)))
        state = classify(path, vendored_rev)

        if state == "patched":
            print("  ok          %-10s already narrowed (rev %d)" % (
                version, vendored_rev))
            continue

        if state == "unrecognized":
            # Most likely a newer upstream that fixed this itself. Leave it be.
            print("  skip        %-10s unrecognized version, left untouched" % version)
            continue

        if state == "unreadable":
            print("  warn        %-10s unreadable, left untouched" % version)
            continue

        # Both remaining states install the vendored copy. `stale` is this
        # script's own earlier output, which a marker-only check could never
        # upgrade; `vulnerable` is a known-bad upstream variant.
        vulnerable += 1
        if check_only:
            if state == "stale":
                print("  STALE       %-10s older revision, would be upgraded"
                      % version)
            else:
                print("  VULNERABLE  %-10s would be patched" % version)
            continue

        backup = "%s.bak.%s" % (path, time.strftime("%Y%m%d-%H%M%S"))
        try:
            shutil.copy2(path, backup)
            install(VENDORED, path)
        except (OSError, IOError, py_compile.PyCompileError) as e:
            print("  FAIL        %-10s %s" % (version, e))
            return 1
        changed += 1
        print("  patched     %-10s backup: %s" % (version, os.path.basename(backup)))

    if check_only:
        if vulnerable:
            print("\n%d copy/copies need patching. Run without --check." % vulnerable)
            return 1
        print("\nAll installed copies are safe.")
        return 0

    print("\n%d patched, %d checked." % (changed, len(targets)))
    if changed:
        # BOTH suites: the exec one covers the child_process rule, the rules
        # one covers the seven siblings. Naming only the first left half the
        # patch set unverified after a re-apply.
        for suite in ("test-security-guidance-exec.py",
                      "test-security-guidance-rules.py"):
            print("Verify with: python3 %s" % os.path.join(HERE, suite))
    return 0


if __name__ == "__main__":
    sys.exit(main())
