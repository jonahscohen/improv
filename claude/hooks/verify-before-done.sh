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
cwd = data.get("cwd", "")
# Session-scoped verify flag. A single global ~/.claude/.needs-verification leaked across
# every concurrent session AND project: a .css edit in one repo armed "visual" globally and
# then blocked commits in an unrelated repo (Jonah 2026-07-18: fucking up all projects).
# Now keyed by session_id, exactly like .memory-dirty.<session> and .screenshot-pending.<session>.
# The sanitizer + "global" fallback is byte-identical to the _SESSION_KEY derivation in
# bash-guard.sh and to verify-manual / verify-clear / second-fix-gate / verify-before-done-stop,
# so every writer and reader agree on the path. A disagreement would make the gate FAIL OPEN
# (the writer-reader-path warning bash-guard documents). No literal apostrophes in this comment:
# the whole block is a python3 -c single-quoted string, so one would close it and break the hook.
_sk = re.sub(r"[^A-Za-z0-9._-]", "_", str(data.get("session_id", "") or "")) or "global"
verify_flag = os.path.expanduser("~/.claude/.needs-verification." + _sk)
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

# --- Non-rendered write targets: eval data, test probes, OS-temp scratch (Jonah 2026-07-24) ---
# The visual Stop gate fired three times in one session on writes to
# sidecoach/eval/fixtures/**/*.html (constructed detector/labeler probe inputs) and on
# *.test.ts / *.spec.* files - none of which have a rendered product surface, so each firing was
# screenshot theatre that cost a manual override. This is a PRECISION carve-out on the visual-arm
# classifier applied to the write TARGET: a real product UI file OUTSIDE these paths still arms
# exactly as before. It is additive - it never makes MORE things arm.

# eval/fixtures and eval/corpus, anchored at the START of the path or after a "/". EXEMPT_PATHS
# already lists the SUBSTRING "/eval/", which exempts an ABSOLUTE fixture path but MISSES a
# cwd-relative one - a bash `sed -i ... eval/fixtures/x.html` from the project dir names
# "eval/fixtures/..." with no leading slash, so "/eval/" does not match and the write armed
# visual. Kept as a NARROW backstop; the broader _NON_APP_DIR_RE below now also matches these.
_EVAL_DATA_RE = re.compile(r"(^|/)eval/(fixtures|corpus)/")

# --- Non-app DEV / TEST / SCRATCH directories (Jonah 2026-07-26) ----------------------
# A visual file (.css/.html/.tsx/...) living under any of these renders no PRODUCT surface, so a
# change to one can never be screenshotted and must NOT arm the visual gate. This extends the
# 2026-07-24 eval/fixtures + OS-temp arm-narrow in the same spirit, closing the false-fires that
# cost manual overrides this month: a deleted .html eval fixture, docs/dependency-map dev-docs, a
# scratchpad .html, any fixtures/ probe dir.
#
# SEGMENT-anchored ((^|/)name/): it matches a real path SEGMENT in absolute OR cwd-relative form
# but never a bare substring, so the genuine front-end surfaces stay ARMED - "reference-site/" is
# not "reference/", "docs-panel/" is not "docs/", "preevaluation/" is not "eval/". This is the same
# anchoring discipline _EVAL_DATA_RE uses. "dependency-map" is the lead-named dev-doc graph; it
# already sits under docs/ in practice but is listed so a bare dependency-map/ is covered too.
#
# Kept BYTE-IDENTICAL to the copies in verify-before-done-stop.sh (tree_has_visual_evidence) and
# bash-guard.sh (the commit gate) so the ARM site and the two re-derivations AGREE on what is not
# product UI; test-verify-visual-gate.sh asserts the three literals match.
_NON_APP_DIR_RE = re.compile(
    r"(^|/)(eval|fixtures|__fixtures__|test-fixtures|docs|reference|dependency-map|scratchpad)/")

# A basename carrying a ".test." or ".spec." infix before its final extension is a test probe.
# Foo.test.tsx / Bar.spec.tsx would otherwise arm VISUAL (.tsx is a visual ext) and trip the Stop
# gate; a bare .test.ts already armed only "code". Declassifying the visual-extension test files
# to "code" (they stay code files, so they still arm "code" and nudge "run its tests") means none
# of them demand a screenshot, while a real product Bar.tsx (no .test./.spec. infix) still arms
# visual.
_TEST_FILE_RE = re.compile(r"\.(test|spec)\.[A-Za-z0-9]+$")

# Direct scratch drop: a file written DIRECTLY into an OS temp root (its immediate parent IS the
# temp dir) - what a throwaway probe looks like: /tmp/probe.html, $TMPDIR/out.html. This is
# deliberately NOT a whole-subtree prefix match. A real product repo checked out UNDER temp
# (/tmp/my-app/src/components/Foo.tsx, /var/folders/.../repo/app/page.tsx) has its file NESTED in
# project dirs, so it is NOT a direct child and KEEPS arming visual - never under-arm real UI even
# in temp (Codex 2026-07-24 recall finding + the hook prefer-FP law). _ENV_TMP reads the OS temp
# dir from the env only ($TMPDIR/$TEMP/$TMP) - NOT tempfile.gettempdir(), which probes the
# filesystem for writability on every tool call. The literal roots are /tmp and /private/tmp; the
# bare /var/folders/ is intentionally NOT a root (its direct children are per-user hash dirs, not
# scratch files - the real macOS temp dir arrives as $TMPDIR = /var/folders/xx/yy/T via _ENV_TMP).
_ENV_TMP = tuple(os.path.normpath(v) for v in
                 (os.environ.get("TMPDIR"), os.environ.get("TEMP"), os.environ.get("TMP")) if v)
_TMP_DIRECT_ROOTS = frozenset({"/tmp", "/private/tmp"} | set(_ENV_TMP))

def _is_test_file(path):
    return bool(path) and bool(_TEST_FILE_RE.search(os.path.basename(path)))

def _is_temp_target(path):
    # Only an ABSOLUTE path can name the OS temp tree; a relative token never means system temp.
    if not path or not os.path.isabs(path):
        return False
    return os.path.dirname(os.path.normpath(path)) in _TMP_DIRECT_ROOTS

def is_exempt(path):
    if any(exempt in path for exempt in EXEMPT_PATHS):
        return True
    # eval/fixtures//corpus/ probe data is not rendered product UI and, like the existing "/eval/"
    # exemption for absolute paths, arms NOTHING. (OS-temp is deliberately NOT here - it is handled
    # in is_visual_file as a visual->code declassify, because a /tmp code file must still arm "code"
    # like any code edit; fully exempting /tmp would stop a /tmp/fake-project/src/file.ts sandbox
    # edit from arming at all. The task carve-out is "must not arm the VISUAL gate", not "arm nothing".)
    if _EVAL_DATA_RE.search(path):
        return True
    # Non-app dev/test/scratch dirs (docs/, reference/, any fixtures/, bare eval/, dependency-map/,
    # scratchpad/): fully exempt - not a rendered product surface, so no screenshot is possible.
    if _NON_APP_DIR_RE.search(path):
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
    # Test probes (.test./.spec. infix) and OS-temp scratch (/tmp, /private/tmp, /var/folders,
    # $TMPDIR) render no product surface - never a screenshot demand. Both stay CODE files
    # (is_code_file is unaffected), so a code-extension one still arms "code"; it just never arms
    # visual. This is the (b)/(c) carve-out: declassify from visual, do NOT fully exempt - a /tmp
    # code edit must keep arming code, and .test.ts already only armed code on HEAD.
    if _is_test_file(path) or _is_temp_target(path):
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

def verify_message(prefix):
    """Pick the demand that MATCHES the pending flag.

    The hook already knows whether the change is visual (.css/.tsx/.html -> a real
    rendered surface) or non-visual (.ts/.py/.go/.sh -> server, CLI, hook, test-runner
    code). Until 2026-07-17 BOTH messages ordered a screenshot regardless, so editing a
    test runner or building a CLI library demanded a screenshot of something that has no
    UI. That is screenshot theatre: it cannot be satisfied honestly, so it trained readers
    to ignore the hook - the boy-who-cried-wolf threshold in
    feedback_hooks_prefer_false_positives. (Jonah 2026-07-17: bothering everyone.)

    ARMING IS UNCHANGED - set_flag() still fires on exactly what it fired on before, and
    bash-guard still blocks git commit. Only the wording changes, so recall on real
    true-positive cases is preserved exactly, per that same beat.

    Reads flag_content() AFTER set_flag, so a sticky "visual" flag (set_flag never
    downgrades visual -> code) correctly keeps demanding a screenshot on a later
    non-visual edit or build. Edit a .css then run the build and you still owe a
    screenshot - which is the 2026-06-22 hole this gate exists to close.
    """
    if flag_content() == "visual":
        return (prefix + " You MUST verify before reporting. Take a screenshot, EXAMINE it "
                "critically, and DESCRIBE what you see. Ask: does this match what was requested? "
                "Is anything overlapping, clipped, misaligned, or wrong? Element existence is not "
                "validation - visual correctness is. Do NOT claim completion without describing "
                "verified proof.")
    return (prefix + " You MUST verify before reporting. This is NON-VISUAL code: there is no "
            "rendered surface, so do NOT screenshot to satisfy this - a screenshot would prove "
            "nothing. Exercise the change instead: run its tests, a probe script, or curl its "
            "endpoint, and report the REAL output. If the change has no runnable surface at all, "
            "say so explicitly rather than claiming completion without proof.")

# --- UI-project detection for build/deploy commands (Jonah 2026-07-17) --------------
# A build command alone cannot reveal whether it emits UI: `npm run build` is byte-identical
# in a Next.js app and in a CLI library. Arming EVERY build visual restores the screenshot
# theatre this fix removed; arming every build code loses visual recall on real UI builds
# (Codex finding 3). So ask the PROJECT instead of the command.
#
# The discriminator is the nearest package.json deps/scripts, deliberately NOT a filesystem
# scan for .css/.html: sidecoach ships eval fixtures and a pages/ dir of HTML it never
# renders as its own UI, so a file scan reports "UI" for a CLI library and reintroduces the
# noise. Declared dependencies do not lie - a package that renders UI depends on a UI
# framework or exposes a dev/start/serve script.
#
# No package.json found, or an unreadable one -> assume UI and demand the screenshot. That
# is the deliberate false positive per feedback_hooks_prefer_false_positives: when we cannot
# tell, over-fire.
UI_DEP_MARKERS = ("react", "next", "vue", "svelte", "@angular", "solid-js", "preact",
                  "astro", "remix", "gatsby", "vite", "tailwind", "styled-components",
                  "@emotion", "lit-element", "lit-html", "nuxt", "webpack-dev-server")
UI_SCRIPT_KEYS = ("dev", "start", "serve", "storybook", "preview")

def effective_dir(cmd, cwd):
    """Honor a LEADING `cd X` so `cd sidecoach && npm run build` is judged against
    sidecoach/package.json rather than the session root.

    Anchored with re.match - only a cd at the very START counts. A trailing cd does not
    describe where the build ran: `npm run build && cd ../cli` from a UI project would
    otherwise be judged against ../cli and downgrade a real UI build to a logic-only
    demand (Codex review 2026-07-17, finding 1 - a false NEGATIVE, the dangerous direction).
    """
    m = re.match(r"\s*cd\s+([^\s;&|]+)", cmd or "")
    if m:
        d = m.group(1).strip().strip(chr(34) + chr(39))
        if not os.path.isabs(d):
            d = os.path.join(cwd or "", d)
        if os.path.isdir(d):
            return d
    return cwd or ""

def _has_rendered_html(start, max_entries=400):
    """Fallback for a tree with NO package.json anywhere: look for the signature of a
    static site - a rendered .html/.htm within a few levels of the build dir.

    This does NOT reintroduce the fixture-scan problem the deps rule above exists to
    avoid. That problem is scoped to projects that HAVE a package.json: sidecoach ships
    209 eval/pages HTML files it never renders as its own UI, and every one of them sits
    UNDER sidecoach/package.json, so sidecoach is decided by deps/scripts and never
    reaches this fallback. Only a package.json-less tree gets here - and there an .html
    IS the project (a plain static marketing/reference site with no build tooling), which
    is exactly the UI that must keep arming visual (Jonah 2026-07-23).

    Bounded: depth 3, skips hidden dirs and node_modules, hard entry cap - this can run
    on any Bash call that reaches the deploy branch. Depth 3 covers the realistic static
    layouts (index.html at the root, public/, src/pages/, site/src/pages/); depth 2 was
    tighter than real sites and missed a/b/c/index.html, a recall loss. An unreadable dir
    or an inconclusive (cap-hit) scan returns True: cannot tell -> over-fire, the stance
    this module already documents for a missing/unreadable package.json
    (feedback_hooks_prefer_false_positives). The entry cap is what bounds a symlink loop,
    so the walk terminates (over-firing) rather than spinning."""
    seen = 0
    queue = [(start, 0)]
    while queue:
        d, depth = queue.pop(0)
        try:
            entries = list(os.scandir(d))
        except (OSError, PermissionError):
            return True
        for e in entries:
            seen += 1
            if seen > max_entries:
                return True
            try:
                if e.is_file():
                    if os.path.splitext(e.name)[1].lower() in (".html", ".htm"):
                        return True
                elif (e.is_dir() and depth < 3 and not e.name.startswith(".")
                        and e.name != "node_modules"):
                    queue.append((e.path, depth + 1))
            except OSError:
                continue
    return False

def project_has_ui(start):
    cur = os.path.abspath(start) if start else ""
    for _ in range(6):
        if not cur or cur == os.path.dirname(cur):
            break
        pj = os.path.join(cur, "package.json")
        if os.path.exists(pj):
            try:
                with open(pj) as fh:
                    pkg = json.load(fh)
            except Exception:
                return True
            # peerDependencies matters: a React/Vue COMPONENT LIBRARY declares its
            # framework as a peer, not a dep, and often ships no dev/start script - so
            # omitting peers gave a real UI package a false non-UI verdict (Codex review
            # 2026-07-17, finding 2). optionalDependencies included for the same reason.
            names = " ".join(list((pkg.get("dependencies") or {}).keys()) +
                             list((pkg.get("devDependencies") or {}).keys()) +
                             list((pkg.get("peerDependencies") or {}).keys()) +
                             list((pkg.get("optionalDependencies") or {}).keys())).lower()
            if any(mk in names for mk in UI_DEP_MARKERS):
                return True
            return any(k in (pkg.get("scripts") or {}) for k in UI_SCRIPT_KEYS)
        cur = os.path.dirname(cur)
    # Fell out of the loop: no package.json within 6 levels, so the dependency signal
    # does not exist. A bare `return True` here made EVERY package.json-less directory a
    # UI project, and because the deploy branch ORs this with the write-target check, it
    # armed visual on zero evidence and made that check irrelevant (a codemod naming only
    # a .js armed visual in an empty dir - lead review 2026-07-23). With no cwd at all we
    # still know nothing, so keep over-firing; with a real directory, ask whether there is
    # actually anything rendered in it.
    if not start:
        return True
    return _has_rendered_html(os.path.abspath(start))

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
    # Write VERBS stay SUBSTRING matches on the raw command - recall is never worth losing
    # (feedback_hooks_prefer_false_positives): `bash -lc "cp ..."`, `\cp`, `gsed -i` all still
    # arm. The ONE indicator refined is the REDIRECT. The old "> " / ">> " substrings also
    # matched the "-> " ARROW, so any command echoing an arrow that is not caught by the
    # read-only prefix list (a for/while/printf compound) falsely armed the gate (Jonah
    # 2026-07-18: the hook fired "take a screenshot" on plain grep/for/echo diagnostics). A
    # real redirect operator is NEVER preceded by a dash, so require a "> "/">> " that is not
    # part of "->". This keeps every real redirect the old code caught (> file, 2> file,
    # >> file) and still ignores fd-dup like 2>&1 (no trailing space), dropping only the arrow.
    write_verb_indicators = ["cp ", "mv ", "tee ", "sed -i"]

    def _has_redirect(s):
        return bool(_vre.search(r"(?<!-)>>? ", s))

    # In-place write FLAGS. A tool invoked with an explicit write flag rewrites the files
    # it names, so `npx prettier --write src/App.tsx` is a real visual write even though
    # no cp/mv/tee/sed verb appears (Codex 2026-07-23, finding 1 - it downgraded to the
    # logic-only demand). Only unambiguous LONG flags: a bare -i means case-insensitive
    # to grep and would over-match wildly.
    write_flag_indicators = ["--write", "--fix", "--in-place"]

    def _visual_write_target(s):
        """True iff a VISUAL file is a genuine WRITE TARGET of s - NOT merely a
        REFERENCE (a tool/codemod arg, a cp read source, a redirect stdin source).

        The ONE reference among write-verb operands is a cp READ SOURCE, because
        cp is the only write verb that leaves an operand untouched. Everything
        else a write verb names is CHANGED: sed -i and tee edit EVERY operand in
        place, and mv DESTROYS its source as well as creating its destination, so
        both ends of an mv count (Codex 2026-07-23, findings 2 and 3 - scoring only
        the trailing operand silently dropped those real visual writes). Targets:
          (a) the token after a dash-guarded > / >> redirect
          (b) any file operand of a SEGMENT carrying a write verb - except a plain
              cp, where only the destination (the trailing operand) is written
          (c) any file operand of a SEGMENT carrying an in-place write FLAG
        A visual file present only as a reference (npx <codemod> Button.tsx, or
        cp App.tsx App.tsx.bak where the .tsx is the read source) is NOT a write
        target and must not upgrade the flag to visual - that reference is the
        false positive this narrows (Jonah 2026-07-23). Write VERBS stay SUBSTRING
        matches (a wrapped/escaped verb like bash -lc "cp ..." or gsed -i still
        counts), so visual recall is preserved per feedback_hooks_prefer_false_positives -
        the 2026-07-18 de-quote attempt that lost that recall was Codex-rejected.
        Quote chars are built via chr(): this whole block is a single-quoted
        python3 -c string, so a literal one would close it and break the hook."""
        _dq, _sq = chr(34), chr(39)
        _q = _sq + _dq
        # A target token stops at whitespace or shell punctuation, and may be quoted.
        # Without that, a target hugging a separator or a subshell close captured the
        # punctuation too (> out.css; true, > out.css), >(procsub)) and a quoted target
        # with a space was truncated - all read as non-visual (Codex 2026-07-23, 4 and 5).
        _bare = r"[^\s;&|<>()]+"
        _tgt = (_dq + r"[^" + _dq + r"]*" + _dq + r"|" +
                _sq + r"[^" + _sq + r"]*" + _sq + r"|" + _bare)
        # (a) redirect target. Guarded against a preceding - or > so a prose arrow
        #     (-> and -->) is never read as a redirect (the 2026-07-18 arrow fix), and
        #     the capture class excludes & so an fd-dup like 2>&1 never matches.
        for _t in _vre.findall(r"(?<![->])>>?\s*(" + _tgt + r")", s):
            if is_visual_file(_t.strip(_q)):
                return True
        # (b)/(c) per SEGMENT carrying a write verb or an in-place write flag.
        _sep = "[" + _vre.escape(_q + "()") + "]"
        for _seg in _vre.split(r"[;&|]+", s):
            _verb = any(w in _seg for w in write_verb_indicators)
            _wflag = any(f in _seg for f in write_flag_indicators)
            if not _verb and not _wflag:
                continue
            # Drop redirect operator+operand pairs so a `< source` stdin read is never
            # taken for a written operand (tee notes.md < App.tsx writes notes.md only);
            # a `> target` is already scored by (a).
            _body = _vre.sub(r"[<>]+\s*(" + _tgt + r")?", " ", _seg)
            _files = [t for t in _vre.sub(_sep, " ", _body).split()
                      if _vre.search(r"\.[A-Za-z0-9]{1,8}$", t)]
            if not _files:
                continue
            # A plain cp READS every operand but the last, so only its destination is
            # written. Any other write verb in the segment (mv/tee/sed -i) or a write
            # flag means every named file is changed - keep them all.
            if (_verb and not _wflag and "cp " in _seg
                    and not any(w in _seg for w in ("mv ", "tee ", "sed -i"))):
                _files = _files[-1:]
            if any(is_visual_file(f) for f in _files):
                return True
        return False

    def arm_and_report(kind="code"):
        # A subagent/teammate must NOT arm the flag: it is keyed by session_id, and an in-flight
        # sidechain edit can land on the PARENT session key, saddling the parent with screenshot
        # debt it never incurred (the parent Stop then blocks on the subagent work). The Stop gate
        # already exempts subagents from being blocked, so the flag is meaningless for them anyway -
        # arm nothing rather than only muting the nudge. No apostrophe in this comment: the whole
        # block is a single-quoted python3 -c string, so one would close it. (Jonah 2026-07-26.)
        if IS_SUBAGENT:
            print("{}"); sys.exit(0)
        # kind MUST be "visual" when the touched file(s) render UI. A Bash write to a
        # visual file (sed -i src/app.css, tee src/App.tsx, cp theme.css ...) is still a
        # VISUAL change and still owes a real screenshot - routing it through the plain
        # "code" flag would silently downgrade it to a logic-only demand and lose visual
        # recall. (Codex review 2026-07-17: latent since the flag was introduced, but
        # harmless while BOTH messages hardcoded a screenshot demand; making the flag
        # load-bearing in verify_message() is what exposed it. set_flag never downgrades
        # an existing visual flag, so passing "code" here can never clear real visual debt.)
        prev = flag_content()
        set_flag(kind)
        # Reign-in (Jonah 2026-07-18): emit the per-edit nudge ONLY when the flag STATE
        # changes (unset -> armed, or code -> visual upgrade), never on every subsequent
        # edit/build while already armed. set_flag is unchanged, so the Stop hook + the
        # commit gate (the real teeth) fire exactly as before - only the repeated nag text
        # is dropped. This is what "stop the per-edit nag from firing everywhere" means.
        if recently_verified() or IS_SUBAGENT or flag_content() == prev:
            print("{}"); sys.exit(0)
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": verify_message("CODE DEPLOYED/BUILT.")
            }
        }))
        sys.exit(0)

    if any(w in cmd for w in deploy_indicators):
        # Visual iff a visual file is a genuine WRITE TARGET of the command, or the project
        # it builds actually renders UI. A chained `sed -i ... app.css && npm run build`
        # still owes a screenshot because the sed -i names a visual write target (Codex
        # review 2026-07-17, finding 1). But a visual file merely NAMED as a tool/codemod
        # arg (npx <codemod> Button.tsx) is only a REFERENCE - it no longer arms visual by
        # itself (Jonah 2026-07-23). A CLI/library build (sidecoach) with no visual write
        # target stays on the logic demand.
        arm_and_report("visual" if (_visual_write_target(cmd) or project_has_ui(effective_dir(cmd, cwd)))
                       else "code")

    if _has_redirect(cmd) or any(w in cmd for w in write_verb_indicators):
        # Extract tokens that look like a filename (end in a short dot-extension) and
        # arm iff ANY is a CODE file. A command referencing only non-code files (a .md
        # beat/notes/doc, a .txt) does NOT arm - that is the re-arm bug being fixed.
        # WHETHER we arm still treats every file operand alike, so a code file that
        # appears only as a READ source (e.g. `cp src/a.ts notes.md`, `tee notes.md <
        # src/a.ts`) still arms. That is an over-arm - a FALSE POSITIVE - which is the
        # deliberately-preferred direction for this enforcement gate
        # (feedback_hooks_prefer_false_positives): never UNDER-arm a real code write,
        # even at the cost of an occasional spurious screenshot prompt. No file-ish token
        # at all (cannot tell) -> arm conservatively. The separator class is built via
        # chr() so no literal single quote appears inside this shell single-quoted
        # python3 -c block.
        _sep_re = "[" + _vre.escape(chr(39) + chr(34) + "<>|;&()") + "]"
        tokens = _vre.sub(_sep_re, " ", cmd).split()
        file_tokens = [t for t in tokens if _vre.search(r"\.[A-Za-z0-9]{1,8}$", t)]
        if not file_tokens:
            arm_and_report()
        if any(is_code_file(t) for t in file_tokens):
            # UPGRADE to visual ONLY when a visual file is a genuine WRITE TARGET
            # (redirect target / sed -i / tee / cp-mv destination). A visual file present
            # only as a REFERENCE - a cp/mv READ SOURCE (cp App.tsx App.tsx.bak), a tee
            # stdin source - stays "code": it renders nothing new, so demanding a
            # screenshot there is the reference false positive this narrows (Jonah
            # 2026-07-23). Distinct from WHETHER we arm above: a referenced code file
            # still arms (prefer-FP); only the visual-vs-code LABEL is narrowed here.
            arm_and_report("visual" if _visual_write_target(cmd) else "code")
        # else: only non-code files touched -> do NOT arm
        print("{}"); sys.exit(0)

    print("{}"); sys.exit(0)

# --- Handle Write/Edit/MultiEdit ---
file_path = data.get("tool_input", {}).get("file_path", "")

# A subagent/teammate edit must NOT arm the session-keyed flag (see arm_and_report): its work can
# land on the PARENT session key and block the parent Stop, and subagents are already Stop-exempt.
if IS_SUBAGENT:
    print("{}")
elif is_code_file(file_path):
    _visual = is_visual_file(file_path)
    prev = flag_content()
    set_flag("visual" if _visual else "code")
    # Once-per-episode nudge (see arm_and_report): silent when the flag state is unchanged,
    # so a run of edits to already-armed code stops re-nagging on every single one.
    if recently_verified() or flag_content() == prev:
        print("{}")
    else:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": verify_message(
                    "VISUAL FILE CHANGED." if _visual else "CODE FILE CHANGED (non-visual).")
            }
        }))
else:
    print("{}")
'
