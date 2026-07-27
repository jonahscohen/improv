---
name: Agent-routing final-review fix wave
description: Single pass folding all 10 findings from the whole-branch review of the agent-routing layer (registration, latency DoS, install deploy modes, six vacuous assertions, type guards)
type: project
relates_to: [session_2026-07-26_agent-routing-task7-codex-fix.md, session_2026-07-26_agent-routing-task6.md]
author_human: Jonah
source: session
verified: tests
confidence: high
---

Final whole-branch review of the `agent-routing` branch returned 10 in-scope findings
(1 critical, 5 important, 4 minor). This beat records the single fix wave that folded
all of them. Items 11-15 (cosmetic) were explicitly out of scope and left alone.

## CRITICAL 1 - route-intent was unregistered; two suites red

`claude/hooks/browser-tree.json` had no `agent-routing` node, so `route-intent` failed
the "in the tree AND deployed by install.sh" managed test at `hook-registry-guard.sh:99`.

Why it mattered beyond a red suite: `NONINTERACTIVE=0` is the default, so a plain
`./install.sh` runs the component browser and exits at `install.sh:3484` without ever
reaching the PICKS apply phase. The browser renders only what `browser-tree.json`
lists. The default install path could not install this cluster at all.

How: added an `agent-routing` bucket node beside `model-routing`, plus a
`hook_desc["route-intent"]` sentence and `hook_owner["route-intent"] = "agent-routing"`.

Verified:
- `hook-registry-guard.sh --audit` now exits 0 with no UNMANAGED line (was: UNMANAGED: route-intent)
- `test-hook-registry.sh` 49/3 -> 52 passed, 0 failed
- `test-component-browser.sh` 138/1 -> 139 passed, 0 failed
- Functional probe through `browser-lib.sh`: `hook_owner route-intent` = `agent-routing`,
  `hooks_owned_by agent-routing` = `route-intent`, leaf path
  `Guardrails/agent-routing/route-intent` - the browser really renders a toggle now.

Files touched: `claude/hooks/browser-tree.json`
