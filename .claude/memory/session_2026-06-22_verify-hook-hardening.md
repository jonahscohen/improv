---
name: Verify-before-done hardened - curl/navigate/tests no longer count as VISUAL verification + Stop-hook teeth
description: Fixed the enforcement hooks that let an unverified CSS change be reported done. Visual files now set a "visual" flag only a real screenshot clears; a new Stop hook blocks ending the turn while a visual change is unverified. 17 new tests + 73 existing pass; wired live + repo.
type: project
relates_to: [session_2026-06-22_justify-hero-title-textwrap-fix.md, reference_browser_validation_tool_precedence.md, reference_chrome_mcp_lan_ip_access.md]
---

Collaborator: Jonah Cohen

Context: Jonah asked "did you actually fix where you were wrong or did you just write memories you can ignore." Correct challenge - beats are passive and ignorable. The real fix is mechanical. Found three holes in the verify hooks that let me report a CSS change "done" off a curl:

1. `verify-before-done.sh` treated `curl localhost` (and test runners, and /tmp log Reads) as verification that CLEARS the needs-verification flag - for ALL code files, including visual ones. That is the literal false positive: curl is content/HTTP proof, not visual.
2. `verify-clear.sh` (chrome MCP PostToolUse) cleared the flag UNCONDITIONALLY on any matched tool - so a bare `navigate` / `read_page` / `get_page_text` counted as verification. Worse: its matcher did not even include `computer` (the actual screenshot tool), so real screenshots did not clear it but navigations did.
3. No Stop-time teeth: nothing blocked ending the turn with the flag still set. The PostToolUse nudge fired every edit and I talked past it.

THE FIX (all hooks symlinked from claude/hooks/, so editing the repo updates live):
- verify-before-done.sh: added VISUAL_EXTS (css/scss/sass/less/html/htm/vue/svelte/jsx/tsx/ejs/hbs/pug/twig). A visual-file edit writes "visual" into the flag; non-visual code writes "code" (never downgrades an existing visual). Split clearing: cmux screenshot + Read-of-.png clear ANY flag (real visual proof); curl-localhost / test runners / HTTP probes / /tmp-log Reads clear ONLY when the flag is not "visual". So a visual change can only be cleared by an actual screenshot.
- verify-clear.sh: rewritten to clear ONLY on a real screenshot - `computer` with action=="screenshot" or `get_screenshot`. navigate/read_page/get_page_text/javascript_tool no longer clear. settings matcher updated to include `mcp__claude-in-chrome__computer`.
- NEW verify-before-done-stop.sh (Stop hook): if flag=="visual", returns {"decision":"block"} with instructions to capture a real screenshot. Safety valves: `stop_hook_active` short-circuit (no infinite loop), subagent/teammate exempt, user "verified"/"looks good" override via verify-manual.sh. bash-guard still blocks git commit while any flag is set.

WIRING: added the Stop hook to BOTH ~/.claude/settings.json (live, backed up first - 7 Stop hooks now) and claude/settings.json (repo, 6), updated the verify-clear matcher in both, and added verify-before-done-stop.sh to install.sh CONFIG_HOOKS + the deactivate_config list.

VERIFICATION (real, not curl):
- New suite /tmp test (17/17): visual flag survives curl/test/log; cleared only by Read-.png / cmux / chrome screenshot; navigate does not clear; stop hook blocks on visual, allows code/none, no loop.
- Existing test-verify-before-done.sh: 73/73, no regression.
- LIVE symlink demo: stop hook returns decision:block on a visual flag; verify-before-done keeps "visual" after css-edit+curl.

Why this is the answer to the question: the failure mode is now structurally prevented, not just documented. If I try to end a turn after a visual change without a real screenshot, the Stop hook blocks me - same as it would now block anyone on this machine.

Files touched:
- claude/hooks/verify-before-done.sh (visual flag + split clearing)
- claude/hooks/verify-clear.sh (clear only on real screenshot)
- claude/hooks/verify-before-done-stop.sh (NEW Stop hook)
- claude/settings.json + ~/.claude/settings.json (wire Stop hook + matcher)
- install.sh (CONFIG_HOOKS + deactivate list)
- claude/hooks/test-verify-before-done.sh unchanged; new coverage lives in the isolated suite
