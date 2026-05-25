---
name: Sidecoach capability gap analysis
description: Forensic audit checking whether absorbed predecessor content is actually enforced in sidecoach source code
type: decision
relates_to: [session_2026-05-23_sidecoach_100_complete.md, all_tasks_complete.md]
---

# Verdict (top)

The claim **largely holds**. The 22 verb commands are wired and the deterministic-validator + extended-domain-validator + taste-validator surface DOES catch a meaningful slice of the predecessor's rules (side-stripes, gradient text, glassmorphism, scale(0.96), concentric radius, modular ratio, 40x40 hit area, exponential easing, IntersectionObserver opacity-race, hardcoded hex in hover, fabricated SVG, hero radial blob). But the **linguistic/copy bans, the font reflex-reject list, the saturated-aesthetic lanes, the breakpoint-pattern transitions, the iOS 100vh trap, the Framer-Motion x/y gotcha, the frequency-first matrix, the ALWAYS-ASK protocol, and the responsive-foundation.md reference** are all in `_extracted/` and never loaded by any flow handler. `skillRefPath` is the smoking gun: it is only stringified in `sidecoach-orchestrator.ts:848` as help-text output, never `readFileSync`d. **Library acquired, partially wired.**

# Per-rule findings

## Anti-pattern enforcement
1. **Side-stripe borders** - WIRED. `design-laws.ts:9-15` checker regex `border-(left|right):\s*\d+px`. Used by `anti-pattern-validator.ts:39`. Also `category-reflex-detector.ts:55-60` flags as oversaturated. `verb-command-registry.ts:278,285` lists it in parity text.
2. **Identical card grids** - WIRED (weak). `design-laws.ts:37-43` checker `/grid|repeat.*card|same.*card/`. Catches the term, not the structural repeat. `category-reflex-detector.ts:43-48` adds pattern matching against ref descriptions.
3. **Hero-metric template** - WIRED (weak). `design-laws.ts:30-36` checker `/hero|metric|big\s*number|stats\s*grid/`. Keyword-level only, not structural.
4. **Gradient text** - WIRED. `design-laws.ts:16-22` checker `/background-clip:\s*text|text\s+gradient/`.
5. **Glassmorphism default** - WIRED. `design-laws.ts:23-29` checker `/backdrop-filter:|backdropFilter:|glass|blur\(\d+px\)/`.
6. **Modal as first thought** - WIRED (weak). `design-laws.ts:44-50` checker `/modal|dialog/` - flags ANY modal use, not "first thought" structural pattern.

## Linguistic bans (taste-skill content)
7. **Slop word list (Elevate, Seamless, Unleash, Delve, Tapestry, Acme, Nexus, SmartFlow)** - DOCUMENTED-ONLY. Lives at `_extracted/external/taste-skill/SKILL.md:125-126,286`, `redesign-skill.md:80-81`, `named-vibe-variants.md:30-31`. Zero matches in `sidecoach/src/`. No validator scans generated copy for these strings.
8. **Title Case in headings ban** - DOCUMENTED-ONLY. The only `extended-domain-validator.ts:1924` reference INSTRUCTS "Headings: Title Case" as a remediation hint, the opposite of a ban. No detector.
9. **3-column card row ban** - PARTIAL/WIRED. `category-reflex-detector.ts:43-48` "Identical Card Grids" pattern matches "card grid", "feature cards", "service cards", "uniform cards" in description text only. No structural 3-column count check.
10. **"Request a demo"** - DOCUMENTED-ONLY/MISSING. Zero occurrences in `sidecoach/src/*.ts` or `_extracted/`.

## Typography (TypeUI)
11. **Modular ratio mandate (one of {1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618})** - PARTIAL/WIRED. `extended-domain-validator.ts:490-501` checks `ctx.designTokens?.typographyScale` against `1.25, 1.33, 1.618` only - 4 of 7 ratios. Requires upstream context to populate `typographyScale`; no parser extracts from CSS.
12. **Line-height-by-tier (body 1.4-1.6, headings 1.05-1.25, UI 1.0-1.2)** - PARTIAL/WIRED. `extended-domain-validator.ts:510-517` checks body >=1.4, headings >=1.2. UI-label tier missing.
13. **Heading-size-by-role table** - DOCUMENTED-ONLY in `_extracted/external/typeui-fundamentals/`; no validator distinguishes card titles from modal titles from display.
14. **Font-pairing rules (one sans + one serif)** - DOCUMENTED-ONLY. `flow-handler-typography-excellence.ts:40` sets a `font-pairing-guidance: true` flag but no validator runs.
15. **Clamp-based fluid scale formulas** - DOCUMENTED-ONLY/PARTIAL. `extended-domain-validator.ts:1733` mentions `clamp()` as remediation. `verb-command-registry.ts:406` mentions clamp() in guidance. No enforcement.

## Motion (Emil + miFB)
16. **Frequency-first matrix (100+/day = NO animation)** - MISSING from src. Not in `flow-handler-motion-integration.ts` or `flow-handler-motion-patterns.ts`. No prompt asks usage frequency.
17. **Three named strong easings** - PARTIAL. `motion-reference.ts:23-71` lists `cubic-bezier(0.25,0.46,0.45,0.94)`, `(0.165,0.84,0.44,1)`, `(0.22,1,0.36,1)`. These are NOT the named three from Emil (`0.23,1,0.32,1` etc.) - different curves. `flow-handler-motion-patterns.ts:93` checks `/cubic-bezier/.test(easing)` only, accepting any cubic-bezier.
18. **Asymmetric enter/exit (exit faster)** - DOCUMENTED-ONLY. `design-laws.ts:268` lists rule but no validator measures durations.
19. **Framer Motion x/y hardware-accel gotcha** - MISSING. No mention in `src/`.
20. **scale(0.96) on press, never below 0.95** - WIRED. `extended-domain-validator.ts:141-143` checks `ctx.cssRules?.some(r => r.includes('scale(0.96)'))`. Required in `flow-handler-tactical-polish.ts:65`, `flow-handlers-core.ts:39`. (Bonus: `taste-validator.ts:116-130` blocks translateY-in-hover as wrong pattern.)
21. **Concentric radius (outer = inner + padding)** - WIRED. `extended-domain-validator.ts:157-158`, `flow-handler-tactical-polish.ts:66`, `flow-handlers-core.ts:46`. Plus `taste-validator.ts:229-247` flags >2 distinct radius literals as inconsistency.

## Responsive (Bencium)
22. **Breakpoint-table compliance (XS/SM/MD/LG/XL)** - PARTIAL. `flow-handler-responsive-validation.ts:65` uses 4 breakpoints (320/640/1024/1280) - missing XS tier from Bencium's 5-tier table. `extended-domain-validator.ts:1574-1576` requires `designTokens.breakpoints` exist.
23. **Pattern transitions per breakpoint (hamburger -> full nav)** - DOCUMENTED-ONLY. `design-laws.ts:298` lists the rule as a string, no checker. `flow-handler-design-critique.ts:74` mentions "hamburger menus without cause" in a prompt.
24. **44x44 hit area at all breakpoints** - WIRED. `extended-domain-validator.ts:1599-1609`, `flow-handler-accessibility.ts:79,85,277`, `design-laws.ts:182,260`.
25. **iOS 100vh address-bar gotcha (svh/dvh/lvh)** - MISSING from src. Zero occurrences.
26. **Mobile-first CSS check (min-width queries)** - WIRED (weak). `design-laws.ts:177` checker `/max-width.*media/` is a one-shot heuristic; flags presence of max-width queries rather than enforcing min-width-first.

## Category-reflex at two altitudes
27. **First-order (theme guessable from category)** - WIRED. `design-laws.ts:319-329` `CATEGORY_REFLEX.first_order` with examples. Used by `flow-handler-design-references.ts:65-86`.
28. **Second-order (aesthetic family + anti-references)** - WIRED (declarative, not algorithmic). `design-laws.ts:330-337` has the rule structure. Application is via prompts in `flow-handler-design-references.ts`; no algorithm walks anti-references against generated work.
29. **Saturated-aesthetic lanes list (Editorial-typographic, Brutalist-utility, Acid-maximalism)** - MISSING. `design-laws.ts:338-347` `oversaturated_families` lists 7 different families (SaaS cream, FinTech trustworthy etc.), NOT Editorial-typographic / Brutalist-utility / Acid-maximalism from predecessor.
30. **Font reflex-reject list (23 entries: Inter, Fraunces, Outfit, Instrument Serif, ...)** - DOCUMENTED-ONLY. `_extracted/local-skills/fontshare/INTEGRATION.md:36-43,113-118` lists Fraunces, Inter, Outfit, Instrument. No src file imports or scans against this list.

## Flow chain integration
31. **`responsive-foundation.md` loaded into any flow handler prompt** - NO. Zero matches across `sidecoach/`. File exists at `sidecoach/reference/responsive-foundation.md` but no `readFile` call references it.
32. **`flowM_responsive_validation` in craft chain in verb-command-registry** - NO. `verb-command-registry.ts:47-56` craft chain is A, B, E, F, G, H, I, J. flowM appears only in `polish` (line 91) and `adapt` (line 480).
33. **Flow handlers read from `sidecoach/reference/_extracted/`** - NO. The only `_extracted` reference is the `SKILL_REF` constant at `verb-command-registry.ts:38`, used only as a string interpolated into help-text at `sidecoach-orchestrator.ts:848`. No `fs.readFileSync` or `import` of `_extracted` content from any handler.
34. **ALWAYS-ASK protocol from Bencium** - MISSING from src. Zero occurrences of "ALWAYS ASK" / "always_ask" / "alwaysAsk".

# Tally

- WIRED (real enforcement): 1, 4, 5, 20, 21, 24, 27
- PARTIAL/WEAK wiring: 2, 3, 6, 9, 11, 12, 17, 22, 26, 28
- DOCUMENTED-ONLY (in _extracted or string-only): 7, 8, 13, 14, 15, 18, 23, 30, 31, 33
- MISSING (not present anywhere): 10, 16, 19, 25, 29, 32, 34

7 of 34 items have real, structural enforcement. 10 are partial/heuristic. 10 live only in absorbed reference files. 7 are absent entirely.

# Verdict paragraph

Sidecoach has replaced the predecessor in branding, surface area (22 verbs + 36 flows), and a substantive but minority slice of the deterministic rule set - the visual anti-patterns absorbed into `design-laws.ts` and `extended-domain-validator.ts` (side-stripes, gradient text, glassmorphism, scale(0.96), concentric radius, 40x40 hit area, exponential easing, category-reflex first-order) and the seven structural taste checks in `taste-validator.ts` are real and run. But the *linguistic* taste layer (slop word ban list, Title Case ban, "Request a demo"), the *typographic* taste layer (font reflex-reject list, heading-size-by-role table, modular-ratio across all 7 ratios, font-pairing enforcement), the *motion* sophistication (frequency-first matrix, Emil's three named curves, asymmetric enter/exit, Framer x/y gotcha), the *responsive* sophistication (iOS 100vh, Bencium's 5-tier breakpoint table + pattern transitions, ALWAYS-ASK protocol), the *saturated-aesthetic lanes* second-order check, and the `responsive-foundation.md` canonical reference are all unwired - either documented-only in `_extracted/` with no code reader, or absent entirely. `verb-command-registry.ts:38` defines a `SKILL_REF` constant that points at the legacy skill reference dir, but the only consumer (`sidecoach-orchestrator.ts:848`) stringifies the path into help-text rather than loading the file. No flow handler in `src/` ever reads from `_extracted/`. `flowM_responsive_validation` is in polish and adapt chains but NOT in craft. The library is acquired and indexed; significant parts of it are unwired.

# Files touched

(read-only investigation)

- `sidecoach/src/design-laws.ts`
- `sidecoach/src/category-reflex-detector.ts`
- `sidecoach/src/taste-validator.ts`
- `sidecoach/src/verb-command-registry.ts`
- `sidecoach/src/sidecoach-orchestrator.ts:840-860`
- `sidecoach/src/extended-domain-validator.ts:141-158, 490-517, 1574-1609, 1733, 1924`
- `sidecoach/src/flow-handler-tactical-polish.ts`
- `sidecoach/src/flow-handler-responsive-validation.ts`
- `sidecoach/src/flow-handler-motion-integration.ts`
- `sidecoach/src/flow-handler-motion-patterns.ts`
- `sidecoach/src/flows.ts`
- `sidecoach/src/anti-pattern-validator.ts`
- `sidecoach/src/motion-reference.ts`
- `sidecoach/reference/_extracted/external/taste-skill/`
- `sidecoach/reference/_extracted/local-skills/fontshare/INTEGRATION.md`
- `sidecoach/reference/responsive-foundation.md`
