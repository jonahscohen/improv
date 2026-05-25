# Impeccable extract.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Extract Flow

Identify reusable patterns, components, and design tokens, then extract and consolidate them into the design system for systematic reuse.

## Step 1: Discover the Design System

Find the design system, component library, or shared UI directory. Understand its structure: component organization, naming conventions, design token structure, import/export conventions.

**CRITICAL**: If no design system exists, STOP and call the AskUserQuestion tool to clarify. before creating one. Understand the preferred location and structure first.

## Step 2: Identify Patterns

Look for extraction opportunities in the target area:

- **Repeated components**: Similar UI patterns used 3+ times (buttons, cards, inputs)
- **Hard-coded values**: Colors, spacing, typography, shadows that should be tokens
- **Inconsistent variations**: Multiple implementations of the same concept
- **Composition patterns**: Layout or interaction patterns that repeat (form rows, toolbar groups, empty states)
- **Type styles**: Repeated font-size + weight + line-height combinations
- **Animation patterns**: Repeated easing, duration, or keyframe combinations

Assess value: only extract things used 3+ times with the same intent. Premature abstraction is worse than duplication.

## Step 3: Plan Extraction

Create a systematic plan:

- **Components to extract**: Which UI elements become reusable components?
- **Tokens to create**: Which hard-coded values become design tokens?
- **Variants to support**: What variations does each component need?
- **Naming conventions**: Component names, token names, prop names that match existing patterns
- **Migration path**: How to refactor existing uses to consume the new shared versions

**IMPORTANT**: Design systems grow incrementally. Extract what is clearly reusable now, not everything that might someday be reusable.

## Step 4: Extract & Enrich

Build improved, reusable versions:

- **Components**: Clear props API with sensible defaults, proper variants for different use cases, accessibility built in (ARIA, keyboard navigation, focus management), documentation and usage examples
- **Design tokens**: Clear naming (primitive vs semantic), proper hierarchy and organization, documentation of when to use each token
- **Patterns**: When to use this pattern, code examples, variations and combinations

## Step 5: Migrate

Replace existing uses with the new shared versions:

- **Find all instances**: Search for the patterns you extracted
- **Replace systematically**: Update each use to consume the shared version
- **Test thoroughly**: Ensure visual and functional parity
- **Delete dead code**: Remove the old implementations

## Step 6: Document

Update design system documentation:

- Add new components to the component library
- Document token usage and values
- Add examples and guidelines
- Update any Storybook or component catalog

**NEVER**:
- Extract one-off, context-specific implementations without generalization
- Create components so generic they are useless
- Extract without considering existing design system conventions
- Skip proper TypeScript types or prop documentation
- Create tokens for every single value (tokens should have semantic meaning)
- Extract things that differ in intent (two buttons that look similar but serve different purposes should stay separate)

## EXTENSION

### Rule of 3 enforcement

The "3+ uses with same intent" threshold deserves operational definitions:

- **Same intent**: serves the same user purpose AND has the same semantic role. A "Save" button and a "Delete" button look similar but have opposite intent; they don't count as 3 uses.
- **Same configuration**: same visual treatment (size, color, padding) OR a small variant set. If usages differ by random padding values per spot, you have drift, not a reusable component; fix the drift before extracting.
- **Same trajectory**: similar usages are likely to keep appearing. If you suspect a component will appear in 1 more place, that's the 4th use; extract. If you suspect it's a snapshot of three one-offs that won't recur, don't.

### Token extraction priority

Extract in this order:

1. **Colors** - most reused, most likely to drift, most painful to retrofit. Even a 3-color extraction (primary, neutral-text, neutral-bg) is high-value.
2. **Spacing** - 4pt or 8pt scale; even pulling out 6 values (4, 8, 12, 16, 24, 32) covers most usage.
3. **Border radius** - small set (none, sm, md, lg) covers nearly everything.
4. **Typography** - sizes, weights, line-heights. Trickier because they interact with font choice; extract as a system, not individually.
5. **Shadows / elevation** - if the project uses them; some flat-by-default systems skip this entirely.
6. **Motion** - durations and easings; extract once the project's motion is consistent enough to standardize.

### Migration grep patterns

| Hardcoded pattern | Token replacement |
|---|---|
| `padding: 16px` | `padding: var(--space-md)` |
| `padding: 8px 16px` | `padding: var(--space-sm) var(--space-md)` |
| `border-radius: 8px` | `border-radius: var(--radius-md)` |
| `color: #1a1a1a` | `color: var(--color-text-primary)` |
| `background: #ffffff` | `background: var(--color-surface)` |
| `font-size: 16px` | `font-size: var(--text-body)` |
| `box-shadow: 0 1px 3px rgba(0,0,0,0.12)` | `box-shadow: var(--shadow-sm)` |

Greppable enough to do bulk-replace once tokens are defined.

## WHAT'S MISSING

- **No metric for "premature abstraction."** "3+ uses" is one heuristic but doesn't address timing (e.g., 3 uses on day 1 of a project vs. 3 uses across 2 years).
- **No deprecation flow.** Step 5 says "delete dead code" but no guidance on how to deprecate a pattern gracefully if external code consumes it.
- **No component API design guidance.** Step 4 says "clear props API with sensible defaults" but no rubric for what a good API looks like (compound components, slot patterns, render props, headless vs. opinionated).
- **No design token naming convention specified.** Says "clear naming (primitive vs semantic)" but doesn't enumerate examples (`--color-blue-500` vs `--color-primary`).
- **No Storybook or catalog setup.** Step 6 says "update any Storybook or component catalog" but no help if one doesn't exist.
- **No relationship to DESIGN.md.** Extracted tokens should land in DESIGN.md's frontmatter; this connection isn't drawn.
- **No "extract" vs "compose" distinction.** Sometimes the right answer is composition (a `Stack` + `Box` primitive set) not extraction (a `<UserCard>` component); no guidance on which.
