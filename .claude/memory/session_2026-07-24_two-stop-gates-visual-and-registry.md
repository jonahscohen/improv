---
name: Two Stop gates handled - visual override (standing rule) + Stage 3b hook packaging deferred to integration
description: The visual-verify gate re-armed on stage1-mine's eval-fixture HTML (same false positive Jonah already ruled on - standing override applied). The hook-registry gate correctly flagged the unpackaged claude/hooks/sidecoach-detect.sh that stage3b-hook is still building; packaging + the activation decision are deferred to integration by design, not overlooked.
type: decision
relates_to: [session_2026-07-24_visual-gate-override-eval-fixtures.md, session_2026-07-24_autonomous-wave1-dispatched.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - operational; both are gate-handling decisions
confidence: high
---

Collaborator: Jonah. 2026-07-24. Two Stop gates fired on the same stop.

## Gate 1 - visual-verify (FALSE POSITIVE, standing override applied)
stage1-mine's Stage 1a work wrote synthetic probe fixtures (`eval/fixtures/provider-sample-alldefect/*.html`), re-arming the extension-keyed visual gate. This is the IDENTICAL pattern Jonah ruled on last turn (session_2026-07-24_visual-gate-override-eval-fixtures.md): eval fixtures graded by the detector are behavioral, not aesthetic, so a screenshot proves nothing. Applied the STANDING override rather than re-asking an identical question (re-asking would be friction Jonah explicitly would not want, and the question was already answered). Flag cleared.

## Gate 2 - hook-registry (REAL, deferred to integration by design)
`claude/hooks/sidecoach-detect.sh` exists on disk (stage3b-hook, the Stage 3b unit, is STILL RUNNING and owns it) but is not packaged into browser-tree.json / install.sh / app-wirings.json, so the registry gate blocked. This is NOT an oversight:
- stage3b-hook was scoped to deliver the script + test + a registration NOTE, with ACTIVATION explicitly deferred to Jonah (auto-activating a per-edit Playwright scan hook mid-session could disrupt this very session).
- Packaging a hook while its owning teammate is still building it risks wiring a stale name/interface.
- The registry gate offers two valid resolutions: package it (browser-tree + install.sh + app-wirings event wiring), OR declare it repo-only in settings.json + pinned_hooks. Which one is correct depends on the ACTIVATION decision that belongs to Jonah.

DECISION: defer packaging to the wave integration step. When stage3b-hook lands, packaging into browser-tree.json + install.sh is part of properly completing Stage 3b's "productize across the harness" goal; the ACTIVATION half (app-wirings event wiring vs settings.json repo-only) is surfaced to Jonah because auto-running a detect scan on every UI edit is a real perf/product call, not a mechanical one. Recorded so integration does not forget to package it, and so the registry gate's block is honestly answered ("mid-build, packaged at integration") rather than bypassed.

## Files touched
- this beat + MEMORY.md index. No code changed.
