---
name: convergence validator capability inventory
description: What the package already has vs needs for upgrading audit/critique to product validators (v4 review Option B table audited against the repo)
type: reference
relates_to: [session_2026-06-12_lane-design-v4-execution-truthfulness.md]
---

Audit of the v4 reviewer's "truthful Option B requirements" table against the
actual repo (2026-06-12, prompted by Jonah's "I thought we had all these
things"). Engine handlers alone undersell the package.

| Validation area | Reviewer says build | Repo reality |
|---|---|---|
| Theming + CSS anti-patterns | static-analysis rules | EXISTS: extended-domain-validator.ts (~3000 lines, real numeric rule logic), anti-pattern-validator.ts, taste-validator.ts (emits ValidationResult), absolute-ban-detector.ts, category-reflex-detector.ts; polish's 112-rule matrix runs these against files |
| Accessibility | DOM/static + browser a11y tooling | JUDGE EXISTS, COLLECTOR MISSING: extended validator has WCAG/ARIA/contrast/keyboard rules but consumes a DomainCheckContext (htmlElement, computedStyle, AccessibilityReport, ContrastReport) that nothing populates from a live page. No axe-core anywhere. |
| Responsive | browser harness + viewports + assertions | HARNESS EXISTS: tilt-lab/verify (Playwright dep in tilt-lab/package.json) - real Chromium, viewport config, pixel-decode paint checks, real-input interaction, long-frame detection; proven 121/121. Scoped to tilt-lab; needs sidecoach-facing adaptation. |
| Performance | running app + Lighthouse/CWV | GENUINELY ABSENT: only frame-sanity (tilt-verify) + static proxies (bundle-size rules). No Lighthouse/CWV anywhere. |
| Nielsen heuristics | evidence-backed human/probabilistic evaluation | BY ARCHITECTURE: persona-engine.ts + critique verb's documented "LLM design director + automated detector" two-assessment design; the evaluator IS the in-session model (router-guard requires this). |
| Cognitive load / design quality | calibrated judgment + confidence/reproducibility | MISSING AS A GATE, and should stay advisory - calibrating model judgment into a deterministic gate is the highest dishonesty risk. |

Net: ~3.5 of 6 rows substantially present. Real gaps: (1) an evidence-collector
bridge - a Playwright pass loading the project's pages and populating
DomainCheckContext (plumbing between two existing systems); (2) performance
lab tooling (true gap); (3) judgment calibration (keep advisory).

**How to apply:** under the v5 capability registry (product validators gate,
advisory flows coach), the staged gate-widening path is: Wave 2 = the
Playwright-to-DomainCheckContext collector, promoting static a11y + theming +
responsive checks to product_validator mostly via wiring; Wave 3 = CWV
tooling. Each lands as its own reviewed feature; the convergence gate widens
automatically via the registry, no lane changes.

Files referenced: sidecoach/src/extended-domain-validator.ts (DomainCheckContext at :20-97, validateAll at :2938), tilt-lab/verify/cli.mjs, sidecoach/src/taste-validator.ts (:315-361), sidecoach/src/persona-engine.ts
