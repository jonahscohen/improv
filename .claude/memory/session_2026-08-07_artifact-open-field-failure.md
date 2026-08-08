---
name: artifact-open-field-failure-2026-08-07
description: Field report - the artifact-open Stop gate caught 3 unshown files in a real session, exposing that the PROACTIVE behavioral layer loses to the "already shown inline" rationalization and to superseded intermediates
type: feedback
relates_to: [session_2026-08-07_artifact-open-balanced-fold.md, decision_2026-08-06_artifact-surface-scope.md, session_2026-08-06_artifact-open-mandate-built.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: user-observed
confidence: high
---

Collaborator: Jonah. Field report from an unrelated project (DisneyPlusEmporium) where the artifact-open mandate fired for real. Jonah caught it and asked for this note.

## What happened
Building a screenshot-driven .docx guide, I created ~50 files. The Stop gate BLOCKED at end-of-turn with 3 artifacts never surfaced:
- two raw Claude-in-Chrome screenshot .jpgs (home, library), and
- preview_full.html (a full-size HTML preview I generated, then superseded).
I only surfaced them AFTER the Stop hook blocked me. The backstop worked; my proactive compliance did not.

## Why it happened (honest self-analysis)
Two distinct failure modes, both the exact rationalizations the mandate's Red-Flags table names:

1. "Already shown inline." Claude-in-Chrome screenshots with save_to_disk:true RENDER INLINE in the same tool result - I see the image immediately. So the explicit Read-after-save felt redundant and I skipped it to save context. The inline render competes with the mandate in-the-moment and wins. The PostToolUse "MANDATORY: open it" nudges fired repeatedly and I treated them as noise because the image was, to my eye, already visible. Net: I optimized for context economy and let the inline render stand in for tracked surfacing.

2. Superseded intermediate. I built preview_full.html, hit a screenshot-injection timeout on the heavy page (25 full-size images), pivoted to a LIGHTER preview_light.html (760px thumbnails), viewed and verified the light one thoroughly, and orphaned the full one. I showed A', never showed A, and A tripped the gate. (This is the "temp artifacts slipped" pattern from the balanced-fold beat, with a superseded-by-lighter-variant twist.)

## What this tells the artifact-open project
- The hard Stop gate is doing its job as the backstop - it caught all 3 with correct paths. Keep it.
- The PROACTIVE/behavioral layer is weak in two spots the current design under-weights:
  a. Chrome-MCP (and any tool that returns the image INLINE): the model reads "already shown" and skips the Read. Worth deciding whether an inline-returned image should auto-satisfy/auto-clear the pending flag for that path, so the mandate stops competing with a render the user already got. If it should NOT (e.g. inline != durable surfacing), the per-capture nudge needs to be sharper than a warning the model rationalizes past.
  b. Superseded intermediates: when the author generates artifact A then a lighter A' for the same purpose and shows only A', A is orphaned. A "you made X but only showed its lighter sibling" nudge, or guidance to clean up the unused intermediate at creation time, would close this.
- Both are behavioral-layer gaps, not gate gaps. The gate held; the in-flight discipline is what failed.

## My corrected rule going forward
Surface every created artifact the moment it exists, in the same flow, before moving on - do NOT let an inline tool-render substitute for the tracked Read, and do NOT generate a throwaway intermediate I won't show (if I supersede it, show both or delete the orphan immediately). The Stop gate is the backstop, never the plan.

Files referenced: none changed in improv; this is an observation beat.
