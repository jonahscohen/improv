# Impeccable color-and-contrast.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Color & Contrast

## Color Spaces: Use OKLCH

**Stop using HSL.** Use OKLCH (or LCH) instead. It's perceptually uniform, meaning equal steps in lightness *look* equal, unlike HSL where 50% lightness in yellow looks bright while 50% in blue looks dark.

The OKLCH function takes three components: `oklch(lightness chroma hue)` where lightness is 0-100%, chroma is roughly 0-0.4, and hue is 0-360. To build a primary color and its lighter / darker variants, hold the chroma+hue roughly constant and vary the lightness, but **reduce chroma as you approach white or black**, because high chroma at extreme lightness looks garish.

The hue you pick is a brand decision and should not come from a default. Do not reach for blue (hue 250) or warm orange (hue 60) by reflex; those are the dominant AI-design defaults, not the right answer for any specific brand.

## Building Functional Palettes

### Tinted Neutrals

**Pure gray is dead.** A neutral with zero chroma feels lifeless next to a colored brand. Add a tiny chroma value (0.005-0.015) to all your neutrals, hued toward whatever your brand color is. The chroma is small enough not to read as "tinted" consciously, but it creates subconscious cohesion between brand color and UI surfaces.

The hue you tint toward should come from THIS project's brand, not from a "warm = friendly, cool = tech" formula. If your brand color is teal, your neutrals lean toward teal. If your brand color is amber, they lean toward amber. The point is cohesion with the SPECIFIC brand, not a stock palette.

**Avoid** the trap of always tinting toward warm orange or always tinting toward cool blue. Those are the two laziest defaults and they create their own monoculture across projects.

### Palette Structure

A complete system needs:

| Role | Purpose | Example |
|------|---------|---------|
| **Primary** | Brand, CTAs, key actions | 1 color, 3-5 shades |
| **Neutral** | Text, backgrounds, borders | 9-11 shade scale |
| **Semantic** | Success, error, warning, info | 4 colors, 2-3 shades each |
| **Surface** | Cards, modals, overlays | 2-3 elevation levels |

**Skip secondary/tertiary unless you need them.** Most apps work fine with one accent color. Adding more creates decision fatigue and visual noise.

### The 60-30-10 Rule (Applied Correctly)

This rule is about **visual weight**, not pixel count:

- **60%**: Neutral backgrounds, white space, base surfaces
- **30%**: Secondary colors: text, borders, inactive states
- **10%**: Accent: CTAs, highlights, focus states

The common mistake: using the accent color everywhere because it's "the brand color." Accent colors work *because* they're rare. Overuse kills their power.

## Contrast & Accessibility

### WCAG Requirements

| Content Type | AA Minimum | AAA Target |
|--------------|------------|------------|
| Body text | 4.5:1 | 7:1 |
| Large text (18px+ or 14px bold) | 3:1 | 4.5:1 |
| UI components, icons | 3:1 | 4.5:1 |
| Non-essential decorations | None | None |

**The gotcha**: Placeholder text still needs 4.5:1. That light gray placeholder you see everywhere? Usually fails WCAG.

### Dangerous Color Combinations

These commonly fail contrast or cause readability issues:

- Light gray text on white (the #1 accessibility fail)
- **Gray text on any colored background**: gray looks washed out and dead on color. Use a darker shade of the background color, or transparency
- Red text on green background (or vice versa): 8% of men can't distinguish these
- Blue text on red background (vibrates visually)
- Yellow text on white (almost always fails)
- Thin light text on images (unpredictable contrast)

### Never Use Pure Gray or Pure Black

Pure gray (`oklch(50% 0 0)`) and pure black (`#000`) don't exist in nature; real shadows and surfaces always have a color cast. Even a chroma of 0.005-0.01 is enough to feel natural without being obviously tinted. (See tinted neutrals example above.)

### Testing

Don't trust your eyes. Use tools:

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Browser DevTools -> Rendering -> Emulate vision deficiencies
- [Polypane](https://polypane.app/) for real-time testing

## Theming: Light & Dark Mode

### Dark Mode Is Not Inverted Light Mode

You can't just swap colors. Dark mode requires different design decisions:

| Light Mode | Dark Mode |
|------------|-----------|
| Shadows for depth | Lighter surfaces for depth (no shadows) |
| Dark text on light | Light text on dark (reduce font weight) |
| Vibrant accents | Desaturate accents slightly |
| White backgrounds | Never pure black; use dark gray (oklch 12-18%) |

In dark mode, depth comes from surface lightness, not shadow. Build a 3-step surface scale where higher elevations are lighter (e.g. 15% / 20% / 25% lightness). Use the SAME hue and chroma as your brand color (whatever it is for THIS project; do not reach for blue) and only vary the lightness. Reduce body text weight slightly (e.g. 350 instead of 400) because light text on dark reads as heavier than dark text on light.

### Token Hierarchy

Use two layers: primitive tokens (`--blue-500`) and semantic tokens (`--color-primary: var(--blue-500)`). For dark mode, only redefine the semantic layer; primitives stay the same.

## Alpha Is A Design Smell

Heavy use of transparency (rgba, hsla) usually means an incomplete palette. Alpha creates unpredictable contrast, performance overhead, and inconsistency. Define explicit overlay colors for each context instead. Exception: focus rings and interactive states where see-through is needed.

---

**Avoid**: Relying on color alone to convey information. Creating palettes without clear roles for each color. Using pure black (#000) for large areas. Skipping color blindness testing (8% of men affected).

## EXTENSION

### WCAG contrast quick-test table

| Foreground | Background | Ratio | AA body? | AA large? |
|---|---|---|---|---|
| #000 | #fff | 21:1 | yes | yes |
| #1a1a1a | #ffffff | 18.7:1 | yes | yes |
| #333333 | #ffffff | 12.6:1 | yes | yes |
| #595959 | #ffffff | 7.0:1 | yes (AAA body) | yes |
| #767676 | #ffffff | 4.54:1 | yes (just) | yes |
| #888888 | #ffffff | 3.54:1 | NO | yes |
| #aaaaaa | #ffffff | 2.32:1 | NO | NO |

Note: #888 on white fails body-text AA. The very common "light gray placeholder" trick almost always fails. Use #767676 minimum for body-size placeholder/secondary text on white.

### OKLCH primary scale generator

```css
:root {
  /* Brand hue: pick once per project. Examples: 25 (red-orange), 150 (green), 250 (blue), 350 (magenta) */
  --brand-hue: 250;

  /* Primary scale - lightness varies, chroma drops at extremes */
  --primary-50:  oklch(97% 0.03 var(--brand-hue));
  --primary-100: oklch(94% 0.07 var(--brand-hue));
  --primary-200: oklch(88% 0.12 var(--brand-hue));
  --primary-300: oklch(78% 0.16 var(--brand-hue));
  --primary-400: oklch(68% 0.20 var(--brand-hue));
  --primary-500: oklch(58% 0.22 var(--brand-hue));  /* base */
  --primary-600: oklch(48% 0.20 var(--brand-hue));
  --primary-700: oklch(38% 0.17 var(--brand-hue));
  --primary-800: oklch(28% 0.13 var(--brand-hue));
  --primary-900: oklch(18% 0.09 var(--brand-hue));
}
```

The chroma drop at 50 and 900 prevents the "fluorescent" look at extreme lightness.

### Tinted-neutral OKLCH template

```css
:root {
  --brand-hue: 250;  /* Reuse from primary scale */

  --neutral-0:   oklch(99% 0.005 var(--brand-hue));   /* page background */
  --neutral-50:  oklch(97% 0.006 var(--brand-hue));   /* alternate surface */
  --neutral-100: oklch(94% 0.008 var(--brand-hue));   /* card */
  --neutral-200: oklch(90% 0.010 var(--brand-hue));   /* hairline border */
  --neutral-300: oklch(82% 0.012 var(--brand-hue));   /* divider */
  --neutral-500: oklch(60% 0.012 var(--brand-hue));   /* placeholder text (still hits AA) */
  --neutral-600: oklch(48% 0.012 var(--brand-hue));   /* secondary text */
  --neutral-700: oklch(35% 0.011 var(--brand-hue));   /* body text */
  --neutral-800: oklch(22% 0.010 var(--brand-hue));   /* heading text */
  --neutral-900: oklch(12% 0.008 var(--brand-hue));   /* darkest text */
}
```

Chroma is small (0.005-0.012); the tint is barely perceptible but cohesive with the brand.

### Dark-mode color generation algorithm

For each semantic role in your light palette, generate a dark variant:

```
1. For text and foreground colors: invert lightness (90% -> 10%, 80% -> 15%, etc.), but cap minimum at ~12% (never pure black)
2. For surfaces: build a 3-step lightness scale (12% / 16% / 20%); higher elevation = lighter
3. For accents: drop chroma by ~20-30% (saturation feels louder against dark)
4. For shadows: usually drop them entirely; depth comes from surface lightness in dark mode
5. For borders: same hue/chroma but lighten 10-15% relative to surface
```

Reduce body weight 50 units (e.g., 400 -> 350 if variable font; 400 -> "thin medium" if not).

## WHAT'S MISSING

- **No P3 wide-gamut guidance.** Modern screens support it; doc doesn't address.
- **No color-blindness simulation prescription.** Says test for it but no tool with usage examples.
- **No automated contrast checking in CI.** Manual prescription only.
- **No "color in data viz" section.** Categorical palettes, sequential, diverging - none catalogued.
- **No relationship to DESIGN.md.** Colors generated here should land in DESIGN.md frontmatter; flow not described.
- **Alpha-is-a-smell rule isn't enforced anywhere.** What's the test? When is alpha legitimate beyond "focus rings"?
