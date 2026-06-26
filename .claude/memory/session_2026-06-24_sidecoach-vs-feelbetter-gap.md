---
name: sidecoach-vs-feelbetter-gap
description: Gap analysis - Sidecoach's references vs make-interfaces-feel-better; coverage is strong (19 polish detectors operationalize 14/16), gaps = #4 interruptible + partial #13 + stale "14-point" doc label
type: project
relates_to: []
---

Collaborator: Jonah Cohen.

Q: gap between Sidecoach's references vs make-interfaces-feel-better (m-i-f-b).

## What exists (not a gap)
- EXTRACTED COPY current: sidecoach/reference/_extracted/make-interfaces-feel-better/ (SKILL.md + animations/performance/surfaces/typography.md), dated May 25-26; SOURCE skill last modified Apr 30. So the copy is NEWER than the source's last change = NOT stale, and AUGMENTED (each principle tagged "- extension"). All 16 source principles present in the extracted copy.
- OPERATIONALIZED, not just docs: Sidecoach has a polish/ validator family - 19 registered product rules (product-rule-registry) + the checks in src/validators/checks/polish-checks.ts. So m-i-f-b is wired into the AUDIT gate as detectors, not only cited as build-guidance.
- BUILD flow applies all 16: flows.ts flow ("Tactical Polish applies 16 refinement principles") + flow-handlers-tier3-tier4.
- SUPERSET: Sidecoach adds 4 checks beyond the 16 - polish/anti-pattern-genericity, polish/state-completeness, polish/typography-rhythm, polish/reduced-motion-respect.

## 16-principle -> Sidecoach detector map
1 Concentric Radius=checkConcentricRadius; 2 Optical Alignment=checkOpticalAlignment; 3 Shadows Over Borders=checkShadowsOverBorders+checkShadowHierarchy; 4 Interruptible Animations=NONE (GAP); 5 Stagger Enter=checkStaggeredEnter; 6 Subtle Exit=checkSubtleExit; 7 Contextual Icon=checkIconSwapCompound; 8 Font Smoothing=checkFontSmoothing; 9 Tabular Nums=checkTabularNums; 10 Text Wrapping=checkTextWrapBalance; 11 Image Outlines=checkImageOutline; 12 Scale on Press=checkScaleOnPress; 13 Skip Anim on Page Load=checkAnimatePresenceInitial (PARTIAL - React/AnimatePresence only, not CSS-only mount anim); 14 No transition:all=checkNoTransitionAll; 15 Sparse will-change=checkSparseWillChange; 16 Min Hit Area=a11y/min-hit-area.

## THE GAPS (small + specific)
1. **#4 Interruptible Animations - NO detector.** The one genuinely missing principle. Hard to detect statically (it's a runtime interaction property - can a mid-flight animation be interrupted/reversed - not a static CSS attribute). Real gap, understandable cause.
2. **#13 Skip Animation on Page Load - PARTIAL.** checkAnimatePresenceInitial covers the React/Framer AnimatePresence initial=false case; CSS-only page-load animations (animation on initial mount) aren't clearly caught by a polish detector (the eval motion instrument + taste/observer-race touch the reveal-stuck case, adjacently).
3. **DOC gap: CLAUDE.md calls it a "14-point checklist"** - the skill is actually 16 principles. The routing/description references a stale count. Cosmetic but should be corrected.

## Net
Coverage is STRONG, not a big gap: 14 of 16 fully detected, 1 partial (#13), 1 missing (#4), copy current, 4 bonus checks. Recommendation: add an interruptible-animation heuristic (e.g., flag state-change animations using @keyframes where a CSS transition would be interruptible) for #4; extend checkAnimatePresenceInitial / a page-load check to CSS-only mount animations for #13; fix the "14-point" -> "16-point" label in CLAUDE.md.

Verified via: grep of polish-checks.ts exports + product-rule-registry (19 polish rules); source vs extracted SKILL.md principle headings (all 16 both); mtimes (source Apr 30, extract May 25).
