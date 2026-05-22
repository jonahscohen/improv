# Impeccable Extraction Blueprint for Sidecoach Task 2

Comprehensive extraction guide showing EVERY feature from Impeccable that must be consolidated into Sidecoach flows as embedded, transparent intelligence (no slash commands visible to users).

---

## PHASE 1: Core Infrastructure

### 1.1 Context Loader System

**What to Extract:**
- PRODUCT.md parser (required fields: users, brand personality, anti-references, strategic principles)
- DESIGN.md parser (optional but strongly recommended; fields: colors, typography, elevation, components)
- Fallback handling for missing files
- Cache mechanism for session persistence

**How Sidecoach Uses It:**
- Every flow starts with context initialization (Step 0 pre-flight)
- Users provide PRODUCT.md once at project start; Sidecoach loads it automatically for all flows
- DESIGN.md flows into Flow F (Design Tokens) and every validation gate

**Reference File Source:** SKILL.md section "Context gathering" + load-context.mjs logic

---

### 1.2 Register System (Brand vs Product)

**What to Extract:**
- Brand register definition: `register: "brand"` - design IS the product (marketing, landing, campaigns, portfolio)
- Product register definition: `register: "product"` - design SERVES the product (app UI, admin, dashboard, tool)
- Detection logic: priority order (1) task cue, (2) surface focus, (3) PRODUCT.md field, (4) infer from "Users" + "Purpose"
- Register-specific reference files: brand.md vs product.md

**How Sidecoach Uses It:**
- Flow A (Brand Verification) Step 2 outputs register and caches it
- Every subsequent flow inherits cached register to apply matching design laws
- No user interaction needed - detection is automatic

**Reference File Source:** SKILL.md section "Register" + brand.md + product.md

---

### 1.3 Shared Design Laws (Core Rules)

**What to Extract from SKILL.md:**

**Color Laws:**
- Use OKLCH (not HSL); reduce chroma near white/black
- Never #000 or #fff; tint every neutral with chroma 0.005-0.01
- 4 color strategies (Restrained/Committed/Full/Drenched) with commitment-level definitions
- Restrained rule: ≤10% accent color ONLY for Restrained, not other strategies

**Theme Laws:**
- Dark vs light never default; run physical scene sentence to determine answer
- Scene detail matters: "SRE glancing at incident severity at 2am in dim room" forces dark

**Typography Laws:**
- Body max 65-75ch character limit
- Hierarchy via scale + weight contrast: ≥1.25 ratio between steps
- No flat scales

**Layout Laws:**
- Vary spacing for rhythm; same padding everywhere = monotony
- Cards are lazy answer; use only when truly best affordance
- Never nest cards inside cards
- Don't wrap everything in container

**Motion Laws:**
- Don't animate CSS layout properties
- Ease out exponential (ease-out-quart/quint/expo only)
- No bounce, no elastic

**Copy Laws:**
- Every word earns its place; no restated headings
- No em dashes (use hyphens, commas, colons, semicolons, periods, parentheses)

**Absolute Bans (27 Anti-Patterns):**
1. Side-stripe borders (colored left/right >1px on cards, callouts, alerts)
2. Gradient text (background-clip: text + gradient)
3. Glassmorphism as default (blurs and glass decorative)
4. Hero-metric template (big number + supporting stats + gradient accent)
5. Identical card grids (same-size cards icon+heading+text repeated)
6. Modal as first thought (lazy pattern; exhaust inline/progressive first)
7. [Plus 20 more from deterministic rules across all domains]

**How Sidecoach Uses It:**
- Flow A loads register → Flow A Step 3 applies matching laws to cache
- Every validation gate (K, L, M, N) checks output against these laws
- Every refine/polish flow (J, S, T) runs these laws pre-validation
- FlowHistory logs which laws were applied to each design decision

**Reference File Source:** SKILL.md "Shared design laws" section + all 7 domain reference files

---

## PHASE 2: Domain Knowledge (7 Files)

### 2.1 Typography Domain (embed into Flows C, G, J, S)

**What to Extract:**
- Vertical rhythm principle (line-height as base unit for spacing)
- Modular scale table (xs/sm/base/lg/xl+ ratios, 1.25/1.333/1.5)
- Readability rules (65ch character limit, line-height scaling with measure)
- Light-on-dark compensation (line-height +0.05-0.1, letter-spacing +0.01-0.02em, weight bump)
- Font selection anti-reflexes (tech ≠ needs serif for warmth, premium ≠ everyone's serif)
- Pairing principles (one font often enough, contrast on multiple axes)
- Web font loading (font-display swap/optional, fallback metrics, Fontaine tool)
- Fluid type patterns (clamp() for marketing, fixed rem for product UI)
- OpenType features (tabular-nums, fractions, small-caps, kerning)
- Rendering polish (text-wrap balance/pretty, font-optical-sizing)
- ALL-CAPS tracking (5-12% letter-spacing)
- Token naming (semantic `--text-body` not `--font-size-16`)
- Accessibility (no zoom disable, rem/em sizes, 16px minimum, 44px+ tap targets)

**Flow Integration:**
- Flow C (Font Research) Step 2 outputs: font candidates, pairing strategy, OpenType features from this domain
- Flow G (Implementation) Step 2: applies typography from Flow C research
- Flow J (Polish) Step 6: text-wrap balance, OpenType polish
- Flow S (Typography Excellence) Step 2: full typography domain research for refinement

**Reference File Source:** /impeccable/skill/reference/typography.md

---

### 2.2 Color & Contrast Domain (embed into Flows F, I, K, L, M)

**What to Extract:**
- OKLCH color space fundamentals (lightness 0-100, chroma 0-0.4, hue 0-360)
- Chroma reduction near white/black to avoid garish appearance
- Tinted neutrals principle (0.005-0.015 chroma toward brand hue)
- 4 palette roles (Primary/Neutral/Semantic/Surface with shade definitions)
- 60-30-10 rule (visual weight, not pixel count)
- WCAG requirements (4.5:1 AA body, 3:1 large text/UI components)
- Dangerous color combos (gray on color washes out, red+green colorblind fails, blue+red vibrates)
- Never pure gray/black (#000 ban)
- Dark mode differs from light mode (surfaces for depth not shadows, text weight reduction)
- Token hierarchy (primitives vs semantic layer)
- Alpha as design smell (incomplete palette indicator)

**Flow Integration:**
- Flow D (Design References) Step 2: color strategies from reference catalog
- Flow F (Design Tokens) Step 2: validate OKLCH strategy, tinted neutrals, commitment level
- Flow F Step 3: validate typography token scales against contrast rules
- Flow I (Accessibility) Step 3: validate WCAG contrast across all text, icons, components
- Flow K (Multi-Lens Audit) Step 3: theming audit (light/dark contrast consistency)
- Flow L (Design Critique) Step 5: AI slop check on color choices (guard against default palette reflex)
- Flow M (Responsive) Step 3: test touch interaction on mobile against WCAG

**Reference File Source:** /impeccable/skill/reference/color-and-contrast.md

---

### 2.3 Spatial Design Domain (embed into Flows F, J, R)

**What to Extract:**
- 4pt base spacing system (4/8/12/16/24/32/48/64/96px)
- Semantic token naming (`--space-sm`, not `--spacing-8`)
- `gap` over margins (eliminates margin collapse)
- Self-adjusting grid (repeat(auto-fit, minmax(280px, 1fr)))
- Named grid areas for complex layouts
- Squint test for hierarchy validation
- Hierarchy through multiple dimensions (size 3:1+, weight bold vs regular, color contrast, position, space)
- Cards as lazy answer (when truly necessary, never nested)
- Container queries for component layouts (@container min-width rules)
- Optical adjustments (text negative margin, icon positioning shifts)
- Touch targets vs visual size (44px minimum via padding or pseudo-element)
- Depth and elevation (semantic z-index scales, subtle shadows)

**Flow Integration:**
- Flow F (Design Tokens) Step 1: spacing system extracted/defined
- Flow J (Tactical Polish) Step 1-2: concentric radius, scale-on-press, optical alignment
- Flow R (Layout Optimization) Step 2: spatial patterns from design references
- Flow R Step 3: validate container queries, touch targets

**Reference File Source:** /impeccable/skill/reference/spatial-design.md

---

### 2.4 Motion Design Domain (embed into Flows E, H, T)

**What to Extract:**
- Duration rule (100-150ms feedback, 200-300ms states, 300-500ms layout, 500-800ms entrance)
- Exit animations 75% of enter duration
- Easing curves (ease-out for enter, ease-in for exit, ease-in-out for toggle)
- Exponential curves (ease-out-quart/quint/expo recommended; no bounce/elastic)
- Premium motion materials (transform/opacity baseline; blur/filter/clip-path/masks/shadows for premium)
- Hard rule: avoid animating layout properties (width/height/top/left/margins)
- Staggered animations via CSS custom properties (animation-delay: calc(var(--i) * 50ms))
- Reduced motion support (required; @media prefers-reduced-motion with fade-in alternative)
- Perceived performance (80ms threshold, preemptive start, early completion, optimistic UI)
- Easing affects perceived duration (ease-in compresses time, ease-out satisfies)
- Will-change only when animation imminent (:hover, .animating)
- Intersection Observer for scroll-triggered animations

**Flow Integration:**
- Flow E (Motion Patterns) Step 2: easing/duration/stagger research from motion-reference
- Flow E Step 3: establish no-animate rules, motion palette
- Flow H (Motion Integration) Step 2: apply easing/timing from Flow E palette
- Flow H Step 3: reduced-motion CSS rules for accessibility
- Flow T (Ambitious Motion) Step 2: advanced easing, spring physics, gesture-driven patterns

**Reference File Source:** /impeccable/skill/reference/motion-design.md

---

### 2.5 Interaction Design Domain (embed into Flows G, H, I, J)

**What to Extract:**
- 8 interactive states (Default/Hover/Focus/Active/Disabled/Loading/Error/Success)
- Focus rings via :focus-visible (show only keyboard, hide mouse/touch)
- Focus ring design (2-3px, high contrast 3:1+, offset from element)
- Placeholders ≠ labels; always use visible `<label>`
- Validate on blur not keystroke (exception: password strength)
- Skeleton screens > spinners for perceived performance
- Modal with `inert` attribute (focus trapping) or `<dialog>` native
- Popover API for tooltips/dropdowns/non-modal overlays
- Dropdown clipping bug (position: absolute in overflow: hidden container)
- CSS Anchor Positioning API for modern tethering
- Popover + Anchor combo for stacking and light-dismiss
- Portal/Teleport pattern in frameworks
- Fixed positioning fallback for browsers without anchor support
- Undo > Confirm for destructive actions
- Roving tabindex pattern for grouped components (tabs, menu items)
- Skip links for keyboard users
- Gesture discoverability (partial reveal, onboarding, visible fallback)

**Flow Integration:**
- Flow G (Implementation) Step 4: implement interaction states from component-gallery patterns
- Flow G Step 5: apply modal/popover/focus ring patterns
- Flow H (Motion) for state transitions
- Flow I (Accessibility): validate all 8 states exist, focus rings visible, keyboard navigation
- Flow J (Polish): refine state transitions, interaction feel

**Reference File Source:** /impeccable/skill/reference/interaction-design.md

---

### 2.6 Responsive Design Domain (embed into Flows M, N, R)

**What to Extract:**
- Mobile-first: base styles for mobile, min-width queries for complexity
- Breakpoints content-driven (let content tell you where to break; 3 usually suffice)
- Detect input method not just screen size (@media pointer: fine/coarse, hover: hover/none)
- Safe areas: env(safe-area-inset-*) for notches, rounded corners, home indicators
- viewport-fit: cover meta tag for full-bleed
- Responsive images: srcset with width descriptors, sizes attribute
- Picture element for art direction (different crops, not just resolution)
- Layout adaptation (navigation hamburger→compact→full, tables→cards, progressive disclosure)
- Testing on real devices (DevTools misses touch, CPU, network, font rendering)
- Avoid: desktop-first, device detection, separate mobile/desktop, ignoring tablet/landscape

**Flow Integration:**
- Flow M (Responsive Validation) Step 1: extract breakpoints from DESIGN.md
- Flow M Step 2-4: test each breakpoint, touch interaction, container queries
- Flow N (Rapid Iteration) Step 2: generate alternatives using responsive patterns
- Flow R (Layout) responsive patterns research

**Reference File Source:** /impeccable/skill/reference/responsive-design.md

---

### 2.7 UX Writing Domain (embed into Flows J, L, N, Flow specific)

**What to Extract:**
- Button label pattern (specific verb + object: "Save changes" not "OK")
- Destructive action naming (name the destruction: "Delete 5 items")
- Error message formula (what happened, why, how to fix)
- Error templates (format, missing required, permission, network, server)
- Don't blame user ("Please enter MM/DD/YYYY" not "You entered invalid")
- Empty states as onboarding (acknowledge, explain value, provide action)
- Voice vs tone (voice constant, tone adapts to moment)
- Tone for specific moments (success: celebratory; error: empathetic; loading: reassuring)
- Never humor for errors (users frustrated, be helpful not cute)
- Accessibility writing (link text standalone meaning, alt text describes information)
- Icon button aria-label for screen readers
- Translation planning (German +30%, French +20%, Finnish +30-40%, Chinese -30%)
- Keep numbers separate, full sentences, avoid abbreviations
- Terminology consistency glossary
- Avoid redundant copy
- Loading state specificity ("Saving your draft" not "Loading")
- Confirmation dialogs sparingly (name action, explain consequences)
- Form instructions (show format with placeholder, explain why asking)

**Flow Integration:**
- Flow J (Tactical Polish) Step 7: label/button copy review
- Flow L (Critique) Step 3: emotional resonance includes language tone
- Flow N (Rapid Iteration): copy polish between design variations
- Flows G, H, I: button/form/error/state labels checked against formula

**Reference File Source:** /impeccable/skill/reference/ux-writing.md

---

## PHASE 3: 23 Command Workflows

### 3.1 Build Category (5 commands → Flows 1-3 integration)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `craft` | Full shape-then-build | Flow A→B→C→D→F→G→H→I→J sequence | craft.md |
| `shape` | Plan UX/UI (no code) | Flows A→B→C→D→F (stops before G implementation) | shape.md |
| `teach` | Interactive PRODUCT.md setup | Pre-flight for all projects; creates context | teach.md |
| `document` | Generate DESIGN.md from code | Reverse engineering; Flow F input | document.md |
| `extract` | Pull tokens/components into design system | Post-implementation; Flow 11 (Extract Tokens) | extract.md |

### 3.2 Evaluate Category (2 commands → Flows K-L)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `critique` | UX design review | Flow L (Design Critique); 5 dimensions | critique.md |
| `audit` | Technical checks (a11y/perf/responsive) | Flow K (Multi-Lens Audit); 5-dimension scan | audit.md |

### 3.3 Refine Category (6 commands → Flows J, R-S)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `polish` | Final quality pass | Flow J (Tactical Polish); shipping readiness | polish.md |
| `bolder` | Amplify bland designs | Variation generation; Flow N (Rapid Iteration) | bolder.md |
| `quieter` | Tone down aggressive designs | Variation generation; Flow N | quieter.md |
| `distill` | Strip to essence | Reduction strategy; Flow N | distill.md |
| `harden` | Error handling, i18n, edge cases | Post-implementation validation; Flow I→J | harden.md |
| `onboard` | First-run flows, empty states | UX writing domain; Flow J | onboard.md |

### 3.4 Enhance Category (6 commands → Flows H, S-T, N)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `animate` | Add purposeful motion | Flow H (Motion Integration); motion-design domain | animate.md |
| `colorize` | Add strategic color | Flow S variation; design-references + color domain | colorize.md |
| `typeset` | Fix typography | Flow S (Typography Excellence); typography domain | typeset.md |
| `layout` | Fix spacing, rhythm | Flow R (Layout Optimization); spatial-design domain | layout.md |
| `delight` | Add personality moments | Flow N variation; interaction-design + ux-writing | delight.md |
| `overdrive` | Technically extraordinary effects | Flow T (Ambitious Motion); motion-design premium materials | overdrive.md |

### 3.5 Fix Category (3 commands → Flows M-N, post-implementation)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `clarify` | Fix UX copy | UX-writing domain; Flow J or post-implementation | clarify.md |
| `adapt` | Responsive fixes | Flow M (Responsive Validation); responsive-design domain | adapt.md |
| `optimize` | Performance diagnosis | Flow K performance audit; post-implementation profiling | optimize.md |

### 3.6 Iterate Category (1 command → Flow N)

| Command | Maps To | Flow Integration | Reference File |
|---------|---------|------------------|-----------------|
| `live` | Visual iteration in browser | Flow N (Rapid Iteration Refined); live browser interaction | live.md |

**How Sidecoach Consolidates Workflows:**
- User says "Design a button" → natural language intent detection → routes to Flow 1 (Design Component) which internally chains craft → shape → build → audit → critique → polish in sequence
- User says "Make this accessible" → routes to Flow 5 (Make Accessible) which embeds `audit` + `critique` logic on a11y dimension
- No slash commands in user interface; all 23 command logics embedded as flow steps that execute transparently
- FlowHistory logs which command logic was applied at which step

**Reference File Source:** All 23 reference files in /impeccable/skill/reference/ (craft.md through live.md)

---

## PHASE 4: AI Slop Detection Framework

### 4.1 Category-Reflex Check (2-Order Detection)

**What to Extract:**
- First-order check: Can someone guess the color palette from the category alone? (e.g., "observability → dark blue")
- Second-order check: Can someone guess the aesthetic family from category + anti-references? (e.g., "AI workflow that's not SaaS-cream")
- Reflex-reject aesthetic lanes (currently oversaturated training data families): fetch from brand.md reflex-reject list
- If answer yes to either order, design has failed the slop test

**Flow Integration:**
- Flow L (Design Critique) Step 5: run category-reflex check
- Every refine/enhance flow (J, S, T) Step final: run category-reflex before reporting done
- FlowHistory logs category-reflex outcome

**Reference File Source:** SKILL.md "The AI slop test" + brand.md "Reflex-reject list"

---

### 4.2 Anti-Pattern Detection (27 Deterministic Rules)

**What to Extract:**
1. Side-stripe borders (>1px colored left/right on cards/callouts/alerts)
2. Gradient text (background-clip: text + gradient)
3. Glassmorphism default (blur + glass decorative)
4. Hero-metric template (big number + stats grid + gradient)
5. Identical card grids (repeated icon+heading+text same-size cards)
6. Modal as first thought (lazy pattern)
[Plus 21 more from shared design laws + domain files]

**Detection Method:** Regex/DOM inspection on generated code or screenshots. Deterministic, no LLM.

**Flow Integration:**
- Flow K (Multi-Lens Audit) Step 5: scan against all 27 rules
- Any violation = Critical or High severity, must fix before flow completes
- FlowHistory logs which rules were checked, which passed/failed

**Reference File Source:** SKILL.md "Absolute bans" section + heuristics-scoring.md

---

### 4.3 LLM Critique Framework (12-Rule Pass)

**What to Extract from critique.md:**
1. Hierarchy clarity (can user identify primary, secondary, groupings)
2. Cognitive load (information chunking, decision density)
3. Visual weight distribution (60-30-10 correctness)
4. Color strategy commitment (is palette commitment level intentional)
5. Typography consistency (modular scale adherence)
6. Interaction affordances (are interactive elements discoverable)
7. Emotional journey (does design match brand tone)
8. Nielsen heuristics coverage (user control, feedback, standards, error prevention)
9. Accessibility inclusion (not just WCAG, but usability for diverse users)
10. Loading perception (feels fast through feedback/optimistic UI)
11. Copy precision (every word earns place)
12. Register alignment (brand vs product laws applied correctly)

**Flow Integration:**
- Flow L (Design Critique) runs full 12-rule pass
- Each rule independently scored
- Results feed into flow recommendations

**Reference File Source:** critique.md + heuristics-scoring.md

---

## PHASE 5: FlowHistory Memory & State Tracking

### 5.1 What Gets Logged Per Flow

**Flow A (Brand Verification):**
- Register detected (brand/product)
- PRODUCT.md fields loaded
- Design laws cached and listed

**Flow B (Component Research):**
- Component type defined
- Semantic requirements documented
- 8 interactive states required
- Design law alignment noted

**Flow C (Font Research):**
- Font families researched (3-5 candidates)
- Pairing strategy documented
- OpenType features identified
- Typography scale rules validated

**Flow D (Design References):**
- Visual direction statement
- Reference examples collected (8-12)
- Category-reflex check outcome (pass/fail + reasoning)
- Reusable patterns extracted

**Flows E-J (Execution & Polish):**
- Each flow logs what was applied (motion palette, tokens, accessibility checks, polish rules)
- Any violations or gate failures logged with remediation

**Flows K-N (Validation & Iteration):**
- Audit findings (Critical/High/Medium by dimension)
- Critique scores (12-rule pass results)
- Responsive breakpoints tested
- Iteration decisions logged (which variant chosen, why)

### 5.2 Decision Rationale Recording

**Every flow logs:**
- What design law was applied and why (context from PRODUCT.md + register)
- What user input was provided (if any interactive steps)
- What reference system produced guidance (component-gallery, fontshare, design-references, motion-reference)
- What rule was checked and outcome (anti-pattern detection, WCAG contrast, responsive)
- Anomalies or exceptions (why rule X didn't apply here)

**Purpose:**
- Future design decisions can reference prior reasoning
- Design reviews can see WHY choices were made, not just THAT they were
- Rework requests can show delta ("you chose Committed palette, but design asks for Restrained")

### 5.3 Memory Store Structure

```
FlowHistory entry:
{
  flowId: "flowA_brand_verify",
  flowName: "Brand Verification",
  timestamp: ISO string,
  status: "success" | "partial" | "failed",
  register: "brand" | "product",
  designLawsCached: [list of 7 domain rules applied],
  designReferencesLoaded: boolean,
  violations: [],
  decisions: [
    {
      ruleApplied: "Color Strategy",
      chosenValue: "Committed",
      reasoning: "From PRODUCT.md: brand-driven, 30-60% color",
      source: "color-and-contrast domain"
    }
  ],
  guidance: string (plain language summary for user),
  artifacts: [] (generated DESIGN.md sections, token files, etc.)
}
```

---

## Integration Points: How Sidecoach Calls Impeccable Intelligence

### User Trigger (Natural Language)

```
User: "Design a button that works across our product"

Sidecoach Intent Detection:
→ "Design X component" pattern
→ Route to Flow 1 (Design Component)
→ Determine scope (our product = product register, not brand)

Flow 1 Execution Chain:
1. Flow A (Brand Verification)
   - Load PRODUCT.md + detect register = "product"
   - Load design laws for product register

2. Flow B (Component Research)
   - Invoke component-gallery-reference
   - Return: semantic markup, ARIA patterns, 8 state requirements

3. Flow C (Font Research)
   - Invoke fontshare-reference
   - Return: typography token from DESIGN.md

4. Flow D (Design References)
   - Invoke design-references
   - Return: button examples, spacing patterns from catalog

5. Flow F (Design Tokens)
   - Load DESIGN.md color, spacing, elevation tokens
   - Validate against product design laws

6. Flow G (Implementation)
   - Write button HTML/CSS using component-gallery semantics
   - Apply tokens from Flow F
   - Apply typography from Flow C

7. Flow H (Motion)
   - Invoke motion-reference
   - Add press feedback (scale 0.96 + easing-out-quart)

8. Flow I (Accessibility)
   - Validate: focus rings, color contrast, touch target 44x44px
   - Check all 8 states present

9. Flow J (Polish)
   - Apply make-interfaces-feel-better tactical rules
   - Concentric border radius, icon state transitions, optical alignment

10. Flow K (Audit)
    - Run 27 anti-pattern checks deterministically
    - Run 5-dimension technical scan

11. Flow L (Critique)
    - Run 12-rule LLM critique pass
    - Category-reflex check

12. Flow M (Responsive)
    - Test button at each DESIGN.md breakpoint
    - Touch target, focus ring visibility

User sees: "Button designed and shipped"
User never types: `/impeccable craft`, `/component-gallery-reference`, or any slash command
All intelligence embedded, silently executed, results presented naturally
```

---

## Success Criteria for Task 2

- [ ] All 7 domain reference files embedded into appropriate flows
- [ ] All 23 command logics consolidated into flow steps (no external `/impeccable` invocation)
- [ ] Register system loads and applies design laws automatically
- [ ] All 4 reference systems (component-gallery, fontshare, design-references, motion-reference) invoked transparently at right moments
- [ ] 27 anti-pattern rules checked deterministically in audit flows
- [ ] 12-rule critique framework runs in design critique flow
- [ ] AI slop detection (category-reflex checks) runs in refinement flows
- [ ] FlowHistory logs design decisions with rationale
- [ ] User triggers flows naturally ("Design a button") with no slash commands visible
- [ ] Sidecoach is now "more useful than Impeccable" because it wraps all intelligence in structured process instead of requiring user to know 23 commands

---

Date: 2026-05-22
Extraction source: /Users/spare3/Documents/Github/impeccable/ (35 reference files, SKILL.md, README.md)
