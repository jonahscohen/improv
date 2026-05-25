# make-interfaces-feel-better - Typography (extracted)

This file extracts `typography.md` from the make-interfaces-feel-better skill. Source verbatim lift comes first, then Extension (operational specificity), then What's missing (typography gaps).

> Note on punctuation: per CLAUDE.md (no emdashes), every emdash from the source has been converted to a regular hyphen with surrounding spaces. All other content is byte-for-byte preserved.

---

## Source verbatim lift

From `/Users/spare3/.agents/skills/make-interfaces-feel-better/typography.md`.

### Typography

Typography rendering details that make interfaces feel better.

### Text Wrapping

#### text-wrap: balance

Distributes text evenly across lines, preventing orphaned words on headings and short text blocks. **Only works on blocks of 6 lines or fewer** (Chromium) or 10 lines or fewer (Firefox) - the balancing algorithm is computationally expensive, so browsers limit it to short text.

```css
/* Good - even line lengths on short text */
h1, h2, h3 {
  text-wrap: balance;
}
```

```css
/* Bad - default wrapping leaves orphans */
h1 {
  /* no text-wrap rule -> "Read our
     blog" instead of balanced lines */
}
```

```css
/* Bad - balance on long paragraphs (silently ignored, wastes intent) */
.article-body p {
  text-wrap: balance;
}
```

**Tailwind:** `text-balance`

#### text-wrap: pretty

Prevents orphaned words (a single word dangling on the last line) by adjusting line breaks throughout the paragraph. Unlike `balance`, it doesn't try to equalize line lengths - it just ensures the last line isn't embarrassingly short. Works on text of any length with no line-count limit.

This should be your **default for short-to-medium text** - paragraphs, descriptions, captions, list items, card text. For very long text (10+ lines), skip both `pretty` and `balance` - the browser's default wrapping is fine and you avoid unnecessary layout cost.

```css
/* Good - descriptions, captions, short paragraphs */
p, li, figcaption, blockquote {
  text-wrap: pretty;
}
```

```tsx
// Tailwind
<p className="text-pretty">
  A short paragraph that won't leave an orphan on the last line.
</p>
```

**Tailwind:** `text-pretty`

#### When to Use Which

| Scenario | Use |
| --- | --- |
| Headings, titles where even distribution matters | `text-wrap: balance` |
| Short-to-medium text - paragraphs, descriptions, captions, UI text | `text-wrap: pretty` |
| Long text (10+ lines), code blocks, pre-formatted text | Neither - leave default |

### Font Smoothing (macOS)

On macOS, text renders heavier than intended by default. Apply antialiased smoothing to the root layout so all text renders crisper and thinner.

```css
/* CSS */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

```tsx
// Tailwind - apply to root layout
<html className="antialiased">
```

#### Good vs. Bad

```css
/* Good - applied once at the root */
html {
  -webkit-font-smoothing: antialiased;
}

/* Bad - applied per-element, inconsistent */
.heading {
  -webkit-font-smoothing: antialiased;
}
.body {
  /* no smoothing -> heavier than heading */
}
```

**Note:** This only affects macOS rendering. Other platforms ignore these properties, so it's safe to apply universally.

### Tabular Numbers

When numbers update dynamically (counters, prices, timers, table columns), use tabular-nums to make all digits equal width. This prevents layout shift as values change.

```css
/* CSS */
.counter {
  font-variant-numeric: tabular-nums;
}
```

```tsx
// Tailwind
<span className="tabular-nums">{count}</span>
```

#### When to Use

| Use tabular-nums | Don't use tabular-nums |
| --- | --- |
| Counters and timers | Static display numbers |
| Prices that update | Decorative large numbers |
| Table columns with numbers | Phone numbers, zip codes |
| Animated number transitions | Version numbers (v2.1.0) |
| Scoreboards, dashboards | |

#### Caveat

Some fonts (like Inter) change the visual appearance of numerals with this property - specifically, the digit `1` becomes wider and centered. This is expected behavior and usually desirable for alignment, but verify it looks right in your specific font.

```css
/* With Inter font:
   Default:  1234  -> proportional, "1" is narrow
   Tabular:  1234  -> all digits equal width, "1" centered */
```

---

## Extension - operational specificity

### Text-wrap: balance - extension

**Why 6 lines is the Chromium limit (and 10 in Firefox).** The balance algorithm is O(n^2) on candidate line breaks - the browser tries every plausible break position and scores the result for even line lengths. Above the limit, the cost dominates render time on slow devices and the property silently no-ops. Treat the limit as a contract, not a recommendation.

**Which elements should get `text-wrap: balance`:**

- `h1`, `h2`, `h3`, `h4` - always.
- Hero subheadings (a 2-3 line sentence under the headline) - yes.
- Card titles - yes if they wrap to 2+ lines and have a `max-width`.
- Button labels - no. Buttons are single-line; balance is a no-op.
- Toast and alert titles - yes.
- Modal headers - yes.

**Required companion: `max-width`.** Balance can only balance across the lines the layout produces. If the heading is allowed to fill the viewport, balance has nothing to do. Pair with `max-w-2xl` (672px) on h1, `max-w-xl` (576px) on h2, etc.

**Tailwind:** `text-balance`. No bracket-syntax variant needed.

### Text-wrap: pretty - extension

**The orphan rule.** A "widow" is one word on the last line of a paragraph. `text-wrap: pretty` reflows the final 1-2 lines so the last line has at least 2-3 words.

**Default this on body text.** The cost is negligible (Chromium implements `pretty` with a much cheaper algorithm than `balance`). Apply at a wide scope: `p, li, figcaption, blockquote` at the root layout level.

**Where to skip:**

- `<pre>`, `<code>`, code blocks. The browser respects pre-formatted whitespace; `text-wrap` is ignored anyway.
- Mono-spaced layout-as-text (ASCII art, alignment diagrams).
- Single-line text (buttons, badges, labels). The rule is a no-op there.

**Tailwind:** `text-pretty`.

### Font smoothing - extension

**Apply at `<html>` exactly once.** Per-element application produces visible weight inconsistency at element boundaries (a smoothed heading next to unsmoothed body text reads as different fonts).

**The two properties together:**
```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```
First line: macOS Safari and Chromium-on-macOS. Second line: Firefox on macOS. Without both, the smoothing applies inconsistently across browser/OS combinations.

**The visual delta.** With antialiased smoothing, text is ~5-10% lighter in weight than the default subpixel-rendered text. Figma renders at antialiased weight; if production lacks smoothing, the live UI looks heavier than the design. The single most common "the live build looks heavier than the mock" cause is missing antialiased.

**Cross-platform safety.** Windows, Linux, and ChromeOS ignore both properties. No measurable cost. Apply at the root unconditionally.

**Why not subpixel?** Subpixel rendering (the macOS default) is sharper on standard-DPI displays but heavier-feeling. On HiDPI/Retina displays (which dominate modern macOS), the sharpness advantage is negligible and the weight cost dominates. The aesthetic call: lighter text on Retina almost always wins.

### Tabular numbers - extension

**Apply at the smallest scope that covers the dynamic numeric.** Inline on the changing `<span>` is best. Root-level application changes ALL numerals in the document, which is usually wrong:

- Phone numbers and IDs render heavier and wider.
- Marketing copy with proportional numbers loses its aesthetic.
- Version strings (`v2.1.0`) look mechanical when proportional would look intentional.

**Which numbers need tabular-nums:**

- Counters (likes, replies, views) that update without page load.
- Timers (countdowns, stopwatches, elapsed time).
- Prices that update (live order totals, dashboards).
- Table cells with numeric data that the user reads column-wise.
- Animated number transitions (e.g., 99 -> 100 with a tween).
- Scoreboards and live dashboards.

**Which numbers should NOT get tabular-nums:**

- Phone numbers (proportional reads more naturally).
- ZIP codes, postal codes, SSNs.
- Decorative large numbers (a "1,000+" badge in marketing copy).
- Version numbers (`v2.1.0`).
- Static display numbers that never update.

**The Inter caveat (and others).** Some fonts narrow `1` proportionally and widen-center it when tabular. Inter does this; so do Geist, IBM Plex, and Recursive. With these fonts, the tabular `1` is wider than the proportional `1`. Verify the design intent matches by previewing a counter going `9 -> 10` and confirming the layout doesn't shift.

**Fonts to verify (tabular variants confirmed):** Inter, Geist, JetBrains Mono, Space Grotesk, SF Pro, Roboto, IBM Plex, Recursive, Manrope. Most display/script fonts (e.g., Lobster, Pacifico) lack tabular variants - the property is silently ignored.

**Tailwind:** `tabular-nums`. There is no `proportional-nums` Tailwind utility; if you need to override at a child, use inline `style={{ fontVariantNumeric: 'proportional-nums' }}` or a custom class.

### Numeric kerning detail

When animating a single digit changing (e.g., a counter ticking 99 -> 100), `tabular-nums` is only half the fix. The other half is matching the column width across digit counts. A 2-digit counter takes less width than a 3-digit counter. If you want zero visual shift across digit transitions, set a `min-width` (or use `text-align: right` in a fixed-width container) so the count region is sized for the maximum expected digit count.

---

## What's missing - typography gaps in MIFB

The typography section covers wrapping, smoothing, and tabular numbers. Significant typography concerns it does not cover:

1. **Font pairing.** No guidance on display + body combinations, when to use a single typeface family, how many weights to load. (Covered by sidecoach's `fontshare-reference` skill, but worth noting MIFB is silent here.)

2. **Type scale.** No guidance on modular scales (1.125, 1.2, 1.25, 1.333, golden ratio), how to choose a scale ratio, when to break the scale for hierarchy.

3. **Line height (leading).** No prescribed values. Common defaults: 1.1-1.2 for display, 1.3-1.4 for headings, 1.5-1.6 for body, 1.4 for captions. Should be in the skill.

4. **Letter spacing (tracking).** No guidance. Common defaults: -0.02em for large display, -0.01em for headings, 0 for body, +0.05em for ALL CAPS. The default letter-spacing on most fonts is calibrated for body text at 16px; large headings need negative tracking, ALL CAPS needs positive tracking. Silent in MIFB.

5. **Optical sizing.** Variable fonts (Inter, Recursive, etc.) ship an `opsz` axis that adjusts the design for the rendered size. MIFB doesn't mention `font-optical-sizing: auto`, which costs nothing and significantly improves rendering on variable fonts.

6. **Font-feature settings beyond tabular-nums.** Ligatures (`liga`, `dlig`), stylistic sets (`ss01-ss20`), small caps (`smcp`), fractions (`frac`), slashed zero (`zero`). Several of these have aesthetic impact and zero performance cost. Inter's `ss01` (single-story `a`) is a common stylistic choice; nothing in MIFB.

7. **Variable font weight ramps.** No guidance on choosing weights (e.g., 400 body, 500 emphasis, 600 buttons, 700 headings) or on how to use a variable font's continuous weight axis instead of discrete weights.

8. **Web font loading strategy.** No mention of `font-display: swap`, `font-display: optional`, preloading critical fonts, FOIT vs FOUT, subsetting, Google Fonts vs self-hosted, performance budgets.

9. **CJK and complex script considerations.** `text-wrap: balance` and `pretty` behave differently on Chinese/Japanese/Korean (which lack word boundaries) and on Arabic/Hebrew (which are RTL). Silent in MIFB.

10. **Reading typography (long-form).** No guidance on optimal line length (45-75 characters / 65ch), paragraph spacing, drop caps, blockquote treatment, code-in-prose styling.

11. **Hierarchy through typography.** No guidance on building information hierarchy through font-size/weight/color combinations. The skill assumes hierarchy is already set; doesn't help you build it.

12. **Color contrast on text.** WCAG 2.1 AA requires 4.5:1 for body, 3:1 for large text (18pt+ or 14pt+ bold). MIFB doesn't mention. Light gray text on white is a common violation.

13. **Internationalization of text-wrap.** `text-wrap: balance` doesn't work on non-space-separated scripts (CJK). `text-wrap: pretty` has incomplete CJK support in older browsers.

14. **Font fallback chains.** No guidance on choosing system-ui fallbacks, sizing fallbacks to match the web font (`size-adjust`, `ascent-override`), preventing layout shift during font swap.

Sidecoach should layer these via `fontshare-reference` (font picking), the 159-rule extended-domain validator (contrast computation, type-scale validation), and direct extension within the typography flow.
