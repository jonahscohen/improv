#!/bin/bash
# Stop hook: BLOCK ending the turn while a VISUAL change is unverified.
#
# verify-before-done.sh writes "visual" into ~/.claude/.needs-verification when a
# .css/.html/.jsx/etc. file changes, and only a REAL screenshot clears it
# (Chrome computer screenshot / cmux screenshot / Read a .png). curl, navigate,
# and tests do NOT clear a visual flag. This hook is the teeth: it stops the
# assistant from reporting "done" on a visual change it never looked at.
#
# Safety valves (never trap permanently):
#   - stop_hook_active: if we already blocked once this cycle, allow the stop
#     (surface, do not loop forever).
#   - subagent/teammate sessions are exempt.
#   - the user can say "verified" / "looks good" / "bypass verification"
#     (verify-manual.sh clears the flag).

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re, subprocess

# Visual extensions, kept in sync with VISUAL_EXTS in verify-before-done.sh. This set MUST
# stay a SUPERSET of anything that can ARM the visual flag: if the arm side can arm on an
# extension this set does not know, a real visual change would be downgraded below and the
# gate would fail OPEN on it. Widen this set whenever the arm side widens.
VISUAL_EXTS = {".css", ".scss", ".sass", ".less",
               ".html", ".htm", ".ejs", ".hbs", ".pug", ".twig",
               ".vue", ".svelte", ".jsx", ".tsx"}

# Non-app dev/test/scratch DIRECTORIES and test-probe basenames - the SAME notion the arm side
# uses in is_exempt (Jonah 2026-07-26). A visual-extension file that is a DELETION, or lives under
# one of these, renders no product surface and cannot be screenshotted, so it is not "visual
# evidence" and must not keep the gate blocking. _NON_APP_DIR_RE is kept BYTE-IDENTICAL to the copy
# in verify-before-done.sh and bash-guard.sh so the arm site and this re-derivation agree;
# test-verify-visual-gate.sh asserts the three literals match.
_NON_APP_DIR_RE = re.compile(
    r"(^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/")
_TEST_SPEC_RE = re.compile(r"\.(test|spec)\.[A-Za-z0-9]+$")

# Hard bound on how much status output we will reason about. Hitting it means we could not
# fully inspect the tree, which is a doubt, which blocks.
MAX_STATUS_ENTRIES = 20000
GIT_TIMEOUT_SECONDS = 5

def tree_has_visual_evidence(cwd):
    """True if the working tree holds a modified or untracked VISUAL file, OR if we cannot
    tell. This is CORROBORATING evidence for an already-armed visual flag - it can never arm
    anything, and it may only ever withhold a demand when it is certain there is nothing to
    screenshot.

    FAIL CLOSED, without exception. Every uncertainty returns True so the gate keeps
    blocking: no cwd, not a directory, git missing, not a git repo, non-zero exit, a
    timeout, undecodable output, too many entries, or a changed entry that is a DIRECTORY
    (a submodule whose contents we cannot enumerate). The gate is the last line of defence,
    so the only path that returns False is a clean, complete, fully-parsed status listing
    that provably contains no visual file."""
    if not cwd or not os.path.isdir(cwd):
        return True
    try:
        # --untracked-files=all expands untracked DIRECTORIES into their files, so a
        # brand-new component that was never git-added still shows up as a .tsx and still
        # blocks. Plain --porcelain would collapse it to a single "?? newdir/" entry and
        # hide it. --ignore-submodules=none forces dirty submodules to surface regardless
        # of repo config, so the directory check below can block on them.
        p = subprocess.run(
            ["git", "status", "--porcelain", "-z",
             "--untracked-files=all", "--ignore-submodules=none"],
            cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=GIT_TIMEOUT_SECONDS)
    except Exception:
        return True
    if p.returncode != 0:
        return True
    try:
        raw = p.stdout.decode("utf-8", "replace")
    except Exception:
        return True
    # -z gives NUL-terminated records and, unlike the default, never C-quotes or escapes a
    # path - so a filename with a space or a newline cannot split into a wrong extension.
    # A rename emits the new path and the original path as separate records, so scanning
    # every record covers both ends of a move.
    chunks = [c for c in raw.split(chr(0)) if c]
    if len(chunks) > MAX_STATUS_ENTRIES:
        return True
    for c in chunks:
        path = c
        status = ""
        if len(c) > 3 and c[2] == " ":
            status = c[:2]   # the XY porcelain status code
            path = c[3:]     # strip the leading XY status code
        # A DELETION cannot be screenshotted, so it is never visual evidence. Git porcelain marks a
        # delete with "D" in either status column (" D" worktree, "D " staged); a rename is "R" and
        # a copy "C", so this skips only genuine removals and still blocks a real modify/add. This is
        # THE fix for the deleted-.html-fixture false-block that cost manual overrides (Jonah
        # 2026-07-26): the deletion record still carries a .html path the old scan read as visual.
        if "D" in status:
            continue
        # Non-app dev/test/scratch paths (docs/, any fixtures/, eval/, scratchpad/, *.test.*, ...)
        # are not product UI - agree with the arm side and do not treat them as visual evidence.
        if _NON_APP_DIR_RE.search(path) or _TEST_SPEC_RE.search(path):
            continue
        # Check the stripped path AND the raw record: if EITHER looks visual we block.
        for cand in (path, c):
            if os.path.splitext(cand)[1].lower() in VISUAL_EXTS:
                return True
        try:
            if path and os.path.isdir(os.path.join(cwd, path)):
                return True  # submodule or dir entry - cannot see inside, so cannot clear it
        except Exception:
            return True
    return False

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

# Already continued once because of a stop hook - do not block again (no loops).
if d.get("stop_hook_active"):
    print("{}"); sys.exit(0)

# Session-scoped (2026-07-18): block THIS session on ITS own unverified visual debt, not on
# a global flag another concurrent session/project left set. Key derivation matches every
# other reader/writer of the flag so writer and reader always agree on the path.
_sk = re.sub(r"[^A-Za-z0-9._-]", "_", str(d.get("session_id", "") or "")) or "global"
flag = os.path.expanduser("~/.claude/.needs-verification." + _sk)
try:
    content = open(flag).read().strip()
except Exception:
    content = ""

def is_subagent(path):
    if not path:
        return False
    try:
        with open(path) as fh:
            for i, line in enumerate(fh):
                if i > 20:
                    break
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if r.get("isSidechain") is True:
                    return True
                if r.get("teamName"):
                    return True
    except Exception:
        return False
    return False

if content == "visual" and not is_subagent(d.get("transcript_path", "")):
    # Corroborate the armed flag against the working tree before demanding a screenshot.
    # The flag can be armed by a command that only MENTIONED a visual filename (proven
    # undecidable to fix at the arm site - see decision_verify_hook_quoted_mention_arming),
    # and it can outlive a change that was reverted. In either case the tree holds no
    # visual file, so a screenshot of the change literally cannot be taken and the demand
    # is unsatisfiable - it can only be answered by a manual override, which is what it
    # cost the lead session on 2026-07-23. When the tree PROVES there is nothing visual,
    # allow the stop, exactly as a non-visual "code" flag already does. Arming is untouched:
    # this only ever withholds a demand it can prove is impossible, and every doubt blocks.
    if not tree_has_visual_evidence(d.get("cwd", "")):
        print("{}"); sys.exit(0)
    reason = (
        "BLOCKED: a visual file changed and was never visually verified. "
        "Capture a REAL screenshot of the rendered result (Chrome computer "
        "screenshot, cmux browser screenshot, or Playwright then Read the .png) "
        "and examine it before reporting done. curl, navigate, and tests do NOT "
        "count for visual changes. If verification is genuinely impossible, say "
        "so explicitly and ask the user - they can reply verified or looks good "
        "to override."
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)

print("{}")
'
