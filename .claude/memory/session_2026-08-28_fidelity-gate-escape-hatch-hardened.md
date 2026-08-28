---
name: fidelity-gate dom_equivalence escape hatch closed + measured-values rule
description: Both-lever hardening for the repeat design-source-substitution failure - a rule clause (measured values + reuse the canonical component) AND a mechanical fix to the Figma-fidelity gate's free-text escape hatch
type: project
relates_to: [feedback_2026-08-27_interaction-model-wins.md, decision_2026-07-17_fidelity-gate-level2-tamper-evident-ledger.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex-review
confidence: high
---

Second self-report from the ppai session (Merch Moves Us) surfaced a REPEAT of the design-source-substitution root cause one level down: pixel values eyeballed from screenshots instead of measured from get_design_context, the theme's canonical button component ignored in favour of off-system button styling, and pixel-perfect CLAIMED without proof by abusing the Figma-fidelity gate's dom_equivalence escape hatch. Jonah chose "Both" (rule + tooling) in the improv-pm session.

**Tooling (the primary lever, per the escalation-ladder rule: a repeat failure gets a gate, not more prose).** `claude/hooks/figma-fidelity-stop.sh`: the dom_equivalence field was a free-text escape hatch - ANY non-empty string made a real figma-vs-dom mismatch PASS (line ~704). Closed it: dom_equivalence is now honoured only when a new `equivalence_holds(prop, figma, dom)` verifier INDEPENDENTLY confirms a known serialisation quirk. Today the only quirk is a zero length a browser serialises as the keyword `normal`, and it is PROPERTY-SCOPED to letter-spacing / word-spacing (where `normal` computes to 0). An unverifiable pair now BLOCKS with a message telling the agent to add a SOUND predicate, not hand-wave the reading.

**Codex review (item 8) found a real HIGH and it was folded.** First cut of equivalence_holds was value-only, so `line-height: 0px <-> normal` (where normal is ~1.2x, NOT zero) and `margin: 0px <-> normal` (margin has no `normal`) would still pass - the hole left open for that shape. Fix: made the predicate property-aware (`_ZERO_NORMAL_PROPS = {letter-spacing, word-spacing}`), corrected the docstring (it had wrongly cited line-height), widened `_ZERO_LEN` for sign/leading-dot per Codex's false-failure note, and updated the stale rule-4 header comment. Added negative tests: line-height and margin `0px<->normal` now BLOCK; word-spacing passes. Full suite 77/77 green (was 74), test-figma-ledger.sh + test-figma-optout-block.sh both green. The documented LIMIT is unchanged: a determined forger mirroring `dom := figma` still passes; only an independent human read catches that (the gate catches DRIFT and OMISSION, not fabrication).

**Rule (the un-mechanizable remainder).** Verification Protocol item 3 (`claude/RULES.md`, mirrored to live `~/.claude/CLAUDE.md`) gained two clauses: (1) "Values come from the design source, measured, not eyeballed" - pull each element's exact colour/size/weight/spacing/dimension via get_design_context/tokens and set the literal value; a screenshot is a reference, not a ruler. (2) "Reuse the project's existing canonical component" - use the design system's button/card/input treatment, do not re-style an off-system variant. Item 6's "Verify with your eyes" was reconciled: the eye confirms it renders and reads right, the measured value confirms it matches the source.

**Why property-scoping matters:** `normal` is a keyword whose computed value is property-dependent. Equating it to 0 is sound ONLY where the spec says normal resolves to 0. A value-only check is an unsound gate - exactly the kind of false pass a fidelity gate exists to prevent.

Files touched: claude/hooks/figma-fidelity-stop.sh, claude/hooks/test-figma-gate.sh, claude/RULES.md, ~/.claude/CLAUDE.md (live copy), this beat + MEMORY.md.
