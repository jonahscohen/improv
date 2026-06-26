---
source: https://github.com/LovroPodobnik/refactoring-ui-skill/tree/main/.claude/skills/ui-refactor/references
captured: 2026-05-25
type: external-taste-skill (5 domain references consolidated)
note: from the Refactoring UI book by Adam Wathan + Steve Schoger
---

# Refactoring UI - 5 Domain References (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

---

### HIERARCHY (hierarchy.md)

#### 1. Size Isn't Everything

Do NOT rely solely on font size to denote importance.

- **Weight**: Make primary elements bolder (600/700) and secondary elements lighter (400). Avoid weights <400 for UI.
- **Color**: Use dark colors for primary content, grey for secondary, lighter grey for tertiary.
- **Example**: Instead of a tiny font size for a date, keep the size readable but make the color light grey.

#### 2. De-emphasize to Emphasize

If a primary element doesn't stand out, do NOT make it louder. Instead, weaken the competing elements.

- **Backgrounds**: Remove background colors from secondary sidebars/containers so the main content pops.
- **Soft colors**: Turn valid but inactive navigation items into a soft grey rather than black.

#### 3. Labels

Avoid `Label: Value` formats where possible.

- **Combine**: Instead of "In Stock: 12", use "12 left in stock".
- **Context**: If the format is obvious (email, phone, price), remove the label entirely.
- **Secondary**: If labels are required (e.g., data dashboards), treat them as supporting content (smaller, lighter weight, uppercase with letter-spacing) and emphasize the DATA.

#### 4. Visual vs. Document Hierarchy

Web semantics (`h1`, `h2`, `h3`) should NOT dictate visual style.

- Section titles (like "Manage Account") are often just labels for the content below. Should be small and subtle, not giant `h1` styled headers.

#### 5. Balancing Weight and Contrast

- **Icons**: Icons are visually "heavy" (solid surface area). To balance an icon next to text, give the icon a SOFTER color (lower contrast).
- **Borders**: If a hairline border (1px) is too subtle, do NOT just darken the color (adds noise). INCREASE the width (2px) instead.

#### 6. Semantics are Secondary (button hierarchy)

Design buttons based on hierarchy, not just semantics.

- **Primary**: Solid, high contrast background.
- **Secondary**: Outline style or low contrast background.
- **Tertiary**: Link style (no container).
- **Destructive**: If a "Delete" button is NOT the primary action, do NOT make it big and red. Make it a secondary/tertiary link. Use red/bold styling only for the confirmation modal where it IS the primary action.

---

### LAYOUT & SPACING (layout-spacing.md)

#### Spacing Systems

Do NOT use arbitrary values (e.g., 123px).

- **Linear scales fail**: Difference between 12px and 16px is huge; difference between 100px and 104px is invisible.
- **The System**: Start with a base (e.g., 16px). Create a scale where no two values are closer than ~25%.
  - *Example Scale*: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Workflow**: Need space? Grab the next value on the scale. Not enough? Jump two steps.

#### White Space

- **Start with too much**: Give elements too much room, then remove until it looks "not bad."
- **Separate groups**: Space BETWEEN groups must be larger than space WITHIN groups.
  - *Ambiguity*: If a label's bottom margin equals the input's bottom margin, the relationship is unclear. DOUBLE the space between the input and the next label.

#### Sizing and Grids

- **Shrink the Canvas**: Do NOT fill the screen just because you have 1400px. If a form needs 600px, use 600px.
- **Grids are Overrated**: Do NOT force everything into percentage-based columns (e.g., 12-column grids).
  - *Sidebars*: Should usually be FIXED width (optimized for their content), main content flexes.
- **Responsive Design**:
  - Use `max-width` rather than percentages. Only shrink elements when screen gets smaller than element's ideal size.
  - **Relative sizing fails**: Do NOT use `em` for layout widths. Elements large on desktop should shrink FASTER than small elements on mobile.

#### Density

- **Refactoring**: Dense UIs (dashboards) are valid, but must be a DELIBERATE choice.
- **Columns**: If a form feels too narrow/empty, split supporting text into a side column rather than widening the input fields.

---

### TYPOGRAPHY (typography.md)

#### Type Scales

Do NOT use linear pixel increments or mathematical ratios (Golden Ratio) that result in fractional pixels (33.14px).

- **Hand-picked scale**: Select a set of sizes that work well.
  - *Example*: 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72.
- **Avoid ems for size**: Use `px` or `rem` for font-size. `em` compounds deeply nested sizes unpredictably.

#### Font Selection

- **Safe Bet**: Neutral sans-serifs (system stack, Helvetica, Roboto).
- **Criteria**:
  - Choose fonts with 5+ weights (indicates quality).
  - Avoid condensed fonts with short x-heights for UI body text.
  - Trust popular fonts (Google Fonts sort by popularity).

#### Line Height

Line height is INVERSELY proportional to font size and line length.

- **Body text**: Needs taller line height (~1.5 to 1.7).
- **Headings**: Large text needs tighter line height (~1.0 to 1.2).
- **Line Length**: Wide paragraphs need more line height to help eye track back. Narrow columns can use tighter spacing.
- **Optimal Length**: 45-75 characters per line.

#### Alignment

- **Left Align**: Standard for readability.
- **Justified**: Avoid on web unless hyphenation is enabled; creates ugly "rivers".
- **Center**: Only for headlines or very short text blocks (2-3 lines max).
- **Numbers**: Always RIGHT-align tabular numbers/prices for comparison.
- **Baseline**: When mixing font sizes on a single row (e.g. "Price" and "$19"), align by baseline, NOT vertical center.

#### Letter Spacing

- **Headlines**: Tighten spacing slightly for large display text.
- **All Caps**: Increase spacing (tracking) to improve readability.

---

### COLOR (color.md)

#### Color Models

- **Use HSL**: Hue, Saturation, Lightness. Intuitive.
  - *Hue*: The "color" (0-360).
  - *Saturation*: Vividness (0% grey, 100% pure).
  - *Lightness*: 0% black, 100% white.

#### Palette Generation

Do NOT use "5 color generators." You need more colors than you think.

1. **Greys**: You need 8-10 shades. Tint them slightly blue (cool) or yellow (warm) to avoid "dead" greys.
2. **Primary**: 5-10 shades of your main brand color.
3. **Accents**: Semantic colors (Red/Destructive, Yellow/Warning, Green/Positive) need multiple shades for backgrounds vs text.

#### Creating Shades (The Curve)

Do NOT just lighten/darken the Lightness channel.

- **Saturation Falloff**: As lightness approaches 0% or 100%, perceived saturation drops. You MUST INCREASE saturation for very light or very dark shades to prevent them from looking washed out.
- **Hue Rotation**: Rotate the hue slightly as you change lightness to mimic natural light.
  - *Darker*: Rotate toward cool/dark colors (Blue/Purple/Red).
  - *Lighter*: Rotate toward bright colors (Yellow/Cyan).

#### Accessibility & Contrast

- **WCAG**: 4.5:1 for normal text.
- **Flip Contrast**: If white text on a colored background is hard to read, do NOT darken the background until it looks black. FLIP it: use dark text on a light colored background (e.g., light red background with dark red text for errors).
- **Rotating Hue**: To increase contrast on colored text without making it black, rotate the hue toward a darker/brighter spectrum (e.g., darken yellow text by moving toward orange).
- **Color Blindness**: Never rely on color alone. Use icons or text labels to accompany status colors.

---

### DEPTH AND POLISH (depth-and-polish.md)

#### Lighting and Shadows

Interfaces should emulate a physical light source (usually from the top).

- **Raised Elements**: Light top border (highlight), dark bottom shadow.
- **Inset Elements (Wells)**: Dark top shadow (or inner shadow), light bottom border.

**Elevation System** - Define 5 shadows:
- Small/Tight: Buttons (close to surface)
- Medium: Dropdowns
- Large/Diffused: Modals (far from surface)

**Two-Part Shadows**: Combine a LARGE, SOFT, ambient shadow (general depth) with a TIGHT, DARK shadow (occlusion near the object).

#### Flat Design Depth

- **Layers**: Overlap elements to create depth (e.g., a card floating halfway off a colored header background).
- **Color**: Lighter feels CLOSER; darker feels FURTHER AWAY.

#### Images

- **Text Overlay**: Text on photos requires consistent contrast.
  - *Overlay*: Semi-transparent black (for light text).
  - *Lower Contrast*: Reduce contrast of background image itself.
  - *Colorize*: Desaturate image + multiply blend mode with brand color.
- **Scaling**:
  - Do NOT scale up icons (look blocky). Enclose small icons in a shape (circle/square) to fill space.
  - Do NOT scale down screenshots (text becomes unreadable). Re-create simplified "illustration" versions, or crop to detail view.
- **User Content**: Always control aspect ratios. Use `background-size: cover` or object-fit. Prevent color bleed by adding subtle inner shadow to user uploads.

#### Finishing Touches

- **Supercharge Defaults**: Replace standard bullets with checkmarks/icons. Style underlines on links.
- **Accent Borders**: Add a colorful 4px TOP-BORDER to a bland card or alert to add personality without graphic design skills.
- **Backgrounds**: Use subtle repeating patterns or simple geometric shapes to break up large white backgrounds.
- **Empty States**: Never leave a container blank. Add an illustration and a primary call-to-action button (e.g., "Create your first project").

---

## SECTION 2: EXTENSION

### The "de-emphasize to emphasize" principle - example application

The most counterintuitive rule in Refactoring UI. Concrete:

- BAD: "The save button isn't standing out. Let me make it bigger and add a glow." -> Now you have 4 elements competing.
- GOOD: "The save button isn't standing out. Let me REMOVE the background from the cards around it and lighten the secondary navigation." -> Now the save button is the loudest element by default.

This is the inverse of the normal designer instinct (add MORE). It's the same principle as the Refactoring UI saying "shrink the canvas" - subtract before you add.

### The spacing scale - why 25% minimum increment

Refactoring UI gives 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Each step is roughly 1.5x to 2x the previous (with smaller steps at the bottom). The 25% rule:

- 4 -> 8 = 100% increase (visible)
- 8 -> 12 = 50% increase (visible)
- 12 -> 16 = 33% increase (visible)
- 16 -> 24 = 50% increase (visible)
- 24 -> 32 = 33% increase (visible)
- 32 -> 48 = 50%
- 48 -> 64 = 33%
- 64 -> 96 = 50%
- 96 -> 128 = 33%

If you tried `4, 5, 6, 7, 8...`, the difference between 4 and 5 (25%) is at the edge of visible; between 7 and 8 (14%) is invisible. The exponential scale guarantees every step is perceptible.

Tailwind's default spacing scale (0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32...) violates this principle in the middle. The 25%-rule scale is more disciplined.

### The HSL "saturation falloff" rule - what it means in practice

When you take a saturated red (`hsl(0, 100%, 50%)`) and naively lighten it to `hsl(0, 100%, 80%)`, you get a washed-out pink that looks DESATURATED even though saturation is still 100%. This is because human eye perceives saturation differently at extreme lightness values.

The fix: as you lighten, BOOST saturation. As you darken, also boost saturation (deep colors look more vivid).

Practical 10-step shade curve for a brand color:
- 50: `hsl(220, 100%, 97%)` (most lightness boost; saturation also high)
- 100: `hsl(218, 95%, 93%)`
- 200: `hsl(216, 90%, 87%)`
- 300: `hsl(214, 85%, 78%)`
- 400: `hsl(213, 80%, 68%)`
- 500: `hsl(212, 75%, 55%)` (base brand color)
- 600: `hsl(213, 80%, 47%)`
- 700: `hsl(214, 85%, 40%)`
- 800: `hsl(215, 90%, 32%)`
- 900: `hsl(216, 95%, 22%)`
- 950: `hsl(218, 100%, 14%)` (deepest)

Hue shifts slightly from 218 to 212 to 218 (subtle warm-cool oscillation following natural light). Saturation curves UP at both extremes.

### The Two-Part Shadow recipe

Refactoring UI's two-part shadow:

```css
.elevation-medium {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),    /* ambient: soft, large */
    0 2px 4px -1px rgba(0, 0, 0, 0.06);   /* occlusion: tight, dark */
}

.elevation-large {
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

The first shadow is the ambient/general depth. The second is the contact/occlusion shadow near the bottom edge. Together they look like a real object on a surface; one alone looks like a CSS shadow.

This is exactly what Tailwind's `shadow-md`, `shadow-lg`, `shadow-xl` provide out of the box. The lesson: don't write single-shadow boxes.

### Button hierarchy table - the canonical pattern

| Action type | Visual treatment | When to use |
|---|---|---|
| Primary (only one per surface) | Solid colored background, white text | The single most important action on the page |
| Secondary | Outline (1-2px border) with colored text, transparent background | Alternative actions that aren't the main one |
| Tertiary | Link style (text-only, underline on hover) | Helper actions, "Learn more", "Cancel" |
| Destructive (when secondary) | Tertiary or outline style with red text | "Delete" when it's NOT the primary action |
| Destructive (when primary in modal) | Solid red background, white text | "Delete" in the confirmation modal where it IS primary |

The rule that catches people: destructive doesn't mean "always red and prominent." It means "match the danger to the position in the hierarchy."

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

1. **The HSL color curve with saturation falloff and hue rotation.** Sidecoach color domain has no codified "as you lighten or darken, you must boost saturation" rule.

2. **The Two-Part Shadow recipe** (ambient + occlusion). Specific CSS pattern that's the difference between "looks like CSS" and "looks like a real object."

3. **The "5 elevations" system** (Small / Medium / Large / Modal / Floating). A specific tier count.

4. **The "de-emphasize to emphasize" principle.** Counterintuitive workflow: weaken competitors rather than amplify the target.

5. **The button hierarchy table with destructive-action nuance** (red only when destructive is the primary action).

6. **The "Label: Value" combination rule** ("12 left in stock" instead of "In Stock: 12"). A specific copywriting pattern.

7. **The spacing scale 25% rule** with the worked exponential scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128).

8. **The "Sidebars are fixed-width, content flexes" responsive rule.** Counters the default "everything is percentage-based" approach.

9. **The "Shrink the canvas" rule** - don't fill 1400px just because you have it.

10. **The icon-weight balancing rule** (icons are visually heavy, so give them softer color when paired with text).

11. **The hairline border thickening rule** (don't darken a 1px border to make it visible, INCREASE the width to 2px instead).

12. **The "Supercharge Defaults" finishing touches** (custom bullets, accent 4px top borders, branded empty states).

13. **The text-on-image triad** (overlay / lower contrast / colorize multiply). Three specific recipes.

14. **The "5+ weights = quality font" criterion.** A specific font-selection heuristic.

15. **The right-align numerical columns rule** + the "baseline-align mixed-size text" rule. Specific typography micro-rules.
