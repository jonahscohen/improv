---
name: session-2026-05-21-sidecoach-trigger-language
description: "Expanded trigger language for 14 Sidecoach flows - 5-8 patterns per flow with collision avoidance matrix"
type: project
relates_to:
  - sidecoach_flows_comprehensive.md
---

# Sidecoach Trigger Language - Complete Set

Comprehensive natural language triggers for each flow. Designed to capture sensible variations while minimizing false positives through careful distinction markers.

## Collision Avoidance Map

```
CRITICAL DISTINCTIONS:
- Flow 1 (Clone) vs Flow 10 (Implement): clone emphasizes "match exactly/steal/1:1", implement emphasizes "build/code/from design"
- Flow 3 (Audit) vs Flow 5 (Review): audit is "report only", review is "comprehensive/fix-focused"
- Flow 4 (Explore) vs Flow 13 (Iterate): explore is "open/what-if/experiment", iterate is "refine/goal-driven/success criteria"
- Flow 7 (Design) vs Flow 10 (Implement): design is "new/create", implement is "from reference/code"
- Flow 8 (Refactor) vs Flow 14 (Migrate): refactor is "layout/structure/hierarchy", migrate is "component/API/replace"
```

---

## HIGH-FEASIBILITY FLOWS (6)

### Flow 1: Clone/Match from Reference
**Trigger patterns:**
- "match [element] from [source]" (Match button from the Figma)
- "clone [component]" (Clone this card)
- "steal [element] from [reference]" (Steal this from the live site)
- "exact copy of [element]" (Exact copy of the header)
- "1:1 with [design]" (1:1 with the Figma mockup)
- "[element] identical to [source]" (Make this identical to the reference)
- "copy [element] precisely" (Copy this button precisely)

**Collision guards:**
- Avoid: "build from [design]" → use for Flow 10
- Avoid: "implement [component]" → use for Flow 10
- Look for: "match", "steal", "clone", "1:1", "exact", "identical", "copy precisely"

---

### Flow 2: Polish/Enhance Interaction
**Trigger patterns:**
- "add feeling to [element]" (Add feeling to the buttons)
- "make this feel better" (Make the form feel better)
- "enhance interaction on [element]" (Enhance interaction on hover)
- "polish [element]" (Polish the modal)
- "[element] needs more life" (This button needs more life)
- "make [element] less janky" (Make the animation less janky)
- "improve the experience of [element]" (Improve the experience of scrolling)
- "add micro[interaction/animation]" (Add microinteractions to the cards)

**Collision guards:**
- Avoid: "improve layout" → use for Flow 8
- Avoid: "make accessible" → use for Flow 9
- Look for: "feel", "polish", "experience", "life", "janky", "microinteraction", "animation"

---

### Flow 3: Audit Page/Section
**Trigger patterns:**
- "audit [page/section]" (Audit the homepage)
- "review [area] for issues" (Review this section for issues)
- "QA check [area]" (QA check the checkout flow)
- "what's wrong with [page]" (What's wrong with the dashboard)
- "find issues on [page]" (Find issues on this page)
- "scan [area] for problems" (Scan the navbar for problems)
- "technical audit of [area]" (Technical audit of the footer)

**Collision guards:**
- Avoid: "code review" → use for Flow 5 (suggests implementation review)
- Avoid: "make this accessible" → use for Flow 9 (specific to a11y)
- Look for: "audit", "review for issues", "QA check", "find issues", "scan"
- Key: audit is reporting-only, doesn't suggest fixes

---

### Flow 4: Exploration/Discovery Mode
**Trigger patterns:**
- "explore [concept]" (Explore sidebar layouts)
- "what if we [tried/changed] [element]" (What if we changed the card colors)
- "experiment with [area]" (Experiment with the navigation)
- "discovery mode for [element]" (Discovery mode for the homepage layout)
- "try [N] versions of [element]" (Try 3 versions of the footer)
- "brainstorm [design aspect]" (Brainstorm color schemes)
- "[area] exploration" (Mobile layout exploration)

**Collision guards:**
- Avoid: "iterate" → use for Flow 13 (suggests refinement toward goal)
- Avoid: "improve" → use for Flow 8 (suggests fixing specific problem)
- Look for: "explore", "what if", "experiment", "discovery", "try variations", "brainstorm"
- Key: exploration is unvalidated, open-ended discovery

---

### Flow 5: Review/QA Mode
**Trigger patterns:**
- "review this PR" (Review this PR)
- "code review [area]" (Code review the checkout component)
- "QA this" (QA this section)
- "review [component] for quality" (Review the modal for quality)
- "do a full review" (Do a full review of the design)
- "comprehensive check of [area]" (Comprehensive check of responsiveness)
- "check for design/performance/a11y issues" (Check for design issues)

**Collision guards:**
- Avoid: "audit [area]" → use for Flow 3 (audit = report only)
- Avoid: "improve [area]" → use for Flow 8 or 2 (suggests fixing, not reviewing)
- Look for: "review", "code review", "comprehensive check", "for quality", "for issues"
- Key: review is comprehensive multi-lens check

---

### Flow 6: Constraint-Based Design
**Trigger patterns:**
- "design [element] for [constraint]" (Design the sidebar for mobile)
- "design with [constraint]" (Design with performance budget)
- "optimize [element] given [limit]" (Optimize the hero for dark mode)
- "[element] under [constraint]" (The button under 40x40px constraint)
- "design [element] at [constraint]" (Design the table at 320px width)
- "make [element] work with [constraint]" (Make the nav work with keyboard-only)
- "[element] respecting [rule]" (Buttons respecting WCAG AAA contrast)

**Collision guards:**
- Avoid: "improve layout" → use for Flow 8 (general improvement, not constraint-driven)
- Avoid: "refactor for [constraint]" → use Flow 8 or 14
- Look for: "design [with/for/given] [constraint]", "optimize [for/given]", "under [limit]", "respecting [rule]"
- Key: constraint is explicit and measurable

---

## HIGH-FEASIBILITY FLOWS (Formerly Medium - 8)

### Flow 7: Design a New Component
**Trigger patterns:**
- "design a [component]" (Design a date picker)
- "create [element]" (Create the sidebar widget)
- "build [component]" (Build the tooltip component)
- "new [component]" (New modal component)
- "design [component] from scratch" (Design the card component from scratch)
- "need a [component]" (Need a notification banner)
- "design [element] with these states/features" (Design a button with loading state)

**Collision guards:**
- Avoid: "implement [component]" → use for Flow 10 (suggests coding from design)
- Avoid: "refactor [component]" → use for Flow 14 (implies existing component)
- Avoid: "clone from [reference]" → use for Flow 1
- Look for: "design", "create", "build", "new", "from scratch"
- Key: design implies NEW, not from existing reference

---

### Flow 8: Refactor/Improve Section
**Trigger patterns:**
- "refactor [section]" (Refactor the checkout flow)
- "[area] feels cluttered" (The dashboard feels cluttered)
- "improve layout of [area]" (Improve layout of the header)
- "restructure [area]" (Restructure the sidebar)
- "[area] needs better hierarchy" (The form needs better hierarchy)
- "reorganize [area]" (Reorganize the footer)
- "make [area] clearer" (Make the navigation clearer)
- "layout improvements for [area]" (Layout improvements for the settings page)

**Collision guards:**
- Avoid: "make [area] accessible" → use for Flow 9
- Avoid: "responsive [area]" → use for Flow 12
- Avoid: "refactor [component] API" → use for Flow 14 (component migration)
- Avoid: "polish [element]" → use for Flow 2 (interaction/animation)
- Look for: "refactor", "cluttered", "hierarchy", "layout", "restructure", "reorganize", "clearer"
- Key: refactor is about structure/whitespace/hierarchy, not API or animation

---

### Flow 9: Make Accessible
**Trigger patterns:**
- "make [area] accessible" (Make the form accessible)
- "a11y audit [area]" (A11y audit the homepage)
- "accessibility check" (Accessibility check)
- "screen reader test [area]" (Screen reader test the nav)
- "WCAG [AA/AAA] [area]" (Make this WCAG AA compliant)
- "improve a11y of [area]" (Improve a11y of the modals)
- "[area] needs keyboard navigation" (The carousel needs keyboard navigation)
- "fix accessibility issues" (Fix accessibility issues)

**Collision guards:**
- Avoid: "audit [area]" (generic) → use for Flow 3
- Avoid: "improve [area]" (generic) → use for Flow 8 or 2
- Look for: "accessible", "a11y", "screen reader", "WCAG", "keyboard navigation", "accessibility"
- Key: a11y is explicitly about accessibility standards/testing

---

### Flow 10: Implement from Design
**Trigger patterns:**
- "implement [component]" (Implement the button)
- "code this design" (Code this Figma design)
- "build from [Figma/reference]" (Build from the mockup)
- "[component] from [design source]" (The modal from the Figma)
- "code [element] from [reference]" (Code the hero from the screenshot)
- "build [component] based on [design]" (Build the form based on the spec)
- "implement design for [element]" (Implement design for the cards)

**Collision guards:**
- Avoid: "design [component]" → use for Flow 7 (implies new design)
- Avoid: "clone [element]" → use for Flow 1 (implies exact pixel-match)
- Look for: "implement", "code", "build from", "build based on"
- Key: implement suggests coding FROM an existing design reference

---

### Flow 11: Extract Tokens/Create Variant
**Trigger patterns:**
- "extract [pattern]" (Extract the button spacing pattern)
- "create a token for [pattern]" (Create a token for this color)
- "make [pattern] reusable" (Make this spacing reusable)
- "define [variant]" (Define the button variants)
- "standardize [pattern]" (Standardize the form field spacing)
- "[pattern] keeps repeating, extract it" (This color keeps repeating, extract it)
- "convert [pattern] to token" (Convert this color to a design token)

**Collision guards:**
- Avoid: "refactor" → use for Flow 8 (layout structure, not tokens)
- Avoid: "design [component]" → use for Flow 7 (component design, not token extraction)
- Look for: "extract", "token", "reusable", "standardize", "variant", "repeating"
- Key: extraction is about finding repeated patterns and making them reusable

---

### Flow 12: Responsive Design Review
**Trigger patterns:**
- "responsive check" (Responsive check)
- "mobile review" (Mobile review)
- "test breakpoints" (Test breakpoints)
- "responsive [area]" (Make the table responsive)
- "tablet/mobile/desktop testing" (Tablet and mobile testing)
- "breakpoint validation" (Breakpoint validation)
- "check [area] at different sizes" (Check this layout at different sizes)

**Collision guards:**
- Avoid: "mobile optimization" → clarify intent (could be performance, Flow 8 layout, or Flow 12 responsive)
- Avoid: "responsive design" (generic) → look for "review", "check", "test" to confirm Flow 12
- Look for: "responsive", "mobile", "breakpoint", "sizes", "tablet", "desktop"
- Key: responsive is explicitly about testing across breakpoints/sizes

---

### Flow 13: Rapid Iteration Cycle
**Trigger patterns:**
- "iterate on [element]" (Iterate on the button design)
- "try variations" (Try variations of the color)
- "rapid iteration on [element]" (Rapid iteration on the header)
- "cycle through ideas" (Cycle through layout ideas)
- "refine [element] with feedback" (Refine the form with user feedback)
- "[element] iteration round [N]" (Another iteration of the sidebar)
- "quick variations of [element]" (Quick variations of the card layout)

**Collision guards:**
- Avoid: "explore" → use for Flow 4 (open-ended, no success criteria)
- Avoid: "refactor" → use for Flow 8 (structural improvement, not iteration)
- Look for: "iterate", "try variations", "cycle through", "refine", "round", "quick variations"
- Key: iteration is goal-driven, requires success criteria or user feedback

---

### Flow 14: Migration/Refactor Existing Component
**Trigger patterns:**
- "migrate [component] to [new approach]" (Migrate the button to the new API)
- "update [component]" (Update the form inputs)
- "replace [old component] with [new]" (Replace the old modal)
- "[component] refactor/rewrite" (Button component refactor)
- "upgrade [component]" (Upgrade the card component)
- "refactor [component]'s API" (Refactor the select's API)
- "breaking change in [component]" (Breaking change in the table)

**Collision guards:**
- Avoid: "refactor [section layout]" → use for Flow 8
- Avoid: "design [component]" → use for Flow 7
- Look for: "migrate", "update", "replace", "refactor", "rewrite", "upgrade", "API", "breaking change"
- Key: migration is about existing component + API change + dependency ripple

---

## Collision Matrix

| Potential Confusion | Flow A | Flow B | Distinguisher |
|---|---|---|---|
| Clone vs Implement | Flow 1 | Flow 10 | Clone: "match exactly", "steal", "1:1" / Implement: "code", "build from" |
| Audit vs Review | Flow 3 | Flow 5 | Audit: "audit", "report" / Review: "code review", "comprehensive" |
| Design vs Implement | Flow 7 | Flow 10 | Design: "new", "create", "from scratch" / Implement: "from [source]", "based on" |
| Explore vs Iterate | Flow 4 | Flow 13 | Explore: "what if", "experiment", "discover" / Iterate: "refine", "success criteria", "round" |
| Refactor Layout vs Refactor Component | Flow 8 | Flow 14 | Layout: "cluttered", "hierarchy", "layout", "section" / Component: "API", "replace", "migrate", "component" |
| Polish vs Improve | Flow 2 | Flow 8 | Polish: "feel", "micro", "animation", "janky" / Improve: "structure", "layout", "hierarchy" |
| Responsive vs Layout | Flow 12 | Flow 8 | Responsive: "breakpoint", "sizes", "mobile" / Layout: "hierarchy", "whitespace", "section" |

---

## Implementation Guidance

1. **Token-based matching:** Match against tokens per flow (e.g., Flow 2 tokens include "feel", "polish", "animation")
2. **Negative filters:** Block known collision patterns (e.g., "refactor" + "layout" → Flow 8, not Flow 14)
3. **Priority ordering:** When ambiguous, check disambiguators in order:
   - Presence of distinguishing token (e.g., "API" → Flow 14)
   - Absence of collision tokens (e.g., "refactor" without "API" or "component" → Flow 8)
   - User context (what was previous flow? what is scope?)
4. **Multi-word matching:** Longest match wins (e.g., "refactor component API" → Flow 14 over "refactor section")

---

Collaborator: Jonah
Date: 2026-05-21
