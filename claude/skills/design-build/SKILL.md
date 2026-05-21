---
name: design-build
description: Run the full design pipeline as ONE orchestrated build, not as 6 hopefully-auto-triggering skills. Triggers ONLY on explicit invocation - `/design-build`, `/design-build <feature>`, "run the design pipeline for X", "design-build this", "kickoff a design build", "walk the pipeline on X", "run the full design pipeline". DO NOT auto-trigger on generic UI keywords like "build a button" or "add a hover state" - those are too narrow. This skill is the orchestrator that explicitly invokes the design pipeline's layers (strategy, research, typography, references, motion, icons, tactical polish, QA triad) in sequence with gate checkpoints, addressing the empirical finding from 2026-05-20 that the individual skills did not auto-trigger reliably on real builds and the QA triad never fired without orchestration.
---

# Design Build (the pipeline orchestrator)

A single skill that runs the design pipeline as ONE coordinated build. The other design skills (`component-gallery-reference`, `fontshare-reference`, `design-references`, `motion-reference`, `icon-source`, `make-interfaces-feel-better`) are READ AND APPLIED by this skill, not auto-triggered alongside it.

## Why this skill exists

The 2026-05-20 marketing-site build was the first time the design pipeline ran on a real UI task. The retrospective surfaced two structural problems:

1. **Auto-triggering by description keywords didn't fire reliably.** `component-gallery-reference`, `design-references`, and `icon-source` never auto-triggered during the build. `make-interfaces-feel-better` only fired because the agent had read it recently.
2. **The QA triad (`/impeccable audit + critique + polish`) never ran.** It's documented as "runs at QA time" in CLAUDE.md but there's no mechanism that actually invokes it.

`design-build` solves both by being a single, explicit orchestrator: the agent runs this skill, the skill walks all the phases, the QA triad is mandatory at the end.

## When to invoke

Trigger ONLY on these explicit invocations:

- `/design-build` or `/design-build <feature description>`
- "run the design pipeline for X"
- "design-build this"
- "kickoff a design build"
- "walk the pipeline on X"
- "run the full design pipeline"
- "use the design stack on X"

DO NOT trigger on:
- Generic UI work ("build a button", "add a hover state", "fix this layout") - these are too narrow for the full pipeline. Let the project's existing patterns handle them.
- Pure copy/typography changes - run `fontshare-reference` directly if needed.
- Pure motion changes - read `motion-reference` directly if needed.
- Tactical polish - read `make-interfaces-feel-better` directly if needed.

The full pipeline is for substantial UI builds: new pages, new screens, new feature surfaces, new sections of an existing page, redesigns. If the work is a tactical tweak, skip this skill.

## The orchestration (9 phases, 2 gate checkpoints)

### Phase 0: Pre-flight - PRODUCT.md and DESIGN.md must exist

```
1. Check <project>/PRODUCT.md. If missing or stub (<200 chars, contains "[TODO]"):
   - Run /impeccable teach FIRST. Block this build until it returns.
2. Check <project>/DESIGN.md. If missing AND project has existing code:
   - Nudge ONCE: "Run /impeccable document to capture the current visual system. Proceeding without it, but variants may drift."
   - Continue. DESIGN.md is not strictly blocking for this skill.
3. Read both files in full. Capture:
   - Three brand-voice words (from PRODUCT.md)
   - Register (brand vs product)
   - Anti-references list
   - Existing tokens (colors, type, spacing) from DESIGN.md
```

These are the inputs to every subsequent phase. Without them the pipeline cannot route correctly.

### Phase 1: Strategy (Impeccable)

```
Compose a brief direction for the feature:
- What is the feature? (One-line)
- Who is the audience? (From PRODUCT.md)
- What register does it sit in? (Brand vs product, from PRODUCT.md)
- What three brand-voice words is it serving?
- What anti-references must it avoid?
- What is the proposed layout / structure?
```

Present this via AskUserQuestion as the FIRST GATE CHECKPOINT:

```
"Direction looks like: <one-paragraph summary>. Approve, edit, or push back?"
Options:
- Approved as proposed (Recommended)
- Edit one specific aspect (you tell me which)
- Reframe entirely (I'll propose a different direction)
- Cancel build
```

Wait for user response. If "Approved" - proceed. If "Edit" / "Reframe" - iterate, then re-present.

### Phase 2: Research (component-gallery-reference)

For any standard UI component in the feature (button, modal, card, navigation, form, etc.), READ the `component-gallery-reference` skill workflow and apply it:

```
1. Detect project tech stack from package.json (React, Vue, Tailwind, etc.)
2. For each standard component, identify the component.gallery slug
3. Browse the gallery page filtered by tech stack
4. Skip Unmaintained and Accessibility-issues examples
5. Extract: semantic markup, name consensus, interaction patterns, ARIA, related components
6. Synthesize a brief per component
```

If the feature is NOVEL (no standard components), skip this phase and note "no gallery match" in the build log.

### Phase 3: References (design-references catalog)

Grep `~/.claude/design-references/*/ref.md` for matches:

```
- Category match (high signal +3)
- Pattern match (+1 each)
- Feel match against the brand-voice words from PRODUCT.md (+1 each)
- Source match if the user named a company (+3)
```

Surface 0-5 references with score ≥ 3. Stay silent if no good matches - noisy surfacing destroys trust.

### Phase 4: Typography (fontshare-reference)

ONLY run this phase if type decisions are in scope (new typeface, new pairing, new project). If the project already has a DESIGN.md typography section locked in, SKIP this phase and use those tokens.

If running:

```
1. List your three brand-voice words (from PRODUCT.md)
2. List your three reflex typefaces - any on the reflex-reject list? Reject them.
   Reject list (from fontshare-reference): Fraunces, Newsreader, Lora, Crimson,
   Crimson Pro, Crimson Text, Playfair Display, Cormorant, Cormorant Garamond,
   Syne, IBM Plex Mono/Sans/Serif, Space Mono, Space Grotesk, Inter, DM Sans,
   DM Serif Display/Text, Outfit, Plus Jakarta Sans, Instrument Sans, Instrument Serif.
3. Also avoid Fontshare's emerging defaults: General Sans, Cabinet Grotesk,
   Switzer, Satoshi, Clash Display (unless the brief specifically argues for one).
4. Browse fontshare.com/fonts with the brand-voice words. Open 5-8 candidates.
5. Cross-check against anti-reflexes (technical brief != serif "for warmth", etc.).
6. Verify weights, OpenType features, language coverage.
7. Document the pick in DESIGN.md.
```

### Phase 5: Motion (motion-reference)

ONLY run this phase if the feature has scroll, animation, transitions, drag, or interaction motion. If purely static, SKIP.

If running:

```
1. Identify the motion need - tween, timeline, scroll-trigger, scroll-feel,
   layout transition, SVG path draw, text reveal, etc.
2. Read motion-reference for the canonical pattern. Lift verbatim. The skill
   ships:
   - GSAP + ScrollTrigger + Lenis 3-line glue snippet
   - React useGSAP hook with scope
   - ReactLenis root provider
   - Flip layout transitions
   - SplitText word/char stagger
   - DrawSVG path animation
   - Snap-to-section
3. Apply the gotchas:
   - SSR: dynamic import or "use client"
   - ScrollTrigger.refresh() after dynamic content
   - Lenis breaks native scrollIntoView - use lenis.scrollTo
   - iOS Safari + Lenis + fixed-position quirks
```

### Phase 6: Icons (icon-source)

ONLY run if icons are needed. If purely typography + color, SKIP.

If running, read `icon-source` skill protocol:

```
1. Check if the project already uses an icon library. One library per project.
2. If new: pick from the 8 approved (Heroicons, Lucide, Tabler, Bootstrap Icons,
   Phosphor, Material Symbols, Lucide Animated, Heroicons Animated).
3. Match to brand voice (Phosphor for warm, Heroicons for clean, Tabler for utility).
4. Source SVG paths VERBATIM from the library. Do not redraw, simplify, or
   "optimize" path data.
```

### Phase 7: Build (make-interfaces-feel-better applied DURING construction)

Generate the code. While generating, apply `make-interfaces-feel-better`'s 14 rules as a build-time checklist, NOT as a separate post-pass:

```
- Concentric border radius (outer = inner + padding)
- Optical centering (manual nudge for icons)
- Shadows over borders (layered transparent box-shadow)
- Interruptible animations (CSS transitions for state, keyframes for staged)
- Split + stagger enters (~100ms delay each)
- Subtle exits (small fixed translateY, never full height)
- Contextual icon swaps via opacity + scale + blur
- Font smoothing on root
- Tabular nums on dynamic counters
- text-wrap: balance on headings, pretty on body
- Image outlines rgba(0,0,0,0.1) light / rgba(255,255,255,0.1) dark, NEVER tinted
- scale(0.96) on press
- initial={false} on AnimatePresence
- Never transition: all; specify exact properties
- will-change only on transform/opacity/filter, sparingly
- Minimum 40x40px hit area, no overlap
```

These should land NATURALLY in the code, not as a post-pass cleanup.

### Phase 8: QA triad (MANDATORY - the part that never fired before)

Before reporting the build done, run:

1. **`/impeccable audit <target>`** - 5-dimension technical scan (a11y, performance, theming, responsive, anti-patterns) plus `npx impeccable detect`. Address all Critical and High findings.
2. **`/impeccable critique <target>`** - design review via independent sub-agents (AI-slop detection, Nielsen heuristics, cognitive load, emotional journey). Address anything above "minor".
3. **`/impeccable polish <target>`** - final design-system alignment pass.

If any of the three flag substantive issues, iterate. Do NOT skip this phase. If you cannot run impeccable for some reason (e.g., the project isn't impeccable-instrumented), record that in the build memory entry explicitly - "QA triad SKIPPED because <reason>" - so future-you sees the gap.

### Phase 9: Verification (cmux browser)

Start a dev server, open the build in the cmux browser pane, take screenshots, Read them, critically examine.

```
- Click every interactive element (real input only - no JS shortcuts, validation-guard will block them)
- Verify hover states, focus rings, press states, loading states
- Side-by-side against the design source if there was one (Figma, mockup, design-references match)
- Verify dark mode if the project has it
- Verify mobile breakpoint
```

### Phase 10: Memory

Write a session memory entry at `<project>/.claude/memory/session_YYYY-MM-DD_<feature>.md` with:
- What was built
- Which pipeline phases fired vs skipped (and why for skips)
- QA findings and how they were addressed
- Friction points hit
- Files touched

The retrospective layer is how the pipeline improves over time. Without memory, every build re-learns the same lessons.

## The second gate checkpoint (between Phase 8 and 9)

After the QA triad has surfaced findings, present via AskUserQuestion:

```
"QA found these issues: <list>. How do you want to proceed?"
Options:
- Address all findings before reporting done (Recommended)
- Address only Critical/High; accept the rest
- Accept all - I'll mark known issues in memory
- Cancel build and re-shape
```

This is the second mandatory checkpoint. The first was after strategy. Everything else flows automatically.

## Failure modes to expect (from the 2026-05-20 retrospective)

- **Skipping the QA triad.** This skill exists partly to prevent that. If you're tempted to skip Phase 8 because "the site looks fine," DO NOT. The triad's whole purpose is catching what the eye misses. Run it.
- **Letting auto-trigger replace orchestration.** The other design skills' auto-triggers don't fire reliably. Don't assume `component-gallery-reference` will fire just because you mentioned a button. Read it explicitly in Phase 2.
- **`data-reveal opacity:0` patterns that break silently.** Use the inverted progressive enhancement: items visible by default, hidden only when JS confirms via a `.js` class. Validated in the 2026-05-20 marketing-site build.
- **CDN ESM imports.** Use `esm.sh` for ES modules, not `cdn.skypack.dev` - skypack failed silently on `lenis` in the marketing-site build.
- **Lenis + verification conflict.** Lenis hijacks native scroll. If you're verifying via cmux's scroll command, temporarily disable Lenis via a feature flag, verify, re-enable. Or click nav links (which use lenis.scrollTo).

## Integration with the rest of the design stack

This skill orchestrates. The others (component-gallery-reference, fontshare-reference, design-references, motion-reference, icon-source, make-interfaces-feel-better) are READ AND APPLIED by this orchestrator, not auto-fired alongside it.

The other skills CAN still fire on direct invocation - e.g. "/curate this reference", "use fontshare-reference for this typeface decision". They are individual tools. `design-build` is the pipeline.

`/impeccable` commands (teach, document, audit, critique, polish) are CALLED by this skill at the appropriate phases. Impeccable's other commands (craft, shape, animate, colorize, harden, etc.) can be invoked directly outside this skill.

## What this skill is NOT for

- Tactical CSS tweaks (read `make-interfaces-feel-better` directly)
- Single-skill consultations (consult them directly when you need them)
- Backend, infrastructure, or non-UI work
- A way to skip the QA triad by overwhelming with phases - if Phase 8 gets skipped, the skill failed at its purpose
