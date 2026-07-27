---
name: Sidecoach flow-redundancy evaluation (analysis only, Codex-reviewed)
description: Source-verified redundancy audit of all 26 sidecoach flows. Finds 4 duplicate handler classes with the wrong copies shipped, a false-green retry-control test, and 4 flows whose registry description does not match what their handler delivers. No code changed.
type: project
relates_to: [session_2026-07-26_sidecoach-20-validators-catalog.md, session_2026-06-24_sidecoach-option-B-convergence-mandate.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: codex-review (codex-cli 0.142.5, read-only, 12 numbered verdicts; 2 disagreements folded in and re-verified against source)
confidence: high
---

Evaluation only - no code was changed, nothing deleted. Question asked: are any sidecoach flows
redundant or superfluous, and what can be merged without losing quality?

Verification baseline probed first: `npx tsc --noEmit` in `sidecoach/` exits 0. A green baseline exists.

## Inventory reconciliation - "26 flows" vs "20 handler files"

Both numbers are correct and there is no gap. `flows.ts` registers 26 flows (flowA..flowZ). Only 20 have a
dedicated `flow-handler-*.ts` file; the remaining 6 live in aggregate files - N/O/P/Q in
`flow-handlers-tier3-tier4.ts`, Y in `flow-handlers-extended.ts`, Z in `flow-handlers-core.ts`. All 26 are
registered in `sidecoach-orchestrator.ts` `initializeHandlers()` and all 26 have an intent detector. The
26-vs-20 discrepancy is file layout, not missing flows.

The trailing "Note" paragraph in `session_2026-07-26_sidecoach-20-validators-catalog.md` is wrong and
self-contradicting (it names flows as "not implemented" that appear in its own list). Treat that note as
retracted; the rest of that catalog is accurate.

## Finding 1 (HIGH, correctness bug not just redundancy) - four duplicate handler classes, mixed copies shipped

`flow-handlers-tier3-tier4.ts` defines FlowJ/K/L/M handler classes with the SAME class names as the dedicated
files. The orchestrator imports a mixed set:

- J -> dedicated `flow-handler-tactical-polish.ts`. The tier3-tier4 FlowJ is dead.
- M -> dedicated `flow-handler-responsive-validation.ts`. The tier3-tier4 FlowM is dead.
- K -> tier3-tier4. The dedicated `flow-handler-multi-lens-audit.ts` is dead in production.
- L -> tier3-tier4. The dedicated `flow-handler-design-critique.ts` is dead in production.

Neither copy of K or L is a superset of the other:
- Dedicated K has token-drift detection (shells `bin/sidecoach-drift.js`), T-0009 retry-control halt, and
  FlowMemory. It lacks AntiPatternValidator.
- Shipped K has AntiPatternValidator.validateBatch. It lacks token drift, retry control, and flow memory.
- Dedicated L has retry-control halt + FlowMemory. Shipped L has the 12-rule CRITIQUE_RULES framework,
  CategoryReflexDetector slop detection, and ProjectPersonaEngine personas from PRODUCT.md.

Why this matters: production `audit` and `critique` run with NO retry-control halt and NO flow memory. The
convergence loop can re-fire them indefinitely against an unchanged target.

## Finding 2 (HIGH) - false-green retry-control test

`__tests__/t9-retry-control.test.ts` and `__tests__/t12-model-routing.test.ts` import FlowK and FlowL from the
DEAD dedicated files. The T-0009 retry guarantee is asserted green against code that never executes in
production. Any fix to Finding 1 must repoint these tests.

## Finding 3 (MEDIUM) - engine depth is very uneven (corrected after Codex pushback)

The first draft claimed "only three handlers do real work". Codex disagreed and was right - that grep only
caught direct filesystem calls. Corrected tally across the 26 shipped handlers:
- Direct filesystem/subprocess work: J, K(dead copy), F, N.
- Consult real reference/data modules (genuine work, no direct fs): B (component.gallery), C, D (reference
  catalog + slop filtering), E (prescribed/banned easings), G (ExtendedDomainValidator + icon-source), H
  (motion-stack-idioms + token citation), M (reference-loader + Bencium table), L(shipped), W and X
  (landing-composition-data / copywriting-templates).
- Pure static string payload with only a memory builder: I (large but static), O, P, Q, R, S, T, U, V, Y, Z.

Roughly a third of the flow surface is static prose wearing a handler interface.

## Cluster verdicts

**Motion E / H / T - T is REDUNDANT.** E and H are both real and reference-backed. T (103 lines) is a static
stub whose registry description promises "shaders, spring physics, scroll-driven reveals, 60fps cinematic
transitions" and whose handler delivers none of it - just generic 150/300/500ms durations and
"hover (scale 1.05), active (scale 0.95)". T contradicts its siblings: E and H derive easings from the
prescribed reference and DESIGN.md tokens, T hardcodes them, and T's "scale 0.95" conflicts with Flow J's
scale(0.96). Nothing is lost by folding T into H's existing `ambitious` intensity tier - H already computes
that tier and already varies durations by it.

Live hazard confirmed with Codex: `flow-prerequisites.ts` makes E a REQUIRED prereq of H but only an OPTIONAL
prereq of T, and the `animate` verb routes to [H, T] without E. On a project where E has not run, H is
prerequisite-blocked and T is what actually executes. The weakest, self-contradicting handler is the one that
fires. `/sidecoach overdrive` routes to T alone.

**Polish J / R / S - CONSOLIDATABLE.** J (456 lines) is the one rich polish flow. R (99) and S (121) are
structurally identical boilerplate differing only in their static strings. J already owns S's territory
(text-wrap balance, font-smoothing, tabular-nums). Codex pushed back on the draft over-crediting R: R's 8px
spacing scale overlaps and partly conflicts with the shared spatial law in `design-laws.ts`. Preservation plan
if merged into one parameterized refinement handler: keep S's type ladder plus its `findTokenLine` DESIGN.md
citation, and reconcile R's scale against design-laws rather than restating it.

**Audit K / V / I / L - V is REDUNDANT as implemented.** Flow V is registered as "chains all 7 tiers for
verification" and chains nothing - it emits a 4-item checklist plus 7 generic lines that duplicate K
(a11y/perf/responsive/cross-browser) and M (viewports). It is strictly worse than running K + I + M. Either
delete it and point `harden` at a real composite (`FlowCompositionEngine` / `PRESET_COMPOSITE_FLOWS` already
exists and is the correct mechanism) or reimplement it as an actual composition. I is DISTINCT (only 7-domain
WCAG criterion map). K and L are DISTINCT lenses (technical scan vs design judgment) - keep both, but fix
Finding 1.

**Curate U vs D - U is REDUNDANT/superfluous.** D is real (searches the catalog, category-reflex slop
detection, filters genericityScore < 0.6). U is a 111-line static stub advertised as a "5-step wizard for
adding to the design-references catalog" that writes nothing and emits a generic 8-step checklist. A real
`/curate` SKILL already exists at `claude/skills/curate/SKILL.md` and does write
`~/.claude/design-references/<slug>/ref.md`. Flow U is a degraded restatement of a working skill.

**Component B vs G - DISTINCT, keep both.** B is research (component.gallery patterns, semantic markup, a11y
patterns, per-component WCAG validation). G is implementation (ExtendedDomainValidator, icon-source, DESIGN.md
token citation, states). Different inputs, different outputs, both real.

**Flow Z - flagged by Codex, not in the original scope.** Z is another composite-stub: it only instructs the
user to run audit/critique/polish, duplicating G plus the QA triad. Same category as V.

## Finding 4 (MEDIUM) - contradictory hit-area constant

M says 44x44 (WCAG 2.5.5). J says 40x40. D says 40. I mixes both. `design-laws.ts` itself states both 44 and
40 in different places. Five sources, two numbers, no single source of truth. Codex flagged the draft as
understating this - it is wider than the three flows first identified.

## Finding 5 (LOW, corrected after Codex pushback) - verb-surface coverage

The 21-verb registry references only 19 of 26 flows; N/O/P/Q/W/Y/Z have no verb. The draft claimed these were
NL-only, which Codex correctly disputed: `PHASE_ALIASES` in `slash-command-router.ts` still routes
N/O/P/Q/Y/Z via legacy phase words (clone, constrain, migrate, rapid, research). Verified. The corrected claim
is narrower: only **flowW_landing_composition** is absent from the verb registry, from PHASE_ALIASES, and from
`flow-prerequisites.ts`, leaving NL intent detection and flow-composition presets as its only entry points.

## Ranked recommendations (value vs risk)

1. **Collapse the four duplicate handler classes into one file each, keeping the union of capabilities, and
   repoint the tests.** Highest value (fixes a real correctness bug plus a false-green test), low risk,
   roughly half a day. This is the one item that is a bug fix, not a cleanup.
2. **Kill Flow T, fold "ambitious" into H's existing intensity tier, and fix the animate/overdrive routing so
   the prereq-blocked path cannot fall through to a stub.** High value, low risk, a few hours.
3. **Kill Flow V (and reconsider Z) or reimplement as real compositions via FlowCompositionEngine.** Medium
   value, low risk. Nothing is lost - both are checklists telling you to run other flows.
4. **Kill Flow U, route `extract` to the existing /curate skill.** Medium value, low risk, ~1 hour.
5. **Merge R + S into one parameterized refinement handler; reconcile R's spacing scale against
   design-laws.ts.** Medium value, medium risk (the payload is thin but it is the only place some of that
   vocabulary lives). Half a day.
6. **Unify the hit-area constant on 44x44 in one shared module.** Low effort, removes a live contradiction
   the flows currently emit at users.

Net: of 26 flows, 4 are genuinely redundant (T, U, V, and arguably Z), 2 are consolidatable (R + S), and the
rest are distinct. The larger prize is not flow count - it is that 4 handler classes are duplicated with the
wrong copies wired in.

## Codex agreement summary

Codex (codex-cli 0.142.5, read-only, independent pass over the same source) returned 12 numbered verdicts:
AGREE on the inventory reconciliation, Findings 1, 2, 4, and on the motion, audit, curate, and component
cluster verdicts. Two DISAGREEs, both valid and both folded in above: Finding 3 was overstated ("only three do
real work" was an artifact of a filesystem-only grep) and Finding 5 was wrong about reachability (legacy phase
aliases still route six of the seven). Codex also added two items the draft missed: the animate/overdrive
prerequisite fall-through to T, and Flow Z as a composite stub in the same category as V. Both were
independently re-verified against source before inclusion.

## Process note (harness bug, worth fixing)

Subagent fan-out was blocked by a contradiction in the harness: a PreToolUse hook requires every `Agent` call
to pass a `name` ("must spawn as a NAMED teammate"), while the runtime rejects a named spawn from a teammate
("Teammates cannot spawn other teammates - the team roster is flat"). Both paths error, so a teammate cannot
delegate at all. Worked around by doing the reads directly and invoking Codex through Bash. The hook should
exempt teammate-context callers from the name requirement.

## Files read (none modified)

- sidecoach/src/flows.ts, sidecoach-orchestrator.ts, flow-handler.ts, intent-detector.ts
- sidecoach/src/flow-handlers-{core,extended,curate-qa,tier3-tier4,tier5-specialized}.ts
- sidecoach/src/flow-handler-*.ts (all 20)
- sidecoach/src/verb-command-registry.ts, slash-command-router.ts, flow-prerequisites.ts, flow-composition.ts, lanes.generated.ts
- sidecoach/src/__tests__/t9-retry-control.test.ts, t12-model-routing.test.ts
- claude/skills/sidecoach/SKILL.md, claude/skills/curate/SKILL.md
