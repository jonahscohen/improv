---
name: Two architecture decisions - vocab collapse via alias map + fix plugin coupling by vendor-with-build-sync
description: Jonah ruled the two forks the simplification audit and distrib surfaced. Vocabulary simplicity gap -> collapse to verbs+NL with a thin PHASE_ALIASES map (zero breaking). Plugin self-containment -> vendor claude/hooks/sidecoach-lanes.json into sidecoach/data/ and repoint the runtime read, generated from the canonical source at build time so the two never drift.
type: decision
relates_to: [session_2026-07-24_simplification-plan.md, session_2026-07-24_distributability-plugin-manifest-package-metadata.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none - decisions recorded verbatim from an AskUserQuestion at the wave-1 boundary
confidence: high
---

Collaborator: Jonah. 2026-07-24. Two forks put to Jonah at the wave-1 commit boundary.

## Decision 1 - vocabulary collapse (workflow-simplicity gap, GAP5)
**Chosen: the audit's option B - alias map, zero breaking.** Collapse the ~5 parallel user-facing vocabularies to 2 typed surfaces (verbs + NL, lanes as the one preset), but keep a thin `PHASE_ALIASES` map so every old phase word still routes.

**Alternatives rejected:**
- Option A (hard cut, drop phases+modes, no fallback): rejected - breaking change for anything using phase words, for a marginal extra ~lines removed.
- Option C (doc-only relabel): rejected - relabels the gap instead of closing it; the parallel vocabularies still exist in code.

**Why:** smallest diff that actually LOWERS the surface count and resolves the modes/skill drift, while breaking nothing existing. Removes ~300 lines + the retired modes surface.

## Decision 2 - plugin coupling (distributability, the biggest self-contained-plugin blocker)
**Chosen: vendor with build-time sync.** The `/sidecoach <phrase>` path reads `claude/hooks/sidecoach-lanes.json` (orchestrator ~line 1014), a file OUTSIDE the sidecoach package, so it cannot be a self-contained installable plugin. Fix: copy the lane registry into `sidecoach/data/` and repoint the runtime read there, but GENERATE that copy from the canonical `claude/hooks/` source at build time so the two never drift.

**Alternatives rejected:**
- Vendor + accept two hand-maintained copies: rejected - the package copy and the canonical copy silently drift apart over time.
- Leave install-coupled (install.sh deploys it): rejected - sidecoach stays an installed component forever, never a standalone plugin; the goal stays permanently open.

**Why:** self-contained AND single-source-of-truth. More build wiring, no duplicated-file rot.

**Revisit when:** either the lane registry stops being the coupling point, or a plugin packaging standard makes repo-sibling reads first-class.

## Files touched
- this beat + MEMORY.md index (atomic-appended).
