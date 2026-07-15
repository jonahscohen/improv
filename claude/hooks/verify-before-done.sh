#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit|Bash.
# GLOBAL verification enforcement.
#
# Any code file change sets ~/.claude/.needs-verification.
# Only actual verification clears it:
#   - cmux browser screenshot/snapshot commands (Bash)
#   - Chrome MCP tool calls (cleared by separate PostToolUse matcher)
#   - curl to localhost (Bash)
#   - Read tool on a .png/.jpg image (UI verification)
#   - Test command runs: npm test, jest, vitest, mocha, pytest, go test, cargo test (Bash)
#   - Node test/probe scripts: `node -e ...`, `node ./test*.js`, `node ./probe*.js` (Bash)
#   - External curl/wget probes with port or path indicating verification intent (Bash)
#   - Read of stdout-capture files in /tmp/ (test logs, probe output, *-server.log)
#
# Server-only code (e.g. ws-server.ts) has no UI to screenshot; these patterns
# give server work an honest verification off-ramp instead of forcing screenshot theatre.
#
# bash-guard.sh blocks git commit when the flag is set.
# This hook's additionalContext reminds the assistant to verify.

VERIFY_FLAG="$HOME/.claude/.needs-verification"

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os, time, re

# Debounce window: skip nudge text if a screenshot Read happened within this many seconds.
# Flag-setting is unaffected; only the additionalContext string is suppressed.
DEBOUNCE_SECONDS = 30

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
transcript_path = data.get("transcript_path", "")
verify_flag = os.path.expanduser("~/.claude/.needs-verification")
last_screenshot_read = os.path.expanduser("~/.claude/.last-screenshot-read")

def is_subagent_context(path):
    """True if this session is a sidechain subagent or a named teammate.
    Signals come from the transcript JSONL:
      - any record with isSidechain == True  -> Agent-tool spawned sidechain
      - any record carrying a teamName field -> cmux-teams teammate
    The parent session sets neither, so the absence of both means we are
    in the top-level session and the nudge should fire normally."""
    if not path:
        return False
    try:
        with open(path) as fh:
            for i, line in enumerate(fh):
                if i > 20:  # only the header + first few records carry these
                    break
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                if d.get("isSidechain") is True:
                    return True
                if d.get("teamName"):
                    return True
    except (FileNotFoundError, OSError):
        return False
    return False

IS_SUBAGENT = is_subagent_context(transcript_path)

def recently_verified():
    """True if a screenshot Read happened within DEBOUNCE_SECONDS."""
    try:
        mtime = os.path.getmtime(last_screenshot_read)
    except (FileNotFoundError, OSError):
        return False
    return (time.time() - mtime) < DEBOUNCE_SECONDS

def touch_last_screenshot_read():
    try:
        with open(last_screenshot_read, "a"):
            pass
        os.utime(last_screenshot_read, None)
    except Exception:
        pass

# Code file extensions that require verification after change.
# NOTE: data/config files (.json, .yaml, .toml, .md, .txt) are intentionally OUT of
# this set - a package.json / tsconfig / config write is not itself a visual change,
# so it does not arm the screenshot gate. If such a write changes rendered UI, the
# accompanying source-file edit (or the build command) arms it.
CODE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
    ".css", ".scss", ".sass", ".less",
    ".html", ".htm", ".ejs", ".hbs", ".pug",
    ".php", ".twig",
    ".py", ".rb", ".go", ".rs", ".java",
    ".sh", ".zsh", ".bash"
}

# Visual files render UI - a change to one demands a REAL screenshot, never a
# curl/test/log off-ramp. Subset of CODE_EXTS. (Defined ahead of the exemption logic
# because the hook-dir exemption below is scoped to NON-visual files.)
VISUAL_EXTS = {
    ".css", ".scss", ".sass", ".less",
    ".html", ".htm", ".ejs", ".hbs", ".pug", ".twig",
    ".vue", ".svelte", ".jsx", ".tsx",
}

# Paths exempt from verification requirement. Everything under a `/eval/` dir is
# detector TEST INPUTS / harness data (Sidecoach Phase 2 scanner corpus + migration
# harness: planted-defect / known-good / candidate / golden-fixture HTML+CSS that the
# scanner READS) - NOT shipped UI, so screenshotting them is meaningless and they must
# not trip the visual-verify gate. Also `__fixtures__` / `test-fixtures` anywhere.
# (added 2026-06-23; Jonah, Sidecoach reimplement-and-own eval; broadened from the
# per-subdir list after migration-harness/inputs/ slipped through.)
EXEMPT_PATHS = [".claude/memory/", "MEMORY.md", ".claude/skills/",
                "/eval/", "/__fixtures__/", "/test-fixtures/"]

# The hook directory, matched as a real path SEGMENT in any of its shapes: the dotfiles
# DEPLOY dir `.claude/hooks/`, the repo SOURCE dir `claude/hooks/`, and any worktree path
# ending in `.../claude/hooks/`. Anchored to a `/` or start (with an optional leading dot)
# so it exempts a genuine hook dir but NOT a UI path that merely embeds the letters - e.g.
# `src/myclaude/hooks/App.tsx` stays ARMED. Editing a shell hook is not a rendered-UI
# change and has nothing to screenshot (U7b issue 3: a worktree edit to claude/hooks/*.sh
# falsely armed CODE FILE CHANGED because only the dot-prefixed deploy dir was exempt).
_HOOK_DIR_RE = re.compile(r"(^|/)\.?claude/hooks/")

def is_exempt(path):
    if any(exempt in path for exempt in EXEMPT_PATHS):
        return True
    # A file under a claude/hooks/ segment is exempt only if it is NOT a VISUAL file.
    # Hook scripts (.sh/.py/.ts/...) have no UI to screenshot, but a VISUAL file that
    # merely lives under such a path - a contrived `src/claude/hooks/App.tsx` or
    # `vendor/claude/hooks/theme.css` - IS renderable and must still arm the gate
    # (Codex U7b review: the segment anchor alone was still too broad for real UI files).
    if _HOOK_DIR_RE.search(path):
        _, ext = os.path.splitext(path)
        if ext.lower() not in VISUAL_EXTS:
            return True
    return False

def is_code_file(path):
    if not path:
        return False
    if is_exempt(path):
        return False
    _, ext = os.path.splitext(path)
    return ext.lower() in CODE_EXTS

def is_visual_file(path):
    if not path:
        return False
    if is_exempt(path):
        return False
    _, ext = os.path.splitext(path)
    return ext.lower() in VISUAL_EXTS

def flag_content():
    try:
        return open(verify_flag).read().strip()
    except Exception:
        return None

def set_flag(kind):
    # kind is "visual" or "code". Never downgrade an existing visual flag to code.
    if flag_content() == "visual" and kind != "visual":
        return
    try:
        with open(verify_flag, "w") as fh:
            fh.write(kind)
    except Exception:
        pass

def is_visual_verification_command(cmd):
    """Real VISUAL verification from the terminal: a cmux browser screenshot or
    snapshot. Clears ANY pending flag, including a visual one."""
    return "cmux browser" in cmd and ("screenshot" in cmd or "snapshot" in cmd)

def is_verification_command(cmd):
    """LOGIC/content verification (NOT visual): curl-localhost, test runners,
    HTTP probes. Clears the flag only when the pending change is not visual."""
    import re
    if "curl " in cmd and ("localhost" in cmd or "127.0.0.1" in cmd):
        return True
    # --- Test runners ---
    test_runners = [
        "npm test", "npm run test", "yarn test", "pnpm test",
        "npx vitest", "npx jest", "npx mocha", "npx playwright test",
        "vitest", "jest", "mocha",
        "pytest", "python -m pytest", "python3 -m pytest", "python -m unittest",
        "go test", "cargo test", "rspec", "rake test",
        "bun test", "deno test",
    ]
    for runner in test_runners:
        # Match as a token (start of cmd, after &&/||/;/|, or after a space)
        if re.search(r"(^|[\s;&|]+)" + re.escape(runner) + r"(\s|$)", cmd):
            return True
    # --- Node test/probe scripts (heuristic: not the dev server) ---
    # Allow `node -e ...`, `node ./test*.js`, `node ./probe*.js`, `node test-*.mjs`, etc.
    # Exclude dev-server invocations: `node server`, `node ./server`, `next dev`, `nodemon`, `tsx watch`.
    if re.search(r"(^|[\s;&|]+)node\s", cmd):
        dev_server_markers = ["node server", "node ./server", "node src/server",
                              "node dist/server", "node build/server"]
        is_dev_server = any(m in cmd for m in dev_server_markers)
        if not is_dev_server:
            # node -e (inline eval) OR node ./test*/probe* file
            if re.search(r"node\s+-e\s", cmd):
                return True
            if re.search(r"node\s+\S*(test|probe|check|verify|spec)", cmd, re.IGNORECASE):
                return True
    # --- External curl/wget probes (non-localhost) with port or path ---
    # Intent signal: a port (:NNNN) or path (/something) means probing a specific endpoint.
    if re.search(r"(^|[\s;&|]+)(curl|wget)\s", cmd):
        # Already handled localhost above. For non-localhost: require a port or path.
        if "localhost" not in cmd and "127.0.0.1" not in cmd:
            # Look for :PORT or http(s)://host/path (avoid literal single-quote
            # in this string - the whole python block is single-quoted in bash).
            sq = chr(39)
            if re.search(r":\d{2,5}(/|\s|\"|" + sq + r"|$)", cmd):
                return True
            if re.search(r"https?://[^\s\"" + sq + r"]+/[^\s\"" + sq + r"]+", cmd):
                return True
    return False

def is_read_only_command(cmd):
    """Skip read-only commands."""
    read_only = [
        "ls", "cat", "head", "tail", "grep", "find", "echo", "pwd",
        "git status", "git log", "git diff", "git show", "git branch",
        "wc ", "diff ", "readlink", "which", "type ", "file ",
        "md5", "shasum", "stat ", "for f in"
    ]
    return any(cmd.strip().startswith(r) for r in read_only)

def is_verification_only(cmd):
    """Commands that are clearly verification-only operations.

    These should NEVER fire the screenshot mandate, even if they contain
    substrings like `npx ` or `make ` that also appear in real deploy
    paths. The hook previously over-fired on `npx ts-node ./foo.test.ts`,
    `npx tsc --noEmit`, `npx eslint`, `npx prettier --check`,
    `npx @google/design.md lint`, `npm run bench`, and similar - because
    `npx ` was a literal substring in `write_indicators`.

    Distinct from `is_verification_command` (which CLEARS the verify flag
    because tests/curl-localhost count as visual verification). This
    function just means "skip the mandate - this is not a deploy."

    Returns True if ANY segment of the command (split on `;`, `&&`, `||`,
    `|`) matches a verification-only pattern. Returns False if any segment
    looks like a deploy/build/dev-server start - those still need a
    screenshot.

    Negative-side carve-out: `npm run build`, `npm run deploy`, `npm start`,
    `npm run dev`, `npm run serve`, `vite build`, `next build` MUST still
    fire the mandate even when chained after a verification-only command.
    """
    import re

    s = cmd.strip()
    if not s:
        return False

    # Deploy/build/dev-server markers - if ANY of these are present, this
    # is NOT verification-only regardless of any test-like prefix that
    # might also appear in the same compound command.
    deploy_patterns = [
        r"(^|[\s;&|]+)npm\s+run\s+build(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+deploy(\s|$)",
        r"(^|[\s;&|]+)npm\s+start(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+start(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+dev(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+serve(\s|$)",
        r"(^|[\s;&|]+)yarn\s+(build|deploy|start|dev|serve)(\s|$)",
        r"(^|[\s;&|]+)pnpm\s+(build|deploy|start|dev|serve)(\s|$)",
        r"(^|[\s;&|]+)vite\s+build(\s|$)",
        r"(^|[\s;&|]+)next\s+build(\s|$)",
        r"(^|[\s;&|]+)next\s+start(\s|$)",
        r"(^|[\s;&|]+)next\s+dev(\s|$)",
        r"(^|[\s;&|]+)nodemon(\s|$)",
        r"(^|[\s;&|]+)tsx\s+watch(\s|$)",
        r"(^|[\s;&|]+)webpack(\s|$)",
        r"(^|[\s;&|]+)rollup(\s|$)",
        r"(^|[\s;&|]+)esbuild(\s|$)",
    ]
    for p in deploy_patterns:
        if re.search(p, s):
            return False

    # Verification-only patterns. Token-anchored (start of cmd, or after
    # a shell separator) so embedded prose / quoted args do not trigger.
    vp = [
        # --- Test runners (some also in is_verification_command - that
        # is fine; this branch just suppresses the mandate without
        # claiming the verification was visual).
        r"(^|[\s;&|]+)npm\s+test(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+test(:|\s|$)",
        r"(^|[\s;&|]+)yarn\s+test(\s|$)",
        r"(^|[\s;&|]+)pnpm\s+test(\s|$)",
        r"(^|[\s;&|]+)npx\s+vitest(\s|$)",
        r"(^|[\s;&|]+)npx\s+jest(\s|$)",
        r"(^|[\s;&|]+)npx\s+mocha(\s|$)",
        r"(^|[\s;&|]+)npx\s+playwright\s+test",
        r"(^|[\s;&|]+)vitest(\s|$)",
        r"(^|[\s;&|]+)jest(\s|$)",
        r"(^|[\s;&|]+)mocha(\s|$)",
        # ts-node / tsx running a test or probe file
        r"(^|[\s;&|]+)npx\s+ts-node\s+\S*(test|spec|probe|check|verify)",
        r"(^|[\s;&|]+)npx\s+tsx\s+\S*(test|spec|probe|check|verify)",
        r"(^|[\s;&|]+)ts-node\s+\S*(test|spec|probe|check|verify)",
        # any node invocation pointing at a test/spec file
        r"(^|[\s;&|]+)node\s+\S+\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)",
        # bash test scripts (hook tests, custom test runners)
        r"(^|[\s;&|]+)bash\s+\S*test-[^\s]+\.sh",
        r"(^|[\s;&|]+)bash\s+\S*test[^\s]*\.sh",
        # Cross-language test runners
        r"(^|[\s;&|]+)cargo\s+test(\s|$)",
        r"(^|[\s;&|]+)pytest(\s|$)",
        r"(^|[\s;&|]+)python3?\s+-m\s+pytest",
        r"(^|[\s;&|]+)python3?\s+-m\s+unittest",
        r"(^|[\s;&|]+)go\s+test(\s|$)",
        r"(^|[\s;&|]+)bun\s+test(\s|$)",
        r"(^|[\s;&|]+)deno\s+test(\s|$)",
        r"(^|[\s;&|]+)rspec(\s|$)",
        r"(^|[\s;&|]+)rake\s+test(\s|$)",

        # --- Type checks ---
        r"(^|[\s;&|]+)npx\s+tsc(\s|$)",
        r"(^|[\s;&|]+)tsc(\s|$)",
        r"--noEmit(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+typecheck(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+type-check(\s|$)",
        r"(^|[\s;&|]+)npm\s+run\s+check(\s|$)",

        # --- Lint / format-check runs ---
        r"(^|[\s;&|]+)npm\s+run\s+lint(\s|$)",
        r"(^|[\s;&|]+)npx\s+eslint(\s|$)",
        r"(^|[\s;&|]+)eslint(\s|$)",
        r"(^|[\s;&|]+)npx\s+prettier\s+--(check|list-different)",
        r"(^|[\s;&|]+)prettier\s+--(check|list-different)",
        r"(^|[\s;&|]+)npx\s+@google/design\.md\s+lint",
        r"(^|[\s;&|]+)npx\s+stylelint(\s|$)",

        # --- Benchmark runs ---
        r"(^|[\s;&|]+)npm\s+run\s+bench(:|\s|$)",
        r"(^|[\s;&|]+)yarn\s+bench(:|\s|$)",
        r"(^|[\s;&|]+)pnpm\s+bench(:|\s|$)",

        # --- Pure introspection (chain-aware, extends is_read_only_command) ---
        r"(^|[\s;&|]+)git\s+status(\s|$)",
        r"(^|[\s;&|]+)git\s+log(\s|$)",
        r"(^|[\s;&|]+)git\s+diff(\s|$)",
        r"(^|[\s;&|]+)git\s+show(\s|$)",
        r"(^|[\s;&|]+)git\s+branch(\s|$)",
    ]
    for p in vp:
        if re.search(p, s):
            return True

    return False

# --- Handle Read tool: reading a screenshot OR a /tmp/ stdout-capture clears verification ---
if tool == "Read":
    file_path = data.get("tool_input", {}).get("file_path", "")
    img_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    _, ext = os.path.splitext(file_path)
    cleared = False
    if ext.lower() in img_exts:
        cleared = True
    # /tmp/ stdout-capture files: test logs, probe output, server logs.
    # LOGIC proof only - these do NOT clear a visual-pending flag.
    elif (file_path.startswith("/tmp/") or file_path.startswith("/private/tmp/")) and flag_content() != "visual":
        base = os.path.basename(file_path).lower()
        capture_markers = ["test", "probe", "verify", "check", "spec",
                           "server.log", ".log", "stdout", "stderr", "output"]
        if any(m in base for m in capture_markers):
            cleared = True
    if cleared:
        try:
            os.remove(verify_flag)
        except FileNotFoundError:
            pass
        touch_last_screenshot_read()
    print("{}"); sys.exit(0)

# --- Handle Bash commands ---
if tool == "Bash":
    cmd = data.get("tool_input", {}).get("command", "")

    # Real visual verification (cmux screenshot) clears ANY pending flag.
    if is_visual_verification_command(cmd):
        try:
            os.remove(verify_flag)
        except FileNotFoundError:
            pass
        print("{}"); sys.exit(0)

    # Logic verification (curl-localhost, test runners, HTTP probes) clears the
    # flag ONLY when the pending change is not visual. A visual change needs a
    # real screenshot - curl/tests are not visual proof. This was the 2026-06-22
    # hole: a CSS change got reported done off a curl-localhost that cleared the
    # flag right here.
    if is_verification_command(cmd):
        if flag_content() != "visual":
            try:
                os.remove(verify_flag)
            except FileNotFoundError:
                pass
        print("{}"); sys.exit(0)

    # Skip read-only commands
    if is_read_only_command(cmd):
        print("{}"); sys.exit(0)

    # T-0017: Skip verification-only commands (tests, type checks, lint,
    # benchmarks, chained git/ls). These can contain `npx ` substrings that
    # would otherwise trip the write_indicators heuristic below.
    if is_verification_only(cmd):
        print("{}"); sys.exit(0)

    # Check if command writes/deploys code files. Two classes of indicator:
    #   - DEPLOY/BUILD (node build, npm run build, npx, make): no single file
    #     target and may emit UI -> ALWAYS arm (unchanged behavior).
    #   - FILE-TARGET writes (cp/mv/>/>>/tee/sed -i): the target file(s) are
    #     determinable, so apply the SAME file-type filter the Write/Edit arm
    #     side already uses (is_code_file). A write that touches ONLY non-code
    #     files (a .md beat/notes/doc, a .txt, a .json) must NOT arm the
    #     visual-verify flag - markdown has no UI to screenshot. Before this
    #     split the Bash arm side skipped the filter entirely, so `sed -i ... notes.md`
    #     or `cp a.md b.md` re-armed .needs-verification right after a screenshot
    #     cleared it (2026-07-14 re-arm bug). is_code_file already honors EXEMPT_PATHS
    #     (.claude/memory/, MEMORY.md, hooks, eval fixtures) and CODE_EXTS.
    import re as _vre
    deploy_indicators = ["node build", "npm run build", "npx ", "make "]
    file_write_indicators = ["cp ", "mv ", "> ", ">> ", "tee ", "sed -i"]

    def arm_and_report():
        set_flag("code")
        if recently_verified() or IS_SUBAGENT:
            print("{}"); sys.exit(0)
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "CODE DEPLOYED/BUILT. You MUST verify before reporting. Take a screenshot, EXAMINE it critically, and DESCRIBE what you see. Ask: does this match what was requested? Is anything overlapping, clipped, misaligned, or wrong? Do NOT claim completion without describing verified proof."
            }
        }))
        sys.exit(0)

    if any(w in cmd for w in deploy_indicators):
        arm_and_report()

    if any(w in cmd for w in file_write_indicators):
        # Extract tokens that look like a filename (end in a short dot-extension) and
        # arm iff ANY is a CODE file. A command referencing only non-code files (a .md
        # beat/notes/doc, a .txt) does NOT arm - that is the re-arm bug being fixed.
        # This intentionally treats every file operand alike, so a code file that
        # appears only as a READ source (e.g. `cp src/a.ts notes.md`, `tee notes.md <
        # src/a.ts`) still arms. That is an over-arm - a FALSE POSITIVE - which is the
        # deliberately-preferred direction for this enforcement gate
        # (feedback_hooks_prefer_false_positives): never UNDER-arm a real code write,
        # even at the cost of an occasional spurious screenshot prompt. Precisely
        # separating write-targets from read-sources (cp source is a read, but mv
        # source is deleted and a redirect target is a write) would risk false
        # negatives, so we do not. No file-ish token at all (cannot tell) -> arm
        # conservatively. The separator class is built via chr() so no literal single
        # quote appears inside this shell single-quoted python3 -c block.
        _sep_re = "[" + _vre.escape(chr(39) + chr(34) + "<>|;&()") + "]"
        tokens = _vre.sub(_sep_re, " ", cmd).split()
        file_tokens = [t for t in tokens if _vre.search(r"\.[A-Za-z0-9]{1,8}$", t)]
        if not file_tokens:
            arm_and_report()
        if any(is_code_file(t) for t in file_tokens):
            arm_and_report()
        # else: only non-code files touched -> do NOT arm
        print("{}"); sys.exit(0)

    print("{}"); sys.exit(0)

# --- Handle Write/Edit/MultiEdit ---
file_path = data.get("tool_input", {}).get("file_path", "")

if is_code_file(file_path):
    set_flag("visual" if is_visual_file(file_path) else "code")
    if recently_verified() or IS_SUBAGENT:
        print("{}")
    else:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "CODE FILE CHANGED. You MUST verify before reporting. Take a screenshot, EXAMINE it critically, and DESCRIBE what you see. Ask: does this match what was requested? Is anything overlapping, clipped, misaligned, or wrong? Element existence is not validation - visual correctness is. Do NOT claim completion without describing verified proof."
            }
        }))
else:
    print("{}")
'
