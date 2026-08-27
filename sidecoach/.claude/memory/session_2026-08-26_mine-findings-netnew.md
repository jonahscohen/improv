---
name: Net-new taste-rule findings artifact for the miner (drive-to-green item 9)
description: 13 real net-new candidate taste rules distilled from the ingested pioneer corpus, written to data/mine-findings-2026-08-26.json for `sidecoach-mine.js run --findings`
type: project
relates_to: [session_2026-08-24_phase3a-runnable-detector.md, session_2026-08-25_sidecoach.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

Built the genuine net-new taste-rule findings artifact the self-learning loop needs (drive-to-green item 9). Today counts.netNew=0 because the deterministic engine only re-finds duplicates from audit-history; the miner needs a reflect-style findings artifact to surface net-new candidates. This is that artifact.

Deliverable: `data/mine-findings-2026-08-26.json` - 13 candidates, `{minedBy, candidates:[...]}` shape matching bin/__tests__/fixtures/findings-representative.json. NOT run through the miner here (lead runs `node bin/sidecoach-mine.js run --findings data/mine-findings-2026-08-26.json`). Did NOT touch taste-candidates.json or data/proposed-rules/ (concurrent owner).

**How the candidates were grounded (honesty bar):**
- Read src/product-rule-registry.ts (63 live rules) + grepped every canonicalRuleKey across src/ so no candidate restates an existing rule. Verified zero STRONG-key collisions (full canonicalRuleKey identity) - a strong match would classify duplicate/strengthen, not net-new. Also confirmed zero tail resemblances, so each lands cleanly net-new (classify() in sidecoach-mine.js: strong=identity->dup, weak=tail/title->still net-new).
- Opened the actual pioneer docs under reference/_extracted/external/ and grepped each cited claim verbatim before citing. Every one of the ~19 evidence lines is a real quote confirmed present in the source file.

**The 13 net-new rules (findingClass coverage: motion 3, a11y 5, typography 3, color 1, layout 1):**
- motion/ease-in-on-ui, motion/animate-layout-property, motion/ui-duration-over-300ms (Emil Kowalski animate + review-animations)
- a11y/outline-none-no-replacement, a11y/positive-tabindex, a11y/viewport-zoom-locked, a11y/icon-button-name, a11y/interactive-div-onclick (Jakub Krehel better-accessibility; div-onclick also Vercel guidelines)
- typography/input-font-below-16px, typography/measure-uncapped (Jakub + oracle typeset, rendered-scan), typography/thin-weight-text (Jakub better-typography)
- color/p3-no-srgb-fallback (Jakub better-colors)
- layout/physical-inset-not-logical (Jakub better-layout; deliberately confidence:low - broad presence signal, human-gated, RTL-scoped)

**Why these are net-new (the gaps named):** registry had bounce-easing + no-scale-zero-enter for motion but no ease-in ban, no layout-property-animation catch (no-transition-all only bans `all`), no duration bound; had focus-visible (presence of a focus style) but no outline:none removal catch, no tabindex rule, no viewport-meta rule; button-label-specific flags generic label text, not icon-only-no-name; had text-wrap-balance/typography-rhythm but no measure cap, no font-weight rule, no input-zoom rule; had color-scheme-dark but no wide-gamut fallback rule; no logical-property/RTL rule.

Strongest (high-precision presence signals, confidence high): motion/ease-in-on-ui, motion/animate-layout-property, a11y/outline-none-no-replacement, a11y/positive-tabindex, a11y/viewport-zoom-locked - each a crisp static token the interpreter can match, mirroring the motion.no-scale-zero-enter operating point (detecting a bad token = higher precision than an absence).

**Verify:** node validation confirmed all 13 structurally valid (title/minedBy/sourceKind=expert-external/confidence/rationale/evidence present; evidenceRequirements in the frozen enum css-rule|markup|rendered-scan; severity in minor|major|blocker; scope valid) and ZERO strong-key collisions. Lead to confirm counts.netNew after running the miner.

Files touched: data/mine-findings-2026-08-26.json (new).
