# Impeccable typeset.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

Typography carries most of the information on the page. Replace generic defaults (Inter, Roboto, system fallback at flat scale) with type that reflects the brand and scales with intentional contrast.

---

## Register

Brand: run the font selection procedure in [brand.md](brand.md). Pairing follows the brand's lane (display serif + sans body for editorial/luxury, one committed sans for tech, etc.). Fluid `clamp()` scale, ratio of at least 1.25 between steps.

Product: system fonts and familiar sans stacks are legitimate here. One well-tuned family typically carries the whole UI. Fixed `rem` scale, 1.125 to 1.2 ratio between more closely-spaced steps.

---

## Assess Current Typography

Analyze what's weak or generic about the current type:

1. **Font choices**:
   - Are we using invisible defaults? (Inter, Roboto, Arial, Open Sans, system defaults)
   - Does the font match the brand personality? (A playful brand shouldn't use a corporate typeface)
   - Are there too many font families? (More than 2-3 is almost always a mess)

2. **Hierarchy**:
   - Can you tell headings from body from captions at a glance?
   - Are font sizes too close together? (14px, 15px, 16px = muddy hierarchy)
   - Are weight contrasts strong enough? (Medium vs Regular is barely visible)

3. **Sizing & scale**:
   - Is there a consistent type scale, or are sizes arbitrary?
   - Does body text meet minimum readability? (16px+)
   - Is the sizing strategy appropriate for the context? (Fixed `rem` scales for app UIs; fluid `clamp()` for marketing/content page headings)

4. **Readability**:
   - Are line lengths comfortable? (45-75 characters ideal)
   - Is line-height appropriate for the font and context?
   - Is there enough contrast between text and background?

5. **Consistency**:
   - Are the same elements styled the same way throughout?
   - Are font weights used consistently? (Not bold in one section, semibold in another for the same role)
   - Is letter-spacing intentional or default everywhere?

**CRITICAL**: The goal isn't to make text "fancier." It's to make it clearer, more readable, and more intentional. Good typography is invisible; bad typography is distracting.

## Plan Typography Improvements

Consult the [typography reference](typography.md) for detailed guidance on scales, pairing, and loading strategies.

Create a systematic plan:

- **Font selection**: Do fonts need replacing? What fits the brand/context?
- **Type scale**: Establish a modular scale (e.g., 1.25 ratio) with clear hierarchy
- **Weight strategy**: Which weights serve which roles? (Regular for body, Semibold for labels, Bold for headings, or whatever fits)
- **Spacing**: Line-heights, letter-spacing, and margins between typographic elements

## Improve Typography Systematically

### Font Selection

If fonts need replacing:
- Choose fonts that reflect the brand personality
- Pair with genuine contrast (serif + sans, geometric + humanist), or use a single family in multiple weights
- Ensure web font loading doesn't cause layout shift (`font-display: swap`, metric-matched fallbacks)

### Establish Hierarchy

Build a clear type scale:
- **5 sizes cover most needs**: caption, secondary, body, subheading, heading
- **Use a consistent ratio** between levels (1.25, 1.333, or 1.5)
- **Combine dimensions**: Size + weight + color + space for strong hierarchy. Don't rely on size alone
- **App UIs**: Use a fixed `rem`-based type scale, optionally adjusted at 1-2 breakpoints. Fluid sizing undermines the spatial predictability that dense, container-based layouts need
- **Marketing / content pages**: Use fluid sizing via `clamp(min, preferred, max)` for headings and display text. Keep body text fixed

### Fix Readability

- Set `max-width` on text containers using `ch` units (`max-width: 65ch`)
- Adjust line-height per context: tighter for headings (1.1-1.2), looser for body (1.5-1.7)
- Increase line-height slightly for light-on-dark text
- Ensure body text is at least 16px / 1rem

### Refine Details

- Use `tabular-nums` for data tables and numbers that should align
- Apply proper `letter-spacing`: slightly open for small caps and uppercase, default or tight for large display text
- Use semantic token names (`--text-body`, `--text-heading`), not value names (`--font-16`)
- Set `font-kerning: normal` and consider OpenType features where appropriate

### Weight Consistency

- Define clear roles for each weight and stick to them
- Don't use more than 3-4 weights (Regular, Medium, Semibold, Bold is plenty)
- Load only the weights you actually use (each weight adds to page load)

**NEVER**:
- Use more than 2-3 font families
- Pick sizes arbitrarily; commit to a scale
- Set body text below 16px
- Use decorative/display fonts for body text
- Disable browser zoom (`user-scalable=no`)
- Use `px` for font sizes; use `rem` to respect user settings
- Default to Inter/Roboto/Open Sans when personality matters
- Pair fonts that are similar but not identical (two geometric sans-serifs)

## Verify Typography Improvements

- **Hierarchy**: Can you identify heading vs body vs caption instantly?
- **Readability**: Is body text comfortable to read in long passages?
- **Consistency**: Are same-role elements styled identically throughout?
- **Personality**: Does the typography reflect the brand?
- **Performance**: Are web fonts loading efficiently without layout shift?
- **Accessibility**: Does text meet WCAG contrast ratios? Is it zoomable to 200%?

When the type carries the hierarchy on its own, hand off to `/impeccable polish` for the final pass.

## Live-mode signature params

Each variant MUST declare a `scale` param controlling the hierarchy ratio. Express all font sizes in the variant's scoped CSS through `calc(var(--p-scale, 1) * <base>)` or, better, scale the type ramp via `clamp(min, calc(var(--p-scale, 1) * Npx), max)`. Users slide from subdued to commanding.

```json
{"id":"scale","kind":"range","min":0.85,"max":1.3,"step":0.05,"default":1,"label":"Scale"}
```

Where the variant riffs on a specific pairing, expose the pairing choice as a `steps` param (e.g. "serif display + sans body" vs. "mono display + sans body" vs. "all-sans"). Each branch routes through `:scope[data-p-pairing="X"]` selectors in scoped CSS.

See `reference/live.md` for the full params contract.

## EXTENSION

### Scale builders (worked examples)

Brand (fluid):
```css
:root {
  --text-xs:   clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
  --text-base: 1rem;  /* hold body fixed even on brand pages */
  --text-lg:   clamp(1.125rem, 1rem + 0.5vw, 1.5rem);
  --text-xl:   clamp(1.5rem, 1.25rem + 1vw, 2rem);
  --text-2xl:  clamp(2rem, 1.5rem + 2vw, 3rem);
  --text-3xl:  clamp(2.75rem, 2rem + 4vw, 5rem);
  --text-4xl:  clamp(4rem, 2.5rem + 8vw, 8rem);    /* hero scale */
}
```

Product (fixed):
```css
:root {
  --text-xs:   0.75rem;   /* 12px - badges, micro-meta */
  --text-sm:   0.875rem;  /* 14px - secondary UI, dense table data */
  --text-base: 1rem;      /* 16px - body, controls */
  --text-lg:   1.125rem;  /* 18px - lead text, large body */
  --text-xl:   1.25rem;   /* 20px - subheading */
  --text-2xl:  1.5rem;    /* 24px - section heading */
  --text-3xl:  2rem;      /* 32px - page heading */
}
```

### Line-height by purpose

| Context | line-height |
|---|---|
| Display / hero | 1.0 to 1.1 |
| Heading (h1-h3) | 1.1 to 1.2 |
| Subheading (h4-h6) | 1.2 to 1.35 |
| Body prose | 1.5 to 1.65 |
| Body in dense UI | 1.4 to 1.5 |
| Caption / micro | 1.3 to 1.45 |
| Light text on dark | add 0.05 to 0.1 to the above |

### Letter-spacing by purpose

| Context | letter-spacing |
|---|---|
| Default body | normal (0) |
| Large display (32px+) | -0.01em to -0.03em (slightly tight) |
| Small all-caps labels | 0.05em to 0.12em (open) |
| Small caps via font-variant | 0.03em to 0.05em |
| Code / mono | 0 (already optical) |

### Pairing rules summarized

- Serif display + Sans body (editorial / luxury)
- Single family in multiple weights (most product UIs, tech minimalism)
- Mono accent + Sans body (technical / dev tools when register fits)
- Geometric + Humanist (proportion contrast)
- Condensed display + Wide body (proportion contrast)

Never:
- Two geometric sans (looks like a mistake)
- Two serifs of similar period (Garamond + Caslon)
- Display + Display (two attention-grabbing voices)

## WHAT'S MISSING

- **No font loading strategy decision tree.** `font-display: swap` vs `optional` mentioned but no rubric for picking.
- **No variable-font usage prescription.** Variable fonts are increasingly common; no guidance on `font-variation-settings` axes.
- **No fluid-vs-fixed decision.** Says brand uses fluid and product uses fixed, but doesn't handle in-between (a brand landing page that's part of a product app).
- **No relationship to brand.md font reflex-reject list.** Cross-reference is named but not the full ban list duplicated for convenience.
- **No real-world pairing examples.** "Serif display + sans body" but no actual font pairs (e.g., "Tiempos Display + Untitled Sans", "Marfa + Helvetica Neue").
