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
import json, sys, os

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
verify_flag = os.path.expanduser("~/.claude/.needs-verification")

# Code file extensions that require verification after change
CODE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
    ".css", ".scss", ".sass", ".less",
    ".html", ".htm", ".ejs", ".hbs", ".pug",
    ".php", ".twig",
    ".py", ".rb", ".go", ".rs", ".java",
    ".sh", ".zsh", ".bash"
}

# Paths exempt from verification requirement
EXEMPT_PATHS = [".claude/memory/", "MEMORY.md", ".claude/hooks/", ".claude/skills/"]

def is_code_file(path):
    if not path:
        return False
    for exempt in EXEMPT_PATHS:
        if exempt in path:
            return False
    _, ext = os.path.splitext(path)
    return ext.lower() in CODE_EXTS

def is_verification_command(cmd):
    """Check if a Bash command is performing verification."""
    import re
    if "cmux browser" in cmd and ("screenshot" in cmd or "snapshot" in cmd):
        return True
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

# --- Handle Read tool: reading a screenshot OR a /tmp/ stdout-capture clears verification ---
if tool == "Read":
    file_path = data.get("tool_input", {}).get("file_path", "")
    img_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    _, ext = os.path.splitext(file_path)
    cleared = False
    if ext.lower() in img_exts:
        cleared = True
    # /tmp/ stdout-capture files: test logs, probe output, server logs
    elif file_path.startswith("/tmp/") or file_path.startswith("/private/tmp/"):
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
    print("{}"); sys.exit(0)

# --- Handle Bash commands ---
if tool == "Bash":
    cmd = data.get("tool_input", {}).get("command", "")

    # If this IS a verification action, clear the flag
    if is_verification_command(cmd):
        try:
            os.remove(verify_flag)
        except FileNotFoundError:
            pass
        print("{}"); sys.exit(0)

    # Skip read-only commands
    if is_read_only_command(cmd):
        print("{}"); sys.exit(0)

    # Check if command writes/deploys code files
    write_indicators = ["cp ", "mv ", "> ", ">> ", "tee ", "sed -i",
                        "node build", "npm run build", "npx ", "make "]
    if any(w in cmd for w in write_indicators):
        try:
            open(verify_flag, "w").close()
        except Exception:
            pass
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": "CODE DEPLOYED/BUILT. You MUST verify before reporting. Take a screenshot, EXAMINE it critically, and DESCRIBE what you see. Ask: does this match what was requested? Is anything overlapping, clipped, misaligned, or wrong? Do NOT claim completion without describing verified proof."
            }
        }))
        sys.exit(0)

    print("{}"); sys.exit(0)

# --- Handle Write/Edit/MultiEdit ---
file_path = data.get("tool_input", {}).get("file_path", "")

if is_code_file(file_path):
    try:
        open(verify_flag, "w").close()
    except Exception:
        pass
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "CODE FILE CHANGED. You MUST verify before reporting. Take a screenshot, EXAMINE it critically, and DESCRIBE what you see. Ask: does this match what was requested? Is anything overlapping, clipped, misaligned, or wrong? Element existence is not validation - visual correctness is. Do NOT claim completion without describing verified proof."
        }
    }))
else:
    print("{}")
'
