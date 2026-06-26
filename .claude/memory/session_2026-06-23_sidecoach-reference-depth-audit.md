---
name: Sidecoach reference integration - Deliverable C (depth audit) - C2 done + dead-bundle finding
description: Attached visual-effects + tilt-lab as additive preflight artifacts; discovered sidecoach/bundles/*.json are dead snapshots (no runtime reader), so literal bundle-enrichment has zero runtime effect
type: project
relates_to: [session_2026-06-23_sidecoach-reference-preflight.md]
---

Collaborator: Jonah Cohen

Deliverable C (depth audit), under the lead's HARD additive-only constraint. C2 done; C1 (bundle enrichment) blocked on a material finding awaiting direction.

## C2 DONE: visual-effects + tilt-lab attached as preflight artifacts (additive, soft-fail)
- `sidecoach/src/reference-preflight-artifacts.ts`: added `readSkillArtifact(skillName, kind, title)` that reads `~/.claude/skills/<skill>/SKILL.md` READ-ONLY (constraint D respected - never modifies the skill), strips frontmatter, caps at 1800 chars, soft-fails to null when absent. Added two probes: `visual-effects` and `tilt-lab`. Extended the artifact `kind` union + ordering.
- Result: a build/refinement lane's referencePreflight now surfaces 6 artifacts: component, fonts, motion, icon-source, visual-effects, tilt-lab (design-references too when the live catalog matches the project voice). Same additive + soft-fail pattern as deliverable B.
- Proof (harness): `referencePreflight.artifacts: 6` incl. `[visual-effects]` and `[tilt-lab]`. Gates: `npm run build` exit 0; `npm test` 56/56; phase3 test passes (now 6 artifacts; soft-fail on bogus path still returns a bundle, no throw).

## C1 FINDING (material): sidecoach/bundles/*.json are DEAD snapshots
Why this matters: the deliverable said "enrich thin bundles ... (reference-update-service.ts)". Investigation shows NO runtime code reads `sidecoach/bundles/*.json`:
- `icon-source-reference.ts` loadBundle reads `data/icons/lucide.json`, NOT `bundles/icon-source.json`.
- `reference-data.ts` (the embedded runtime source for component/font/design-ref/motion) reads `~/.claude/design-references` (live) + DESIGN.md, never the bundles.
- The 4 other reference impls read embedded constants, not bundles.
- `getApprovedLibraries()` already returns all 8 icon libraries at runtime; the bundle's 5 is a stale snapshot.
- `reference-update-service.ts` is a no-op for upstream fetch and would re-serialize whole bundle files (reformatting existing data) + touch DESIGN.md - which the additive-only constraint forbids without before/after sign-off.

Conclusion: literally enriching the bundles is cosmetic (zero runtime effect). The runtime depth lever is the EMBEDDED data in `reference-data.ts` / reference impls - but editing that TOUCHES existing reference data, so per the constraint it needs explicit before/after sign-off. Surfaced to the lead with 3 options (skip cosmetic bundle work / additive-append bundles anyway / additively enrich embedded runtime data with sign-off). Awaiting direction.

## C1 DONE (Option 3 per lead, PENDING SIGN-OFF): additive componentIndex enrichment
Lead (Jonah) chose Option 3: additively enrich the EMBEDDED runtime data with REAL skill content, append-only, sign-off gate.
- Investigated every embedded structure's sourceability + firing. Only componentIndex both FIRES (flowB searchComponents + preflight component probe) AND has real, verbatim-sourceable content (the component-gallery-reference skill's Step-1 type table).
- Appended 6 real component.gallery types to `reference-data.ts` componentIndex (40 -> 46): combobox, spinner, separator, hero, carousel, segmented_control. name + "user says" synonyms + gallery slug sourced VERBATIM from the skill; systems=['component.gallery'] (honest single provenance); a11y/variants = standard ARIA conventions per pattern (not invented). Marked with a dated "APPENDED 2026-06-23 (Jonah Cohen)" comment.
- Additive proof: `git diff --numstat` = 67 insertions / 0 deletions; `git diff -U0 | grep '^-'` empty -> existing entries byte-identical. Gates: build exit 0; npm test 56/56. searchComponents() returns each new type.
- HONEST EXCLUSIONS (real-or-nothing, no fabrication): fonts (skill names families but no weights/pairings; + flowC slices to first 5 so appended fonts wouldn't fire), easings (flowE reads CSS cubic-bezier curves; skill ships GSAP code, not curves), reference-data motionPatterns (no flow reads it - dead like the bundles).
- Sent the lead the additive proof + per-field sourcing + exclusions; WAITING for sign-off before task #4.

## C1 SIGNED OFF (components-only) + labeling refinement
Lead signed off on Option (a) components-only. Per the labeling ask, the appended block's comment now self-documents provenance: name/synonyms/gallery-slug VERBATIM from the component-gallery skill; accessibility/variants/constraints follow the W3C ARIA Authoring Practices Guide (APG) conventions (authoritative, not invented). Fonts (option b) DEFERRED.

## DEFERRED FOLLOW-UP (font depth, if wanted later)
Adding font depth needs three things together, out of scope for this purely-additive-data deliverable: (1) the 5 real fontshare families named in the fontshare skill (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) with their published variable-weight axes, (2) raising flowC.getFontCandidates' slice(0,5) so appended fonts actually surface (a behavior change), (3) a separate review of that slice change. Excluded now to stay purely-additive + verbatim-sourced.

## Task #4 FINAL VERIFY: Codex full-diff review (item 8) + holistic proof
Ran `codex exec review` on the FULL A+B+C diff. 6 findings, ALL folded + re-verified:
1. HIGH (timeout not a true sync bound): bounded the one NEW sync read (readSkillArtifact now statSync size-caps at 256KB + skips non-files); documented that ReferenceDataService/buildProjectContext sync reads are pre-existing lane behavior, not new.
2. MEDIUM (timeout returned live mutable arrays): gather now returns CLONED snapshots so a late probe can't mutate the returned bundle.
3. MEDIUM (outer 5s raced inner 5s health timeout): raised PREFLIGHT_TIMEOUT_MS to 8000 (> inner 5000) so fallbacks have room.
4. MEDIUM (design-ref voice match too strict): now queries per voice TOKEN and merges/dedupes (substring search missed the joined phrase) + reads brandPersonality OR brand_personality. IMPROVEMENT: design-references now FIRES in the preflight (matched "clean, editorial, precise" against the live catalog -> 7 artifacts).
5. LOW (skill read symlink/full-file): same statSync cap as #1; hard-coded skill names (no traversal).
6. LOW (partial caller product suppressed brandPersonality): enrichContextForHandler now MERGES loaded product UNDER caller product (caller wins, content always retained) instead of choosing one.
Codex confirmed NO material finding on the 6 appended componentIndex entries (well-formed, non-duplicate keys, types match) and that the harness is honest (discloses clean-validator stub + PRODUCT.md-derived context).

HOLISTIC BEFORE->AFTER (single harness, baseline-via-stash vs final): routing flowC/flowD false->true; componentIndex 40->46 with all 6 new types FIRING via searchComponents; craft step gained flowC+flowD (flowC fires with Font Candidates artifact); preflight ABSENT->7 artifacts [component, fonts, design-references, motion, icon-source, visual-effects, tilt-lab].
GATES: build exit 0; npm test 56/56; phase3 integration passes; constraint D verified (all 7 standalone skills mtimes unchanged, no repo changes).

## Files touched (C + #4 folds)
- sidecoach/src/reference-preflight-artifacts.ts (C2: readSkillArtifact + visual-effects/tilt-lab probes + kind union/order)
- sidecoach/src/reference-data.ts (C1: 6 appended componentIndex entries; purely additive)
- sidecoach/src/lanes.generated.ts, LANES.generated.md, dist/* (regenerated/build output)
