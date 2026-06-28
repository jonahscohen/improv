---
name: Claude Code surface detection via CLAUDE_CODE_ENTRYPOINT
description: How to detect which Claude Code surface (terminal/cmux/desktop/web/mobile/vscode/sdk) a session runs in. The CLAUDE_CODE_ENTRYPOINT env var carries it; cmux is distinguished by CMUX_* vars. Extracted from the claude binary's own switch statement (v2.1.195).
type: reference
---

Question (Jonah, 2026-06-27): can we detect desktop/browser/mobile vs terminal/cmux?
Answer: YES. The signal is the `CLAUDE_CODE_ENTRYPOINT` env var (UNDOCUMENTED - not in the public
env-vars docs, but read all over the binary). Extracted the full value set from the compiled
claude binary's own switch (bin/claude.exe, v2.1.195, GIT_SHA 4603aa3f):

  switch(process.env.CLAUDE_CODE_ENTRYPOINT){
    case "claude-vscode": -> claude_code_vscode
    case "remote":
    case "remote_baku":
    case "remote_cowork":
    case "remote_desktop":
    case "remote_mobile":   -> claude_code_remote
    case "claude-in-teams": -> claude_code_remote
    case "sdk-cli": case "sdk-ts": case "sdk-py": -> claude_code_sdk
    case "mcp": -> ...
  }
Plus a dedicated helper: `function uca(){return process.env.CLAUDE_CODE_ENTRYPOINT==="claude-desktop"}`.
Default when unset: code does `CLAUDE_CODE_ENTRYPOINT || "cli"`.

## THE MAP (surface -> value)
- Terminal / CLI:        cli   (or empty -> defaults to cli)
- Desktop app:           claude-desktop
- Web (claude.ai/code):  remote  /  remote_desktop
- Mobile:                remote_mobile
- VS Code extension:     claude-vscode
- Teams:                 claude-in-teams
- SDK:                   sdk-cli / sdk-ts / sdk-py
- MCP server mode:       mcp
- cmux:                  cli  +  CMUX_* env vars set (cmux launches the CLI, so the entrypoint is
                         'cli'; what distinguishes it is CMUX_BUNDLE_ID / CMUX_SURFACE_ID / etc.)

## HOW TO DETECT (in a hook / Bash / script)
- Local terminal vs cmux: both are entrypoint 'cli'; check `[ -n "$CMUX_BUNDLE_ID" ]` for cmux.
- Desktop: `[ "$CLAUDE_CODE_ENTRYPOINT" = claude-desktop ]`.
- Web/mobile: `case "$CLAUDE_CODE_ENTRYPOINT" in remote*) ... esac` (remote_mobile = mobile,
  remote/remote_desktop = web). These run in Anthropic's cloud sandbox (Linux), not the user's machine.
- VS Code: `[ "$CLAUDE_CODE_ENTRYPOINT" = claude-vscode ]`.
- Also: CLAUDECODE=1 (any Claude-Code-spawned subprocess); TERM_PROGRAM names the terminal app.
- NOT reliable: process.stdout.isTTY from a spawned tool is ALWAYS false (output captured), regardless of surface.

## CAVEATS
- CLAUDE_CODE_ENTRYPOINT is UNDOCUMENTED (not in code.claude.com/docs/en/env-vars) - it's an internal
  telemetry/routing marker. Stable in v2.1.195 but NOT a public contract; values could change.
- web vs mobile: remote_desktop vs remote_mobile distinguishes them; plain 'remote' is ambiguous.
- This session (verified): CLAUDE_CODE_ENTRYPOINT=cli, CMUX_BUNDLE_ID set -> cmux.

Sources: code.claude.com/docs/en/env-vars (CLAUDECODE / CLAUDE_CODE_CHILD_SESSION only; entrypoint
undocumented); the claude binary itself (authoritative for the value set).
</content>
