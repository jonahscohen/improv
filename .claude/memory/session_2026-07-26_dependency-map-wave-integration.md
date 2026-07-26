---
name: Dependency-map wave - lead integration of 6 agents (compactor, orphan, capability, dogfood, justify-core, cmux)
description: Lead-integrated the 6-agent dependency-map/hardening wave. compactor + orphan committed (3b21a22b). This beat covers the capability-breadth + dogfood-cleanup + justify-core + cmux integration, plus a lead fix to the stale font-research principle count.
type: project
relates_to: [session_2026-07-26_capability-breadth.md, session_2026-07-26_dogfood-marketing-path.md, session_2026-07-26_marketing-site-justify-core.md, session_2026-07-26_cmux-dependency-pinned.md, session_2026-07-26_memory-compactor-fixed.md, session_2026-07-26_orphan-improv-skill.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: full gate 168 suites green; capability test standalone + in-gate; cmux preflight 15/15; build clean no drift
confidence: high
---

Collaborator: Jonah. 2026-07-26. Lead integration of the dependency-map / harness-hardening wave (6 parallel agents).

## The 6 agents and their landing state

1. **Memory compactor** (afeed831bef0da78f) - COMMITTED `3b21a22b`. cap_line no-op fix; MEMORY.md 109KB -> 20KB; 44/44 incl new Scenario D.
2. **Orphan improv skill** (a0eaf6bfc9cca36a8) - COMMITTED `3b21a22b`. Stale rename orphan (improv -> justify); deployed copy moved to reversible backup; main-repo diff = beat only.
3. **Capability breadth** (a5202dc0573c53c64) - integrated here. Built rows 20+21 as typography guidance: font-pairing (cap at two, contrast across classification) + clamp() fluid type-scale (mandatory rem term, WCAG 1.4.4). New test `typography-fluid-pairing.test.ts` (plain-assert, negative controls). Agent ran Codex 2 rounds, folded 4 findings.
4. **Dogfood marketing path** (af8489dae8740f099) - integrated here. Premise was STALE: the dogfood scripts were already deleted 2026-07-25 in `ce3743fd`. No source fix. Lead cleaned the 12 orphan `dist/dogfood-*` artifacts left behind.
5. **justify-core.js** (a3f3553cc07e59a4d) - self-committed in the separate improv-site repo (`74cc31f`). Graceful-degrade: self-hosted `justify-loader.js` injects the :9223 daemon script only on opt-in (`?justify=1`/localStorage), default OFF. Browser-verified (0 console errors, 0 :9223 requests on default load). Main-repo artifact = beat only.
6. **cmux pin** (a59777bb3952ab481) - integrated here. Pin `cmux.version` = 0.64.20 + `cmux-preflight.sh` (POSIX sh, fail-closed exit 1/2, --warn soft, unparseable=warn) + `test-cmux-preflight.sh` + launcher wire (Teams path only, graceful fallback). Agent stopped mid-Codex, so lead ran an INDEPENDENT Claude review (not the producer): core logic verified clean (version-compare, return propagation, resolution chain, fail modes, launcher wire). One confidence-80 durability finding folded (see below). Final syntax gate: sh -n / bash -n / zsh -n all clean; test 16/16.

## Lead fix folded in (capability commit)

`flow-handler-font-research.ts:86` hard-coded `'Typography Domain Rules (16 principles):'` - a stale literal count (the array had 9, now 11 after the capability additions). This is a prompt string fed to the builder model, so a wrong count is misinformation. Changed to derive from the array: `` `Typography Domain Rules (${typographyRules.length} principles):` `` - consistent with the existing `${typographyRules.length} rules loaded` at line 77. The capability agent flagged this via spawn_task as out-of-its-scope; lead fixed it as part of the same typography unit. No test asserted the literal string (grepped), so no test breakage.

## Integration mechanics (lead-owned)

- Added `{ rel: 'src/__tests__/typography-fluid-pairing.test.ts', required: true }` to `scripts/run-tests.ts` next to typeface-vocabulary (Stage 4a sibling).
- `git rm` the 12 orphan `dist/dogfood-*` files; verified a clean `npm run build` does not re-emit them (sources gone).
- `npm run build` green: generate-lanes/validators/counter-rules all OK, no drift; tsc clean. dist regenerated with the new design-laws + font-research content.
- Full gate: **168 suites pass** (was 167; +1 typography-fluid-pairing).

## Commits (this wave)

- `3b21a22b` - compactor + orphan.
- (this pass) dogfood dist cleanup; capability breadth; cmux (after review). Push deferred to a single end-of-wave push.

## cmux review finding (folded)

Independent Claude review flagged one confidence-80 durability gap: the launcher gates on `[ -x "$_cmux_pf" ]`, so if `cmux-preflight.sh` ever regresses to mode 644 the guard silently skips forever; nothing re-asserts the bit (install.sh symlinks the `claude/cmux` dir with no chmod, unlike ~20 other scripts) and the 15-case suite ran the script via `sh "$PF"`, bypassing the exec bit. FOLDED: added a 16th test assertion `[ -x "$PF" ]` so a mode regression fails the suite loudly (the file is currently correctly 755 and git tracks the bit). DEFERRED to a task chip: the install.sh `chmod +x` for `claude/cmux` entry points - it would entangle this commit with the unrelated pending concise-hooks install.sh change (the grounding-cluster wiring), so it is left for the concise-hooks commit to add alongside.

## Dep-map audit HTML updated (browser-verified)

`docs/dependency-map/index.html` (hand-maintained inline-JS, no generator): flipped findings 654 (orphan) + 657 (justify-core) + 661 (dogfood) to resolved=true with dated resolution text + beat citations; cmux (660) rewritten to "Partly managed" (pin+guard, kept false for the residual CLI-shape risk); the sidecoach node's stale dogfood evidence/debt (537/539) corrected. Header stat corrected 6 -> 9 resolved and the intro narrative + updated-reason subtitle rewritten to this wave. Browser-verified via the Browser pane (file://): JS executes, all 11 findings render, header shows "11 findings, 9 resolved".

## Still open at time of writing

- Single end-of-wave push (ask) - the local wave commits (3b21a22b compactor+orphan, 38cce633 dogfood, b3f71e4d capability, a15c290c cmux, + final dep-map/beats commit) plus justify-core already on improv-site (74cc31f).
- Task chip spawned: install.sh `chmod +x` for claude/cmux entry points (rides with the pending concise-hooks install.sh change).

## Files touched (lead)
- sidecoach/src/flow-handler-font-research.ts (derive principle count)
- sidecoach/scripts/run-tests.ts (+1 suite)
- sidecoach/dist/* (rebuild; -12 dogfood orphans)
- .claude/memory/ (this beat + index)
