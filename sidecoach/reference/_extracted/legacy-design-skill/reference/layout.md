# Impeccable layout.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

Space is the most underused design tool. Find the layout's actual problem (monotone spacing, weak hierarchy, identical card grids, the centered-stack default) and fix the structure, not the surface.

---

## Register

Brand: asymmetric compositions, fluid spacing with `clamp()`, intentional grid-breaking for emphasis. Rhythm through contrast: tight groupings paired with generous separations.

Product: predictable grids, consistent densities, familiar navigation patterns. Responsive behavior is structural (collapse sidebar, responsive table), not fluid typography. Consistency IS an affordance.

---

## Assess Current Layout

Analyze what's weak about the current spatial design:

1. **Spacing**:
   - Is spacing consistent or arbitrary? (Random padding/margin values)
   - Is all spacing the same? (Equal padding everywhere = no rhythm)
   - Are related elements grouped tightly, with generous space between groups?

2. **Visual hierarchy**:
   - Apply the squint test: blur your (metaphorical) eyes. Can you still identify the most important element, second most important, and clear groupings?
   - Is hierarchy achieved effectively? (Space and weight alone can be enough; is the current approach working?)
   - Does whitespace guide the eye to what matters?

3. **Grid & structure**:
   - Is there a clear underlying structure, or does the layout feel random?
   - Are identical card grids used everywhere? (Icon + heading + text, repeated endlessly)
   - Is everything centered? (Left-aligned with asymmetric layouts feels more designed, but not a hard and fast rule)

4. **Rhythm & variety**:
   - Does the layout have visual rhythm? (Alternating tight/generous spacing)
   - Is every section structured the same way? (Monotonous repetition)
   - Are there intentional moments of surprise or emphasis?

5. **Density**:
   - Is the layout too cramped? (Not enough breathing room)
   - Is the layout too sparse? (Excessive whitespace without purpose)
   - Does density match the content type? (Data-dense UIs need tighter spacing; marketing pages need more air)

**CRITICAL**: Layout problems are often the root cause of interfaces feeling "off" even when colors and fonts are fine. Space is a design material; use it with intention.

## Plan Layout Improvements

Consult the [spatial design reference](spatial-design.md) for detailed guidance on grids, rhythm, and container queries.

Create a systematic plan:

- **Spacing system**: Use a consistent scale (a framework's built-in scale like Tailwind's, rem-based tokens, or a custom system). The specific values matter less than consistency.
- **Hierarchy strategy**: How will space communicate importance?
- **Layout approach**: What structure fits the content? Flex for 1D, Grid for 2D, named areas for complex page layouts.
- **Rhythm**: Where should spacing be tight vs generous?

## Improve Layout Systematically

### Establish a Spacing System

- Use a consistent spacing scale (framework scales like Tailwind, rem-based tokens, or a custom scale all work). What matters is that values come from a defined set, not arbitrary numbers.
- Name tokens semantically if using custom properties: `--space-xs` through `--space-xl`, not `--spacing-8`
- Use `gap` for sibling spacing instead of margins; eliminates margin collapse hacks
- Apply `clamp()` for fluid spacing that breathes on larger screens

### Create Visual Rhythm

- **Tight grouping** for related elements (8-12px between siblings)
- **Generous separation** between distinct sections (48-96px)
- **Varied spacing** within sections (not every row needs the same gap)
- **Asymmetric compositions**: break the predictable centered-content pattern when it makes sense

### Choose the Right Layout Tool

- **Use Flexbox for 1D layouts**: Rows of items, nav bars, button groups, card contents, most component internals. Flex is simpler and more appropriate for the majority of layout tasks.
- **Use Grid for 2D layouts**: Page-level structure, dashboards, data-dense interfaces, anything where rows AND columns need coordinated control.
- **Don't default to Grid** when Flexbox with `flex-wrap` would be simpler and more flexible.
- Use `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints.
- Use named grid areas (`grid-template-areas`) for complex page layouts; redefine at breakpoints.

### Break Card Grid Monotony

- Don't default to card grids for everything; spacing and alignment create visual grouping naturally
- Use cards only when content is truly distinct and actionable. Never nest cards inside cards
- Vary card sizes, span columns, or mix cards with non-card content to break repetition

### Strengthen Visual Hierarchy

- Use the fewest dimensions needed for clear hierarchy. Space alone can be enough; generous whitespace around an element draws the eye. Some of the most polished designs achieve rhythm with just space and weight. Add color or size contrast only when simpler means aren't sufficient.
- Be aware of reading flow: in LTR languages, the eye naturally scans top-left to bottom-right, but primary action placement depends on context (e.g., bottom-right in dialogs, top in navigation).
- Create clear content groupings through proximity and separation.

### Manage Depth & Elevation

- Create a semantic z-index scale (dropdown -> sticky -> modal-backdrop -> modal -> toast -> tooltip)
- Build a consistent shadow scale (sm -> md -> lg -> xl); shadows should be subtle
- Use elevation to reinforce hierarchy, not as decoration

### Optical Adjustments

- If an icon looks visually off-center despite being geometrically centered, nudge it. But only if you're confident it actually looks wrong. Don't adjust speculatively.

**NEVER**:
- Use arbitrary spacing values outside your scale
- Make all spacing equal (variety creates hierarchy)
- Wrap everything in cards (not everything needs a container)
- Nest cards inside cards (use spacing and dividers for hierarchy within)
- Use identical card grids everywhere (icon + heading + text, repeated)
- Center everything (left-aligned with asymmetry feels more designed)
- Default to the hero metric layout (big number, small label, stats, gradient) as a template. If showing real user data, a prominent metric can work, but it should display actual data, not decorative numbers.
- Default to CSS Grid when Flexbox would be simpler; use the simplest tool for the job
- Use arbitrary z-index values (999, 9999); build a semantic scale

## Verify Layout Improvements

- **Squint test**: Can you identify primary, secondary, and groupings with blurred vision?
- **Rhythm**: Does the page have a satisfying beat of tight and generous spacing?
- **Hierarchy**: Is the most important content obvious within 2 seconds?
- **Breathing room**: Does the layout feel comfortable, not cramped or wasteful?
- **Consistency**: Is the spacing system applied uniformly?
- **Responsiveness**: Does the layout adapt gracefully across screen sizes?

When the rhythm and hierarchy land, hand off to `/impeccable polish` for the final pass.

## Live-mode signature params

Each variant MUST declare a `density` param. Drive all spacing tokens in the variant's scoped CSS through `calc(var(--p-density, 1) * <base>)`: paddings, gaps, column widths. Users slide from airy to packed and see layout re-breathe with no regeneration.

```json
{"id":"density","kind":"range","min":0.6,"max":1.4,"step":0.05,"default":1,"label":"Density"}
```

For variants whose topology genuinely changes (stacked vs. side-by-side, grid vs. bento), use a `steps` param whose scoped CSS branches via `:scope[data-p-structure="X"]`. One structure param + one density param is a powerful combo; resist adding a third.

```json
{"id":"structure","kind":"steps","default":"grid","label":"Structure","options":[
  {"value":"stacked","label":"Stacked"},
  {"value":"grid","label":"Grid"},
  {"value":"bento","label":"Bento"}
]}
```

See `reference/live.md` for the full params contract.

## EXTENSION

### Spacing scale (4pt base, prescribed)

```css
:root {
  --space-3xs: 0.25rem;  /* 4px */
  --space-2xs: 0.5rem;   /* 8px */
  --space-xs:  0.75rem;  /* 12px */
  --space-sm:  1rem;     /* 16px */
  --space-md:  1.5rem;   /* 24px */
  --space-lg:  2rem;     /* 32px */
  --space-xl:  3rem;     /* 48px */
  --space-2xl: 4rem;     /* 64px */
  --space-3xl: 6rem;     /* 96px */
  --space-4xl: 8rem;     /* 128px */
}
```

8pt is too coarse (you'll want 12 between 8 and 16). 4pt covers everything; you'll never want 2px or 6px outside of borders / hairlines.

### Rhythm pattern (tight + generous, paired)

```css
.section {
  padding-block: var(--space-3xl);  /* generous between sections */
}
.section > * + * {
  margin-block-start: var(--space-xs);  /* tight between section siblings */
}
.section > h2 + p,
.section > p + p {
  margin-block-start: var(--space-sm);  /* slightly looser for prose */
}
```

The pattern: large outer rhythm (96px between sections), small inner rhythm (12-16px within). Avoid uniform 24px everywhere.

### z-index semantic scale (prescribed)

```css
:root {
  --z-base:           0;
  --z-content:        10;
  --z-dropdown:       100;
  --z-sticky:         200;
  --z-fixed:          300;
  --z-modal-backdrop: 400;
  --z-modal:          500;
  --z-popover:        600;
  --z-toast:          700;
  --z-tooltip:        800;
}
```

Reserve 9999 and similar for emergencies only; the scale above should cover everything.

### Auto-fit grid (one-line responsive)

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}
```

Columns are at least 280px, as many as fit per row, leftover space distributed evenly. Replaces breakpoint-based column logic for most card grids.

### When to use named grid areas

For page-level layouts with header / sidebar / main / footer or similar fixed regions:

```css
.app-shell {
  display: grid;
  grid-template-areas:
    "header header"
    "nav    main"
    "nav    footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr auto;
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-areas:
      "header"
      "main"
      "footer";  /* nav moves to bottom or becomes hamburger */
    grid-template-columns: 1fr;
  }
}
```

Reduces breakpoint complexity dramatically; the layout reflows by reassigning areas.

## WHAT'S MISSING

- **No baseline grid prescription.** Vertical rhythm referenced in typography.md but no concrete `--baseline: 24px` token system.
- **No container-query worked examples here.** spatial-design.md covers it; layout.md doesn't cross-reference.
- **No layout patterns by use case.** Dashboard, landing, settings page, table page each want different structures; no catalog.
- **No advice on what to do when content doesn't fit.** Overflow strategies (scrollable section, modal expansion, pagination) not enumerated.
- **No anti-pattern catalog for grids.** The 6 absolute bans cover some, but card-grid monotony has variants (3x3 same, 4-up icon cards, etc.) that could be enumerated.
