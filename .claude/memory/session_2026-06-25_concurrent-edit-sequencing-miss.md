---
name: concurrent-edit-sequencing-miss
description: Lead self-analysis - dispatched Task #5 (low-contrast) to sidestripe while buzzword was mid-flight on Task #1, both editing the SAME central registry/codegen/golden files in a shared tree (worktree isolation is a no-op here). No damage (buzzword caught it + changes compose) but a process lesson - registry-touching units must be SEQUENCED, not parallel.
type: feedback
relates_to: [feedback_agent_worktree_isolation_unreliable.md, session_2026-06-25_stage6-oneengine-audit-and-lowcontrast-hole.md, session_2026-06-25_stage5-team-dispatched.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## WHAT HAPPENED
I dispatched Task #5 (wire low-contrast into the live path) to the sidestripe teammate while the buzzword teammate was still finalizing Task #1 (marketing-buzzword detector). Both units edit the SAME central files: src/product-rule-registry.ts, src/validators.generated.ts, src/validators/checks/rendered-checks.ts, and the golden src/__tests__/product-rule-registry.test.ts. cmux teammates share ONE working tree (worktree isolation is a known no-op - [[feedback_agent_worktree_isolation_unreliable]]), so the two units' edits intermixed and the combined tree transiently showed golden-row mismatch + codegen drift while Task #5 was half-done. buzzword flagged it and correctly did NOT clobber Task #5's checkLowContrast or regenerate over it.

## WHY IT HAPPENED (self-analysis, honest)
I reasoned about the two units as INDEPENDENT because their DETECTION concerns are orthogonal (a new subjective rule vs re-pointing an existing a11y rule). They are logically independent - but they are not FILE-independent: ALL registry rules live in the same registry + codegen + golden files, so any two rule-adding/rule-editing units collide there. I knew teammates share the tree (I even cited the isolation-no-op beat at dispatch) but did not connect "shared tree" + "both touch the registry" = "concurrent-edit hazard." The signal I missed: the unit of parallelism isn't the detection concern, it's the FILE SET.

## THE FIX / RULE
When two teammate units both touch the registry / codegen / golden (or any shared central file set), SEQUENCE them - one lands + regenerates, the next starts from that base - OR have the lead own the codegen/golden integration. Parallel teammates are safe only when their FILE SETS are disjoint. For registry work specifically: only ONE rule-editing unit in flight at a time, or accept that the second must regenerate codegen + golden from the COMBINED tree (which is what I'm now directing sidestripe to do).

## OUTCOME (no damage)
The changes COMPOSE (buzzword adds a new polish rule + check; sidestripe re-points an existing a11y rule + adds a check - different registry rows, different RENDERED_CHECKS keys). generate --check passes again (codegen reads the registry, so it picked up both). I directed sidestripe to finalize from the combined tree (keep golden count 59, both checks survive, full npm test). One Codex review on the combined batch follows.

## Files touched
- (self-analysis beat; no code)
</content>
