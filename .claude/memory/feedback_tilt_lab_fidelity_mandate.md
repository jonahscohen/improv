---
name: tilt-lab effects must be 1:1 faithful to their originals
description: User mandate (2026-05-29) - every acquired tilt-lab effect's code AND paired settings/params must match its original source exactly. Nothing dropped or simplified; only additive enhancement allowed. Any missing uniform/param/default/behavior is a FAILURE, not a minor gap. Verify each against its recon report + original.
type: feedback
relates_to: [feedback_clone_1to1.md, session_2026-05-29_tilt-lab-acquisition-exec.md, session_2026-05-29_tilt-lab-ui-exec.md]
---

Collaborator: Jonah. 2026-05-29.

## The mandate
"The code and paired settings must match what already exists - nothing can be lost, only added to enhance what was already there. Any shortage, anything missing results in failure." Said after a quick run-through revealed some acquired effects are OUT OF STEP with their original counterparts.

**Why:** this is the [[feedback_clone_1to1]] rule applied to tilt-lab - when porting/cloning, match EVERY detail (uniforms, params, default values, render modes, visual behavior). The acquisition agents (tilt-acquire team) sometimes simplified: e.g. mesh-gradient dropped `colorStops` from manifest params ("no array ParamType"), ascii dropped 3d/disco/shapes modes as "out of core trio", some effects reimplemented rather than ported verbatim. Each such omission is a defect to fix.

**How to apply:** the per-effect sweep is a FIDELITY AUDIT, not just a render check. For each effect:
1. Read its recon report `docs/superpowers/tilt-lab-recon/lane-*.md` (captured the verbatim original source + full uniform/param list).
2. Read the built `tilt-lab/runtime/effects/<id>/{index.ts, manifest.json}`.
3. Diff for ANYTHING dropped/simplified: missing uniforms, missing params, changed defaults, omitted render modes, simplified shaders. The manifest param list must expose every tunable the original had (add new ParamType kinds if needed rather than dropping a param, e.g. color-array/stops).
4. Restore every gap (additive only - never remove existing working code).
5. Visually verify it renders AND matches the original's look.

Missing = failure. Be exhaustive, not expedient.
