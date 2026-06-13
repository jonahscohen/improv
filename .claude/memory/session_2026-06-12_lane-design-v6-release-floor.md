---
name: lane intent detection design v6 - bounded release floor
description: Fifth review verified; Jonah adopted the bounded product-validation release floor for lane_converge; four-status rule results, run-derived coverage, cleanPolicy schema
type: decision
relates_to: [session_2026-06-12_lane-design-v5-complete.md, reference_convergence_validator_capability_inventory.md]
supersedes: session_2026-06-12_lane-design-v5-complete.md
---

Spec revised to v6 after the fifth independent review. Jonah's decision
(2026-06-12): ADOPT the bounded product-validation release floor.

**Verified review claims (all confirmed in source):**
- Flow J's collector walks ONE level deep, CSS-family files only for rules,
  root+one-level HTML/MD for copy (its own comments say so) - TSX-heavy /
  CSS-in-JS / nested projects largely escape it.
- Absence passes: concentric-radius rule is `passed:
  ctx.computedStyle?.borderRadius !== '0px'` - undefined evidence scores as
  compliance.
- N/A-as-pass is a DOCUMENTED convention: tier2 domain modules state "Every
  rule degrades to N/A (passed: true) when the markup it inspects is absent."
- So a "clean" Flow J result mixes inspected passes, defaulted passes, and
  not-applicables - it could not truthfully back v5's static measuredScope.

**Choice made:** capability architecture retained; lane_converge ENABLES only
when the release floor is met: (1) Flow J hardened - recursive coverage-aware
discovery, four-status ProductRuleResult (pass | fail | not_applicable |
inconclusive), absence-passes and N/A-as-pass eliminated, unsupported/
unreadable scope = inconclusive; (2) three static slices as independent
product validators: theming/token consistency, CSS anti-patterns, reliable
static accessibility (rule logic mostly exists per the capability inventory -
the work is honest evidence collection). Browser-dependent (rendered
responsive, CWV, screen reader) and judgment-heavy (Nielsen, cognitive load)
validation stays advisory as separately reviewed follow-ups. Full Option B
rejected as excessive. The classifier and five sequence lanes do NOT wait on
the floor.

**Alternatives considered:**
- Pure Option A (hardened Flow J alone gates): rejected - converged would
  mean a polished static lint loop; the floor's marginal cost is low because
  the slices share the collector work Flow J hardening requires anyway.
- Full Option B before release: rejected - browser harness + calibrated
  judgment as a release dependency would delay the lane substantially or
  pressure weak proxies into the gate.

**Also folded in (v5-review P1/P2, truthfulness completions):**
- cleanPolicy as structured testable data (requiredRuleIds,
  blockingSeverities, toleratedFindingCountsByClass, minimumCoverageByScope,
  inconclusiveBehavior: block, notApplicableBehavior: exclude_and_report),
  persisted with each run.
- registryScope (maximum capability) vs run-derived measuredScope from a
  persisted coverage record (inspectedFiles, skippedFiles, source kinds,
  ruleCounts); summaries generated from run coverage, never registry alone.
- Advisory failure display qualification:
  machine_checks_clean_with_advisory_warnings (persisted status stays
  converged; bare "converged" never shown when coaching didn't complete).
- Release-floor truthfulness acceptance suite (TSX/CSS-in-JS fixture,
  evidence-removal -> inconclusive, N/A excluded from rates, shallow-CSS
  can't claim full matrix, slice mutations block convergence, registry check
  blocks lane_converge until floor validators green).
- Blast radius += polish-standard-validator.ts, extended-domain-validator.ts,
  domains/*, new slice modules, recursive collector.

v6 status: every review-tier disposition is now Approve or implemented;
remaining step is the implementation plan (writing-plans).

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v6 edits)
