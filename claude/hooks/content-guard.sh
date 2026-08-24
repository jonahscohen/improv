#!/bin/bash
# PreToolUse hook for Write|Edit|MultiEdit. Blocks file content matching forbidden
# patterns from CLAUDE.md: emojis, emdashes, attribution lines, legacy model IDs.
# Reads hook input JSON from stdin, emits permissionDecision JSON to stdout.

INPUT=$(cat)

# Repo root, derived EXACTLY as figma-fidelity-arm.sh / -stop.sh derive it, so the
# marker path this guard resolves against is the same file those hooks manage.
_FIGMA_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
export FIGMA_MARKER="$_FIGMA_ROOT/.figma-fidelity.pending"

printf '%s' "$INPUT" | python3 -c '
import json, os, sys, re

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
inp  = data.get("tool_input", {})

# Opting out of the Figma-fidelity gate is forbidden: its arming record
# .figma-fidelity.pending may not be created, overwritten, or edited through
# Write/Edit/MultiEdit (bash-guard blocks the shell vectors; this blocks the tool
# vectors). The arm hook and Stop gate write it as hook processes, never these tools.
# Checked BEFORE the content/empty-content exits below so an edit that removes a line
# (new_string empty) is caught too. Cover the node in .figma-fidelity.json instead.
# Hardened 2026-07-18 (Jonah). NO APOSTROPHES in this block (see the note below).
# The match is PATH-equality to OUR marker OR resolved-samefile, never a bare
# basename: a substring/basename check wrongly caught foo.figma-fidelity.pending,
# .figma-fidelity.pending.bak, and a DIFFERENT repo path that merely shares the
# name (/other-repo/.figma-fidelity.pending). Path-equality (normalized, resolved
# against cwd - works whether or not the file exists yet) pins it to the real
# marker; samefile follows symlinks and compares device+inode, so an Edit whose
# file_path is a symlink or hardlink ALIAS of the marker is caught too. Marker
# path comes from the env, derived in bash exactly as the arm/stop hooks derive it.
_marker = os.environ.get("FIGMA_MARKER", "")
_fp = str(inp.get("file_path") or "")
_is_marker = False
if _marker and _fp:
    try:
        _cand = os.path.expanduser(_fp)
        if not os.path.isabs(_cand):
            _cand = os.path.join(os.getcwd(), _cand)
        # realpath (not normpath): macOS /var is a symlink to /private/var, so the
        # bash-derived marker and the cwd-resolved file_path must both be resolved
        # or an equal path compares unequal. Also resolves a symlink alias here.
        _cand = os.path.realpath(_cand)
        _mk = os.path.realpath(os.path.expanduser(_marker))
        if _cand == _mk:
            _is_marker = True
        elif os.path.exists(_cand) and os.path.exists(_marker) and os.path.samefile(_cand, _marker):
            _is_marker = True
    except OSError:
        _is_marker = False
if _is_marker:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: editing .figma-fidelity.pending (or a symlink/hardlink alias of it) is forbidden - opting out of the Figma-fidelity gate is not permitted. Cover the node with a check in .figma-fidelity.json and the Stop gate clears the marker on a pass. For a reference-only look, use get_screenshot."}}))
    sys.exit(0)

# The frontier confirm token (~/.claude/.frontier-confirm) is armed ONLY by the
# user typing confirm (frontier-confirm-arm.sh). Writing it through Write/Edit/
# MultiEdit would forge that confirm and self-lift a frontier-model gate the user
# never approved. Match the token by resolved path or exact basename - never the
# frontier-confirm.sh scripts (their basename ends in .sh). NO APOSTROPHES here.
_ffp = str(inp.get("file_path") or "")
if _ffp:
    try:
        _fc = os.path.expanduser(_ffp)
        if not os.path.isabs(_fc):
            _fc = os.path.join(os.getcwd(), _fc)
        _fc = os.path.realpath(_fc)
        _tok = os.path.realpath(os.path.expanduser(os.environ.get("FRONTIER_CONFIRM_FILE") or "~/.claude/.frontier-confirm"))
        if _fc == _tok or os.path.basename(_ffp) == ".frontier-confirm":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: ~/.claude/.frontier-confirm is the frontier-model confirm token and may not be written through Write/Edit/MultiEdit. Doing so would forge the user confirm and route work onto a frontier model they never approved. Only the user typed confirm may arm it - ask the user and let them confirm."}}))
            sys.exit(0)
    except OSError:
        pass

# The taste-rule promote consent token (~/.claude/.taste-rule-promote-consent) is minted
# ONLY by the user typed TTY confirm in sidecoach-taste-promote (approve). Writing it
# through Write/Edit/MultiEdit would forge that confirm and self-promote a mined taste rule
# into the guidance store the user never approved. Match the token by resolved path or exact
# basename - never the CLI script. Byte-identical fence to the frontier token block above.
# NO APOSTROPHES here.
_tfp = str(inp.get("file_path") or "")
if _tfp:
    try:
        _tc = os.path.expanduser(_tfp)
        if not os.path.isabs(_tc):
            _tc = os.path.join(os.getcwd(), _tc)
        _tc = os.path.realpath(_tc)
        _ttok = os.path.realpath(os.path.expanduser("~/.claude/.taste-rule-promote-consent"))
        if _tc == _ttok or os.path.basename(_tfp) == ".taste-rule-promote-consent":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: ~/.claude/.taste-rule-promote-consent is the taste-rule promotion consent token and may not be written through Write/Edit/MultiEdit. Doing so would forge the user typed approve confirm and self-promote a mined taste rule into the guidance store they never approved. Only the user typed confirm may mint it - ask the user to approve."}}))
            sys.exit(0)
    except OSError:
        pass

# The taste-promotion ledger signing key (~/.claude/.taste-promotion-ledger-secret) is the HMAC
# key for the tamper-evident promotion ledger. Overwriting it through Write/Edit/MultiEdit would
# let an agent install a known key and then forge signed ledger/token entries (a promotion with
# no real human sign-off). Off-limits, same shape as the consent-token block above (bash-guard
# covers the Bash vector). Match by resolved path or exact basename. NO APOSTROPHES here.
_sfp = str(inp.get("file_path") or "")
if _sfp:
    try:
        _sc = os.path.expanduser(_sfp)
        if not os.path.isabs(_sc):
            _sc = os.path.join(os.getcwd(), _sc)
        _sc = os.path.realpath(_sc)
        _stok = os.path.realpath(os.path.expanduser("~/.claude/.taste-promotion-ledger-secret"))
        if _sc == _stok or os.path.basename(_sfp) == ".taste-promotion-ledger-secret":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: ~/.claude/.taste-promotion-ledger-secret is the taste-promotion ledger HMAC signing key and may not be written through Write/Edit/MultiEdit. Overwriting it would let you forge signed promotion-ledger entries and self-bless a mined rule. sidecoach-taste-promote signs the ledger itself; you never need to touch this file."}}))
            sys.exit(0)
    except OSError:
        pass

# The taste-rule ENFORCE consent token (~/.claude/.taste-rule-enforce-consent) is minted ONLY by the
# user typed REPL confirm (sidecoach-taste-enforce-arm.sh). Writing it through Write/Edit/MultiEdit
# would forge that confirm and self-flip a mined taste rule into a BUILD-BLOCKING detector the user
# never approved. Match by resolved path or exact basename - never the CLI script. Byte-identical
# fence to the promote consent-token block above. NO APOSTROPHES here.
_efp = str(inp.get("file_path") or "")
if _efp:
    try:
        _ec = os.path.expanduser(_efp)
        if not os.path.isabs(_ec):
            _ec = os.path.join(os.getcwd(), _ec)
        _ec = os.path.realpath(_ec)
        _etok = os.path.realpath(os.path.expanduser("~/.claude/.taste-rule-enforce-consent"))
        if _ec == _etok or os.path.basename(_efp) == ".taste-rule-enforce-consent":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: ~/.claude/.taste-rule-enforce-consent is the taste-rule ENFORCE consent token and may not be written through Write/Edit/MultiEdit. Doing so would forge the user typed enforce-confirm and self-flip a mined taste rule into a build-blocking detector they never approved. Only the user typed confirm may mint it - ask the user to sign off."}}))
            sys.exit(0)
    except OSError:
        pass

# The taste-ENFORCE ledger signing key (~/.claude/.taste-enforce-ledger-secret) is the HMAC key for
# the tamper-evident ENFORCEMENT ledger (distinct from the promotion secret). Overwriting it through
# Write/Edit/MultiEdit would let an agent install a known key and forge signed enforcement-ledger
# entries (a blocking rule with no real human sign-off). Off-limits, same shape as the promote
# secret block above (bash-guard covers the Bash vector). Match by resolved path or basename. NO
# APOSTROPHES here.
_esp = str(inp.get("file_path") or "")
if _esp:
    try:
        _esc = os.path.expanduser(_esp)
        if not os.path.isabs(_esc):
            _esc = os.path.join(os.getcwd(), _esc)
        _esc = os.path.realpath(_esc)
        _estok = os.path.realpath(os.path.expanduser("~/.claude/.taste-enforce-ledger-secret"))
        if _esc == _estok or os.path.basename(_esp) == ".taste-enforce-ledger-secret":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: ~/.claude/.taste-enforce-ledger-secret is the taste-ENFORCEMENT ledger HMAC signing key and may not be written through Write/Edit/MultiEdit. Overwriting it would let you forge signed enforcement-ledger entries and self-enforce a mined rule to blocking. sidecoach-taste-enforce signs the ledger itself; you never need to touch this file."}}))
            sys.exit(0)
    except OSError:
        pass

if tool == "Write":
    content = inp.get("content", "")
elif tool == "Edit":
    content = inp.get("new_string", "")
elif tool == "MultiEdit":
    edits = inp.get("edits", []) or []
    content = "\n".join((e or {}).get("new_string", "") for e in edits)
else:
    print("{}"); sys.exit(0)

if not content:
    print("{}"); sys.exit(0)


reason = None

for needle, msg in [
    ("Co-Authored-By",        "Co-Authored-By attribution forbidden by CLAUDE.md"),
    ("Generated with Claude", "Claude attribution forbidden by CLAUDE.md"),
    ("Generated by Claude",   "Claude attribution forbidden by CLAUDE.md"),
]:
    if needle in content:
        reason = msg; break

if not reason and ("\u2014" in content or "\u2013" in content):
    reason = "Emdash/endash forbidden by CLAUDE.md - use hyphens or rewrite"

if not reason:
    if re.search(r"gpt-4o(?!-mini-tts)|gpt-4\.1|gpt-3\.5|gpt-4(?![o\.\-\d])|claude-3-(opus|sonnet|haiku)", content):
        reason = "Legacy model ID forbidden by CLAUDE.md - use latest model versions only"

if not reason:
    # A masked credential echo that still shows a tail IS a credential fragment. On
    # 2026-07-29 exactly four characters of a live key reached a commit that way: a test
    # fixture copied a provider 401 response verbatim, mask and all, and the mask left the
    # last four characters intact. The sweep meant to catch it classified the hit on its
    # SHAPE - masked, sitting in a test file - and never asked whether the visible part was
    # real. Prose and human judgment did not catch it; a mechanical check on content does.
    # (Adversary pass, Jonah 2026-07-29; purged in 5fcfdcee.)
    #
    # This gate cannot know whether a tail is real without reading live credentials, which
    # it deliberately never does. So it enforces the QUESTION rather than the answer: a
    # write carrying a masked key with a surviving tail must also SAY where that tail came
    # from. Either attestation passes - that the tail is synthetic, or that it was real and
    # this file is the incident record - because both mean the author engaged with
    # provenance. Silence is what gets blocked, and silence is what shipped the fragment.
    #
    # Anchored on a real key PREFIX, which is what makes it precise rather than noisy.
    # Measured across every tracked file in this repo: prefix-anchored hits 4 times and all
    # 4 are genuine masked-key literals; the same pattern without the prefix hits 17 times,
    # 13 of them CSS comment banners in captured HTML corpus files.
    #
    # The attestation is looked for in the edited span AND in the file already on disk,
    # because an Edit hands this hook only new_string - a one-line change to a fixture
    # whose comment block sits ten lines above would otherwise be denied for a statement
    # that is already there.
    #
    # The deny message deliberately quotes NOTHING from the match. If the tail were real,
    # echoing it would put the fragment into the transcript, which is the leak this exists
    # to prevent. The mask class carries a literal bullet and middle dot alongside the
    # asterisk forms, because providers mask with all three; both are text-presentation
    # symbols that this guard permits, so the file still passes its own emoji check.
    _mask = re.search(
        r"(sk-[A-Za-z0-9-]*|AIza[A-Za-z0-9]*|AQ\.[A-Za-z0-9]*|ghp_|xox[bap]-|gsk_)"
        r"[*x•·#]{6,}[A-Za-z0-9]{3,8}", content)
    if _mask:
        _ctx = content
        _fp2 = str(inp.get("file_path") or "")
        if _fp2 and os.path.isfile(_fp2):
            try:
                with open(_fp2, encoding="utf8", errors="ignore") as _fh:
                    _ctx = _ctx + chr(10) + _fh.read()
            except OSError:
                pass
        if not re.search(r"synthetic|not invented|is not a real|was the real|fake tail|"
                         r"dummy tail|placeholder|must stay that way", _ctx, re.IGNORECASE):
            reason = ("A masked credential literal here keeps a visible tail, and nothing in "
                      "this file says where that tail came from. A mask that preserves a tail "
                      "preserves a credential fragment - four characters of a live key were "
                      "committed this way on 2026-07-29, in the very test written to prove "
                      "tails do not leak. Replace the tail with an obviously invented one and "
                      "state in the file that it is synthetic. If you are recording the "
                      "incident rather than writing a fixture, say that the tail was real. "
                      "Never copy a masked echo out of a provider response verbatim.")

if not reason:
    # Retired names are banned from markdown (docs + beats) per Jonah 2026-07-03:
    # canonical vocabulary is "tactical-polish" and "sidecoach"; the retired
    # names (the old skill name, its shorthand, and the pre-rename orchestrator
    # name) may not appear. The pattern is base64-encoded ON PURPOSE: the
    # banned words must not be greppable anywhere in the repo, including inside
    # this guard (Jonah 2026-07-03). Decode the blob to audit it. Scoped to .md
    # so code identifiers and captured corpus files are unaffected.
    # NOTE: this whole python program lives inside a bash SINGLE-QUOTED string;
    # a lone apostrophe anywhere in it (comments included) breaks the guard and
    # with it every Write/Edit on the machine. No apostrophes. Ever.
    fp = str(inp.get("file_path") or "")
    if fp.lower().endswith(".md"):
        import base64
        _banned = base64.b64decode(
            "XGJtaWZiXGJ8XGJpbXBlY2NhYmxlXGJ8XGJtYWtlLWludGVyZmFjZXMtZmVlbC1iZXR0ZXJcYnxcYmZlZWxiZXR0ZXJcYg=="
        ).decode()
        m = re.search(_banned, content, re.IGNORECASE)
        if m:
            reason = ("Retired name %r forbidden in markdown (Jonah 2026-07-03) - "
                      "use the canonical skill name or sidecoach" % m.group(0))

if not reason:
    # Emoji detection by EMOJI-PRESENTATION, not by Unicode block. Terminal
    # typography is allowed - check (U+2713), ballot-x (U+2717), stars, arrows,
    # box-drawing, geometric shapes, dingbat asterisks - because these are
    # text-presentation symbols, not emoji. A character is treated as emoji only
    # when it is genuinely a color pictograph:
    #   - the supplementary emoji planes (U+1F000..U+1FAFF);
    #   - it carries a Variation-Selector-16 (U+FE0F) or combining keycap
    #     (U+20E3) - these force/define emoji presentation (warning+VS16, etc.);
    #   - it is one of the BMP code points that are color-emoji BY DEFAULT
    #     (Unicode Emoji_Presentation=Yes), enumerated below.
    # Everything else passes. KEEP IN SYNC with content-guard-stop.sh.
    _EMOJI_PRES = (
        (0x231A, 0x231B), (0x23E9, 0x23EC), (0x23F0, 0x23F0), (0x23F3, 0x23F3),
        (0x25FD, 0x25FE), (0x2614, 0x2615), (0x2648, 0x2653), (0x267F, 0x267F),
        (0x2693, 0x2693), (0x26A1, 0x26A1), (0x26AA, 0x26AB), (0x26BD, 0x26BE),
        (0x26C4, 0x26C5), (0x26CE, 0x26CE), (0x26D4, 0x26D4), (0x26EA, 0x26EA),
        (0x26F2, 0x26F3), (0x26F5, 0x26F5), (0x26FA, 0x26FA), (0x26FD, 0x26FD),
        (0x2705, 0x2705), (0x270A, 0x270B), (0x2728, 0x2728), (0x274C, 0x274C),
        (0x274E, 0x274E), (0x2753, 0x2755), (0x2757, 0x2757), (0x2795, 0x2797),
        (0x27B0, 0x27B0), (0x27BF, 0x27BF), (0x2B1B, 0x2B1C), (0x2B50, 0x2B50),
        (0x2B55, 0x2B55),
    )
    def _emoji(s):
        for ch in s:
            cp = ord(ch)
            if cp == 0xFE0F or cp == 0x20E3:        # VS16 / combining keycap -> emoji
                return ch
            if 0x1F000 <= cp <= 0x1FAFF:            # supplementary emoji planes
                return ch
            for lo, hi in _EMOJI_PRES:
                if lo <= cp <= hi:
                    return ch
        return None
    bad = _emoji(content)
    if bad:
        reason = "Emoji (" + repr(bad) + ") forbidden by CLAUDE.md"

if reason:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "BLOCKED: " + reason
        }
    }))
else:
    print("{}")
'
