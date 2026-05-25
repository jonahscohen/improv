---
source: https://github.com/LovroPodobnik/refactoring-ui-skill/blob/main/.claude/skills/ui-refactor/SKILL.md
captured: 2026-05-25
type: external-taste-skill (codification of Refactoring UI book by Adam Wathan & Steve Schoger)
---

# Refactoring UI - SKILL Index (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### Core Workflow

1. **Feature First**: Do NOT start by designing a "shell" (nav bars, sidebars). Start with the specific functionality (e.g., the search form, the contact card).
2. **Low Fidelity**: Ignore color, shadows, and fonts initially. Design in grayscale using a thick marker or basic wireframes to solve layout and spacing first.
3. **Define Systems**: Do NOT use arbitrary values. Establish restrictive systems for spacing, type, and color immediately.
4. **Refine**: Apply specific tactics for hierarchy, depth, and polish.

### Domain References

- **Making elements stand out/fit in**: hierarchy.md (Size, weight, contrast, semantics)
- **Whitespace and alignment**: layout-spacing.md (Grids, spacing scales, density)
- **Text and fonts**: typography.md (Type scales, line-height, fonts)
- **Colors and palettes**: color.md (HSL, saturation, accessible contrast)
- **Images, shadows, and polish**: depth-and-polish.md (Light sources, assets, finishing touches)

### Quick Heuristics

- **Limit Choices**: If you can't decide between two options, you have too many choices. Constrain your inputs (colors, font sizes, spacing) to a pre-defined scale.
- **Personality**:
  - *Serious/Elegant*: Serif fonts, sharp corners, gold/blue colors, formal language.
  - *Playful/Friendly*: Rounded sans-serifs, large border-radius, pink/orange, casual language.
- **Complexity**: Do NOT design for edge cases first. Design the "happy path" (simple version), then iterate for complexity.

---

## SECTION 2: EXTENSION

### The "Feature First" workflow reordering

The standard developer instinct is to build the shell (nav bar, sidebar, header, footer) first because it's mechanical and easy. Refactoring UI inverts this:

1. Build the actual content (one feature card, one form, one data table).
2. Get that content right at small scale.
3. THEN figure out what shell the content needs.

This prevents the common failure mode where the shell is over-designed and the content is an afterthought - the entire page becomes "Slack chrome with a tiny message area in the middle."

### Why grayscale-first works

When you start with color, you make TWO decisions at once: "what's important?" and "what color is it?" Color becomes a crutch for hierarchy. When you start in grayscale:
- You're forced to use size, weight, position, and SPACING to create hierarchy.
- When you add color later, it amplifies decisions you've already made instead of substituting for them.
- Grayscale-first designs survive accessibility audits better because they don't rely on color contrast for meaning.

### Personality decision tree

The 2-axis personality lookup expanded:

| Brand vibe | Font | Corners | Color | Voice |
|---|---|---|---|---|
| Serious / Elegant | Serif (Lyon, Newsreader) | Sharp (0-2px radius) | Gold (#B8924D), Navy (#1A3354) | Formal: "Continue", "Submit Application" |
| Playful / Friendly | Rounded sans (Nunito, Inter) | Large (12-16px radius) | Pink (#EC4899), Orange (#F97316) | Casual: "Go for it", "Send it!" |
| Technical / Tool | Mono (JetBrains, Geist Mono) | Square (0px radius) | Green terminal (#4AF626), Hazard red (#FF2A2A) | Direct: "Execute", "Deploy" |
| Premium / Boutique | Display serif (Cabinet Grotesk, PP Editorial) | Medium (8px radius) | Muted earth (Terracotta + Charcoal) | Refined: "Discover", "Explore" |
| Consumer / SaaS | Geometric sans (Geist, Outfit) | Standard (6-8px radius) | Brand accent + 1 status set | Plain: "Save changes", "Try free" |

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

1. **The "Feature First" workflow ordering principle.** Sidecoach flows start with strategy then build; Refactoring UI starts with one specific feature then works outward.

2. **The "Low Fidelity / Grayscale-first" discipline.** A specific process gate that prevents premature color decisions.

3. **The "Limit Choices" heuristic.** Sidecoach is constraint-driven but doesn't explicitly say "if you're stuck between two options, you have too many options."

4. **The 2-axis personality lookup (Serious/Elegant vs Playful/Friendly).** A simple lookup the user can use to set the design tone.

5. **The "happy path first, edge cases later" complexity ordering.** Prevents the over-designed empty-state failure mode.
