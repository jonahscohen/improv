---
name: sidecoach-stage2-deletion-integrity-catch
description: Architect caught that 2 of the 3 "noise rules" slated for Stage-2 deletion are valued product guardrails (incl. the SVG-fabrication-ban enforcement); ruling = delete ReDoS only, keep+exclude the guardrails
type: decision
relates_to: [session_2026-06-24_sidecoach-jonah-gtswap-deletion-blessing.md, session_2026-06-24_sidecoach-m1-verified-decouple-decision.md]
---

Collaborator: Jonah Cohen.

PHASE 1 (GT swap) committed 30873478 - candidates.json now has observed-motion GT (lt 6, be 3, marginal flagged). Official scorecard: sidecoach objective 0.936/0.917, subjective R0.160 P0.434; oracle objective 0.064, subjective R0.125 P0.108. Objective unchanged, honest framing intact. (Lead to independently re-verify the subjective recompute.)

## INTEGRITY CATCH (architect, HELD Phase 2 before the destructive deletion) - VERIFIED by me
The "2 noise rules" planned for Stage-2 deletion are NOT dead noise - they're valued PRODUCT GUARDRAILS whose "noise" is an EVAL-CORPUS artifact (they fire on external sites, but those findings are UNMAPPED so they only inflate raw VOLUME, not recall/precision). I verified:
- taste/fabricated-svg = the SVG-FABRICATION-BAN enforcement (taste-validator.ts:159; referenced in icon-source-reference.ts x3 + flow-handler-component-implementation.ts + flow-handler-clone-match.ts as "the rule enforces this on commit"). Enforces the CORE team rule "NEVER fabricate SVG icons." Deleting it removes the enforcement of a core rule AND falsifies 4+ references. matchedClass=null (unmapped).
- taste/hex-in-interactive-state = a registered theming BLOCKER (taste-validator.ts:242). Real capability. matchedClass=null (unmapped).
- identical-card-grids = the genuine ReDoS, AND a real taste detector mapped to icon-tile-stack (matchedClass="icon-tile-stack", the over-firing P0.33 / 3 TP one we decided not to support).

## RULING: delete the ReDoS ONLY; keep + eval-exclude the guardrails
- DELETE scanIdenticalCardGrids (identical-card-grids): the real ReDoS pathology + a low-precision (P0.33) over-firing taste detector mapped to icon-tile-stack (which we decided not to support). Deleting is simpler + precision-positive (0.436->0.457, recall 0.160->0.143, tie holds). Net-simpler half of the committed Stage-1+2 pair, achieved.
- KEEP fabricated-svg + hex-in-interactive-state in the PRODUCT - they're valued guardrails (fabricated-svg is REQUIRED by the core SVG-ban team rule; keeping it isn't a judgment call). EXCLUDE them from the eval SCAN to clean the raw-volume "noise" optic WITHOUT deleting product code. They're unmapped, so excluding them changes 0 recall/precision.
This is the architect's recommendation (a)+(b), verified and adopted. The hard-checkpoint worked: "delete the noise" would have destroyed a core guardrail to clean an eval artifact = wrong tradeoff.

## Jonah refinement (inform, not re-ask)
Jonah blessed "execute the Stage-2 deletion (scanIdenticalCardGrids + 2 noise rules)" on the "noise" framing - which was WRONG for 2 of 3. Refining to ReDoS-only DELETES LESS (conservative/safe direction) + keeping fabricated-svg is required by the team rules, so it doesn't need his re-permission - but inform him transparently (we mislabeled guardrails as noise; deleting only the pathology; "simpler" still achieved). Give him a clear chance to object.

Verified via: grep fabricated-svg (taste-validator.ts:159 + icon-source-reference + 2 flow-handlers); scorecard-mapping.json (fabricated-svg/hex matchedClass=null, identical-card-grids->icon-tile-stack).
