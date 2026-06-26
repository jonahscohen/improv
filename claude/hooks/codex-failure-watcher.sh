#!/bin/bash
# PostToolUse hook for Bash. Watches completed codex CLI invocations for a
# FAILURE signature (capacity flake or an error/stream-error line) and injects a
# reminder to retry-lean / switch-model rather than silently skip the cross-model
# gate.
#
# THE GAP (codex-doctor protocol, failure mode 2 of 3): codex exec sometimes
# returns "Selected model is at capacity" or a stream/error line instead of a
# verdict. When that slips by unnoticed the produce-and-verify gate is silently
# skipped. This watcher catches the COMPLETED-but-failed case and nudges a retry.
# A HANG cannot be caught here (PostToolUse only fires on completion) - that path
# is manual elapsed-vs-CPU + SIGKILL per reference_codex_exec_hang_sigkill.
#
# TRIP: tool_name == "Bash" AND command matches /codex/ AND the command OUTPUT
# (from tool_response - string OR object with stdout/output) contains a failure
# signature. Otherwise no-op. Any parse error -> no-op (fail-open; never break
# Bash).
#
# Collaborator: Jonah Cohen, 2026-06-25.

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, re

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

try:
    tool = data.get("tool_name", "") or ""
    inp = data.get("tool_input", {}) or {}
    command = inp.get("command", "") or ""

    # Trip only when codex is actually INVOKED as a command (start of command, or
    # after a shell separator ; && || | ( newline, optionally behind env-vars or a
    # `timeout ...` wrapper). This excludes commands that merely MENTION codex as an
    # argument to grep/cat/ls/find (which over-fired on codex-log inspection).
    # Separators are command terminators only (start, newline, ; && || |). NOT "(": a bare "(" also appears inside
    # quoted grep/rg patterns (grep -E "(codex|ERROR)") and would re-introduce the log-inspection over-fire. Our
    # codex calls all start at a command position (codex exec ... / timeout ... codex / ... && codex), so dropping
    # "(" loses nothing real. KNOWN LIMIT (accepted - best-effort nudge): a path-qualified /usr/bin/codex or a
    # backticked `codex ...` is not matched; codex is always on PATH in our usage.
    invoke = re.compile(
        r"(?:^|[\n;&|])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:timeout\s+\S+\s+)?codex\b",
        re.IGNORECASE,
    )
    if tool != "Bash" or not invoke.search(command):
        print("{}"); sys.exit(0)

    # Extract command output from tool_response: string, or object with
    # stdout/output (also pull stderr/content/result for robustness).
    resp = data.get("tool_response", data.get("tool_result", ""))
    output = ""
    if isinstance(resp, str):
        output = resp
    elif isinstance(resp, dict):
        parts = []
        for key in ("stdout", "output", "stderr", "content", "result"):
            v = resp.get(key)
            if isinstance(v, str):
                parts.append(v)
            elif isinstance(v, list):
                for it in v:
                    if isinstance(it, str):
                        parts.append(it)
                    elif isinstance(it, dict):
                        t = it.get("text")
                        if isinstance(t, str):
                            parts.append(t)
        output = "\n".join(parts) if parts else json.dumps(resp)

    if not output:
        print("{}"); sys.exit(0)

    # Failure signatures (case-insensitive): capacity flake + stream/request errors.
    sigs = [
        r"selected model is at capacity",
        r"model is at capacity",
        r"at capacity",
        r"stream[ _]error",
        r"error sending request",
        r"request failed",
    ]
    tripped = any(re.search(p, output, re.IGNORECASE) for p in sigs)
    # A codex/rust-style error line (uppercase ERROR at line start) - case-sensitive
    # so prose mentions of "error" in a successful review do not over-fire.
    if not tripped and re.search(r"(?m)^\s*ERROR\b", output):
        tripped = True

    if tripped:
        msg = (
            "CODEX FAILURE DETECTED (capacity/error). Per the codex-doctor protocol: "
            "treat by re-running the review with a LEANER findings-only prompt (give "
            "codex the already-verified context to cut synthesis tokens) and/or "
            "`-m <alternate-model>`; if it persists after one retry, fall back to "
            "lead-gate + the partial trace (a completed cross-model pass still "
            "satisfies produce-and-verify). Do NOT silently skip the cross-model gate."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": msg
            }
        }))
    else:
        print("{}")
except Exception:
    print("{}")
'
