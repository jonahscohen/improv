---
name: Wire-up wave lead-verified + committed - 2 built-never-wired services made real, 1 deleted as superseded
description: The 3 built-never-wired services resolved per Jonah's ruling. ref-update (reference-update-service made a real capture-preserving updater + bin/sidecoach-refs.js) and drift-detector (project-drift-detector wired via bin/sidecoach-drift.js, 2 ungated tests now gated) are REAL; flow-domain-integration + flow-domain-mapping DELETED (superseded, evidence-backed). 85 suites green (81 + 4). Each beats oracle on a concrete axis.
type: project
relates_to: [session_2026-07-24_wave4-and-wireup-decision.md, session_2026-07-25_flow-domain-deleted-lead.md, session_2026-07-25_reference-update-service-wired.md, session_2026-07-25_drift-detector-wired.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: gate - npm run build clean (both --check OK), npm test 85 suites; ref-update capture-preservation + fail-closed test 9/9; drift-detector 6-round Codex to no-findings + fail-closed matrix; flow-domain both files 0 importers
confidence: high
---

Collaborator: Jonah. 2026-07-25. Jonah ruled "make all 3 real" (goal: functionally better/faster/easier/more real than oracle). Outcome: 2 made real, 1 honestly deleted.

## ref-update (reference-update-service made REAL)
Rewrote the 337L stub into a 649L real capture-preserving updater + `bin/sidecoach-refs.js`. Two-location model: upstream (repo `bundles/`) -> local (user-owned `~/.claude/sidecoach/reference-bundles/`) with captures folded from the real `/curate` catalog (`~/.claude/design-references/`). LOAD-BEARING: union-preserving merge - a user capture is NEVER clobbered on an upstream refresh (both local-only + catalog captures survive; catalog wins a slug conflict). Pruned 5 speculative stubs (version-cache, network-fetch stub, fictional user-captures model, always-false checker, fake async). Fail-closed exit 0/1/3/4/5. Foreground Codex 4 findings folded (broken upstream now surfaces as failed apply not exit 0; corrupt local refused not overwritten; DESIGN.md failure surfaced; loader crash guard). Lead-verified: test 9/9 (incl capture-preservation + fail-closed), tsc clean. BEATS ORACLE: theirs is a hosted catalog you can't own/refresh; ours is local, user-owned, capture-preserving.

## drift-detector (project-drift-detector WIRED)
`bin/sidecoach-drift.js` reads a project's committed DESIGN.md baseline + every custom prop (CSS + <style>) and names tokens DRIFTED off-system (color/radius/spacing/easing/duration) with value + file. project-drift-detector.ts SOURCE unchanged (clean wire-up via a new CLI + gating). Fail-closed 0/1/2/3 - "cannot assess" is never a false "no drift". The 2 previously-UNGATED tests are now gated + a new CLI contract suite. 6-round foreground Codex converged to NO findings (whitespace FN, commented props, unreadable-clean, last-wins masking, string/function `--*`, !important). It caught a REAL masked drift on the actual ../reference project (`--c-text-tertiary` redefined later with the sanctioned value - hidden under a naive scan, surfaced by per-distinct-declaration checking). Honest KNOWN SCOPE BOUNDARY: CSS identifier-escaped prop names unassessable (frozen detector matches `--[\w-]+`). BEATS ORACLE: theirs evaluates a page in isolation with no design-system memory; ours governs accretion against a known committed baseline, even masked overrides.

## flow-domain-integration (DELETED - superseded)
Evaluated per "you decide": SUPERSEDED with decisive evidence (domain rules already reach flows two live ways; the integrator feeds no consumer; reviving it is BUGGY - stale 10-of-26 matrix + wrong uxWriting/writing key). Both flow-domain-integration.ts + flow-domain-mapping.ts (0 importers) deleted. A real live-path issue Codex found (getValidatorsForFlow not attached every branch + memory-before-validation ordering) spawned as task_092f2fbc.

## Gate + commits
npm run build clean, npm test 85 suites (81 + reference-update + project-drift-detector + drift-cli + sprint1-integration). Committed per-unit: flow-domain deletion, ref-update, drift-detector, build (run-tests + dist), beats. The wave-lessons held again - no orphans (foreground reviews), lead-owned run-tests + dist.

## Files touched (lead integration)
- scripts/run-tests.ts (4 suite lines), dist rebuild, this beat + MEMORY.md.
