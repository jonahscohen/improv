---
name: Field-report remedies wired (H2 + H3 + artifact Gap A/B) into the grounding cluster
description: Lead integration of the four field-report remedies. Unit 1 (frontier-confirm-arm tree dedup) has its own beat. This records wiring H2 (declared-broken-guard) and H3 (named-tool-swap-arm + named-tool-swap-guard) into the default-ON grounding cluster, widening the artifact-open-mandate matcher to Chrome-MCP image tools (Gap A), and the verification. Both guardrails ship default-ON per Jonah. NOT committed at time of writing.
type: session
relates_to: [session_2026-08-07_frontier-confirm-arm-tree-dedup.md, session_2026-08-07_declared-broken-guard.md, session_2026-08-07_named-tool-swap-guard.md, session_2026-08-07_artifact-open-flow-fix.md, session_2026-08-07_tool-declared-broken-direct-order-failure.md, session_2026-08-07_artifact-open-field-failure.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (component-browser 147/0, hook-registry 94/0, registry audit 0 unmanaged, 4 hook suites green)
confidence: high
---

Collaborator: Jonah. Lead-side integration of the four remedies drawn from two field-report beats ([[session_2026-08-07_tool-declared-broken-direct-order-failure]] from yes-kaufmanrossin, [[session_2026-08-07_artifact-open-field-failure]] from DisneyPlusEmporium). Three units were built by parallel teammates (diaggate/artflow/swapgate); the lead built unit 1 and did all installer wiring so four writers never collided on shared files.

## The four remedies and their status
1. **Frontier-confirm-arm tree dedup** (the failing self-check) - DONE, own beat [[session_2026-08-07_frontier-confirm-arm-tree-dedup]]. 146/1 -> 147/0.
2. **H2 declared-broken-guard** (Stop) - built by diaggate (recovered from a mid-response API drop), 29/0 + shellcheck + Codex. Wired here.
3. **H3 named-tool-swap-arm (UserPromptSubmit) + named-tool-swap-guard (Stop)** - built by swapgate, 46/0 + shellcheck + Codex converged. Wired here. This is the guard the source beat warned over-fires; built conservative (5 conditions, fails open).
4. **Artifact-open Gap A (inline-image auto-satisfy) + Gap B (superseded-intermediate nudge)** - built by artflow in artifact-open-mandate.sh only, backstop untouched, 45/23/12 + Codex. Wired here (Gap A matcher widening).

## Wiring decisions (Jonah, via AskUserQuestion)
- H2 declared-broken-guard: **default-ON**. (Directly prevents the field failure; carve-outs limit false alarms.)
- H3 named-tool-swap guard: **default-ON**. (Chose ON over my recommended OFF; built conservative enough per swapgate.)
- Artifact Gap A: **widen the matcher** so the rule watches Chrome-MCP image tools (otherwise Gap A is dormant).

## What was wired (all lead edits; teammates touched no shared files)
Home = the **grounding** cluster (default-ON, holds task-loop-mandate/concise/elias). Behavioral guards are CLUSTER hooks (deploy via the cluster pass + cluster-wirings.json), NOT app hooks - so exempt from the install_app_hooks single-owner invariant.
- install.sh: appended declared-broken-guard.sh, named-tool-swap-arm.sh, named-tool-swap-guard.sh to the grounding cluster echo, AFTER elias-detect-stop.sh.
- claude/hooks/cluster-wirings.json: added 3 event blocks (declared-broken-guard -> Stop; named-tool-swap-arm -> UserPromptSubmit; named-tool-swap-guard -> Stop), placed after the elias-detect-stop block; widened artifact-open-mandate matcher from `Write|Artifact|Bash` to `Write|Artifact|Bash|mcp__claude-in-chrome__computer|mcp__claude-in-chrome__get_screenshot` (Gap A).
- claude/hooks/browser-tree.json: added the 3 hooks to the grounding node hooks list + 3 hook_desc entries + 3 hook_owner entries (all -> grounding).

## Ordering constraint (from diaggate's beat, honored)
declared-broken-guard's cross-gate deferral is ONE-directional: it checks the concise + elias flags but they do not check its flag. So it MUST run AFTER concise-detect-stop and elias-detect-stop in the Stop array. Both the install.sh echo order and the cluster-wirings.json placement put it after elias, so the deployed Stop order is correct.

## Verification
- browser-tree.json + cluster-wirings.json valid JSON; install.sh `bash -n` clean.
- hook-registry-guard.sh --audit: 0 unmanaged; --check managed for all 3 new hooks.
- test-component-browser.sh 147/0; test-hook-registry.sh 94/0; test-hook-data-parity 35/0; test-app-hook-offlist pass.
- Hook suites after wiring: declared-broken-guard 29/0, named-tool-swap-guard 46/0, artifact-open-mandate 45/0, artifact-open-stop 12/0.

## Known out-of-scope red (NOT mine)
test-settings-deploy-parity FAILS on `sidecoach-craft-floor.sh` (config,chrome / config,figma: "wired but NOT deployed"). Names a hook this work never touched; confirmed pre-existing on clean HEAD by the earlier teamheal pass. Left for a separate task.

## Files
- install.sh, claude/hooks/cluster-wirings.json, claude/hooks/browser-tree.json
- (unit 1 also) claude/hooks/hook-registry-guard.sh
- this beat + MEMORY.md pointers for the 3 teammate beats
